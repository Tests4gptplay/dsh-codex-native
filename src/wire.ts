/** Newline-delimited JSON-RPC transport with an optional explicit byte budget. */

import { diagnosticText } from './diagnostic.ts'
import { once } from 'node:events'
import type { Readable, Writable } from 'node:stream'
import { LlmError } from '@deepseek-ai/dsh-llm'

/** Lossless JSON value accepted by the App Server protocol. */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

/** Decoded JSON object at the App Server boundary. */
export interface JsonObject {
  readonly [key: string]: unknown
}

/** Request identifier accepted by JSON-RPC. */
export type JsonRpcId = number | string

/** One decoded App Server event retained at the provider boundary. */
export type CodexAppServerEvent =
  | {
      readonly kind: 'thread-started'
      readonly threadId: string
      readonly userAgent: string
      readonly instructionSources: readonly JsonValue[]
    }
  | {
      readonly kind: 'notification'
      readonly method: string
      readonly params: JsonObject
    }
  | {
      readonly kind: 'server-request'
      readonly id: JsonRpcId
      readonly method: string
      readonly params: JsonObject
      readonly resolution: 'answered' | 'declined' | 'rejected'
      readonly resolutionMessage?: string
    }

interface PendingRequest {
  readonly method: string
  readonly waiter: ReturnType<typeof Promise.withResolvers<unknown>>
}

interface QueuedWaiter<T> {
  readonly resolve: (result: IteratorResult<T>) => void
  readonly reject: (error: unknown) => void
}

class AsyncQueue<T> {
  private readonly values: T[] = []
  private readonly waiters: QueuedWaiter<T>[] = []
  private closed = false
  private failure: Error | undefined

  push(value: T): void {
    if (this.closed) return
    const waiter = this.waiters.shift()
    if (waiter === undefined) this.values.push(value)
    else waiter.resolve({ done: false, value })
  }

  close(failure?: Error): void {
    if (this.closed) return
    this.closed = true
    this.failure = failure
    for (const waiter of this.waiters.splice(0)) {
      if (failure === undefined) waiter.resolve({ done: true, value: undefined })
      else waiter.reject(failure)
    }
  }

  next(): Promise<IteratorResult<T>> {
    const value = this.values.shift()
    if (value !== undefined) return Promise.resolve({ done: false, value })
    if (this.failure !== undefined) return Promise.reject(this.failure)
    if (this.closed) return Promise.resolve({ done: true, value: undefined })
    const waiter = Promise.withResolvers<IteratorResult<T>>()
    this.waiters.push(waiter)
    return waiter.promise
  }
}

/** Require a decoded value to be a JSON object. */
export function object(value: unknown, label: string): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new LlmError(`Codex App Server returned invalid ${label}`, 'MALFORMED_RESPONSE')
  }
  return value as JsonObject
}

/** Copy and validate one decoded lossless JSON value. */
export function jsonValue(value: unknown, label: string): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (Array.isArray(value)) return value.map((entry, index) => jsonValue(entry, `${label}[${index}]`))
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, jsonValue(entry, `${label}.${key}`)]))
  }
  throw new LlmError(`Codex App Server returned non-JSON ${label}`, 'MALFORMED_RESPONSE')
}

function rpcId(value: unknown): JsonRpcId | undefined {
  return typeof value === 'string' || typeof value === 'number' ? value : undefined
}

function rpcKey(id: JsonRpcId): string {
  return `${typeof id}:${String(id)}`
}

function thrown(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value))
}

/** One connected App Server JSON-RPC peer. */
export class JsonRpcConnection {
  private readonly pending = new Map<string, PendingRequest>()
  private readonly serverRequests = new Map<string, { params: JsonObject; controller: AbortController }>()
  private readonly events = new AsyncQueue<CodexAppServerEvent>()
  private nextId = 1
  private fragments: string[] = []
  private bufferedBytes = 0
  private stopped = false
  private failure: Error | undefined
  private readonly stopSignal = new AbortController()

  /**
   * @param input - writable App Server stdin.
   * @param output - readable App Server stdout.
   * @param maxJsonRpcLineBytes - opt-in maximum UTF-8 bytes per frame; 0 disables it.
   */
  constructor(
    private readonly input: Writable,
    private readonly output: Readable,
    private readonly maxJsonRpcLineBytes: number,
  ) {
    output.setEncoding('utf8')
    output.on('data', this.onData)
    output.once('end', this.onEnd)
    output.once('close', this.onEnd)
    input.once('close', this.onEnd)
    output.once('error', this.onError)
    input.once('error', this.onError)
  }

  /** Cancels pending native interactions when the protocol connection closes. */
  get signal(): AbortSignal {
    return this.stopSignal.signal
  }

  /** Observed pipe state only; no heartbeat, polling, or model request. */
  get closed(): boolean {
    return this.stopped || this.output.readableEnded || this.output.destroyed
      || this.input.destroyed || this.input.writableEnded
  }

  private limitExceeded(bytes: number): boolean {
    if (this.maxJsonRpcLineBytes === 0 || bytes <= this.maxJsonRpcLineBytes) return false
    this.fail(new LlmError('Codex App Server JSON-RPC line exceeded its configured limit', 'OUTPUT_LIMIT'))
    return true
  }

  private readonly onData = (chunk: string): void => {
    if (this.stopped) return
    let offset = 0
    while (offset < chunk.length) {
      const newline = chunk.indexOf('\n', offset)
      const part = chunk.slice(offset, newline === -1 ? undefined : newline)
      if (part.length > 0) {
        this.fragments.push(part)
        this.bufferedBytes += Buffer.byteLength(part)
      }
      if (newline === -1) {
        this.limitExceeded(this.bufferedBytes - (part.endsWith('\r') ? 1 : 0))
        return
      }
      // Each incoming chunk is scanned/counts bytes once. Join only a completed
      // frame, rather than repeatedly copying/scanning the entire partial line.
      const joined = this.fragments.join('')
      const carriageReturn = joined.endsWith('\r')
      const line = carriageReturn ? joined.slice(0, -1) : joined
      const bytes = this.bufferedBytes - (carriageReturn ? 1 : 0)
      this.fragments = []
      this.bufferedBytes = 0
      offset = newline + 1
      if (line.trim().length === 0) continue
      if (this.limitExceeded(bytes)) return
      try {
        this.receive(JSON.parse(line))
      } catch (error: unknown) {
        this.fail(error instanceof LlmError
          ? error
          : new LlmError('Codex App Server emitted malformed JSON-RPC', 'MALFORMED_RESPONSE', {
              cause: thrown(error),
            }))
        return
      }
    }
  }

  private readonly onEnd = (): void => {
    if (this.stopped) return
    if (this.fragments.join('').trim().length !== 0) {
      this.fail(new LlmError('Codex App Server stdout ended with an incomplete JSON-RPC line', 'MALFORMED_RESPONSE'))
      return
    }
    this.fail(new LlmError('Codex App Server closed its protocol stream', 'TRANSPORT'))
  }

  private readonly onError = (error: Error): void => {
    this.fail(new LlmError('Codex App Server protocol stream failed', 'TRANSPORT', { cause: error }))
  }

  private receive(value: unknown): void {
    const envelope = object(value, 'JSON-RPC envelope')
    const id = rpcId(envelope.id)
    if (typeof envelope.method === 'string') {
      const params = object(envelope.params ?? {}, `${envelope.method} params`)
      if (id === undefined) {
        // This runs on receipt, while a Host answerer may block next(). Native
        // withdrawal/turn completion must dismiss that prompt immediately.
        if (envelope.method === 'serverRequest/resolved') {
          const requestId = rpcId(params.requestId)
          const pending = requestId === undefined ? undefined : this.serverRequests.get(rpcKey(requestId))
          if (pending !== undefined && pending.params.threadId === params.threadId) {
            pending.controller.abort(new LlmError('Native request was resolved or withdrawn', 'ABORTED'))
          }
        } else if (envelope.method === 'turn/completed') {
          const turn = object(params.turn, 'turn/completed turn')
          for (const pending of this.serverRequests.values()) {
            if (pending.params.threadId === params.threadId && pending.params.turnId === turn.id) {
              pending.controller.abort(new LlmError('Native approval turn ended', 'ABORTED'))
            }
          }
        }
        this.events.push({ kind: 'notification', method: envelope.method, params })
      } else {
        this.serverRequests.set(rpcKey(id), { params, controller: new AbortController() })
        this.events.push({
          kind: 'server-request',
          id,
          method: envelope.method,
          params,
          resolution: 'rejected',
        })
      }
      return
    }
    if (id === undefined) throw new LlmError('Codex App Server response has no id', 'MALFORMED_RESPONSE')
    const pending = this.pending.get(rpcKey(id))
    if (pending === undefined) throw new LlmError('Codex App Server returned an unknown response id', 'MALFORMED_RESPONSE')
    this.pending.delete(rpcKey(id))
    if (envelope.error !== undefined) {
      pending.waiter.reject(new LlmError(
        `Codex App Server ${pending.method} failed: ${diagnosticText(JSON.stringify(envelope.error))}`,
        'CODEX_PROTOCOL',
      ))
    } else {
      pending.waiter.resolve(envelope.result)
    }
  }

  private async send(envelope: JsonObject): Promise<void> {
    if (this.closed) throw this.failure ?? new LlmError('Codex App Server connection is closed', 'TRANSPORT')
    const line = `${JSON.stringify(envelope)}\n`
    if (this.input.write(line)) return
    try {
      await once(this.input, 'drain', { signal: this.stopSignal.signal })
    } catch (error: unknown) {
      throw this.failure ?? error
    }
  }

  /** Send one client request and resolve its correlated response. */
  async request(method: string, params: JsonObject): Promise<unknown> {
    const id = this.nextId++
    const waiter = Promise.withResolvers<unknown>()
    this.pending.set(rpcKey(id), { method, waiter })
    // Adopt the response immediately: a pipe failure can reject it while a
    // backpressured write is still waiting for drain.
    void this.send({ method, id, params }).catch((error: unknown) => {
      this.pending.delete(rpcKey(id))
      waiter.reject(error)
    })
    return waiter.promise
  }

  /** Send one client notification. */
  notify(method: string, params: JsonObject): Promise<void> {
    return this.send({ method, params })
  }

  /** Resolve one App Server request. */
  async respond(id: JsonRpcId, result: JsonValue): Promise<void> {
    this.serverRequests.get(rpcKey(id))?.controller.signal.throwIfAborted()
    try { await this.send({ id, result }) } finally { this.forgetServerRequest(id) }
  }

  /** Reject one App Server request. */
  async respondError(id: JsonRpcId, code: number, message: string): Promise<void> {
    this.serverRequests.get(rpcKey(id))?.controller.signal.throwIfAborted()
    try { await this.send({ id, error: { code, message } }) } finally { this.forgetServerRequest(id) }
  }

  /** Cancellation for an actually received native RPC, including queued withdrawals. */
  serverRequestSignal(id: JsonRpcId): AbortSignal {
    return this.serverRequests.get(rpcKey(id))?.controller.signal
      ?? AbortSignal.abort(new LlmError('Native request is no longer pending', 'ABORTED'))
  }

  /** Release a consumed request, whether answered or already withdrawn. */
  forgetServerRequest(id: JsonRpcId): void {
    // Completion/cleanup is not a native withdrawal. In particular, a failed
    // response write must propagate rather than look like an upstream cancel.
    this.serverRequests.delete(rpcKey(id))
  }

  /** Read the next notification or server request. */
  next(): Promise<IteratorResult<CodexAppServerEvent>> {
    return this.events.next()
  }

  /** Fail every waiter and detach the stream listeners. */
  fail(error: Error): void {
    if (this.stopped) return
    this.stopped = true
    this.failure = error
    this.stopSignal.abort(error)
    this.detach()
    for (const pending of this.pending.values()) pending.waiter.reject(error)
    this.pending.clear()
    this.events.close(error)
  }

  /** Close every waiter without manufacturing a transport failure. */
  dispose(): void {
    if (this.stopped) return
    this.stopped = true
    const error = new LlmError('Codex App Server connection disposed', 'ABORTED')
    this.failure = error
    this.stopSignal.abort(error)
    this.detach()
    for (const pending of this.pending.values()) pending.waiter.reject(error)
    this.pending.clear()
    this.events.close()
  }

  private detach(): void {
    this.fragments = []
    this.bufferedBytes = 0
    for (const pending of this.serverRequests.values()) pending.controller.abort(this.failure)
    this.serverRequests.clear()
    this.output.off('data', this.onData)
    this.output.off('end', this.onEnd)
    this.output.off('close', this.onEnd)
    this.input.off('close', this.onEnd)
    // Keep the once-only error handlers through stream teardown. Late EPIPE
    // must not become an unhandled EventEmitter error in the DSH host.
  }
}

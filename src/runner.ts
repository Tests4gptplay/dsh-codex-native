/** Disposable App Server process and thread lifecycle. */

import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { chmod, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { LlmError } from '@deepseek-ai/dsh-llm'
import type {
  SubprocessHandle,
  SubprocessOutcome,
  SubprocessSpawnSpec,
} from '@deepseek-ai/dsh-subprocess'
import { SAFE_MODEL_ID } from './identifiers.ts'
import {
  ManagedCodexThread,
  operationFailure,
  validateTurnRequest,
} from './thread.ts'
import { JsonRpcConnection, jsonValue, object } from './wire.ts'
import type {
  CodexAppServerEvent,
  JsonValue,
} from './wire.ts'

export type { CodexAppServerEvent, JsonValue } from './wire.ts'

export const CODEX_APP_SERVER_VERSION = '0.154.0'

const WORKDIR_PREFIX = 'dsh-codex-app-server-'
const TIMEOUT_REASON = Symbol('codex-app-server-timeout')
const CONSUMER_REASON = Symbol('codex-app-server-consumer-stop')

/** Complete input for one stateless App Server turn. */
export interface CodexAppServerRequest {
  readonly model: string
  readonly modelProvider: string
  readonly reasoningEffort?: string
  readonly system: string
  readonly history: readonly JsonValue[]
  readonly dynamicTools: readonly JsonValue[]
  /** Native Codex web-search policy for this process. */
  readonly webSearch?: CodexWebSearchMode
  /** Whether the pinned native image-generation feature is offered to this turn. */
  readonly imageGenerationEnabled?: boolean
  readonly signal?: AbortSignal
}

/** Thread-level values fixed for one disposable App Server process. */
export interface CodexAppServerThreadRequest {
  readonly model: string
  readonly modelProvider: string
  readonly system: string
  readonly dynamicTools: readonly JsonValue[]
  /** Native Codex web-search policy for this process. */
  readonly webSearch?: CodexWebSearchMode
  /** Whether the pinned native image-generation feature is offered to this thread. */
  readonly imageGenerationEnabled?: boolean
  readonly signal?: AbortSignal
}

/** Top-level Codex web-search policy passed to the pinned App Server. */
export type CodexWebSearchMode = 'disabled' | 'live'

/** Durable Harness result used to match one pending App Server callback exactly. */
export interface CodexAppServerToolResult {
  readonly callId: string
  readonly output: JsonValue
  readonly success: boolean
}

/** Transport-ready result that resolves one pending App Server dynamic-tool callback. */
export interface CodexAppServerHydratedToolResult {
  readonly callId: string
  readonly contentItems: readonly JsonValue[]
  readonly success: boolean
}

/** One Harness model step on an open App Server thread. */
export interface CodexAppServerTurnRequest {
  readonly reasoningEffort?: string
  readonly injectedItems?: readonly JsonValue[]
  readonly input?: readonly JsonValue[]
  /** Additional user messages steered into the active turn in order. */
  readonly steeringInputs?: readonly (readonly JsonValue[])[]
  readonly toolResult?: CodexAppServerHydratedToolResult
  readonly signal?: AbortSignal
}

/** One process-owned ephemeral thread that may span consecutive Harness steps. */
export interface CodexAppServerThreadPort {
  readonly threadId: string
  stream(request: CodexAppServerTurnRequest): AsyncIterable<CodexAppServerEvent>
  dispose(): Promise<void>
}

/** Deployment values for one App Server process. */
export interface CodexAppServerRunnerOptions {
  readonly timeoutMs: number
  readonly disposeGraceMs: number
  readonly maxJsonRpcLineBytes: number
  readonly maxStderrBytes: number
  readonly env: Readonly<Record<string, string>>
  readonly spawn: (spec: SubprocessSpawnSpec) => SubprocessHandle
}

/** Testable streaming process contract used by the adapter. */
export interface CodexAppServerRunnerPort {
  open(request: CodexAppServerThreadRequest): Promise<CodexAppServerThreadPort>
  stream(request: CodexAppServerRequest): AsyncIterable<CodexAppServerEvent>
}

/** Resolve the pinned official CLI's JavaScript entry without a shell lookup. */
export function codexCliEntry(): string {
  const require = createRequire(import.meta.url)
  return join(dirname(require.resolve('@openai/codex/package.json')), 'bin', 'codex.js')
}

/** Let the official Codex configuration select its own features and permissions.
 * Only explicitly requested per-operation capabilities override the user policy.
 */
export function codexAppServerArgv(
  webSearch?: CodexWebSearchMode,
  imageGenerationEnabled = true,
): string[] {
  return [
    process.execPath,
    codexCliEntry(),
    'app-server',
    '--stdio',
    ...(webSearch === undefined ? [] : ['-c', `web_search="${webSearch}"`]),
    ...(imageGenerationEnabled ? [] : ['--disable', 'image_generation']),
  ]
}

async function privateWorkdir(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), WORKDIR_PREFIX))
  try {
    await chmod(path, 0o700)
    return path
  } catch (error: unknown) {
    try {
      await rm(path, { recursive: true, force: true })
    } catch (cleanup: unknown) {
      throw new AggregateError([error, cleanup], 'Codex App Server private directory setup and cleanup failed')
    }
    throw error
  }
}

async function removePrivateWorkdir(path: string): Promise<void> {
  const base = resolve(tmpdir())
  if (resolve(dirname(path)) !== base || !path.slice(base.length + 1).startsWith(WORKDIR_PREFIX)) {
    throw new Error('refusing to remove an unexpected Codex App Server directory')
  }
  await rm(path, { recursive: true, force: true })
}

function readStderr(child: SubprocessHandle): string {
  const reader = child.collected.stderr
  if (reader === undefined) return ''
  const read = reader.readFrom(0)
  return read.lossy ? `${read.text}\n[stderr capture exceeded its configured limit]` : read.text
}

function thrown(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value))
}

async function cleanupRun(
  child: SubprocessHandle | undefined,
  connection: JsonRpcConnection | undefined,
  workdir: string,
  graceMs: number,
): Promise<Error[]> {
  const failures: Error[] = []
  connection?.dispose()
  if (child !== undefined) {
    try {
      child.stdin?.end()
      child.terminate()
    } catch (error: unknown) {
      failures.push(thrown(error))
    }
    try {
      const waitMs = Math.min(2_147_483_647, Math.max(1, graceMs * 2))
      if (!await child.waitForExit(AbortSignal.timeout(waitMs))) {
        failures.push(new Error('Codex App Server process tree did not reach quiescence'))
      }
    } catch (error: unknown) {
      failures.push(thrown(error))
    }
    await child.done.catch(() => {
      // Exit and wait failures are already reported by the connection or the checks above.
    })
  }
  try {
    await removePrivateWorkdir(workdir)
  } catch (error: unknown) {
    failures.push(thrown(error))
  }
  return failures
}

function cleanupError(primary: LlmError | undefined, failures: readonly Error[]): LlmError | undefined {
  if (failures.length === 0) return primary
  const detail = failures.map(failure => failure.message).join('; ')
  if (primary === undefined) {
    return new LlmError(`Codex App Server cleanup failed: ${detail}`, 'TRANSPORT', {
      cause: new AggregateError(failures, 'Codex App Server cleanup failed'),
    })
  }
  return new LlmError(`${primary.message}; cleanup also failed: ${detail}`, primary.code, {
    cause: new AggregateError([primary, ...failures], 'Codex App Server request and cleanup failed'),
  })
}

function validateThreadRequest(request: CodexAppServerThreadRequest): void {
  if (!SAFE_MODEL_ID.test(request.model)) {
    throw new LlmError(`Codex model is not a safe identifier: ${JSON.stringify(request.model)}`, 'INVALID_MODEL')
  }
  if (!SAFE_MODEL_ID.test(request.modelProvider)) {
    throw new LlmError(
      `Codex model provider is not a safe identifier: ${JSON.stringify(request.modelProvider)}`,
      'INVALID_PROVIDER',
    )
  }
}

function validateRequest(request: CodexAppServerRequest): void {
  validateThreadRequest(request)
  validateTurnRequest(request)
}

function threadId(value: unknown, label: string): string {
  const candidate = object(value, label)
  if (typeof candidate.id !== 'string' || candidate.id.length === 0) {
    throw new LlmError(`Codex App Server returned invalid ${label}.id`, 'MALFORMED_RESPONSE')
  }
  return candidate.id
}

function instructionSources(value: unknown): JsonValue[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    throw new LlmError('Codex App Server returned invalid instructionSources', 'MALFORMED_RESPONSE')
  }
  return value.map((source, index) => jsonValue(source, `instructionSources[${index}]`))
}

/** App Server process factory; open threads remain alive until their owner disposes them. */
export class CodexAppServerRunner implements CodexAppServerRunnerPort {
  constructor(private readonly options: CodexAppServerRunnerOptions) {}

  async open(request: CodexAppServerThreadRequest): Promise<CodexAppServerThreadPort> {
    validateThreadRequest(request)
    let workdir: string
    try {
      workdir = await privateWorkdir()
    } catch (error: unknown) {
      throw new LlmError('Codex App Server private directory setup failed', 'TRANSPORT', { cause: thrown(error) })
    }
    const lifetime = new AbortController()
    let timedOut = false
    const timeout = this.options.timeoutMs > 0 ? setTimeout(() => {
      timedOut = true
      connection?.fail(operationFailure(TIMEOUT_REASON, true, request.signal))
      if (!lifetime.signal.aborted) lifetime.abort(TIMEOUT_REASON)
    }, this.options.timeoutMs) : undefined
    let child: SubprocessHandle | undefined
    let connection: JsonRpcConnection | undefined
    const onAbort = (): void => {
      connection?.fail(operationFailure(request.signal?.reason, false, request.signal))
      if (!lifetime.signal.aborted) lifetime.abort(request.signal?.reason)
    }
    request.signal?.addEventListener('abort', onAbort, { once: true })
    try {
      if (request.signal?.aborted) throw request.signal.reason
      child = this.options.spawn({
        argv: codexAppServerArgv(request.webSearch, request.imageGenerationEnabled),
        cwd: workdir,
        stdio: {
          stdin: 'pipe',
          stdout: 'pipe',
          stderr: { maxBytes: this.options.maxStderrBytes },
        },
        graceMs: this.options.disposeGraceMs,
        signal: lifetime.signal,
        env: { ...this.options.env },
      })
      if (child.stdin === undefined || child.stdout === undefined) {
        throw new LlmError('Codex App Server subprocess did not expose protocol pipes', 'TRANSPORT')
      }
      connection = new JsonRpcConnection(child.stdin, child.stdout, this.options.maxJsonRpcLineBytes)
      const activeConnection = connection
      void child.done.then((outcome: SubprocessOutcome) => {
        const stderr = readStderr(child!)
        const detail = stderr.trim().length === 0 ? '' : `: ${stderr.trim()}`
        activeConnection.fail(new LlmError(
          `Codex App Server exited with ${String(outcome.exitCode)}/${String(outcome.signal)}${detail}`,
          'TRANSPORT',
        ))
      }, (error: unknown) => {
        activeConnection.fail(new LlmError('Codex App Server process failed to start', 'TRANSPORT', {
          cause: thrown(error),
        }))
      })
      const initialized = object(await activeConnection.request('initialize', {
        clientInfo: {
          name: 'deepseek-harness',
          title: 'DeepSeek Harness',
          version: '0.1.19',
        },
        capabilities: {
          experimentalApi: true,
          requestAttestation: false,
        },
      }), 'initialize result')

      await activeConnection.notify('initialized', {})
      const started = object(await activeConnection.request('thread/start', {
        model: request.model,
        modelProvider: request.modelProvider,
        cwd: workdir,
        baseInstructions: request.system,
        developerInstructions: '',
        personality: 'none',
        multiAgentMode: null,
        ephemeral: true,
        historyMode: 'legacy',
        environments: [],
        runtimeWorkspaceRoots: [],
        selectedCapabilityRoots: [],
        dynamicTools: request.dynamicTools,
        experimentalRawEvents: true,
        serviceName: 'deepseek-harness',
      }), 'thread/start result')
      const id = threadId(started.thread, 'thread/start thread')
      let disposeTask: Promise<void> | undefined
      const dispose = (): Promise<void> => {
        if (disposeTask !== undefined) return disposeTask
        if (!lifetime.signal.aborted) lifetime.abort(CONSUMER_REASON)
        disposeTask = (async (): Promise<void> => {
          const failure = cleanupError(
            undefined,
            await cleanupRun(child, activeConnection, workdir, this.options.disposeGraceMs),
          )
          if (failure !== undefined) throw failure
        })()
        return disposeTask
      }
      return new ManagedCodexThread({
        timeoutMs: this.options.timeoutMs,
        connection: activeConnection,
        threadId: id,
        abort: (reason: unknown): void => {
          if (!lifetime.signal.aborted) lifetime.abort(reason)
        },
        dispose,
        startedEvent: {
          kind: 'thread-started',
          threadId: id,
          userAgent: typeof initialized.userAgent === 'string' ? initialized.userAgent : '',
          instructionSources: instructionSources(started.instructionSources),
        },
      })
    } catch (error: unknown) {
      let failure = operationFailure(error, timedOut, request.signal)
      if (!lifetime.signal.aborted) lifetime.abort(CONSUMER_REASON)
      failure = cleanupError(
        failure,
        await cleanupRun(child, connection, workdir, this.options.disposeGraceMs),
      )!
      throw failure
    } finally {
      if (timeout !== undefined) clearTimeout(timeout)
      request.signal?.removeEventListener('abort', onAbort)
    }
  }

  async * stream(request: CodexAppServerRequest): AsyncIterable<CodexAppServerEvent> {
    validateRequest(request)
    const thread = await this.open(request)
    try {
      yield* thread.stream({
        ...(request.reasoningEffort === undefined ? {} : { reasoningEffort: request.reasoningEffort }),
        injectedItems: request.history,
        input: [],
        ...(request.signal === undefined ? {} : { signal: request.signal }),
      })
    } finally {
      await thread.dispose()
    }
  }
}

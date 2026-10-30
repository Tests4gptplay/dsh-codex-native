/** Native Codex account bridge. OAuth credentials remain owned by official Codex. */
import { homedir } from 'node:os'
import { abortable } from './abort.ts'
import { diagnosticText } from './process-connection.ts'
import type { SubprocessHandle, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import { codexCliEntry } from './runner.ts'
import { JsonRpcConnection, object } from './wire.ts'
import { connectCodexProcess } from './process-connection.ts'
import { queryUsage } from './usage-query.ts'
import type { UsageSnapshot } from './usage.ts'
import type { CodexModel } from './adapter.ts'

type LoginMode = 'browser' | 'device'
export type LoginPhase = 'pending' | 'authenticated' | 'failed' | 'cancelled'
export interface LoginFlow {
  id: string
  phase: LoginPhase
  mode: LoginMode
  authUrl?: string
  verificationUrl?: string
  userCode?: string
  error?: string
}
interface RunningCodex {
  child: SubprocessHandle
  rpc: JsonRpcConnection
  close(): Promise<void>
  failure(error: unknown): Error
  releaseRequest(): void
}
type Spawn = (spec: SubprocessSpawnSpec) => SubprocessHandle | Promise<SubprocessHandle>

interface AccountOptions {
  env?: Readonly<Record<string, string>>
  disposeGraceMs?: number
  maxStderrBytes?: number
  maxJsonRpcLineBytes?: number
}

export class NativeCodexAccount {
  private active: RunningCodex | undefined
  private readonly connections = new Set<RunningCodex>()
  private flow: LoginFlow | undefined
  private disposed = false
  private readonly lifetime = new AbortController()
  private loginAttempt: AbortController | undefined
  constructor(private readonly spawn: Spawn, private readonly options: AccountOptions = {}) {}

  private async open(caller?: AbortSignal): Promise<RunningCodex> {
    if (this.disposed) throw new Error('Native Codex account service is disposed')
    const signal = caller === undefined ? this.lifetime.signal : AbortSignal.any([caller, this.lifetime.signal])
    signal.throwIfAborted()
    const childLifetime = new AbortController()
    let closeConnection: (() => Promise<void>) | undefined
    const abort = (): void => {
      childLifetime.abort(signal.reason)
      void closeConnection?.()
    }
    signal.addEventListener('abort', abort, { once: true })
    const releaseRequest = (): void => signal.removeEventListener('abort', abort)
    const graceMs = this.options.disposeGraceMs ?? 3_000
    let child: SubprocessHandle
    try {
      const pending = Promise.resolve(this.spawn({
        argv: [process.execPath, codexCliEntry(), 'app-server', '--stdio'],
        cwd: homedir(),
        stdio: { stdin: 'pipe', stdout: 'pipe', stderr: { maxBytes: this.options.maxStderrBytes ?? 64 * 1024 } },
        env: { ...this.options.env }, graceMs, signal: childLifetime.signal,
      })).then(value => {
        // An injected provider may settle after cancellation; never leave that child unowned.
        if (childLifetime.signal.aborted) value.terminate()
        return value
      })
      child = await abortable(pending, signal)
      signal.throwIfAborted()
    } catch (error) {
      releaseRequest()
      throw error
    }
    if (!child.stdin || !child.stdout) {
      releaseRequest(); child.terminate()
      throw new Error('Codex app-server did not provide stdio')
    }
    const diagnostics = connectCodexProcess(child, this.options.maxJsonRpcLineBytes ?? 0)
    const rpc = diagnostics.rpc
    let closeTask: Promise<void> | undefined
    const close = (): Promise<void> => {
      closeTask ??= (async () => {
        releaseRequest()
        try {
          rpc.dispose()
          diagnostics.markCleanup()
          child.terminate()
          const waitMs = Math.min(2_147_483_647, Math.max(1, graceMs * 2))
          await child.waitForExit(AbortSignal.timeout(waitMs)).catch(() => {})
        } finally { this.connections.delete(conn) }
      })()
      return closeTask
    }
    const conn: RunningCodex = { child, rpc, close, failure: diagnostics.failure, releaseRequest }
    this.connections.add(conn)
    closeConnection = close
    try {
      signal.throwIfAborted()
      await rpc.request('initialize', {
        clientInfo: { name: 'dsh_codex_native', title: 'DSH Codex Native', version: '0.2.1' },
      })
      await rpc.notify('initialized', {})
      signal.throwIfAborted()
      return conn
    } catch (error: unknown) {
      await close()
      signal.throwIfAborted()
      throw diagnostics.failure(error)
    }
  }
  private async withConnection<T>(fn: (rpc: JsonRpcConnection) => Promise<T>, signal?: AbortSignal): Promise<T> {
    const combined = signal === undefined ? this.lifetime.signal : AbortSignal.any([signal, this.lifetime.signal])
    const conn = await this.open(combined)
    try { return await abortable(fn(conn.rpc), combined) }
    catch (error: unknown) {
      await conn.close()
      combined.throwIfAborted()
      throw conn.failure(error)
    }
    finally { await conn.close() }
  }
  async status(signal?: AbortSignal): Promise<{ authenticated: boolean; email?: string; planType?: string }> {
    const data = object(await this.withConnection(rpc => rpc.request('account/read', { refreshToken: false }), signal), 'account/read')
    const account = data.account === null || data.account === undefined ? null : object(data.account, 'account')
    if (!account || account.type !== 'chatgpt') return { authenticated: false }
    return {
      authenticated: true,
      ...(typeof account.email === 'string' ? { email: account.email } : {}),
      ...(typeof account.planType === 'string' ? { planType: account.planType } : {}),
    }
  }
  /** Refresh the models available to the signed-in account when DSH requests its picker catalog. */
  async models(signal?: AbortSignal): Promise<CodexModel[]> {
    return this.withConnection(async rpc => {
      const models: CodexModel[] = []
      let cursor: string | null = null
      const seenCursors = new Set<string>()
      do {
        const page = object(await rpc.request('model/list', { cursor, limit: 100, includeHidden: false }), 'model/list')
        if (!Array.isArray(page.data)) throw new Error('Codex model/list returned no model array')
        for (const entry of page.data) {
          const model = object(entry, 'model/list model')
          if (typeof model.id !== 'string' || !model.id) continue
          const modalities: Array<'text' | 'image'> = Array.isArray(model.inputModalities)
            ? model.inputModalities.filter((value): value is 'text' | 'image' => value === 'text' || value === 'image')
            : ['text', 'image']
          if (modalities.length === 0) continue
          const efforts: string[] = Array.isArray(model.supportedReasoningEfforts)
            ? model.supportedReasoningEfforts.map(value => object(value, 'model reasoning').reasoningEffort)
              .filter((value): value is string => typeof value === 'string')
            : []
          models.push({
            id: model.id,
            name: typeof model.displayName === 'string' ? model.displayName : model.id,
            ...(typeof model.description === 'string' ? { description: model.description } : {}),
            inputModalities: modalities,
            reasoningEfforts: efforts,
            ...(typeof model.defaultReasoningEffort === 'string'
              && efforts.includes(model.defaultReasoningEffort)
              ? { defaultReasoningEffort: model.defaultReasoningEffort } : {}),
          })
        }
        cursor = typeof page.nextCursor === 'string' && page.nextCursor ? page.nextCursor : null
        if (cursor !== null) {
          if (seenCursors.has(cursor)) throw new Error('Codex model/list repeated a pagination cursor')
          seenCursors.add(cursor)
        }
      } while (cursor !== null)
      return models
    }, signal)
  }
  async quota(signal?: AbortSignal): Promise<unknown> {
    const data = object(await this.withConnection(rpc => rpc.request('account/rateLimits/read', {}), signal), 'account/rateLimits/read')
    return data.rateLimits ?? null
  }
  /** Manual, read-only account-wide history. No token accumulation hook or background loop. */
  async usage(signal?: AbortSignal): Promise<UsageSnapshot> {
    return this.withConnection(rpc => queryUsage(method => rpc.request(method, {})), signal)
  }
  async start(mode: LoginMode, caller?: AbortSignal): Promise<LoginFlow> {
    if (mode !== 'browser' && mode !== 'device') throw new Error('Unsupported login mode')
    caller?.throwIfAborted()
    const attempt = new AbortController()
    this.loginAttempt?.abort(new Error('Codex login attempt replaced'))
    this.loginAttempt = attempt
    this.flow = undefined
    const signal = caller === undefined ? attempt.signal : AbortSignal.any([attempt.signal, caller])
    const previous = this.active
    this.active = undefined
    await previous?.close()
    const conn = await this.open(signal)
    this.active = conn
    try {
      const reply = object(await conn.rpc.request('account/login/start',
        mode === 'browser'
          ? { type: 'chatgpt', useHostedLoginSuccessPage: true, appBrand: 'chatgpt' }
          : { type: 'chatgptDeviceCode' }), 'account/login/start')
      if (typeof reply.loginId !== 'string' || !reply.loginId) throw new Error('Codex login id missing')
      const info: LoginFlow = { id: reply.loginId, phase: 'pending', mode }
      if (mode === 'browser') {
        if (typeof reply.authUrl !== 'string') throw new Error('Codex browser authorization URL missing')
        info.authUrl = reply.authUrl
      } else {
        if (typeof reply.verificationUrl !== 'string' || typeof reply.userCode !== 'string') throw new Error('Codex device-code response incomplete')
        info.verificationUrl = reply.verificationUrl
        info.userCode = reply.userCode
      }
      signal.throwIfAborted()
      this.flow = info
      conn.releaseRequest()
      void this.observeLogin(conn, info.id)
      return { ...info }
    } catch (error: unknown) {
      if (this.active === conn) this.active = undefined
      await conn.close()
      signal.throwIfAborted()
      throw conn.failure(error)
    }
  }
  private async observeLogin(conn: RunningCodex, loginId: string): Promise<void> {
    try {
      while (!this.disposed && this.active === conn) {
        const event = await conn.rpc.next()
        if (event.done || this.active !== conn) break
        if (event.value.kind !== 'notification' || event.value.method !== 'account/login/completed') continue
        const params = event.value.params
        if (params.loginId !== loginId) continue
        this.flow = params.success === true
          ? { id: loginId, phase: 'authenticated', mode: this.flow?.mode ?? 'browser' }
          : { id: loginId, phase: 'failed', mode: this.flow?.mode ?? 'browser', error: typeof params.error === 'string' ? diagnosticText(params.error).slice(0, 180) : 'Codex login failed' }
        break
      }
    } catch (error: unknown) {
      await conn.close()
      if (this.active === conn) this.flow = { id: loginId, phase: 'failed', mode: this.flow?.mode ?? 'browser', error: conn.failure(error).message }
    } finally {
      if (this.active === conn) this.active = undefined
      await conn.close()
    }
  }
  loginStatus(id: string): LoginFlow {
    if (!this.flow || this.flow.id !== id) throw new Error('Unknown Codex login attempt')
    return { ...this.flow }
  }
  async cancel(id: string): Promise<LoginFlow> {
    if (!this.flow || this.flow.id !== id) throw new Error('Unknown Codex login attempt')
    this.loginAttempt?.abort(new Error('Codex login cancelled'))
    const conn = this.active
    const cancelled: LoginFlow = { id, phase: 'cancelled', mode: this.flow.mode }
    this.active = undefined
    this.flow = cancelled
    if (conn) {
      // Cancellation cannot depend on acknowledgement from a stalled peer.
      void conn.rpc.request('account/login/cancel', { loginId: id }).catch(() => {})
      await conn.close()
    }
    return { ...cancelled }
  }
  async logout(signal?: AbortSignal): Promise<{ authenticated: false }> {
    this.loginAttempt?.abort(new Error('Codex logout requested'))
    if (this.flow?.phase === 'pending') await this.cancel(this.flow.id)
    await this.withConnection(rpc => rpc.request('account/logout', {}).then(() => undefined), signal)
    return { authenticated: false }
  }
  async dispose(): Promise<void> {
    this.disposed = true
    this.lifetime.abort(new Error('Native Codex account service is disposed'))
    this.loginAttempt?.abort()
    this.active = undefined
    await Promise.all([...this.connections].map(conn => conn.close()))
  }
}

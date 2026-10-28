/** Native Codex account bridge. OAuth credentials remain owned by official Codex. */
import { homedir } from 'node:os'
import type { SubprocessHandle, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import { codexCliEntry } from './runner.ts'
import { JsonRpcConnection, object } from './wire.ts'
import { connectCodexProcess } from './process-connection.ts'
import type { CodexModel } from './adapter.ts'
import { queryUsage } from './usage-query.ts'
import type { UsageSnapshot } from './usage.ts'

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
}
type Spawn = (spec: SubprocessSpawnSpec) => SubprocessHandle

export class NativeCodexAccount {
  private active: RunningCodex | undefined
  private readonly connections = new Set<RunningCodex>()
  private flow: LoginFlow | undefined
  private disposed = false
  constructor(private readonly spawn: Spawn) {}

  private async open(): Promise<RunningCodex> {
    if (this.disposed) throw new Error('Native Codex account service is disposed')
    const child = this.spawn({
      argv: [process.execPath, codexCliEntry(), 'app-server', '--stdio'],
      cwd: homedir(),
      stdio: { stdin: 'pipe', stdout: 'pipe', stderr: { maxBytes: 64 * 1024 } },
      env: {}, graceMs: 3_000,
    })
    if (!child.stdin || !child.stdout) {
      child.terminate()
      throw new Error('Codex app-server did not provide stdio')
    }
    const diagnostics = connectCodexProcess(child, 8 * 1024 * 1024)
    const rpc = diagnostics.rpc
    let closeTask: Promise<void> | undefined
    const close = (): Promise<void> => {
      closeTask ??= (async () => {
        try {
          rpc.dispose()
          diagnostics.markCleanup()
          child.terminate()
          await child.waitForExit(AbortSignal.timeout(6_000)).catch(() => {})
        } finally { this.connections.delete(conn) }
      })()
      return closeTask
    }
    const conn: RunningCodex = { child, rpc, close, failure: diagnostics.failure }
    // Own every account process before initialize can suspend, including short queries.
    this.connections.add(conn)
    try {
      await rpc.request('initialize', {
        clientInfo: { name: 'dsh_codex_native', title: 'DSH Codex Native', version: '0.2.1' },
      })
      await rpc.notify('initialized', {})
      return conn
    } catch (error: unknown) {
      await close()
      throw diagnostics.failure(error)
    }
  }
  private async withConnection<T>(fn: (rpc: JsonRpcConnection) => Promise<T>): Promise<T> {
    const conn = await this.open()
    try { return await fn(conn.rpc) }
    catch (error: unknown) {
      await conn.close()
      throw conn.failure(error)
    }
    finally { await conn.close() }
  }
  async status(): Promise<{ authenticated: boolean; email?: string; planType?: string }> {
    const data = object(await this.withConnection(rpc => rpc.request('account/read', { refreshToken: false })), 'account/read')
    const account = data.account === null || data.account === undefined ? null : object(data.account, 'account')
    if (!account || account.type !== 'chatgpt') return { authenticated: false }
    return {
      authenticated: true,
      ...(typeof account.email === 'string' ? { email: account.email } : {}),
      ...(typeof account.planType === 'string' ? { planType: account.planType } : {}),
    }
  }
  async quota(): Promise<unknown> {
    const data = object(await this.withConnection(rpc => rpc.request('account/rateLimits/read', {})), 'account/rateLimits/read')
    return data.rateLimits ?? null
  }
  /** Read the current official picker catalog when DSH asks for its model list. */
  async models(): Promise<readonly CodexModel[]> {
    return this.withConnection(async rpc => {
      const models: CodexModel[] = []
      const cursors = new Set<string>()
      let cursor: string | undefined
      for (;;) {
        const page = object(await rpc.request('model/list', {
          includeHidden: false,
          ...(cursor === undefined ? {} : { cursor }),
        }), 'model/list')
        if (!Array.isArray(page.data)) throw new Error('Codex model/list returned invalid data')
        for (const entry of page.data) {
          const model = object(entry, 'model/list model')
          if (model.hidden === true) continue
          const id = typeof model.model === 'string' ? model.model : model.id
          if (typeof id !== 'string' || id.length === 0) throw new Error('Codex model/list returned invalid model id')
          const inputModalities: Array<'text' | 'image'> = model.inputModalities === undefined
            ? ['text', 'image']
            : Array.isArray(model.inputModalities)
              ? model.inputModalities.filter((value): value is 'text' | 'image' => value === 'text' || value === 'image')
              : []
          if (inputModalities.length === 0) continue
          const reasoningEfforts = Array.isArray(model.supportedReasoningEfforts)
            ? model.supportedReasoningEfforts.map(value => object(value, 'model/list reasoning effort').reasoningEffort)
              .filter((value): value is string => typeof value === 'string' && value.length > 0)
            : []
          models.push({
            id,
            name: typeof model.displayName === 'string' ? model.displayName : id,
            ...(typeof model.description === 'string' ? { description: model.description } : {}),
            inputModalities,
            reasoningEfforts,
            ...(typeof model.defaultReasoningEffort === 'string'
              && reasoningEfforts.includes(model.defaultReasoningEffort)
              ? { defaultReasoningEffort: model.defaultReasoningEffort } : {}),
          })
        }
        if (page.nextCursor == null) break
        if (typeof page.nextCursor !== 'string' || !page.nextCursor || cursors.has(page.nextCursor)) {
          throw new Error('Codex model/list returned an invalid pagination cursor')
        }
        cursor = page.nextCursor
        cursors.add(cursor)
      }
      return models
    })
  }
  /** Manual, read-only account-wide history. No token accumulation hook or background loop. */
  async usage(): Promise<UsageSnapshot> {
    return this.withConnection(rpc => queryUsage(method => rpc.request(method, {})))
  }
  async start(mode: LoginMode): Promise<LoginFlow> {
    if (this.active) await this.active.close()
    this.active = undefined
    if (mode !== 'browser' && mode !== 'device') throw new Error('Unsupported login mode')
    const conn = await this.open()
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
      this.flow = info
      void this.observeLogin(conn, info.id)
      return { ...info }
    } catch (error: unknown) {
      if (this.active === conn) this.active = undefined
      await conn.close()
      throw conn.failure(error)
    }
  }
  private async observeLogin(conn: RunningCodex, loginId: string): Promise<void> {
    try {
      while (!this.disposed && this.active === conn) {
        const event = await conn.rpc.next()
        if (event.done) break
        if (event.value.kind !== 'notification' || event.value.method !== 'account/login/completed') continue
        const params = event.value.params
        if (params.loginId !== loginId) continue
        this.flow = params.success === true
          ? { id: loginId, phase: 'authenticated', mode: this.flow?.mode ?? 'browser' }
          : { id: loginId, phase: 'failed', mode: this.flow?.mode ?? 'browser', error: typeof params.error === 'string' ? params.error.slice(0, 180) : 'Codex login failed' }
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
  async logout(): Promise<{ authenticated: false }> {
    if (this.flow?.phase === 'pending') await this.cancel(this.flow.id)
    await this.withConnection(rpc => rpc.request('account/logout', {}).then(() => undefined))
    return { authenticated: false }
  }
  async dispose(): Promise<void> {
    this.disposed = true
    this.active = undefined
    await Promise.all([...this.connections].map(conn => conn.close()))
  }
}

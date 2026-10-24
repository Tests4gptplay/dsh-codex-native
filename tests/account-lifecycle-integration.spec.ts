import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import type { SubprocessHandle, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import { NativeCodexAccount } from '../src/native-account.ts'
import { CodexAppServerRunner } from '../src/runner.ts'
import { CodexSessionCache } from '../src/session-cache.ts'

const cleanups: Array<() => Promise<void>> = []
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup() })

async function fixture(scenario: string) {
  const root = await mkdtemp(join(tmpdir(), 'codex-account-risk-'))
  await mkdir(join(root, 'dsh')); await mkdir(join(root, 'codex'))
  const ctx = new Context()
  await ctx.plugin(LocalSubprocessRuntime)
  const children: SubprocessHandle[] = []
  const spawn = (spec: SubprocessSpawnSpec) => {
    const child = ctx.subprocess.spawn({ ...spec,
      argv: [process.execPath, fileURLToPath(new URL('./fixtures/account-lifecycle.mjs', import.meta.url)), scenario],
      cwd: root, graceMs: 100,
      env: { ...spec.env, DSH_HOME: join(root, 'dsh'), CODEX_HOME: join(root, 'codex'), OPENAI_API_KEY: '' },
    })
    children.push(child)
    return child
  }
  const account = new NativeCodexAccount(spawn)
  cleanups.push(async () => {
    // Force only this fixture's owned children; never require the code under test to clean up successfully.
    for (const child of children) child.terminate()
    await account.dispose()
    await ctx.fiber.dispose()
    await rm(root, { recursive: true, force: true })
  })
  const seen = async (method: string, index = 0) => {
    await vi.waitFor(() => expect(children[index]?.collected.stderr?.readFrom(0).text).toContain(`AUDIT_RECEIVED:${method}`), { timeout: 10_000, interval: 15 })
  }
  return { account, children, spawn, seen }
}

function tracked<T>(promise: Promise<T>) {
  return promise.then(value => ({ state: 'resolved' as const, value }), error => ({ state: 'rejected' as const, error }))
}
async function observed(promise: Promise<unknown>, ms = 2500): Promise<'settled' | 'pending'> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise.then(() => 'settled' as const),
      new Promise<'pending'>(resolve => { timer = setTimeout(() => resolve('pending'), ms) }),
    ])
  } finally { if (timer !== undefined) clearTimeout(timer) }
}

describe('account lifecycle in real official DSH subprocess runtime', () => {
  it('stopping the plugin cancels an account initialize that never responds', async () => {
    const f = await fixture('silent-initialize')
    const request = tracked(f.account.status())
    await f.seen('initialize')
    await f.account.dispose()
    expect(await observed(request), 'account initialize remained pending after plugin disposal').toBe('settled')
    expect(await f.children[0]!.waitForExit(AbortSignal.timeout(2500))).toBe(true)
    expect((await request).state).toBe('rejected')
  }, 20_000)

  it.each(['status', 'quota', 'usage'] as const)('stopping the plugin releases a stalled %s query', async method => {
    const f = await fixture('silent-query')
    const request = tracked(f.account[method]())
    const protocol = { status: 'account/read', quota: 'account/rateLimits/read', usage: 'account/usage/read' }[method]
    await f.seen(protocol)
    await f.account.dispose()
    expect(await observed(request), `${method} stayed pending after dispose`).toBe('settled')
    expect(await f.children[0]!.waitForExit(AbortSignal.timeout(2500))).toBe(true)
  }, 20_000)

  it('cancel does not require a reply from an unresponsive login peer', async () => {
    const f = await fixture('silent-cancel')
    const login = await f.account.start('browser')
    const cancellation = tracked(f.account.cancel(login.id))
    expect(await observed(cancellation), 'cancel button waited indefinitely for server acknowledgement').toBe('settled')
    expect(await cancellation).toMatchObject({ state: 'resolved', value: { phase: 'cancelled' } })
    expect(await f.children[0]!.waitForExit(AbortSignal.timeout(2500))).toBe(true)
  }, 20_000)

  it('disposing during login initialize leaves no late pending login', async () => {
    const f = await fixture('silent-initialize')
    const start = tracked(f.account.start('device'))
    await f.seen('initialize')
    await f.account.dispose()
    expect(await observed(start), 'login initialize outlived plugin disposal').toBe('settled')
    expect((await start).state).toBe('rejected')
  }, 20_000)

  it('normal account read initializes exactly once without a model turn', async () => {
    const f = await fixture('normal')
    await expect(f.account.status()).resolves.toEqual({ authenticated: false })
    const trace = f.children[0]!.collected.stderr!.readFrom(0).text
    expect(trace.match(/AUDIT_RECEIVED:initialize\n/g)).toHaveLength(1)
    expect(trace).toContain('AUDIT_RECEIVED:initialized\n')
    expect(trace).not.toContain('turn/start')
    expect(await f.children[0]!.waitForExit(AbortSignal.timeout(2500))).toBe(true)
  }, 20_000)

  it('cache idle expiry does not kill an actively running model turn', async () => {
    const f = await fixture('slow-turn')
    const runner = new CodexAppServerRunner({ timeoutMs: 0, disposeGraceMs: 1000, maxJsonRpcLineBytes: 1_048_576, maxStderrBytes: 65_536, env: {}, spawn: f.spawn })
    const cache = new CodexSessionCache({ runner, maxSessions: 1, idleTimeoutMs: 20, onCleanupError: error => { throw error } })
    try {
      const step = await cache.begin({ sessionId: 'isolated-session', epoch: { v: 1 }, thread: { model: 'fixture-model', modelProvider: 'openai', system: 'test', dynamicTools: [] }, history: [], loadInjectedHistory: async () => [], loadUserInput: async content => content, loadToolResult: async result => ({ callId: result.callId, contentItems: [{ type: 'inputText', text: 'test' }], success: true }), toolResults: [] })
      const events = []
      for await (const event of step.events) events.push(event)
      expect(events.some(e => e.kind === 'notification' && e.method === 'turn/completed')).toBe(true)
      expect(f.children).toHaveLength(1)
      await step.discard()
    } finally { await cache.dispose() }
  }, 20_000)
})

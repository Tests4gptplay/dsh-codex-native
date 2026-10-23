import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { Context } from '@deepseek-ai/cordis'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import type { SubprocessHandle } from '@deepseek-ai/dsh-subprocess'
import { NativeCodexAccount } from '../src/native-account.ts'

const cleanups: Array<() => Promise<void>> = []
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup() })

async function setup(mode: string) {
  const root = await mkdtemp(join(tmpdir(), 'codex-account-audit-'))
  const marker = join(root, 'events.log')
  const ctx = new Context()
  await ctx.plugin(LocalSubprocessRuntime)
  const children: SubprocessHandle[] = []
  const manager = new NativeCodexAccount(spec => {
    const child = ctx.subprocess.spawn({ ...spec, cwd: root, argv: [process.execPath, fileURLToPath(new URL('./fixtures/account-lifecycle.mjs', import.meta.url))], env: { TEST_ACCOUNT_MODE: mode, TEST_ACCOUNT_MARKER: marker, HOME: root, CODEX_HOME: root } })
    children.push(child)
    return child
  })
  cleanups.push(async () => {
    // Test-owned cleanup also runs when the baseline assertion fails.
    for (const child of children) child.terminate()
    await Promise.all(children.map(child => child.waitForExit(AbortSignal.timeout(5000))))
    await manager.dispose()
    await ctx.fiber.dispose()
    await rm(root, { recursive: true, force: true })
  })
  async function seen(method: string) {
    const deadline = Date.now() + 3000
    while (Date.now() < deadline) {
      const text = await readFile(marker, 'utf8').catch(() => '')
      if (text.split('\n').includes(method)) return
      await delay(10)
    }
    throw new Error(`Fixture did not receive ${method}`)
  }
  return { manager, children, seen, marker, ctx }
}

function observe<T>(promise: Promise<T>) {
  let state = 'pending'
  const result = promise.then(value => { state = 'resolved'; return value }, error => { state = 'rejected'; return error })
  return { result, state: () => state }
}

describe('official DSH runtime: account cancellation and disposal', () => {
  it('disposal closes a child stalled in initialize, without waiting for a handshake reply', async () => {
    const s = await setup('stall-initialize')
    const query = observe(s.manager.status())
    await s.seen('initialize')
    await s.manager.dispose()
    expect(await s.children[0]!.waitForExit(AbortSignal.timeout(300))).toBe(true)
    await vi.waitFor(() => expect(query.state()).toBe('rejected'), { timeout: 1000, interval: 10 })
  })

  it.each([
    ['status', 'account/read'], ['quota', 'account/rateLimits/read'], ['usage', 'account/usage/read'],
  ] as const)('disposal closes an in-flight %s query', async (operation, method) => {
    const s = await setup('stall-request')
    const query = observe(s.manager[operation]())
    await s.seen(method)
    await s.manager.dispose()
    expect(await s.children[0]!.waitForExit(AbortSignal.timeout(300))).toBe(true)
    await vi.waitFor(() => expect(query.state()).toBe('rejected'), { timeout: 1000, interval: 10 })
  })

  it('Cancel does not require the unresponsive server to acknowledge cancellation', async () => {
    const s = await setup('stall-cancel')
    const flow = await s.manager.start('browser')
    const write = vi.spyOn(s.children[0]!.stdin!, 'write')
    const cancel = observe(s.manager.cancel(flow.id))
    expect(write).toHaveBeenCalledWith(expect.stringContaining('account/login/cancel'))
    expect(await s.children[0]!.waitForExit(AbortSignal.timeout(300))).toBe(true)
    await vi.waitFor(() => expect(cancel.state()).toBe('resolved'), { timeout: 1000, interval: 10 })
    expect(s.manager.loginStatus(flow.id).phase).toBe('cancelled')
  })

  it('disabling only the consumer plugin stops its query while the official subprocess service remains enabled', async () => {
    const s = await setup('stall-request')
    let consumer: Context | undefined
    await s.ctx.plugin({ name: 'audit-account-consumer', apply(scoped: Context) {
      consumer = scoped
      scoped.effect(() => () => s.manager.dispose(), 'audit account consumer teardown')
    } })
    const query = observe(s.manager.status())
    await s.seen('account/read')
    await consumer!.fiber.dispose()
    expect(await s.children[0]!.waitForExit(AbortSignal.timeout(300))).toBe(true)
    await vi.waitFor(() => expect(query.state()).toBe('rejected'), { timeout: 1000, interval: 10 })
    expect(s.ctx.subprocess).toBeDefined()
  })

  it('account disposal leaves an unrelated DSH subprocess alive', async () => {
    const s = await setup('stall-request')
    const query = observe(s.manager.status())
    await s.seen('account/read')
    const unrelated = s.ctx.subprocess.spawn({
      argv: [process.execPath, '-e', 'setInterval(() => {}, 1000)'],
      cwd: tmpdir(), stdio: { stdin: 'ignore', stdout: 'pipe', stderr: { maxBytes: 1024 } },
      env: {}, graceMs: 100,
    })
    try {
      await s.manager.dispose()
      expect(await s.children[0]!.waitForExit(AbortSignal.timeout(1000))).toBe(true)
      expect(await unrelated.waitForExit(AbortSignal.timeout(50))).toBe(false)
      await vi.waitFor(() => expect(query.state()).toBe('rejected'), { timeout: 1000, interval: 10 })
    } finally {
      unrelated.terminate()
      await unrelated.waitForExit(AbortSignal.timeout(1000))
    }
  })

  it('joins all parallel account reads and makes repeated disposal idempotent', async () => {
    const s = await setup('stall-request')
    const queries = [observe(s.manager.status()), observe(s.manager.quota()), observe(s.manager.usage())]
    await Promise.all(['account/read', 'account/rateLimits/read', 'account/usage/read'].map(s.seen))
    await Promise.all([s.manager.dispose(), s.manager.dispose(), s.manager.dispose()])
    expect(s.children).toHaveLength(3)
    for (const child of s.children) expect(await child.waitForExit(AbortSignal.timeout(1000))).toBe(true)
    await vi.waitFor(() => expect(queries.map(q => q.state())).toEqual(['rejected', 'rejected', 'rejected']), { timeout: 1000, interval: 10 })
  })

  it('a slow but valid handshake/query is not killed or retried by the account bridge', async () => {
    const s = await setup('delayed-success')
    expect(await s.manager.status()).toEqual({ authenticated: true, email: 'test@example.invalid', planType: 'pro' })
    expect(s.children).toHaveLength(1)
    const events = (await readFile(s.marker, 'utf8')).trim().split('\n')
    expect(events).toEqual(['initialize', 'initialized', 'account/read'])
    expect(await s.children[0]!.waitForExit(AbortSignal.timeout(300))).toBe(true)
  })
})

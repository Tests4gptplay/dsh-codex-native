import { describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { CodexNativeApprovals } from '../src/native-approvals.ts'
import type { NativeApprovalOwner, NativeApprovalRequest } from '../src/native-approvals.ts'

function setup(answer: () => Promise<unknown> = async () => 'allowed-once') {
  const log = [{ type: 'turn/start' }]
  const agent = { session: { id: 'session-1', get seq() { return log.length }, eventAt: (seq: number) => log[seq] } }
  const agents = new Map<string, unknown>([['session-1', agent]])
  const request = vi.fn(async (_request: unknown) => answer())
  const listeners = new Map<string, (...args: any[]) => void>()
  const services = new Map<string, unknown>([['agents', { get: (id: string) => agents.get(id) }], ['approval', { request }]])
  const ctx = {
    get: (name: string) => services.get(name),
    on: (name: string, fn: (...args: any[]) => void) => { listeners.set(name, fn) },
    effect: vi.fn(),
  } as unknown as Context
  const bridge = new CodexNativeApprovals(ctx)
  const controller = new AbortController()
  const owner: NativeApprovalOwner = { sessionId: 'session-1', threadId: 'thread-1', turnId: 'turn-1', signal: controller.signal }
  const event: NativeApprovalRequest = { method: 'item/commandExecution/requestApproval', params: {
    threadId: 'thread-1', turnId: 'turn-1', itemId: 'native-item-1', command: 'echo fixture-only', cwd: '/synthetic-workspace',
    additionalPermissions: { network: false },
  } }
  return { bridge, owner, event, request, agents, agent, listeners, services, controller, log }
}

// Entirely synthetic: no process spawn, runtime discovery, filesystem, account or network.
describe('native approvals use the Host one-shot approval seam', () => {
  it('forwards exact owner and operation, without fabricating a DSH tool call id', async () => {
    const s = setup()
    expect(await s.bridge.resolve(s.event, s.owner)).toMatchObject({ decision: 'accept', outcome: 'allowed-once', resolution: 'answered' })
    expect(s.request).toHaveBeenCalledOnce()
    const sent = s.request.mock.calls[0]![0] as any
    expect(sent.agent).toBe(s.agent)
    expect(sent).not.toHaveProperty('callId')
    expect(sent.reason).toContain('echo fixture-only')
    expect(sent.reason).toContain('/synthetic-workspace')
    expect(sent.reason).toContain('additionalPermissions')
    expect(sent.signal).toBeInstanceOf(AbortSignal)
  })

  it.each([
    ['rejected', 'decline', 'declined'], ['cancelled', 'cancel', 'declined'], ['unavailable', undefined, 'rejected'],
  ] as const)('preserves Host %s without asking generic questions', async (outcome, decision, resolution) => {
    const s = setup(async () => outcome)
    const result = await s.bridge.resolve(s.event, s.owner)
    expect(result).toMatchObject({outcome,resolution})
    expect(result.decision).toBe(decision)
    expect(s.request).toHaveBeenCalledOnce()
  })

  it('shows native file changes and returns only a one-shot accept', async () => {
    const s = setup()
    const event: NativeApprovalRequest = { ...s.event, method: 'item/fileChange/requestApproval' }
    const operation = { id: 'native-item-1', type: 'fileChange', changes: [{ path: '/synthetic/file', diff: '+fixture' }] }
    expect(await s.bridge.resolve(event, { ...s.owner, operation })).toMatchObject({ decision: 'accept' })
    expect((s.request.mock.calls[0]![0] as any).reason).toContain('+fixture')
  })

  it.each(['threadId', 'turnId', 'itemId'] as const)('does not ask for an unrelated %s', async field => {
    const s = setup()
    const params = { ...s.event.params, [field]: field === 'itemId' ? '' : 'wrong' }
    expect(await s.bridge.resolve({ ...s.event, params }, s.owner)).toMatchObject({ outcome: 'unavailable' })
    expect(s.request).not.toHaveBeenCalled()
  })

  it('rejects a mismatched action snapshot', async () => {
    const s = setup()
    expect(await s.bridge.resolve(s.event, { ...s.owner, operation: { id: 'other-item' } })).toMatchObject({ outcome: 'unavailable' })
    expect(s.request).not.toHaveBeenCalled()
  })

  it('does not substitute a session or policy grant for one-time approval', async () => {
    const s = setup()
    const event = { ...s.event, params: { ...s.event.params, availableDecisions: ['acceptForSession', 'cancel'] } }
    expect(await s.bridge.resolve(event, s.owner)).toMatchObject({ outcome: 'unavailable' })
    expect(await s.bridge.resolve(event, s.owner)).not.toHaveProperty('decision')
    expect(s.request).not.toHaveBeenCalled()
  })

  it('asks the caller to send a protocol error when no supported non-grant exists', async () => {
    const s = setup()
    const event = { ...s.event, params: { ...s.event.params, availableDecisions: ['acceptForSession'] } }
    expect(await s.bridge.resolve(event, s.owner)).not.toHaveProperty('decision')
    expect(s.request).not.toHaveBeenCalled()
  })

  it('distinguishes absent Host service from a human rejection', async () => {
    const s = setup(); s.services.delete('approval')
    const result = await s.bridge.resolve(s.event, s.owner)
    expect(result.outcome).toBe('unavailable')
    expect(result.diagnostic).toContain('not a user rejection')
  })

  it.each(['missing-session', 'missing-agent'] as const)('fails closed with %s', async kind => {
    const s = setup()
    if (kind === 'missing-agent') s.agents.clear()
    expect(await s.bridge.resolve(s.event, kind === 'missing-session' ? { ...s.owner, sessionId: undefined } : s.owner)).toMatchObject({ outcome: 'unavailable' })
    expect(s.request).not.toHaveBeenCalled()
  })

  it('does not grant on audit/turn/answerer failure or invalid outcomes', async () => {
    for (const answer of [async () => { throw new Error('synthetic audit failure') }, async () => 'rogue-grant']) {
      const s = setup(answer)
      const result = await s.bridge.resolve(s.event, s.owner)
      expect(result).toMatchObject({ outcome: 'unavailable' })
      expect(result).not.toHaveProperty('decision')
    }
  })

  it.each(['caller', 'session', 'plugin'] as const)('withdraws on %s cancellation, ignoring a late grant', async kind => {
    const pending = Promise.withResolvers<string>()
    const s = setup(() => pending.promise)
    const task = s.bridge.resolve(s.event, s.owner)
    await Promise.resolve()
    if (kind === 'caller') s.controller.abort()
    else if (kind === 'session') s.listeners.get('session/disposed')!({ id: 'session-1' })
    else s.bridge.dispose()
    const result = await task
    expect(result).toMatchObject({ decision: 'cancel', outcome: 'cancelled' })
    pending.resolve('allowed-once')
    await Promise.resolve()
    expect(result).toMatchObject({ decision: 'cancel' })
  })

  it('does not send an already-cancelled request to the Host', async () => {
    const s = setup(); s.controller.abort()
    expect(await s.bridge.resolve(s.event, s.owner)).toMatchObject({ outcome: 'cancelled' })
    expect(s.request).not.toHaveBeenCalled()
  })

  it('does not apply an old Agent grant to a replacement Agent', async () => {
    const pending = Promise.withResolvers<string>()
    const s = setup(() => pending.promise)
    const task = s.bridge.resolve(s.event, s.owner)
    await Promise.resolve()
    s.agents.set('session-1', { session: { id: 'session-1' } })
    pending.resolve('allowed-once')
    expect(await task).toMatchObject({ outcome: 'cancelled', decision: 'cancel' })
  })

  it('cancels only the disposed session', async () => {
    const pending = Promise.withResolvers<string>()
    const s = setup(() => pending.promise)
    s.agents.set('session-2', { session: { id: 'session-2', seq: 1, eventAt: () => ({ type: 'turn/start' }) } })
    const first = s.bridge.resolve(s.event, s.owner)
    const second = s.bridge.resolve(s.event, { ...s.owner, sessionId: 'session-2' })
    await Promise.resolve()
    s.listeners.get('session/disposed')!({ id: 'session-1' })
    expect(await first).toMatchObject({ outcome: 'cancelled' })
    pending.resolve('allowed-once')
    expect(await second).toMatchObject({ outcome: 'allowed-once' })
  })
  it('does not transfer a late approval to a new DSH turn on the same Agent', async () => {
    const pending = Promise.withResolvers<string>()
    const s = setup(() => pending.promise)
    const task = s.bridge.resolve(s.event, s.owner)
    await Promise.resolve()
    s.log.push({ type: 'turn/end' }, { type: 'turn/start' })
    pending.resolve('allowed-once')
    expect(await task).toMatchObject({ outcome: 'cancelled', decision: 'cancel' })
  })
  it('does not ask between DSH turns', async () => {
    const s = setup(); s.log.push({ type: 'turn/end' })
    expect(await s.bridge.resolve(s.event, s.owner)).toMatchObject({ outcome: 'unavailable' })
    expect(s.request).not.toHaveBeenCalled()
  })

  it('does not ask for a file change with only an optional reason or grant root', async () => {
    const s = setup()
    const event: NativeApprovalRequest = { method: 'item/fileChange/requestApproval', params: {
      threadId: 'thread-1', turnId: 'turn-1', itemId: 'native-item-1', reason: 'Please approve', grantRoot: '/synthetic',
    } }
    const result = await s.bridge.resolve(event, s.owner)
    expect(result).toMatchObject({ outcome: 'unavailable' })
    expect(result).not.toHaveProperty('decision')
    expect(result.diagnostic).toContain('operation details')
    expect(s.request).not.toHaveBeenCalled()
  })
  it('does not ask for an undescribed command', async () => {
    const s = setup()
    expect(await s.bridge.resolve({ ...s.event, params: { ...s.event.params, command: null, reason: 'Trust me' } }, s.owner)).toMatchObject({ outcome: 'unavailable' })
    expect(s.request).not.toHaveBeenCalled()
  })
  it('accepts command details from the matching native action snapshot', async () => {
    const s = setup()
    expect(await s.bridge.resolve({ ...s.event, params: { ...s.event.params, command: null } }, {
      ...s.owner, operation: { id: 'native-item-1', type: 'commandExecution', command: 'echo snapshot-fixture' },
    })).toMatchObject({ outcome: 'allowed-once' })
    expect((s.request.mock.calls[0]![0] as any).reason).toContain('echo snapshot-fixture')
  })
  it('presents a managed network approval without inventing a shell command', async () => {
    const s = setup()
    expect(await s.bridge.resolve({ ...s.event, params: { ...s.event.params, command: null,
      networkApprovalContext: { host: 'example.invalid', protocol: 'https' },
    } }, s.owner)).toMatchObject({ outcome: 'allowed-once' })
    expect((s.request.mock.calls[0]![0] as any).reason).toContain('example.invalid')
  })

  it.each([
    ['item/commandExecution/requestApproval', 'fileChange'],
    ['item/fileChange/requestApproval', 'commandExecution'],
  ] as const)('does not approve %s from a different action type', async (method, type) => {
    const s = setup()
    expect(await s.bridge.resolve({ ...s.event, method }, { ...s.owner,
      operation: { id: 'native-item-1', type, command: 'echo fixture', changes: [{ path: '/synthetic/file', diff: '+fixture' }] },
    })).toMatchObject({ outcome: 'unavailable' })
    expect(s.request).not.toHaveBeenCalled()
  })

})

import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CodexUserQuestions } from '../src/user-questions.ts'

const contexts: Context[] = []
afterEach(async () => { await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose())) })

const params = {
  questions: [
    { id: 'scope', header: '清理范围', question: '如何清理？', options: [
      { label: '包含，确认后停止并清理', description: '停止活动任务后清理。' },
      { label: '只清理已结束的任务记录', description: '保持活动任务。' },
    ] },
    { id: 'note', header: '备注', question: '需要补充什么？', options: null },
  ],
}
const item = { id: 'native-async-1', type: 'agentMessage', delivery: 'async', text: '如何清理？',
  questions: [{ title: '如何清理？', options: ['包含，确认后停止并清理', '只清理已结束的任务记录'] }] }

function setup(ask: ReturnType<typeof vi.fn>) {
  const ctx = new Context()
  contexts.push(ctx)
  const owner = { id: 'session-1', steer: vi.fn() }
  const unrelated = { id: 'session-2', steer: vi.fn() }
  ctx.provide('agents', {
    get: (id: string) => id === 'session-1' ? owner : id === 'session-2' ? unrelated : undefined,
    currentInitiator: () => unrelated,
  } as never)
  ctx.provide('userQuestions', { ask } as never)
  return { ctx, owner, unrelated, bridge: new CodexUserQuestions(ctx) }
}

describe('native DSH question bridge', () => {
  it('uses the owning session and preserves options, descriptions and custom answers', async () => {
    const ask = vi.fn(async () => ({ answers: [
      { id: 'scope', selected: ['只清理已结束的任务记录'] },
      { id: 'note', selected: ['ignored'], custom: '保留昨天的记录' },
    ] }))
    const { bridge, owner, unrelated } = setup(ask)
    expect(await bridge.ask(params, 'session-1', new AbortController().signal)).toEqual({
      answers: { scope: { answers: ['只清理已结束的任务记录'] }, note: { answers: ['保留昨天的记录'] } },
    })
    expect(ask.mock.calls[0]![0]).toMatchObject({ agent: owner, questions: [
      params.questions[0], { id: 'note', header: '备注', question: '需要补充什么？' },
    ] })
    expect(unrelated.steer).not.toHaveBeenCalled()
  })

  it('maps explicit closing to cancellation and preserves a skipped question', async () => {
    const ask = vi.fn().mockRejectedValueOnce(Object.assign(new Error('cancelled'), { code: 'ASK_CANCELLED' }))
      .mockResolvedValueOnce({ answers: [{ id: 'scope', selected: [] }] })
    const { bridge } = setup(ask)
    expect(await bridge.ask(params, 'session-1', new AbortController().signal)).toBeNull()
    expect(await bridge.ask(params, 'session-1', new AbortController().signal)).toEqual({ answers: { scope: { answers: [] } } })
  })

  it('opens async questions once, keeps work running, and steers only the submitted human answer', async () => {
    const result = Promise.withResolvers<any>()
    const ask = vi.fn(() => result.promise)
    const { bridge, owner, unrelated } = setup(ask)
    bridge.notify(item, 'session-1')
    bridge.notify(item, 'session-1')
    expect(ask).toHaveBeenCalledOnce()
    expect(owner.steer).not.toHaveBeenCalled()
    expect(ask.mock.calls[0]![0].questions).toEqual([{ id: '0', question: '如何清理？',
      options: [{ label: '包含，确认后停止并清理' }, { label: '只清理已结束的任务记录' }] }])
    result.resolve({ answers: [{ id: '0', selected: ['只清理已结束的任务记录'] }] })
    await vi.waitFor(() => expect(owner.steer).toHaveBeenCalledOnce())
    const message = owner.steer.mock.calls[0]![0]
    expect(message.source).toEqual({ kind: 'user' })
    expect(message.role).toBe('user')
    expect(message.content).toEqual([{ type: 'text', text: '如何清理？\n只清理已结束的任务记录' }])
    expect(unrelated.steer).not.toHaveBeenCalled()
    bridge.notify(item, 'session-1')
    expect(ask).toHaveBeenCalledOnce()
  })

  it('dismisses on stop or unload without submitting a default or late answer', async () => {
    const result = Promise.withResolvers<any>()
    const ask = vi.fn(() => result.promise)
    const { bridge, owner } = setup(ask)
    const stop = new AbortController()
    bridge.notify(item, 'session-1', stop.signal)
    const signal = ask.mock.calls[0]![0].signal
    stop.abort()
    expect(signal.aborted).toBe(true)
    result.resolve({ answers: [{ id: '0', selected: ['包含，确认后停止并清理'] }] })
    await result.promise
    await Promise.resolve()
    expect(owner.steer).not.toHaveBeenCalled()

    bridge.notify({ ...item, id: 'second-question' }, 'session-1')
    const pending = ask.mock.calls[1]![0].signal
    bridge.dispose()
    expect(pending.aborted).toBe(true)
  })

  it('automatically steers one readable reply with custom text and multiple question answers', async () => {
    const ask = vi.fn(async () => ({ answers: [
      { id: '0', selected: ['选项 B'] },
      { id: '1', selected: [], custom: '保留原文\n第二行' },
      { id: '2', selected: [] },
    ] }))
    const { bridge, owner } = setup(ask)
    bridge.notify({ ...item, questions: [
      { title: '选择哪项？', options: ['选项 A', '选项 B'] },
      { title: '补充说明？' },
      { title: '已跳过的问题？' },
    ] }, 'session-1')
    await vi.waitFor(() => expect(owner.steer).toHaveBeenCalledOnce())
    expect(owner.steer.mock.calls[0]![0]).toMatchObject({
      role: 'user', source: { kind: 'user' },
      content: [{ type: 'text', text: '选择哪项？\n选项 B\n\n补充说明？\n保留原文\n第二行' }],
    })
  })

  it('does not send a user message when all async questions are skipped', async () => {
    const ask = vi.fn(async () => ({ answers: [{ id: '0', selected: [] }] }))
    const { bridge, owner } = setup(ask)
    bridge.notify(item, 'session-1')
    await Promise.resolve()
    await Promise.resolve()
    expect(owner.steer).not.toHaveBeenCalled()
  })
})

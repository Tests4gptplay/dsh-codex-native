import { afterEach, describe, expect, it, vi } from 'vitest'
import { MessageId } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, Message, StreamChunk } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import { CodexAppServerAdapter } from '../src/adapter.ts'
import { DshCodexAdapter } from '../src/dsh-adapter.ts'

const warning = 'Skill descriptions were shortened to fit the skills context budget. Codex can still see every skill, but some descriptions are shorter. Disable unused skills or plugins to leave more room for the rest.'
const adapters: DshCodexAdapter[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(adapters.splice(0).map(adapter => adapter.dispose()))
})

function adapter(): DshCodexAdapter {
  const value = new DshCodexAdapter({
    provider: 'codex-local', displayName: 'Codex local', modelProvider: 'openai',
    models: [], maxRetries: 0, maxRequestImageBytes: 20 * 1024 * 1024,
    maxCachedSessions: 8, sessionIdleTimeoutMs: 600_000,
    onCleanupError: vi.fn(), resolveAttachments: () => undefined,
    runner: { open: vi.fn(), stream: vi.fn() },
  })
  adapters.push(value)
  return value
}

function request(sessionId?: string, messages: Message[] = []): GenerateOptions {
  return {
    provider: 'codex-local', model: 'gpt-6-astra', messages,
    ...(sessionId === undefined ? {} : { sessionId: SessionId(sessionId) }),
  }
}

function source(message = warning, actionType = 'warning', id = 'notice-1'): StreamChunk[] {
  return [
    { type: 'block-start', index: 0, blockType: 'codex-action' },
    { type: 'block-end', index: 0, block: {
      type: 'codex-action', actionId: id, actionType, category: 'diagnostic',
      phase: 'completed', protocolEvent: actionType, snapshot: { message },
    } },
    { type: 'block-start', index: 1, blockType: 'text' },
    { type: 'text-delta', index: 1, text: 'Reply' },
    { type: 'block-end', index: 1, block: { type: 'text', text: 'Reply' } },
    { type: 'finish', reason: { kind: 'stop' }, replayState: { response: { items: [] } } },
  ] as StreamChunk[]
}

function nativeSource() {
  return vi.spyOn(CodexAppServerAdapter.prototype, 'stream')
    .mockImplementation(async function* () { yield* source() })
}

async function collect(value: DshCodexAdapter, options: GenerateOptions): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = []
  for await (const chunk of value.stream(options)) chunks.push(chunk)
  return chunks
}

function text(chunks: StreamChunk[]): string {
  return chunks.filter(chunk => chunk.type === 'text-delta').map(chunk => chunk.text).join('')
}

describe('session-scoped native notices', () => {
  it('shows an unchanged warning once across turns and retries, even with new action ids', async () => {
    const native = nativeSource()
    const value = adapter()
    expect(text(await collect(value, request('session-a')))).toContain(warning)
    native.mockImplementation(async function* () { yield* source(warning, 'warning', 'notice-2') })
    const repeated = await collect(value, request('session-a'))
    expect(text(repeated)).toBe('Reply')
    expect(repeated.filter(chunk => chunk.type === 'block-start').map(chunk => chunk.index)).toEqual([0])
    expect(repeated.at(-1)).toEqual(source().at(-1))
  })

  it('keeps new warnings and another session visible', async () => {
    const native = nativeSource()
    const value = adapter()
    await collect(value, request('session-a'))
    expect(text(await collect(value, request('session-b')))).toContain(warning)
    native.mockImplementation(async function* () { yield* source('A different configuration warning', 'configWarning') })
    expect(text(await collect(value, request('session-a')))).toContain('A different configuration warning')
  })

  it.each(['error', 'guardianWarning'])('does not suppress repeated %s notices', async actionType => {
    nativeSource().mockImplementation(async function* () { yield* source(warning, actionType) })
    const value = adapter()
    expect(text(await collect(value, request('session-a')))).toContain(warning)
    expect(text(await collect(value, request('session-a')))).toContain(warning)
  })

  it.each(['', 'Previous reply'])('restores a displayed notice from assistant history with suffix %j', async suffix => {
    nativeSource()
    const value = adapter()
    const messages: Message[] = [{
      id: MessageId('prior-warning'), role: 'assistant',
      source: { kind: 'model', provider: 'codex-local', model: 'gpt-6-astra' },
      content: [{ type: 'text', text: `Codex: ${warning}\n\n${suffix}` }],
    }]
    expect(text(await collect(value, request('session-a', messages)))).toBe('Reply')
  })

  it('accepts history messages without an optional source', async () => {
    nativeSource()
    const value = adapter()
    const messages: Message[] = [{
      id: MessageId('source-free-history'), role: 'assistant',
      content: [{ type: 'text', text: 'Previous reply' }],
    }]
    expect(text(await collect(value, request('session-a', messages)))).toContain(warning)
  })

  it('releases session state on disposal and does not share anonymous requests', async () => {
    nativeSource()
    const value = adapter()
    await collect(value, request('session-a'))
    await value.disposeSession('session-a')
    expect(text(await collect(value, request('session-a')))).toContain(warning)
    expect(text(await collect(value, request()))).toContain(warning)
    expect(text(await collect(value, request()))).toContain(warning)
  })

  it('does not let an internal compaction request hide a notice from the conversation', async () => {
    nativeSource()
    const value = adapter()
    await collect(value, { ...request('session-a'), purpose: 'compaction' })
    expect(text(await collect(value, request('session-a')))).toContain(warning)
  })
})

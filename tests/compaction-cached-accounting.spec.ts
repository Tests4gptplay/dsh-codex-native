import { describe, expect, it } from 'vitest'
import { MessageId, ToolCallId } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, Message, StreamChunk, TokenUsage } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import { CodexAppServerAdapter } from '../src/adapter.ts'
import type { CodexAppServerEvent, CodexAppServerThreadPort, CodexAppServerTurnRequest } from '../src/runner.ts'

const nativeUsage = { inputTokens: 90_000, cachedInputTokens: 60_000, outputTokens: 1_000 }

function functionCall(callId: string): CodexAppServerEvent {
  return { kind: 'notification', method: 'rawResponseItem/completed', params: {
    threadId: 'cached-thread', turnId: 'native-turn', item: {
      type: 'function_call', id: `item-${callId}`, call_id: callId,
      namespace: 'deepseek_harness', name: 'read_file', arguments: '{"path":"a.txt"}',
    },
  } }
}

function callback(callId: string): CodexAppServerEvent {
  return { kind: 'server-request', id: `rpc-${callId}`, method: 'item/tool/call', params: {
    threadId: 'cached-thread', turnId: 'native-turn', callId,
    namespace: 'deepseek_harness', tool: 'read_file', arguments: { path: 'a.txt' },
  }, resolution: 'rejected' }
}

function usage(chunks: readonly StreamChunk[]): TokenUsage | undefined {
  const chunk = chunks.findLast(chunk => chunk.type === 'usage')
  return chunk?.type === 'usage' ? chunk.usage : undefined
}

function billedTotal(sample: TokenUsage | undefined): number {
  return sample === undefined ? 0
    : sample.inputTokens + sample.outputTokens + (sample.cacheReadTokens ?? 0) + (sample.cacheWriteTokens ?? 0)
}

async function collect(adapter: CodexAppServerAdapter, request: GenerateOptions): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = []
  for await (const chunk of adapter.stream(request)) chunks.push(chunk)
  return chunks
}

describe('accounting across cached Harness tool continuations', () => {
  it('does not bill an already reported response again when its delayed last snapshot arrives in the next mapper', async () => {
    // A native response can settle before the tool callback. Its thread.last
    // snapshot is allowed to arrive only after the pending tool is resolved.
    const turns: readonly (readonly CodexAppServerEvent[])[] = [
      [
        functionCall('call-1'),
        { kind: 'notification', method: 'rawResponse/completed', params: {
          threadId: 'cached-thread', turnId: 'native-turn', usage: nativeUsage,
        } },
        callback('call-1'),
      ],
      [
        { kind: 'notification', method: 'thread/tokenUsage/updated', params: {
          threadId: 'cached-thread', turnId: 'native-turn', tokenUsage: { last: nativeUsage },
        } },
        functionCall('call-2'),
        callback('call-2'),
      ],
      [
        { kind: 'notification', method: 'rawResponse/completed', params: {
          threadId: 'cached-thread', turnId: 'native-turn',
          usage: { inputTokens: 120_000, cachedInputTokens: 80_000, outputTokens: 2_000 },
        } },
        { kind: 'notification', method: 'rawResponseItem/completed', params: {
          threadId: 'cached-thread', turnId: 'native-turn', item: {
            type: 'message', id: 'raw-answer', role: 'assistant', content: [{ type: 'output_text', text: 'done' }],
          },
        } },
        { kind: 'notification', method: 'item/completed', params: {
          threadId: 'cached-thread', turnId: 'native-turn', item: { type: 'agentMessage', id: 'answer', text: 'done' },
        } },
        { kind: 'notification', method: 'turn/completed', params: {
          threadId: 'cached-thread', turn: { id: 'native-turn', status: 'completed', error: null },
        } },
      ],
    ]
    let opens = 0
    const requests: CodexAppServerTurnRequest[] = []
    const thread: CodexAppServerThreadPort = {
      threadId: 'cached-thread',
      stream(request) {
        const events = turns[requests.length]
        requests.push(request)
        return (async function * () { yield* events ?? [] })()
      },
      async dispose() {},
    }
    const adapter = new CodexAppServerAdapter({
      provider: 'codex-local', displayName: 'cached accounting test', modelProvider: 'openai',
      models: [{ id: 'gpt-6-astra', name: 'GPT-6 Astra', contextWindow: 272_000, inputModalities: ['text'], reasoningEfforts: [] }],
      maxRetries: 0, maxRequestImageBytes: 20 * 1024 * 1024, maxCachedSessions: 1, sessionIdleTimeoutMs: 60_000,
      onCleanupError: error => { throw error }, resolveAttachments: () => undefined,
      runner: {
        async open() { opens++; return thread },
        async *stream() { throw new Error('unexpected uncached stream') },
      },
    })
    try {
      const request: GenerateOptions = {
        provider: 'codex-local', model: 'gpt-6-astra', sessionId: SessionId('accounting-continuation'),
        tools: [{ name: 'read_file', description: 'Read a file.', parameters: {
          type: 'object', properties: { path: { type: 'string' } }, required: ['path'],
        } }],
        messages: [{ id: MessageId('user-1'), role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'read both files' }] }],
      }
      const first = await collect(adapter, request)
      const finish = first.findLast(chunk => chunk.type === 'finish')
      if (finish?.type !== 'finish') throw new Error('first callback did not finish')
      const callId = ToolCallId('call-1')
      const answer: Message = {
        id: MessageId('assistant-1'), role: 'assistant',
        source: { kind: 'model', provider: request.provider, model: request.model, replayState: finish.replayState },
        content: [{ type: 'tool-call', id: callId, name: 'read_file', arguments: '{"path":"a.txt"}' }],
      }
      const result: Message = {
        id: MessageId('tool-1'), role: 'tool', source: { kind: 'tool', callId }, toolCallId: callId,
        content: [{ type: 'text', text: 'file contents' }], isError: false,
      }
      const second = await collect(adapter, { ...request, messages: [...request.messages, answer, result] })
      expect(opens).toBe(1)
      expect(requests[1]).toMatchObject({ toolResult: { callId: 'call-1', success: true } })
      expect(first.at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'tool-calls' } })
      expect(second.at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'tool-calls' } })
      expect(usage(first)).toMatchObject({ inputTokens: 30_000, cacheReadTokens: 60_000, outputTokens: 1_000 })
      // No new raw response usage was reported before the second callback.
      expect(billedTotal(usage(first)) + billedTotal(usage(second))).toBe(91_000)
      expect(usage(second)).toBeUndefined()

      const secondFinish = second.findLast(chunk => chunk.type === 'finish')
      if (secondFinish?.type !== 'finish') throw new Error('second callback did not finish')
      const secondCallId = ToolCallId('call-2')
      const secondAnswer: Message = {
        id: MessageId('assistant-2'), role: 'assistant',
        source: { kind: 'model', provider: request.provider, model: request.model, replayState: secondFinish.replayState },
        content: [{ type: 'tool-call', id: secondCallId, name: 'read_file', arguments: '{"path":"a.txt"}' }],
      }
      const secondResult: Message = {
        id: MessageId('tool-2'), role: 'tool', source: { kind: 'tool', callId: secondCallId }, toolCallId: secondCallId,
        content: [{ type: 'text', text: 'more contents' }], isError: false,
      }
      const third = await collect(adapter, {
        ...request, messages: [...request.messages, answer, result, secondAnswer, secondResult],
      })
      expect(opens).toBe(1)
      expect(requests[2]).toMatchObject({ toolResult: { callId: 'call-2', success: true } })
      expect(third.at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'stop' } })
      expect(usage(third)).toMatchObject({ inputTokens: 40_000, cacheReadTokens: 80_000, outputTokens: 2_000 })
      // When the real next response does arrive, its full usage is settled once.
      expect([first, second, third].reduce((total, chunks) => total + billedTotal(usage(chunks)), 0)).toBe(213_000)
    } finally {
      await adapter.dispose()
    }
  })

  it('keeps a live thread after canonical native compaction and sends only the next user input', async () => {
    const answerEvents = (turn: number): CodexAppServerEvent[] => [
      { kind: 'notification', method: 'rawResponseItem/completed', params: {
        threadId: 'cached-thread', turnId: `turn-${turn}`, item: {
          type: 'message', id: `raw-answer-${turn}`, role: 'assistant', content: [{ type: 'output_text', text: `answer ${turn}` }],
        },
      } },
      { kind: 'notification', method: 'item/completed', params: {
        threadId: 'cached-thread', turnId: `turn-${turn}`,
        item: { type: 'agentMessage', id: `answer-${turn}`, text: `answer ${turn}` },
      } },
      { kind: 'notification', method: 'turn/completed', params: {
        threadId: 'cached-thread', turn: { id: `turn-${turn}`, status: 'completed', error: null },
      } },
    ]
    const turns: readonly (readonly CodexAppServerEvent[])[] = [
      [
        { kind: 'notification', method: 'item/started', params: {
          threadId: 'cached-thread', turnId: 'turn-1', item: { type: 'contextCompaction', id: 'compact-1' },
        } },
        { kind: 'notification', method: 'item/completed', params: {
          threadId: 'cached-thread', turnId: 'turn-1', item: { type: 'contextCompaction', id: 'compact-1' },
        } },
        ...answerEvents(1),
      ],
      answerEvents(2),
    ]
    let opens = 0
    let disposals = 0
    const requests: CodexAppServerTurnRequest[] = []
    const thread: CodexAppServerThreadPort = {
      threadId: 'cached-thread',
      stream(request) {
        const events = turns[requests.length]
        requests.push(request)
        return (async function * () { yield* events ?? [] })()
      },
      async dispose() { disposals++ },
    }
    const adapter = new CodexAppServerAdapter({
      provider: 'codex-local', displayName: 'canonical compaction continuation test', modelProvider: 'openai',
      models: [{ id: 'gpt-6-astra', name: 'GPT-6 Astra', contextWindow: 272_000, inputModalities: ['text'], reasoningEfforts: [] }],
      maxRetries: 0, maxRequestImageBytes: 20 * 1024 * 1024, maxCachedSessions: 1, sessionIdleTimeoutMs: 60_000,
      onCleanupError: error => { throw error }, resolveAttachments: () => undefined,
      runner: {
        async open() { opens++; return thread },
        async *stream() { throw new Error('unexpected uncached stream') },
      },
    })
    try {
      const request: GenerateOptions = {
        provider: 'codex-local', model: 'gpt-6-astra', sessionId: SessionId('canonical-compaction-continuation'),
        messages: [{ id: MessageId('user-1'), role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'first request' }] }],
      }
      const first = await collect(adapter, request)
      const finish = first.findLast(chunk => chunk.type === 'finish')
      if (finish?.type !== 'finish') throw new Error('first turn did not finish')
      const answer: Message = {
        id: MessageId('assistant-1'), role: 'assistant',
        source: { kind: 'model', provider: request.provider, model: request.model, replayState: finish.replayState },
        content: [{ type: 'text', text: 'answer 1' }],
      }
      const next: Message = {
        id: MessageId('user-2'), role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'continue' }],
      }
      const second = await collect(adapter, { ...request, messages: [...request.messages, answer, next] })
      // The runner only supplies protocol events. This proves adapter reuse,
      // not the model's summary content or checkpoint persistence after restart.
      expect(opens).toBe(1)
      expect(disposals).toBe(0)
      expect(requests).toHaveLength(2)
      expect(requests[1]).toEqual({ input: [{ type: 'text', text: 'continue', text_elements: [] }], signal: expect.any(AbortSignal) })
      expect(first.at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'stop' } })
      expect(second.at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'stop' } })
    } finally {
      await adapter.dispose()
    }
  })
})

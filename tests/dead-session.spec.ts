import { describe, expect, it, vi } from 'vitest'
import type { CodexAppServerEvent, CodexAppServerRequest, CodexAppServerRunnerPort, CodexAppServerThreadPort, CodexAppServerThreadRequest, CodexAppServerTurnRequest, JsonValue } from '../src/runner.ts'
import { CodexSessionCache } from '../src/session-cache.ts'
import type { CodexSessionRequest } from '../src/session-cache.ts'
const user = (text: string): JsonValue => ({ type: 'message', role: 'user', content: [{ type: 'input_text', text }] })
const assistant = (text: string): JsonValue => ({ type: 'message', id: `assistant-${text}`, role: 'assistant', content: [{ type: 'output_text', text }] })
class FakeThread implements CodexAppServerThreadPort {
  closed = false
  readonly threadId: string
  readonly requests: CodexAppServerTurnRequest[] = []
  readonly dispose = vi.fn(async () => {})

  constructor(index: number) {
    this.threadId = `thread-${index}`
  }

  stream(request: CodexAppServerTurnRequest): AsyncIterable<CodexAppServerEvent> {
    this.requests.push(request)
    return (async function * () {})()
  }
}

function fixture() {
  const threads: FakeThread[] = []
  const runner: CodexAppServerRunnerPort = {
    open: vi.fn(async (_request: CodexAppServerThreadRequest) => {
      const thread = new FakeThread(threads.length + 1)
      threads.push(thread)
      return thread
    }),
    stream: vi.fn((_request: CodexAppServerRequest) => (async function * () {})()),
  }
  const cache = new CodexSessionCache({
    runner, maxSessions: 8, idleTimeoutMs: 600_000, onCleanupError: vi.fn(),
  })
  return { cache, runner, threads }
}

function request(
  sessionId: string,
  history: readonly JsonValue[],
  overrides: Partial<CodexSessionRequest> = {},
): CodexSessionRequest {
  return {
    sessionId,
    epoch: { version: 1 },
    thread: { model: 'gpt-5.6-sol', modelProvider: 'openai', system: 'Harness system', dynamicTools: [] },
    history,
    loadInjectedHistory: () => Promise.resolve(history),
    loadUserInput: content => Promise.resolve(content.map((item) => {
      if (item === null || typeof item !== 'object' || Array.isArray(item)
        || item.type !== 'input_text' || typeof item.text !== 'string') {
        throw new Error('test user input is not text')
      }
      return { type: 'text', text: item.text, text_elements: [] }
    })),
    loadToolResult: result => Promise.resolve({
      callId: result.callId,
      contentItems: [{ type: 'inputText', text: typeof result.output === 'string' ? result.output : JSON.stringify(result.output) }],
      success: result.success,
    }),
    toolResults: [],
    ...overrides,
  }
}

describe('closed cached process recovery', () => {
  it('reconstructs from durable history when the cached process has already closed', async () => {
    const { cache, runner, threads } = fixture()
    try {
      const history = [user('first'), assistant('answer')]
      const first = await cache.begin(request('dead-session', [history[0]!]))
      first.commit(history)
      threads[0]!.closed = true
      const nextHistory = [...history, user('next')]
      const step = await cache.begin(request('dead-session', nextHistory))
      expect(runner.open).toHaveBeenCalledTimes(2)
      expect(threads[0]!.dispose).toHaveBeenCalledOnce()
      expect(threads[0]!.requests).toHaveLength(1)
      expect(threads[1]!.requests[0]).toMatchObject({ injectedItems: nextHistory })
      await step.discard()
    } finally { await cache.dispose() }
  })

  it('reconstructs a closed tool-waiting process using the recorded tool result, not a second tool call', async () => {
    const { cache, runner, threads } = fixture()
    try {
      const initial = user('first')
      const call: JsonValue = { type: 'function_call', call_id: 'call-1', name: 'read_file', arguments: '{}' }
      const first = await cache.begin(request('dead-tool', [initial]))
      first.commit([initial, call], 'call-1')
      threads[0]!.closed = true
      const result: JsonValue = { type: 'function_call_output', call_id: 'call-1', output: 'already executed' }
      const history = [initial, call, result]
      const step = await cache.begin(request('dead-tool', history, {
        toolResults: [{ callId: 'call-1', output: 'already executed', success: true }],
      }))
      expect(runner.open).toHaveBeenCalledTimes(2)
      expect(threads[1]!.requests[0]).toMatchObject({ injectedItems: history })
      expect(threads[1]!.requests[0]!.toolResult).toBeUndefined()
      await step.discard()
    } finally { await cache.dispose() }
  })
})

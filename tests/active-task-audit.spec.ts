import { PassThrough } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'
import type { SubprocessHandle, SubprocessOutcome } from '@deepseek-ai/dsh-subprocess'
import { CodexAppServerRunner } from '../src/runner.ts'
import type { CodexAppServerRunnerPort, CodexAppServerThreadPort, JsonValue } from '../src/runner.ts'
import { CodexSessionCache } from '../src/session-cache.ts'
import type { CodexSessionRequest } from '../src/session-cache.ts'

// Virtual-time controls prove timer semantics, not an hour of real inference.
describe('active-task audit controls', () => {
  it('keeps a live model turn across one simulated hour with timeoutMs zero', async () => {
    const input = new PassThrough()
    const output = new PassThrough()
    const done = Promise.withResolvers<SubprocessOutcome>()
    const ready = Promise.withResolvers<void>()
    const send = (value: unknown) => output.write(JSON.stringify(value) + '\n')
    let buffer = ''
    input.setEncoding('utf8')
    input.on('data', (chunk: string) => {
      buffer += chunk
      let newline: number
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const message = JSON.parse(buffer.slice(0, newline))
        buffer = buffer.slice(newline + 1)
        if (message.method === 'initialize') send({ id: message.id, result: {} })
        if (message.method === 'thread/start') send({ id: message.id, result: { thread: { id: 'thread' } } })
        if (message.method === 'turn/start') {
          send({ id: message.id, result: { turn: { id: 'turn' } } })
          ready.resolve()
        }
      }
    })
    const child: SubprocessHandle = {
      stdin: input, stdout: output, stderr: undefined, collected: {}, done: done.promise,
      terminate: vi.fn(() => { output.end(); done.resolve({ exitCode: 0, signal: null }) }),
      waitForExit: async () => true,
    }
    const runner = new CodexAppServerRunner({ timeoutMs: 0, disposeGraceMs: 100,
      maxJsonRpcLineBytes: 65536, maxStderrBytes: 1024, env: {}, spawn: () => child })
    const thread = await runner.open({ model: 'fixture-model', modelProvider: 'openai', system: '', dynamicTools: [] })
    vi.useFakeTimers()
    try {
      const iterator = thread.stream({ input: [] })[Symbol.asyncIterator]()
      await iterator.next()
      const terminal = iterator.next()
      await ready.promise
      await vi.advanceTimersByTimeAsync(3_600_000)
      expect(child.terminate).not.toHaveBeenCalled()
      send({ method: 'turn/completed', params: { threadId: 'thread', turn: { id: 'turn', status: 'completed', error: null } } })
      expect(await terminal).toMatchObject({ done: false, value: { method: 'turn/completed' } })
      await iterator.return?.()
    } finally {
      vi.useRealTimers()
      await thread.dispose()
      input.destroy(); output.destroy()
    }
  })

  it('does not idle-expire or capacity-evict active cached sessions', async () => {
    const threads: Array<CodexAppServerThreadPort & { dispose: ReturnType<typeof vi.fn> }> = []
    const runner: CodexAppServerRunnerPort = {
      async open() {
        const thread = { threadId: String(threads.length), dispose: vi.fn(async () => {}),
          stream: () => (async function* () {})() }
        threads.push(thread)
        return thread
      },
      stream: () => (async function* () {})(),
    }
    const cache = new CodexSessionCache({ runner, maxSessions: 1, idleTimeoutMs: 600_000, onCleanupError: vi.fn() })
    const request = (sessionId: string): CodexSessionRequest => {
      const history: JsonValue[] = [{ type: 'message', role: 'user', content: [{ type: 'input_text', text: sessionId }] }]
      return { sessionId, epoch: {}, thread: { model: 'fixture', modelProvider: 'openai', system: '', dynamicTools: [] },
        history, toolResults: [], loadInjectedHistory: async () => history, loadUserInput: async value => value,
        loadToolResult: async result => ({ callId: result.callId, success: result.success, contentItems: [{ type: 'inputText', text: 'recorded result' }] }) }
    }
    vi.useFakeTimers()
    try {
      await cache.begin(request('active-a'))
      await cache.begin(request('active-b'))
      await vi.advanceTimersByTimeAsync(3_600_000)
      expect(threads).toHaveLength(2)
      expect(threads.every(thread => thread.dispose.mock.calls.length === 0)).toBe(true)
    } finally {
      await cache.dispose()
      vi.useRealTimers()
    }
  })
})

import { PassThrough } from 'node:stream'
import { existsSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import type {
  SubprocessHandle,
  SubprocessOutcome,
  SubprocessSpawnSpec,
} from '@deepseek-ai/dsh-subprocess'
import {
  CODEX_APP_SERVER_VERSION,
  CodexAppServerRunner,
  codexAppServerArgv,
  codexCliEntry,
} from '../src/runner.ts'
import type {
  CodexAppServerEvent,
  CodexAppServerRequest,
  CodexAppServerRunnerOptions,
  CodexAppServerThreadPort,
  CodexAppServerTurnRequest,
} from '../src/runner.ts'

interface JsonObject {
  readonly [key: string]: unknown
}

type Script = (
  message: JsonObject,
  send: (message: JsonObject) => void,
  sendRaw: (text: string) => void,
) => void

function object(value: unknown): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('expected object')
  return value as JsonObject
}

function scriptedHandle(script: Script): SubprocessHandle {
  const stdin = new PassThrough()
  const stdout = new PassThrough()
  const outcome = Promise.withResolvers<SubprocessOutcome>()
  let input = ''
  let stopped = false
  const send = (message: JsonObject): void => {
    stdout.write(`${JSON.stringify(message)}\n`)
  }
  stdin.setEncoding('utf8')
  stdin.on('data', (chunk: string) => {
    input += chunk
    while (true) {
      const newline = input.indexOf('\n')
      if (newline === -1) return
      const line = input.slice(0, newline)
      input = input.slice(newline + 1)
      if (line.trim().length !== 0) script(object(JSON.parse(line)), send, text => { stdout.write(text) })
    }
  })
  const terminate = vi.fn(() => {
    if (stopped) return
    stopped = true
    stdout.end()
    outcome.resolve({ exitCode: 0, signal: null })
  })
  return {
    stdin,
    stdout,
    stderr: undefined,
    collected: {
      stderr: { readFrom: () => ({ text: '', nextOffset: 0, lossy: false }) },
    },
    done: outcome.promise,
    terminate,
    waitForExit: vi.fn(async () => true),
  }
}

function standardScript(afterTurn: (send: (message: JsonObject) => void) => void): Script {
  return (message, send) => {
    if (message.method === 'initialize') {
      send({ id: message.id, result: { userAgent: `codex_app_server/${CODEX_APP_SERVER_VERSION}` } })
    } else if (message.method === 'thread/start') {
      send({
        id: message.id,
        result: {
          thread: { id: 'thread-1' },
          instructionSources: [{ path: 'C:/Users/test/.codex/AGENTS.md' }],
        },
      })
    } else if (message.method === 'thread/inject_items') {
      send({ id: message.id, result: {} })
    } else if (message.method === 'turn/start') {
      send({ id: message.id, result: { turn: { id: 'turn-1' } } })
      afterTurn(send)
    }
  }
}

function request(overrides: Partial<CodexAppServerRequest> = {}): CodexAppServerRequest {
  return {
    model: 'gpt-5.6-sol',
    modelProvider: 'openai',
    system: 'Harness system',
    history: [{ type: 'message', role: 'user', content: [{ type: 'input_text', text: 'hello' }] }],
    dynamicTools: [],
    ...overrides,
  }
}

function runner(
  script: Script,
  overrides: Partial<CodexAppServerRunnerOptions> = {},
): { runner: CodexAppServerRunner; child: SubprocessHandle; spec: () => SubprocessSpawnSpec } {
  const child = scriptedHandle(script)
  let spawned: SubprocessSpawnSpec | undefined
  return {
    child,
    spec: () => {
      if (spawned === undefined) throw new Error('process was not spawned')
      return spawned
    },
    runner: new CodexAppServerRunner({
      timeoutMs: 1_000,
      disposeGraceMs: 25,
      maxJsonRpcLineBytes: 100_000,
      maxStderrBytes: 1_000,
      env: { CODEX_HOME: 'configured-home' },
      spawn: (candidate) => {
        spawned = candidate
        expect(existsSync(candidate.cwd)).toBe(true)
        return child
      },
      ...overrides,
    }),
  }
}

async function collect(instance: CodexAppServerRunner, input: CodexAppServerRequest): Promise<CodexAppServerEvent[]> {
  const events: CodexAppServerEvent[] = []
  for await (const event of instance.stream(input)) events.push(event)
  return events
}

async function collectTurn(
  thread: CodexAppServerThreadPort,
  input: CodexAppServerTurnRequest,
): Promise<CodexAppServerEvent[]> {
  const events: CodexAppServerEvent[] = []
  for await (const event of thread.stream(input)) events.push(event)
  return events
}

describe('Codex App Server runner', () => {
  it('selects HTTP while preserving Codex feature policy, login and compaction', () => {
    expect(existsSync(codexCliEntry())).toBe(true)
    const argv = codexAppServerArgv()
    expect(argv).toEqual([
      process.execPath, codexCliEntry(), 'app-server', '--stdio',
      '-c', 'model_providers.dsh-openai-http={name="OpenAI",requires_openai_auth=true,supports_websockets=false}',
    ])
    expect(argv).not.toContain('--strict-config')
    expect(argv).not.toContain('--disable')
    expect(argv).not.toContain('--enable')
    expect(argv).not.toContain('--dangerously-bypass-approvals-and-sandbox')
    const search = codexAppServerArgv('live')
    expect(search).toContain('web_search="live"')
    expect(search).not.toContain('--disable')
    expect(codexAppServerArgv('disabled', false)).toEqual([
      process.execPath, codexCliEntry(), 'app-server', '--stdio',
      '-c', 'model_providers.dsh-openai-http={name="OpenAI",requires_openai_auth=true,supports_websockets=false}',
      '-c', 'web_search="disabled"', '--disable', 'image_generation',
    ])
  })

  it('uses DSH skill discovery without changing other native capabilities', async () => {
    const setup = runner(standardScript(send => send({ method: 'turn/completed', params: {
      threadId: 'thread-1', turn: { id: 'turn-1', status: 'completed', error: null },
    } })), { skillsMode: 'dsh', skillsMaxContextTokens: 10000 })
    await collect(setup.runner, request())
    expect(setup.spec().argv).toContain('skills.max_context_tokens=10000')
    expect(setup.spec().argv).toContain('skills.include_instructions=false')
    expect(setup.spec().argv).toContain('features.skip_host_skill_discovery=true')
    expect(setup.spec().argv).not.toContain('--disable')
    expect(setup.spec().argv.join(' ')).not.toMatch(/orchestrator|CODEX_HOME|plugins.*false/)
    expect(codexAppServerArgv(undefined, true, 'openai', 'native', 7000)).toContain('skills.max_context_tokens=7000')
    expect(codexAppServerArgv(undefined, true, 'openai', 'native')).not.toContain('skills.include_instructions=false')
  })

  it('starts an ephemeral thread, injects history, streams events, and reaches quiescence', async () => {
    const messages: JsonObject[] = []
    const setup = runner((message, send, sendRaw) => {
      messages.push(message)
      standardScript((write) => {
        write({ method: 'item/agentMessage/delta', params: {
          threadId: 'thread-1', turnId: 'turn-1', itemId: 'message-1', delta: 'hello',
        } })
        write({ method: 'turn/completed', params: {
          threadId: 'thread-1',
          turn: { id: 'turn-1', status: 'completed', error: null },
        } })
      })(message, send, sendRaw)
    })

    const events = await collect(setup.runner, request({ reasoningEffort: 'high' }))
    expect(events[0]).toMatchObject({
      kind: 'thread-started',
      threadId: 'thread-1',
      instructionSources: [{ path: 'C:/Users/test/.codex/AGENTS.md' }],
    })
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'notification', method: 'item/agentMessage/delta' }),
      expect.objectContaining({ kind: 'notification', method: 'turn/completed' }),
    ]))
    expect(messages.find(message => message.method === 'initialize')).toMatchObject({
      params: { clientInfo: { name: 'deepseek-harness', version: '0.1.19' } },
    })
    expect(messages.find(message => message.method === 'thread/start')).toMatchObject({
      params: {
        baseInstructions: 'Harness system',
        dynamicTools: [],
        ephemeral: true,
        experimentalRawEvents: true,
      },
    })
    const threadParams = object(messages.find(message => message.method === 'thread/start')?.params)
    expect(threadParams).not.toHaveProperty('developerInstructions')
    expect(threadParams).not.toHaveProperty('sandbox')
    expect(threadParams).not.toHaveProperty('approvalPolicy')
    expect(messages.find(message => message.method === 'thread/inject_items')).toMatchObject({
      params: { threadId: 'thread-1', items: request().history },
    })
    expect(messages.find(message => message.method === 'turn/start')).toMatchObject({
      params: { threadId: 'thread-1', input: [], effort: 'high' },
    })
    expect(setup.spec()).toMatchObject({
      stdio: { stdin: 'pipe', stdout: 'pipe', stderr: { maxBytes: 1_000 } },
      env: { CODEX_HOME: 'configured-home' },
    })
    expect(existsSync(setup.spec().cwd)).toBe(false)
    expect(setup.child.terminate).toHaveBeenCalledOnce()
    expect(setup.child.waitForExit).toHaveBeenCalledOnce()
  })

  it('uses authenticated HTTP for OpenAI without changing another provider', async () => {
    for (const provider of ['openai', 'custom-provider']) {
      const messages: JsonObject[] = []
      const setup = runner((message, send, sendRaw) => {
        messages.push(message)
        standardScript((write) => {
          write({ method: 'turn/completed', params: {
            threadId: 'thread-1',
            turn: { id: 'turn-1', status: 'completed', error: null },
          } })
        })(message, send, sendRaw)
      })
      await collect(setup.runner, request({ modelProvider: provider }))
      const params = object(messages.find(message => message.method === 'thread/start')?.params)
      if (provider === 'openai') {
        expect(setup.spec().argv).toContain(
          'model_providers.dsh-openai-http={name="OpenAI",requires_openai_auth=true,supports_websockets=false}',
        )
        expect(params.modelProvider).toBe('dsh-openai-http')
      } else {
        expect(setup.spec().argv.some(argument => argument.includes('dsh-openai-http'))).toBe(false)
        expect(params.modelProvider).toBe(provider)
      }
      expect(params).not.toHaveProperty('sandbox')
      expect(params).not.toHaveProperty('approvalPolicy')
      expect(setup.spec().env).toEqual({ CODEX_HOME: 'configured-home' })
    }
  })

  it('starts a live-search process only for an explicit search request', async () => {
    const setup = runner(standardScript((write) => {
      write({ method: 'turn/completed', params: {
        threadId: 'thread-1',
        turn: { id: 'turn-1', status: 'completed', error: null },
      } })
    }))

    await collect(setup.runner, request({ webSearch: 'live' }))

    expect(setup.spec().argv).toContain('web_search="live"')
    expect(setup.spec().argv).not.toEqual(expect.arrayContaining(['--disable', 'standalone_web_search']))
  })

  it('applies the image-generation policy to each new process', async () => {
    const setup = runner(standardScript((write) => {
      write({ method: 'turn/completed', params: {
        threadId: 'thread-1',
        turn: { id: 'turn-1', status: 'completed', error: null },
      } })
    }))

    await collect(setup.runner, request({ imageGenerationEnabled: false }))

    expect(setup.spec().argv).toEqual(expect.arrayContaining(['--disable', 'image_generation']))
    const enabledFeatures = setup.spec().argv.flatMap(
      (argument, index) => argument === '--enable' ? [setup.spec().argv[index + 1]] : [],
    )
    expect(enabledFeatures).not.toContain('image_generation')
  })

  it('hands a dynamic tool request back without sending a provider-side result', async () => {
    const messages: JsonObject[] = []
    const setup = runner((message, send, sendRaw) => {
      messages.push(message)
      standardScript((write) => {
        write({
          id: 'server-call-1',
          method: 'item/tool/call',
          params: {
            threadId: 'thread-1',
            turnId: 'turn-1',
            callId: 'call-1',
            namespace: 'deepseek_harness',
            tool: 'read_file',
            arguments: { path: 'a.txt' },
          },
        })
      })(message, send, sendRaw)
    })

    await expect(collect(setup.runner, request())).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'server-request',
        id: 'server-call-1',
        method: 'item/tool/call',
      }),
    ]))
    expect(messages.some(message => message.id === 'server-call-1')).toBe(false)
    expect(setup.child.terminate).toHaveBeenCalledOnce()
  })

  it('reports and rejects an unnamespaced tool request without handing it to Harness', async () => {
    const messages: JsonObject[] = []
    const setup = runner((message, send, sendRaw) => {
      messages.push(message)
      standardScript((write) => {
        write({
          id: 'native-skill-1',
          method: 'item/tool/call',
          params: {
            threadId: 'thread-1',
            turnId: 'turn-1',
            callId: 'native-skill-1',
            namespace: null,
            tool: 'skill',
            arguments: { name: 'imagegen' },
          },
        })
      })(message, send, sendRaw)
      if (message.id === 'native-skill-1') {
        expect(message.error).toMatchObject({
          code: -32_001,
          message: 'DeepSeek Harness cannot answer item/tool/call',
        })
        send({ method: 'turn/completed', params: {
          threadId: 'thread-1',
          turn: { id: 'turn-1', status: 'completed', error: null },
        } })
      }
    })

    const events = await collect(setup.runner, request())
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'server-request',
        id: 'native-skill-1',
        method: 'item/tool/call',
        resolution: 'rejected',
      }),
      expect.objectContaining({ kind: 'notification', method: 'turn/completed' }),
    ]))
    expect(messages.some(message => message.id === 'native-skill-1' && message.result !== undefined)).toBe(false)
  })

  it('keeps one ephemeral process alive across serialized turns', async () => {
    const messages: JsonObject[] = []
    let nextTurn = 0
    const setup = runner((message, send, sendRaw) => {
      messages.push(message)
      if (message.method === 'turn/start') {
        nextTurn += 1
        const id = `turn-${String(nextTurn)}`
        send({ id: message.id, result: { turn: { id } } })
        send({ method: 'turn/completed', params: {
          threadId: 'thread-1',
          turn: { id, status: 'completed', error: null },
        } })
      } else {
        standardScript(() => {})(message, send, sendRaw)
      }
    })

    const thread = await setup.runner.open(request())
    const first = await collectTurn(thread, {
      injectedItems: request().history,
      input: [],
    })
    expect(first[0]).toMatchObject({ kind: 'thread-started', threadId: 'thread-1' })
    expect(setup.child.terminate).not.toHaveBeenCalled()
    expect(existsSync(setup.spec().cwd)).toBe(true)

    const second = await collectTurn(thread, {
      input: [{ type: 'text', text: 'follow up', text_elements: [] }],
    })
    expect(second.some(event => event.kind === 'thread-started')).toBe(false)
    expect(messages.filter(message => message.method === 'thread/start')).toHaveLength(1)
    expect(messages.filter(message => message.method === 'turn/start')).toHaveLength(2)
    expect(messages.filter(message => message.method === 'turn/start')[1]).toMatchObject({
      params: { input: [{ type: 'text', text: 'follow up', text_elements: [] }] },
    })

    await thread.dispose()
    expect(existsSync(setup.spec().cwd)).toBe(false)
    expect(setup.child.terminate).toHaveBeenCalledOnce()
    expect(setup.child.waitForExit).toHaveBeenCalledOnce()
  })

  it('steers additional user messages after starting a warm turn', async () => {
    const messages: JsonObject[] = []
    const setup = runner((message, send, sendRaw) => {
      messages.push(message)
      if (message.method === 'turn/start') {
        send({ id: message.id, result: { turn: { id: 'turn-1' } } })
      } else if (message.method === 'turn/steer') {
        send({ id: message.id, result: {} })
        send({ method: 'turn/completed', params: {
          threadId: 'thread-1',
          turn: { id: 'turn-1', status: 'completed', error: null },
        } })
      } else {
        standardScript(() => {})(message, send, sendRaw)
      }
    })

    const thread = await setup.runner.open(request())
    await expect(collectTurn(thread, {
      input: [{ type: 'text', text: 'first', text_elements: [] }],
      steeringInputs: [[{ type: 'text', text: 'second', text_elements: [] }]],
    })).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'notification', method: 'turn/completed' }),
    ]))
    expect(messages.find(message => message.method === 'turn/steer')).toMatchObject({
      params: {
        threadId: 'thread-1',
        expectedTurnId: 'turn-1',
        input: [{ type: 'text', text: 'second', text_elements: [] }],
      },
    })
    await thread.dispose()
  })

  it('holds a dynamic-tool callback across Harness steps and resumes the same turn', async () => {
    const messages: JsonObject[] = []
    const setup = runner((message, send, sendRaw) => {
      messages.push(message)
      standardScript((write) => {
        write({
          id: 'server-call-1',
          method: 'item/tool/call',
          params: {
            threadId: 'thread-1',
            turnId: 'turn-1',
            callId: 'call-1',
            namespace: 'deepseek_harness',
            tool: 'read_file',
            arguments: { path: 'a.txt' },
          },
        })
      })(message, send, sendRaw)
      if (message.id === 'server-call-1') {
        expect(message.result).toEqual({
          contentItems: [
            { type: 'inputText', text: 'file text' },
            { type: 'inputImage', imageUrl: 'data:image/png;base64,AAAA' },
          ],
          success: true,
        })
        send({ method: 'turn/completed', params: {
          threadId: 'thread-1',
          turn: { id: 'turn-1', status: 'completed', error: null },
        } })
      }
    })

    const thread = await setup.runner.open(request())
    const first = await collectTurn(thread, { injectedItems: request().history })
    expect(first).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'server-request', id: 'server-call-1' }),
    ]))
    expect(setup.child.terminate).not.toHaveBeenCalled()

    await expect(collectTurn(thread, {
      toolResult: {
        callId: 'call-1',
        contentItems: [
          { type: 'inputText', text: 'file text' },
          { type: 'inputImage', imageUrl: 'data:image/png;base64,AAAA' },
        ],
        success: true,
      },
    })).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'notification', method: 'turn/completed' }),
    ]))
    expect(messages.filter(message => message.method === 'turn/start')).toHaveLength(1)
    await thread.dispose()
  })

  it('responds to a dynamic-tool callback before steering queued inbox messages', async () => {
    const messages: JsonObject[] = []
    let steers = 0
    const setup = runner((message, send, sendRaw) => {
      messages.push(message)
      standardScript((write) => {
        write({
          id: 'server-call-steer',
          method: 'item/tool/call',
          params: {
            threadId: 'thread-1',
            turnId: 'turn-1',
            callId: 'call-steer',
            namespace: 'deepseek_harness',
            tool: 'subagent',
            arguments: {},
          },
        })
      })(message, send, sendRaw)
      if (message.method === 'turn/steer') {
        steers += 1
        send({ id: message.id, result: {} })
        if (steers === 2) {
          send({ method: 'turn/completed', params: {
            threadId: 'thread-1',
            turn: { id: 'turn-1', status: 'completed', error: null },
          } })
        }
      }
    })

    const thread = await setup.runner.open(request())
    await collectTurn(thread, {})
    await expect(collectTurn(thread, {
      toolResult: {
        callId: 'call-steer',
        contentItems: [{ type: 'inputText', text: 'started' }],
        success: true,
      },
      steeringInputs: [
        [{ type: 'text', text: 'report', text_elements: [] }],
        [{ type: 'text', text: 'settled', text_elements: [] }],
      ],
    })).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'notification', method: 'turn/completed' }),
    ]))

    const responseIndex = messages.findIndex(message => message.id === 'server-call-steer')
    const steerIndexes = messages.flatMap((message, index) => message.method === 'turn/steer' ? [index] : [])
    expect(responseIndex).toBeGreaterThan(-1)
    expect(steerIndexes).toHaveLength(2)
    expect(steerIndexes.every(index => index > responseIndex)).toBe(true)
    expect(steerIndexes.map(index => messages[index]?.params)).toEqual([
      expect.objectContaining({ expectedTurnId: 'turn-1', input: [{ type: 'text', text: 'report', text_elements: [] }] }),
      expect.objectContaining({ expectedTurnId: 'turn-1', input: [{ type: 'text', text: 'settled', text_elements: [] }] }),
    ])
    await thread.dispose()
  })

  it('disposes a thread after a mismatched dynamic-tool result', async () => {
    const setup = runner(standardScript((send) => {
      send({
        id: 'server-call-1',
        method: 'item/tool/call',
        params: {
          threadId: 'thread-1',
          turnId: 'turn-1',
          callId: 'call-1',
          namespace: 'deepseek_harness',
          tool: 'read_file',
          arguments: { path: 'a.txt' },
        },
      })
    }))
    const thread = await setup.runner.open(request())
    await collectTurn(thread, {})

    await expect(collectTurn(thread, {
      toolResult: { callId: 'wrong-call', contentItems: [{ type: 'inputText', text: 'file text' }], success: true },
    })).rejects.toMatchObject({ code: 'INVALID_CONTINUATION' })
    expect(setup.child.terminate).toHaveBeenCalledOnce()
  })

  it('rejects a concurrent continuation while its owner still consumes the thread', async () => {
    const setup = runner(standardScript(() => {}))
    const thread = await setup.runner.open(request())
    const first = thread.stream({})[Symbol.asyncIterator]()
    await expect(first.next()).resolves.toMatchObject({
      done: false,
      value: { kind: 'thread-started', threadId: 'thread-1' },
    })
    await expect(collectTurn(thread, {})).rejects.toMatchObject({ code: 'INVALID_CONTINUATION' })
    await first.return?.()
    expect(setup.child.terminate).toHaveBeenCalledOnce()
  })


  it('waits for a native question answer and returns it over the same RPC', async () => {
    const ready = Promise.withResolvers<AbortSignal>()
    const choice = Promise.withResolvers<import('../src/wire.ts').JsonObject | null>()
    const questions = {
      ask: vi.fn((_params, sessionId, signal) => {
        expect(sessionId).toBe('session-1')
        ready.resolve(signal)
        return choice.promise
      }),
      notify: vi.fn(),
    }
    let response: unknown
    const setup = runner((message, send, raw) => {
      standardScript(write => write({
        id: 'question-1', method: 'item/tool/requestUserInput',
        params: { threadId: 'thread-1', turnId: 'turn-1', itemId: 'q1', isBlocking: true,
          questions: [{ id: 'scope', header: 'Scope', question: 'Choose?', options: [{ label: 'Keep', description: 'Keep running' }] }] },
      }))(message, send, raw)
      if (message.id === 'question-1') {
        response = message.result
        send({ method: 'turn/completed', params: { threadId: 'thread-1', turn: { id: 'turn-1', status: 'completed', error: null } } })
      }
    }, { timeoutMs: 0, questions })
    const pending = collect(setup.runner, request({ sessionId: 'session-1' }))
    await ready.promise
    expect(response).toBeUndefined()
    choice.resolve({ answers: { scope: { answers: ['Keep'] } } })
    const events = await pending
    expect(response).toEqual({ answers: { scope: { answers: ['Keep'] } } })
    expect(events).toContainEqual(expect.objectContaining({ method: 'item/tool/requestUserInput', resolution: 'answered' }))
  })

  it('publishes native async questions without waiting or inventing an RPC reply', async () => {
    const questions = { ask: vi.fn(), notify: vi.fn() }
    const item = { id: 'async-q', type: 'agentMessage', delivery: 'async', text: 'Choose?',
      questions: [{ title: 'Choose?', options: ['Keep', 'Clear'] }] }
    const setup = runner(standardScript(send => {
      send({ method: 'item/completed', params: { threadId: 'thread-1', turnId: 'turn-1', item } })
      send({ method: 'turn/completed', params: { threadId: 'thread-1', turn: { id: 'turn-1', status: 'completed', error: null } } })
    }), { questions })
    await collect(setup.runner, request({ sessionId: 'session-1' }))
    expect(questions.notify).toHaveBeenCalledWith(item, 'session-1', undefined)
    expect(questions.ask).not.toHaveBeenCalled()
  })

  it('cancels an open native question when the user stops or the pipe closes', async () => {
    for (const end of ['stop', 'pipe'] as const) {
      const ready = Promise.withResolvers<AbortSignal>()
      const stop = new AbortController()
      const questions = {
        ask: vi.fn((_params, _sessionId, signal) => {
          ready.resolve(signal)
          return new Promise<never>((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }))
        }), notify: vi.fn(),
      }
      const setup = runner(standardScript(send => send({
        id: 'question-1', method: 'item/tool/requestUserInput',
        params: { threadId: 'thread-1', turnId: 'turn-1', itemId: 'q1', questions: [] },
      })), { timeoutMs: 0, questions })
      const pending = collect(setup.runner, request({ signal: stop.signal }))
      const rejected = expect(pending).rejects.toMatchObject({ code: end === 'stop' ? 'ABORTED' : 'TRANSPORT' })
      const signal = await ready.promise
      if (end === 'stop') stop.abort(new Error('stop'))
      else setup.child.stdout!.destroy()
      await rejected
      expect(signal.aborted).toBe(true)
      expect(setup.child.terminate).toHaveBeenCalledOnce()
    }
  })

  it('reports an unavailable approval bridge without pretending the user declined', async () => {
    const setup = runner((message, send, sendRaw) => {
      standardScript((write) => {
        write({
          id: 'approval-1',
          method: 'item/commandExecution/requestApproval',
          params: { threadId: 'thread-1', turnId: 'turn-1', itemId: 'command-1' },
        })
      })(message, send, sendRaw)
      if (message.id === 'approval-1') {
        expect(message.error).toMatchObject({ code: -32_001, message: expect.stringContaining('unavailable') })
        send({ method: 'turn/completed', params: {
          threadId: 'thread-1',
          turn: { id: 'turn-1', status: 'completed', error: null },
        } })
      }
    })

    const events = await collect(setup.runner, request())
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'server-request',
        method: 'item/commandExecution/requestApproval',
        resolution: 'rejected',
      }),
      expect.objectContaining({ kind: 'notification', method: 'turn/completed' }),
    ]))
  })

  it('classifies deadline and caller cancellation separately', async () => {
    const opening = runner(() => {}, { timeoutMs: 5 })
    await expect(opening.runner.open(request())).rejects.toMatchObject({ code: 'TIMEOUT' })
    expect(opening.child.terminate).toHaveBeenCalledOnce()

    const hanging = (): Script => standardScript(() => {})
    const timed = runner(hanging(), { timeoutMs: 5 })
    await expect(collect(timed.runner, request())).rejects.toMatchObject({ code: 'TIMEOUT' })

    const controller = new AbortController()
    const cancelled = runner(hanging())
    const pending = collect(cancelled.runner, request({ signal: controller.signal }))
    controller.abort(new Error('stop'))
    await expect(pending).rejects.toMatchObject({ code: 'ABORTED' })
  })

  it('tears down when the stream consumer returns after the first event', async () => {
    const setup = runner(standardScript(() => {}))
    const iterator = setup.runner.stream(request())[Symbol.asyncIterator]()
    await expect(iterator.next()).resolves.toMatchObject({
      done: false,
      value: { kind: 'thread-started', threadId: 'thread-1' },
    })
    await iterator.return?.()

    expect(existsSync(setup.spec().cwd)).toBe(false)
    expect(setup.child.terminate).toHaveBeenCalledOnce()
    expect(setup.child.waitForExit).toHaveBeenCalledOnce()
  })

  it('does not fail solely on diagnostic version text; still rejects malformed JSON-RPC', async () => {
    const mismatched = runner((message, send, raw) => {
      if (message.method === 'initialize') {
        send({ id: message.id, result: { userAgent: 'codex_app_server/0.148.0' } })
        return
      }
      standardScript(write => write({
        method: 'turn/completed',
        params: { threadId: 'thread-1', turn: { id: 'turn-1', status: 'completed', error: null } },
      }))(message, send, raw)
    })
    expect((await collect(mismatched.runner, request())).some(e => e.kind === 'notification' && e.method === 'turn/completed')).toBe(true)
    expect(mismatched.child.terminate).toHaveBeenCalledOnce()

    const malformed = runner((message, send, sendRaw) => {
      standardScript(() => {})(message, send, sendRaw)
      if (message.method === 'turn/start') sendRaw('{not-json}\n')
    })
    await expect(collect(malformed.runner, request())).rejects.toMatchObject({ code: 'MALFORMED_RESPONSE' })
    expect(malformed.child.terminate).toHaveBeenCalledOnce()
  })

  it('accepts a long protocol stream whose individual JSON-RPC lines stay bounded', async () => {
    const setup = runner(standardScript((send) => {
      for (let index = 0; index < 20; index += 1) {
        send({ method: 'item/agentMessage/delta', params: {
          threadId: 'thread-1',
          turnId: 'turn-1',
          itemId: 'message-1',
          delta: `${String(index)}:${'x'.repeat(256)}`,
        } })
      }
      send({ method: 'turn/completed', params: {
        threadId: 'thread-1',
        turn: { id: 'turn-1', status: 'completed', error: null },
      } })
    }), { maxJsonRpcLineBytes: 512 })

    const events = await collect(setup.runner, request())
    expect(events.filter(event => (
      event.kind === 'notification' && event.method === 'item/agentMessage/delta'
    ))).toHaveLength(20)
    expect(setup.child.terminate).toHaveBeenCalledOnce()
  })

  it('bounds each App Server JSON-RPC line', async () => {
    const setup = runner(standardScript((send) => {
      send({ method: 'item/agentMessage/delta', params: {
        threadId: 'thread-1',
        turnId: 'turn-1',
        itemId: 'message-1',
        delta: 'x'.repeat(2_000),
      } })
    }), { maxJsonRpcLineBytes: 512 })

    await expect(collect(setup.runner, request())).rejects.toMatchObject({ code: 'OUTPUT_LIMIT' })
    expect(setup.child.terminate).toHaveBeenCalledOnce()
  })

  it('requires nonempty JSON model and provider identities before spawning', async () => {
    const spawn = vi.fn(() => scriptedHandle(() => {}))
    const instance = new CodexAppServerRunner({
      timeoutMs: 1_000,
      disposeGraceMs: 25,
      maxJsonRpcLineBytes: 1_000,
      maxStderrBytes: 1_000,
      env: {},
      spawn,
    })
    await expect(collect(instance, request({ model: '' }))).rejects.toMatchObject({ code: 'INVALID_MODEL' })
    await expect(collect(instance, request({ modelProvider: '' }))).rejects.toMatchObject({
      code: 'INVALID_PROVIDER',
    })
    expect(spawn).not.toHaveBeenCalled()
  })
})

// End-to-end runner/connection/thread/helper tests; synthetic pipes and Host only.
import type { Context } from '@deepseek-ai/cordis'
import { CodexNativeApprovals } from '../src/native-approvals.ts'

function hostApproval(answer: (request: { signal: AbortSignal; reason?: string }) => Promise<unknown>) {
  const log = [{ type: 'turn/start' }]
  const agent = { session: { id: 'qa-session', get seq() { return log.length }, eventAt: (seq: number) => log[seq] } }
  const asked = vi.fn(answer)
  const ctx = { on() {}, effect() {}, get(name: string) {
    return name === 'agents' ? { get: () => agent } : name === 'approval' ? { request: asked } : undefined
  } } as unknown as Context
  return { bridge: new CodexNativeApprovals(ctx), asked, log }
}

const nativeCommand = { id: 'native-command', type: 'commandExecution', command: 'echo synthetic-only', cwd: '/synthetic', status: 'inProgress' }
const nativeFile = { id: 'native-file', type: 'fileChange', status: 'inProgress', changes: [{ path: '/synthetic/file', kind: { type: 'add' }, diff: '+synthetic-only' }] }
function nativeRequest(send: (message: JsonObject) => void, file = false, decisions: string[] = ['accept', 'decline', 'cancel']) {
  const item = file ? nativeFile : nativeCommand
  send({ method: 'item/started', params: { threadId: 'thread-1', turnId: 'turn-1', item } })
  send({ id: 'native-approval', method: file ? 'item/fileChange/requestApproval' : 'item/commandExecution/requestApproval', params: {
    threadId: 'thread-1', turnId: 'turn-1', itemId: item.id, availableDecisions: decisions,
    ...(file ? { grantRoot: '/synthetic' } : { command: nativeCommand.command, cwd: nativeCommand.cwd }),
  } })
}
function complete(send: (message: JsonObject) => void) { send({ method: 'turn/completed', params: { threadId: 'thread-1', turn: { id: 'turn-1', status: 'completed', error: null } } }) }

describe('native approvals are routed through the actual runner/thread/Host-helper chain', () => {
  it('propagates a failed approval write instead of swallowing it as native cancellation', async () => {
    const h = hostApproval(async () => 'allowed-once')
    const setup = runner((message, send, raw) => {
      standardScript(send => nativeRequest(send))(message, send, raw)
      if (message.id === 'native-approval') throw new Error('synthetic approval write failed')
    }, { approvals: h.bridge })
    try {
      const error = await collect(setup.runner, request({ sessionId: 'qa-session' })).then(
        () => { throw new Error('Expected a transport failure') }, error => error,
      )
      expect(error).toMatchObject({ code: 'TRANSPORT' })
      const causes: string[] = []
      for (let value: unknown = error; value instanceof Error; value = value.cause) causes.push(value.message)
      expect(causes).toContain('synthetic approval write failed')
      expect(h.asked).toHaveBeenCalledOnce()
      expect(setup.child.terminate).toHaveBeenCalledOnce()
    } finally { h.bridge.dispose() }
  })

  it('does not end the owning turn when another thread emits the same turn id', async () => {
    const setup = runner(standardScript(send => {
      send({ method: 'turn/completed', params: { threadId: 'other-thread', turn: { id: 'turn-1', status: 'failed', error: null } } })
      send({ method: 'item/agentMessage/delta', params: { threadId: 'thread-1', turnId: 'turn-1', itemId: 'm', delta: 'still active' } })
      complete(send)
    }))
    const events = await collect(setup.runner, request())
    expect(events).toContainEqual(expect.objectContaining({ method: 'item/agentMessage/delta' }))
    expect(events.filter(e => e.kind === 'notification' && e.method === 'turn/completed')).toHaveLength(1)
  })
  it.each([
    ['allowed-once', 'accept', 'answered'], ['rejected', 'decline', 'declined'],
    ['cancelled', 'cancel', 'declined'], ['unavailable', undefined, 'rejected'],
  ] as const)('maps Host %s without inventing a broader grant', async (outcome, decision, resolution) => {
    const h = hostApproval(async () => outcome); const replies: JsonObject[] = []
    const setup = runner((message, send, raw) => {
      standardScript(send => nativeRequest(send))(message, send, raw)
      if (message.id === 'native-approval') { replies.push(message); complete(send) }
    }, { approvals: h.bridge })
    try {
      const events = await collect(setup.runner, request({ sessionId: 'qa-session' }))
      expect(h.asked).toHaveBeenCalledOnce(); expect(h.asked.mock.calls[0]![0].reason).toContain('echo synthetic-only')
      expect(replies).toHaveLength(1)
      if(decision === undefined){expect(replies[0]).not.toHaveProperty('result');expect(replies[0]?.error).toMatchObject({code:-32001})}
      else expect(replies[0]?.result).toEqual({ decision })
      expect(events).toContainEqual(expect.objectContaining({ kind: 'server-request', resolution }))
      if (outcome === 'unavailable') expect(events).toContainEqual(expect.objectContaining({ resolutionMessage: expect.stringContaining('not a user rejection') }))
    } finally { h.bridge.dispose() }
  })

  it('carries the actual matching file diff to the Host rather than approving vague IDs', async () => {
    const h = hostApproval(async () => 'allowed-once')
    const setup = runner((message, send, raw) => {
      standardScript(send => nativeRequest(send, true))(message, send, raw)
      if (message.id === 'native-approval') { expect(message.result).toEqual({ decision: 'accept' }); complete(send) }
    }, { approvals: h.bridge })
    try { await collect(setup.runner, request({ sessionId: 'qa-session' })); expect(h.asked.mock.calls[0]![0].reason).toContain('+synthetic-only') }
    finally { h.bridge.dispose() }
  })

  it.each(['resolved', 'completed'] as const)('withdraws an already displayed approval on native %s, before next() can consume it', async kind => {
    const late = Promise.withResolvers<unknown>(); let nativeSend: ((message: JsonObject) => void) | undefined; const replies: JsonObject[] = []
    const h = hostApproval(async () => {
      if (kind === 'resolved') nativeSend!({ method: 'serverRequest/resolved', params: { threadId: 'thread-1', requestId: 'native-approval' } })
      complete(nativeSend!)
      return late.promise
    })
    const setup = runner((message, send, raw) => {
      nativeSend = send; standardScript(send => nativeRequest(send))(message, send, raw)
      if (message.id === 'native-approval') replies.push(message)
    }, { approvals: h.bridge })
    try {
      const events = await collect(setup.runner, request({ sessionId: 'qa-session' }))
      expect(h.asked).toHaveBeenCalledOnce(); expect(h.asked.mock.calls[0]![0].signal.aborted).toBe(true)
      late.resolve('allowed-once'); await Promise.resolve()
      expect(replies).toEqual([]); expect(events).toContainEqual(expect.objectContaining({ method: 'turn/completed' }))
    } finally { late.resolve('cancelled'); h.bridge.dispose() }
  })

  it('never upgrades a native session-only grant into one-time Host permission', async () => {
    const h = hostApproval(async () => 'allowed-once'); const replies: JsonObject[] = []
    const setup = runner((message, send, raw) => {
      standardScript(send => nativeRequest(send, false, ['acceptForSession']))(message, send, raw)
      if (message.id === 'native-approval') { replies.push(message); complete(send) }
    }, { approvals: h.bridge })
    try {
      await collect(setup.runner, request({ sessionId: 'qa-session' })); expect(h.asked).not.toHaveBeenCalled()
      expect(replies[0]?.error).toMatchObject({ code: -32_001 }); expect(replies[0]).not.toHaveProperty('result')
    } finally { h.bridge.dispose() }
  })

  it.each(['stop', 'pipe'] as const)('withdraws Host native approval on %s and ignores a late grant', async end => {
    const ready = Promise.withResolvers<AbortSignal>()
    const late = Promise.withResolvers<unknown>()
    const stop = new AbortController()
    const replies: JsonObject[] = []
    const h = hostApproval(async ({ signal }) => { ready.resolve(signal); return late.promise })
    const setup = runner((message, send, raw) => {
      standardScript(send => nativeRequest(send))(message, send, raw)
      if (message.id === 'native-approval') replies.push(message)
    }, { timeoutMs: 0, approvals: h.bridge })
    try {
      const pending = collect(setup.runner, request({ sessionId: 'qa-session', signal: stop.signal }))
      const failed = expect(pending).rejects.toMatchObject({ code: end === 'stop' ? 'ABORTED' : 'TRANSPORT' })
      const signal = await ready.promise
      if (end === 'stop') stop.abort(new Error('synthetic stop'))
      else setup.child.stdout!.destroy()
      await failed
      expect(signal.aborted).toBe(true)
      late.resolve('allowed-once'); await Promise.resolve()
      expect(replies).toEqual([])
      expect(setup.child.terminate).toHaveBeenCalledOnce()
    } finally { late.resolve('cancelled'); h.bridge.dispose() }
  })

  it('reports missing file details as an integration gap, not as a user decision', async () => {
    const h = hostApproval(async () => 'allowed-once')
    const setup = runner((message, send, raw) => {
      standardScript(send => send({ id: 'native-approval', method: 'item/fileChange/requestApproval', params: {
        threadId: 'thread-1', turnId: 'turn-1', itemId: 'unknown-file', grantRoot: '/synthetic',
      } }))(message, send, raw)
      if (message.id === 'native-approval') { expect(message).not.toHaveProperty('result');expect(message.error).toMatchObject({code:-32001}); complete(send) }
    }, { approvals: h.bridge })
    try {
      const events = await collect(setup.runner, request({ sessionId: 'qa-session' }))
      expect(h.asked).not.toHaveBeenCalled()
      expect(events).toContainEqual(expect.objectContaining({ kind: 'server-request', resolution: 'rejected' }))
    } finally { h.bridge.dispose() }
  })

  it('forwards long Unicode and option-looking JSON identities without shell interpretation', async () => {
    const identities = { model: '--model; 模型'.repeat(30), modelProvider: '提供者/'.repeat(30), reasoningEffort: '思考 🌈 '.repeat(15) }
    const received: JsonObject[] = []
    const setup = runner((message, send, raw) => { received.push(message); standardScript(complete)(message, send, raw) })
    await collect(setup.runner, request(identities))
    const started = received.find(x => x.method === 'thread/start')!
    expect(started.params).toMatchObject({ model: identities.model, modelProvider: identities.modelProvider })
    expect(received.find(x => x.method === 'turn/start')?.params).toMatchObject({ effort: identities.reasoningEffort })
    expect(setup.spec().argv).not.toContain(identities.model)
    expect(setup.spec().argv).not.toContain(identities.reasoningEffort)
  })
})

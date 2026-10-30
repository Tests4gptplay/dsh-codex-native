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


import { writeFileSync } from 'node:fs'

// Handwritten contract simulator. No executable/CLI is launched.
// Mirrors public config_manager.rs check_thread_model_provider_for_input + turn_start_inner.
function strictSetup(loadedProvider = 'openai') {
  const transcript: any[] = []
  let active = loadedProvider
  let selected = ''
  const setup = runner((message, send) => {
    transcript.push(message)
    if (message.method === 'initialize') send({id:message.id,result:{userAgent:'contract-fake/1'}})
    else if (message.method === 'thread/start') {
      selected = String(object(message.params).modelProvider)
      send({id:message.id,result:{thread:{id:'synthetic-thread'},instructionSources:[]}})
    } else if (message.method === 'thread/inject_items') send({id:message.id,result:{}})
    else if (message.method === 'turn/start') {
      if (selected !== active) send({id:message.id,error:{code:-32600,message:`model provider mismatch: thread=${selected}; current=${active}`}})
      else {
        send({id:message.id,result:{turn:{id:'synthetic-turn'}}})
        send({method:'turn/completed',params:{threadId:'synthetic-thread',turn:{id:'synthetic-turn',status:'completed',error:null}}})
      }
    }
  })
  const instance = new CodexAppServerRunner({timeoutMs:1000,disposeGraceMs:25,maxJsonRpcLineBytes:100000,maxStderrBytes:1000,env:{},spawn:spec=>{
    transcript.push({argv:spec.argv})
    for (const arg of spec.argv) if (arg.startsWith('model_provider=')) active = JSON.parse(arg.slice('model_provider='.length))
    return setup.child
  }})
  return {instance,child:setup.child,transcript,active:()=>active,setActive:(value:string)=>{active=value}}
}

describe('public provider input contract (synthetic, never actual Codex)',()=>{
  it('default openai transport starts a thread and admits its first turn',async()=>{
    const s = strictSetup()
    try { await collect(s.instance,request()) }
    finally { writeFileSync('request-capture.json',JSON.stringify({scope:'synthetic argv/RPC capture, not real upstream execution',active:s.active(),transcript:s.transcript,terminated:vi.mocked(s.child.terminate).mock.calls.length},null,2)) }
    expect(s.child.terminate).toHaveBeenCalledTimes(1)
  })
  it('explicit custom provider remains custom, independent of loaded default',async()=>{
    const s = strictSetup()
    await collect(s.instance,request({modelProvider:'qa-custom'}))
    expect(s.active()).toBe('qa-custom')
    expect(s.transcript.find(x=>x.method==='thread/start').params.modelProvider).toBe('qa-custom')
  })
  it('already warm thread accepts a second turn without provider mutation',async()=>{
    const s = strictSetup()
    const thread = await s.instance.open(request())
    try {
      await collectTurn(thread,{input:[{type:"text",text:"synthetic next turn"}]})
      await collectTurn(thread,{input:[{type:"text",text:"synthetic next turn"}]})
      expect(s.transcript.filter(x=>x.method==='thread/start')).toHaveLength(1)
      expect(s.transcript.filter(x=>x.method==='turn/start')).toHaveLength(2)
    } finally { await thread.dispose() }
  })
  it('custom already selected in loaded config stays usable',async()=>{
    const s = strictSetup('qa-custom')
    await collect(s.instance,request({modelProvider:'qa-custom'}))
    expect(s.active()).toBe('qa-custom')
  })
  it('cold reopen preserves durable input history and opens a new process binding',async()=>{
    const history=request().history
    const first=strictSetup(); await collect(first.instance,request({history}))
    const second=strictSetup(); await collect(second.instance,request({history}))
    for(const s of [first,second]) {
      expect(s.transcript.find(x=>x.method==='thread/inject_items').params.items).toEqual(history)
      expect(s.child.terminate).toHaveBeenCalledTimes(1)
    }
    expect(first.child).not.toBe(second.child)
  })
  it('later effective provider change fails once and disposes retained thread',async()=>{
    const s=strictSetup();const thread=await s.instance.open(request())
    await collectTurn(thread,{input:[{type:'text',text:'before change'}]})
    s.setActive('qa-changed')
    await expect(collectTurn(thread,{input:[{type:'text',text:'after change'}]})).rejects.toThrow('model provider mismatch')
    expect(s.child.terminate).toHaveBeenCalledTimes(1)
    expect(s.transcript.filter(x=>x.method==='turn/start')).toHaveLength(2)
    await thread.dispose()
  })

  it('skill-discovery helper does not select its internal sentinel as a provider',()=>{
    const args=codexAppServerArgv(undefined,true,'discovery','native',10000)
    expect(args.filter(arg=>arg.startsWith('model_provider='))).toEqual([])
  })

})

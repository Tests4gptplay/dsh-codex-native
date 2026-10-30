import{CodexAppServerAdapter}from'../src/adapter.ts'
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


it.each([undefined,'','Explicit Host system'])('preserves optional system state %s through actual adapter and runner',async(system)=>{
 const calls:any[]=[];const setup=runner((msg,send)=>{calls.push(msg);standardScript(send=>send({method:'turn/completed',params:{threadId:'thread-1',turn:{id:'turn-1',status:'completed'}}}))(msg,send,()=>{})});
 const a=new CodexAppServerAdapter({provider:'synthetic',displayName:'synthetic',modelProvider:'openai',models:[],maxRetries:0,maxRequestImageBytes:0,maxCachedSessions:1,sessionIdleTimeoutMs:1000,onCleanupError:()=>{},resolveAttachments:()=>undefined,runner:setup.runner});
 try{
 const messages:any=[{role:'system',source:{kind:'system-prompt'},content:[{type:'text',text:'Host system in history'}]},{role:'user',source:{kind:'user'},content:[{type:'text',text:'Synthetic question'}]}];
 for await(const chunk of a.stream({provider:'synthetic',model:'synthetic-model',messages,...(system===undefined?{}:{system})})){}
 const params=calls.find(x=>x.method==='thread/start').params;const history=calls.find(x=>x.method==='thread/inject_items').params.items;
 if(system===undefined)expect(params).not.toHaveProperty('baseInstructions');else expect(params.baseInstructions).toBe(system);
 expect(history).toEqual(expect.arrayContaining([expect.objectContaining({role:'developer',content:[{type:'input_text',text:'Host system in history'}]})]));
 }finally{await a.dispose()}
})

it.each([[undefined,''],['',undefined]])('changes cache epoch for omitted/empty system %s -> %s',async(before,after)=>{
 const opens:any[]=[];const disposals:any[]=[];const turn={kind:'notification' as const,method:'turn/completed',params:{threadId:'t',turn:{id:'turn',status:'completed'}}};
 const fake={stream:()=>{throw Error('Only session path expected')},open:async(request:any)=>{opens.push(request);const id=opens.length;return{threadId:'t',dispose:async()=>{disposals.push(id)},async*stream(){yield turn}}}};
 const a=new CodexAppServerAdapter({provider:'synthetic',displayName:'synthetic',modelProvider:'openai',models:[],maxRetries:0,maxRequestImageBytes:0,maxCachedSessions:1,sessionIdleTimeoutMs:1000,onCleanupError:()=>{},resolveAttachments:()=>undefined,runner:fake});
 const user=(text:string)=>({role:'user',source:{kind:'user'},content:[{type:'text',text}]});const msgs:any[]=[];
 try{for(const [i,system]of[before,after,after].entries()){msgs.push(user('message '+i));for await(const chunk of a.stream({provider:'synthetic',model:'synthetic-model',sessionId:'same-owned-session' as any,messages:[...msgs] as any,...(system===undefined?{}:{system})})){} }
 expect(opens).toHaveLength(2);expect(disposals).toEqual([1]);expect(opens[0].system).toBe(before);expect(opens[1].system).toBe(after)
 }finally{await a.dispose()}
})

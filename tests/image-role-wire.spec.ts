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


import {CodexAppServerAdapter} from '../src/adapter.ts'
import {MessageId} from '@deepseek-ai/dsh-llm'
import {AttachmentId} from '@deepseek-ai/dsh-attachment'
import type {CodexImageStorePort} from '../src/images.ts'
describe('role images travel through the real adapter and runner',()=>{
 it.each([false,true])('hydrates role-preserving actual inject_items RPC with source metadata %s',async(withSource)=>{
  const seen:JsonObject[]=[]
  const setup=runner((m,send,raw)=>{seen.push(m);standardScript(send=>send({method:'turn/completed',params:{threadId:'thread-1',turn:{id:'turn-1',status:'completed',error:null}}}))(m,send,raw)})
  const data=Uint8Array.from([1,2,3]);const ref={attachmentId:AttachmentId('synthetic-image'),mediaType:'image/png' as const,bytes:3,width:1,height:1}
  const store:CodexImageStorePort={imageLimits:{maxImageBytes:1024,maxImagesPerMessage:3,maxMessageImageBytes:3072,maxImagePixels:100,maxImageDimension:10,mediaTypes:['image/png']},validateImage:vi.fn(async()=>{}),readImage:vi.fn(async r=>({ref:r,data})),saveImage:vi.fn(async()=>ref)}
  const adapter=new CodexAppServerAdapter({provider:'codex-local',displayName:'QA',modelProvider:'openai',models:[],maxRetries:0,maxRequestImageBytes:3072,maxCachedSessions:1,sessionIdleTimeoutMs:600000,onCleanupError:vi.fn(),resolveAttachments:()=>store,runner:setup.runner})
  const roles=['assistant','system','user'] as const
  const messages=roles.map(role=>({id:MessageId('image-'+role),role,...(withSource?{source:role==='assistant'?{kind:'model' as const,provider:'other',model:'qa'}:{kind:role}}:{}),content:[{type:'text' as const,text:'before-'+role},{type:'image' as const,attachment:ref},{type:'text' as const,text:'after-'+role}]}))
  try{
   for await(const _ of adapter.stream({provider:'codex-local',model:'qa',messages})){}
   const inject=seen.find(x=>x.method==='thread/inject_items')!;expect(inject).toBeDefined()
   const items=(inject.params as {items:unknown[]}).items
   expect(items).toEqual(roles.map(role=>({type:'message',role:role==='system'?'developer':role,content:[{type:role==='assistant'?'output_text':'input_text',text:'before-'+role},{type:'input_image',image_url:'data:image/png;base64,AQID'},{type:role==='assistant'?'output_text':'input_text',text:'after-'+role}]})))
   expect(store.readImage).toHaveBeenCalledTimes(1)
   expect(seen.filter(x=>x.method==='turn/start')).toHaveLength(1)
   expect(messages[0]!.content[1]).toEqual({type:'image',attachment:ref})
  }finally{await adapter.dispose()}
 })
})

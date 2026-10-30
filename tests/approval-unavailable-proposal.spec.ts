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


describe('unavailable is an integration error, not a user decision',()=>{
 it('returns one RPC error, terminates the request, exposes diagnostic, then allows a later valid answer',async()=>{
   let answer='unavailable';const h=hostApproval(async()=>answer);const replies:JsonObject[]=[]
   const setup=runner((message,send,raw)=>{standardScript(send=>nativeRequest(send))(message,send,raw);if(message.id==='native-approval'){replies.push(message);complete(send)}},{approvals:h.bridge})
   try{
     const first=await collect(setup.runner,request({sessionId:'qa-session'}))
     expect(replies).toHaveLength(1);expect(replies[0]).not.toHaveProperty('result');expect(replies[0]?.error).toMatchObject({code:-32001,message:expect.stringContaining('not a user rejection')})
     expect(first).toContainEqual(expect.objectContaining({kind:'server-request',resolution:'rejected',resolutionMessage:expect.stringContaining('not a user rejection')}))
     expect(first).toContainEqual(expect.objectContaining({method:'turn/completed'}))
     answer='allowed-once'
     const recovered=runner((m,send,raw)=>{standardScript(send=>nativeRequest(send))(m,send,raw);if(m.id==='native-approval'){replies.push(m);complete(send)}},{approvals:h.bridge})
     await collect(recovered.runner,request({sessionId:'qa-session'}));expect(replies).toHaveLength(2);expect(replies[1]?.result).toEqual({decision:'accept'});expect(h.asked).toHaveBeenCalledTimes(2)
   }finally{h.bridge.dispose()}
 })
 it.each([['rejected','decline'],['cancelled','cancel']] as const)('preserves actual Host %s',async(outcome,decision)=>{
   const h=hostApproval(async()=>outcome);const setup=runner((m,send,raw)=>{standardScript(send=>nativeRequest(send))(m,send,raw);if(m.id==='native-approval'){expect(m.result).toEqual({decision});complete(send)}},{approvals:h.bridge})
   try{await collect(setup.runner,request({sessionId:'qa-session'}))}finally{h.bridge.dispose()}
 })
})

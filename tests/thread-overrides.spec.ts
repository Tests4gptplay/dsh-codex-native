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


it('preserves upstream environment and root defaults when Host supplied no override',async()=>{
 let params:any;const setup=runner((msg,send)=>{if(msg.method==='thread/start')params=msg.params;standardScript(send=>send({method:'turn/completed',params:{threadId:'thread-1',turn:{id:'turn-1',status:'completed'}}}))(msg,send,()=>{})});
 await collect(setup.runner,request());
 // Independent request assertions. No fabricated refusal behavior in the fake.
 expect(params).not.toHaveProperty('environments');expect(params).not.toHaveProperty('runtimeWorkspaceRoots');
 // Direct pinned upstream Option semantics, not a real environment execution.
 expect(params.environments ?? ['configured-upstream-environment']).toEqual(['configured-upstream-environment']);
})
it('does not replace configured developer instructions or personality with empty/none',async()=>{
 let params:any;const setup=runner((msg,send)=>{if(msg.method==='thread/start')params=msg.params;standardScript(send=>send({method:'turn/completed',params:{threadId:'thread-1',turn:{id:'turn-1',status:'completed'}}}))(msg,send,()=>{})});await collect(setup.runner,request());
 expect(params).not.toHaveProperty('developerInstructions');expect(params).not.toHaveProperty('personality');expect(params).not.toHaveProperty('selectedCapabilityRoots');
})
it('retains explicit DSH model, provider, system and dynamic tools without adding approval bypass',async()=>{
 let params:any;const setup=runner((msg,send)=>{if(msg.method==='thread/start')params=msg.params;standardScript(send=>send({method:'turn/completed',params:{threadId:'thread-1',turn:{id:'turn-1',status:'completed'}}}))(msg,send,()=>{})});const input=request({model:'explicit-model',modelProvider:'custom',system:'Explicit Host system',dynamicTools:[{type:'function',name:'synthetic',inputSchema:{type:'object'}}]});await collect(setup.runner,input);
 expect(params).toMatchObject({model:input.model,modelProvider:'custom',baseInstructions:input.system,dynamicTools:input.dynamicTools});expect(params).not.toHaveProperty('approvalPolicy');expect(params).not.toHaveProperty('sandbox');
})

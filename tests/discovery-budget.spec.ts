import { PassThrough } from 'node:stream'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { SubprocessHandle, SubprocessOutcome, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import { discoverNativeSkills, NativeCodexSkills, searchNativeSkills } from '../src/native-skills.ts'
import type { JsonValue } from '../src/wire.ts'

function fixtures(path = 'C:/skills/authoring/SKILL.md') {
  const local = { data: [{ cwd: 'C:/project', errors: [], skills: [
    { name: 'nte-mod-authoring', description: 'NTE Blender authoring', path, enabled: true },
    { name: 'drive:edit', description: 'local copy', path: 'C:/plugins/drive/SKILL.md', pluginId: 'drive@remote', enabled: true },
    { name: 'edit', description: 'Independent custom skill', path: 'C:/custom/edit/SKILL.md', enabled: true },
    { name: 'disabled', description: 'disabled skill', path: 'C:/disabled/SKILL.md', enabled: false },
  ] }] }
  const installed = { marketplaces: [{ name: 'remote', plugins: [
    { id: 'drive@remote', name: 'drive', installed: true, enabled: true, source: { type: 'remote' }, remotePluginId: 'connector_drive' },
    { id: 'disabled@remote', name: 'disabled', installed: true, enabled: false, source: { type: 'remote' }, remotePluginId: 'connector_disabled' },
  ] }] }
  const details = { plugin: { skills: [
    { name: 'edit', description: 'Edit Google Drive documents', enabled: true },
    { name: 'off', description: 'disabled', enabled: false },
  ] } }
  return { local, installed, details }
}
function requestFixture(path?: string) {
  const data = fixtures(path)
  return vi.fn(async (method: string, _params: Record<string, JsonValue>): Promise<unknown> => {
    if (method === 'skills/list') return data.local
    if (method === 'plugin/installed') return data.installed
    if (method === 'plugin/read') return data.details
    if (method === 'plugin/skill/read') return { contents: '# Remote edit\nUse connected Drive.\nEnd.' }
    throw new Error('Unexpected method ' + method)
  })
}
function processFixture(request: ReturnType<typeof requestFixture>, stall = false) {
  const specs: SubprocessSpawnSpec[] = []
  const terminated = vi.fn()
  const spawn = (spec: SubprocessSpawnSpec): SubprocessHandle => {
    specs.push(spec)
    const input = new PassThrough(), output = new PassThrough()
    const outcome = Promise.withResolvers<SubprocessOutcome>()
    let stopped = false, buffer = ''
    input.setEncoding('utf8')
    input.on('data', (chunk: string) => {
      buffer += chunk
      let at: number
      while ((at = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, at); buffer = buffer.slice(at + 1)
        const message = JSON.parse(line)
        if (message.id === undefined || stall) continue
        const result = message.method === 'initialize' ? Promise.resolve({}) : request(message.method, message.params)
        void result.then(value => { if (!stopped) output.write(JSON.stringify({ id: message.id, result: value }) + '\n') })
      }
    })
    return {
      stdin: input, stdout: output, stderr: undefined, done: outcome.promise,
      terminate: () => {
        if (stopped) return
        stopped = true; terminated(); output.end(); outcome.resolve({ exitCode: 0, signal: null })
      },
      waitForExit: async () => { await outcome.promise; return true },
    }
  }
  return { spawn, specs, terminated }
}
function manager(process: ReturnType<typeof processFixture>) {
  return new NativeCodexSkills({
    spawn: process.spawn, env: {}, maxJsonRpcLineBytes: 1048576, maxStderrBytes: 4096,
    disposeGraceMs: 100, maxContextTokens: 10000,
  })
}


it.each([undefined,10001])('actual discovery spawn preserves skill budget choice %s',async(budget)=>{const process=processFixture(requestFixture());const service=new NativeCodexSkills({spawn:process.spawn,env:{},maxJsonRpcLineBytes:0,maxStderrBytes:1024,disposeGraceMs:1,...(budget===undefined?{}:{maxContextTokens:budget})});try{await service.catalog('/synthetic-owned',new AbortController().signal);expect(process.specs[0].argv.filter(v=>v.startsWith('skills.max_context_tokens='))).toEqual(budget===undefined?[]:[`skills.max_context_tokens=${budget}`]);expect(process.specs[0].argv.some(v=>v.startsWith('model_provider='))).toBe(false)}finally{await service.dispose()}})

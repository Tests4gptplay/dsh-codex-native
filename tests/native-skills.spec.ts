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

describe('DSH Codex skill discovery', () => {
  it('prefers a connector copy of the same plugin and keeps independent local skills', async () => {
    const request = requestFixture()
    const catalog = await discoverNativeSkills(request, 'C:/project')
    expect(catalog.warnings).toEqual([])
    expect(catalog.skills.map(s => [s.name, s.source])).toEqual([
      ['drive:edit', 'connector'], ['edit', 'local'], ['nte-mod-authoring', 'local'],
    ])
    expect(request.mock.calls.map(([name]) => name)).toEqual(['skills/list', 'plugin/installed', 'plugin/read'])
  })

  it('searches both sources, paginates, and returns summaries rather than bodies', async () => {
    const catalog = await discoverNativeSkills(requestFixture(), 'C:/project')
    expect(searchNativeSkills(catalog, 'Google Drive').skills.map(s => s.name)).toEqual(['drive:edit'])
    expect(searchNativeSkills(catalog, '', 'local').total).toBe(2)
    expect(searchNativeSkills(catalog, '', 'all', 0, 1)).toMatchObject({ total: 3, nextOffset: 1 })
    expect(searchNativeSkills(catalog, 'NTE').skills[0]).not.toHaveProperty('contents')
    expect(() => searchNativeSkills(catalog, '', 'all', -1)).toThrow('offset')
  })

  it('keeps local results and reports a failed remote source', async () => {
    const original = requestFixture()
    const catalog = await discoverNativeSkills(async (method, params) => {
      if (method === 'plugin/installed') throw new Error('connector unavailable')
      return original(method, params)
    }, 'C:/project')
    expect(catalog.skills.some(s => s.name === 'nte-mod-authoring')).toBe(true)
    expect(catalog.warnings).toEqual(['Connector discovery: Error: connector unavailable'])
  })

  it('scans only on demand, caches metadata, refreshes explicitly, and reads each source', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dsh-skills-test-'))
    const path = join(directory, 'SKILL.md')
    await writeFile(path, '# NTE authoring\nLocal instructions.\nEnd.', 'utf8')
    const process = processFixture(requestFixture(path))
    const service = manager(process)
    const signal = new AbortController().signal
    try {
      expect(process.specs).toHaveLength(0)
      const catalog = await service.catalog(directory, signal)
      expect(process.specs).toHaveLength(1)
      expect(process.specs[0].argv).toContain('features.skip_host_skill_discovery=false')
      expect(process.specs[0].argv.some(arg => arg.startsWith('model_provider='))).toBe(false)
      expect(await service.catalog(directory, signal)).toBe(catalog)
      const local = catalog.skills.find(s => s.name === 'nte-mod-authoring')!
      expect(await service.read(directory, local.id, signal, 1, 2)).toMatchObject({
        contents: '# NTE authoring\nLocal instructions.', nextOffset: 3, resourceBase: directory,
      })
      expect(process.specs).toHaveLength(1)
      const remote = catalog.skills.find(s => s.source === 'connector')!
      expect(await service.read(directory, remote.id, signal)).toMatchObject({
        contents: '# Remote edit\nUse connected Drive.\nEnd.', resourceBase: 'skill://connector_drive/edit',
      })
      expect(process.specs).toHaveLength(2)
      await service.catalog(directory, signal, true)
      expect(process.specs).toHaveLength(3)
      await expect(service.read(directory, 'missing', signal)).rejects.toThrow('codex_skill_search')
      expect(process.terminated).toHaveBeenCalledTimes(3)
    } finally { await service.dispose(); await rm(directory, { recursive: true, force: true }) }
    await expect(service.catalog(directory, signal)).rejects.toThrow('disposed')
  })

  it('loads recovery guidance only with the computer-use skill body', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dsh-cu-skill-'))
    const path = join(directory, 'SKILL.md')
    await writeFile(path, '# Computer Use\nUse the documented API.')
    const data = fixtures(path)
    data.local.data[0]!.skills[0]!.name = 'computer-use:computer-use'
    const original = requestFixture(path)
    const request = vi.fn(async (method: string, params: Record<string, JsonValue>) =>
      method === 'skills/list' ? data.local : original(method, params))
    const service = manager(processFixture(request))
    try {
      const signal = new AbortController().signal
      const catalog = await service.catalog(directory, signal)
      expect(JSON.stringify(searchNativeSkills(catalog, 'computer-use'))).not.toContain('FrameArrived')
      const skill = catalog.skills.find(s => s.skillName === 'computer-use')!
      const read = await service.read(directory, skill.id, signal)
      expect(read.contents).toContain('FrameArrived')
      expect(read.contents).toContain('codex_computer_use_recovery')
    } finally { await service.dispose(); await rm(directory, { recursive: true, force: true }) }
  })

  it('stops its active discovery process when the caller cancels', async () => {
    const process = processFixture(requestFixture(), true)
    const service = manager(process)
    const abort = new AbortController()
    const pending = service.catalog('C:/project', abort.signal)
    abort.abort(new Error('caller stopped'))
    await expect(pending).rejects.toThrow('caller stopped')
    expect(process.terminated).toHaveBeenCalledOnce()
    await service.dispose()
  })
})

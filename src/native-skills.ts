/** On-demand Codex skill discovery. Credentials and plugin connectivity remain owned by Codex. */
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { SubprocessHandle, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import { codexAppServerArgv } from './runner.ts'
import { connectCodexProcess, diagnosticText } from './process-connection.ts'
import { object, type JsonValue } from './wire.ts'
import { COMPUTER_USE_GUIDE } from './computer-use-recovery.ts'

type Request = (method: string, params: Record<string, JsonValue>) => Promise<unknown>
export type SkillSource = 'local' | 'connector'
export interface NativeSkill {
  id: string
  name: string
  description: string
  source: SkillSource
  path: string | null
  pluginId: string | null
  remoteMarketplace: string | null
  remotePluginId: string | null
  skillName: string
  dependencies: unknown
}
export interface SkillCatalog {
  skills: NativeSkill[]
  warnings: string[]
}
function rows(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Codex returned invalid ${label}`)
  return value
}
function str(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`Codex returned invalid ${label}`)
  return value
}
function optionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}
function bareName(name: string): string {
  return name.slice(name.lastIndexOf(':') + 1)
}
function identity(skill: NativeSkill): string {
  return skill.pluginId === null ? `local:${skill.path}` : `${skill.pluginId}/${skill.skillName}`
}

/** Query enabled local skills and installed remote plugin skills without starting a model turn. */
export async function discoverNativeSkills(request: Request, cwd: string): Promise<SkillCatalog> {
  const local = object(await request('skills/list', { cwds: [cwd], forceReload: true }), 'skills/list')
  const skills = new Map<string, NativeSkill>()
  const warnings: string[] = []
  for (const value of rows(local.data, 'skills/list.data')) {
    const entry = object(value, 'skill directory')
    for (const error of rows(entry.errors, 'skill directory errors')) {
      const item = object(error, 'skill directory error')
      warnings.push(diagnosticText(`${String(item.path)}: ${String(item.message)}`))
    }
    for (const value of rows(entry.skills, 'local skills')) {
      const item = object(value, 'local skill')
      if (item.enabled !== true) continue
      const path = str(item.path, 'skill path')
      const name = str(item.name, 'skill name')
      const skill: NativeSkill = {
        id: `local:${createHash('sha256').update(path).digest('hex').slice(0, 20)}`,
        name, description: str(item.description, 'skill description'), source: 'local', path,
        pluginId: optionalString(item.pluginId), remoteMarketplace: null, remotePluginId: null,
        skillName: bareName(name), dependencies: item.dependencies ?? null,
      }
      skills.set(identity(skill), skill)
    }
  }
  // Remote failures are visible, but do not conceal usable local skills.
  try {
    const installed = object(await request('plugin/installed', { cwds: [cwd] }), 'plugin/installed')
    for (const value of rows(installed.marketplaces, 'plugin marketplaces')) {
      const market = object(value, 'plugin marketplace')
      const marketplace = str(market.name, 'marketplace name')
      for (const value of rows(market.plugins, 'installed plugins')) {
        const plugin = object(value, 'installed plugin')
        if (plugin.installed !== true || plugin.enabled !== true || plugin.availability === 'DISABLED_BY_ADMIN') continue
        if (object(plugin.source, 'plugin source').type !== 'remote' || typeof plugin.remotePluginId !== 'string') continue
        const pluginId = str(plugin.id, 'plugin id')
        const pluginName = str(plugin.name, 'plugin name')
        try {
          const detail = object(await request('plugin/read', {
            pluginName, remoteMarketplaceName: marketplace,
          }), 'plugin/read')
          for (const value of rows(object(detail.plugin, 'plugin detail').skills, 'remote skills')) {
            const item = object(value, 'remote skill')
            if (item.enabled !== true) continue
            const skillName = bareName(str(item.name, 'remote skill name'))
            const skill: NativeSkill = {
              id: `connector:${pluginId}/${skillName}`, name: `${pluginName}:${skillName}`,
              description: str(item.description, 'remote skill description'), source: 'connector', path: null,
              pluginId, remoteMarketplace: marketplace, remotePluginId: plugin.remotePluginId,
              skillName, dependencies: null,
            }
            // Only the same plugin + skill is replaced; unrelated user skills retain their identity.
            skills.set(identity(skill), skill)
          }
        } catch (error: unknown) {
          warnings.push(`${pluginName}: ${diagnosticText(String(error))}`)
        }
      }
    }
    for (const value of rows(installed.marketplaceLoadErrors ?? [], 'marketplace errors')) {
      warnings.push(diagnosticText(String(object(value, 'marketplace error').message)))
    }
  } catch (error: unknown) {
    warnings.push(`Connector discovery: ${diagnosticText(String(error))}`)
  }
  return { skills: [...skills.values()].sort((a, b) => a.name.localeCompare(b.name)), warnings }
}

export function searchNativeSkills(
  catalog: SkillCatalog,
  query = '',
  source: 'all' | SkillSource = 'all',
  offset = 0,
  limit = 8,
) {
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('offset must be a non-negative integer')
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 20) throw new Error('limit must be between 1 and 20')
  const terms = query.toLocaleLowerCase().split(/\s+/u).filter(Boolean)
  const matches = catalog.skills
    .filter(skill => source === 'all' || skill.source === source)
    .map(skill => ({
      skill,
      score: terms.reduce((score, term) => score
        + (skill.name.toLocaleLowerCase().includes(term) ? 4 : 0)
        + (skill.description.toLocaleLowerCase().includes(term) ? 1 : 0), 0),
    }))
    .filter(match => terms.length === 0 || match.score > 0)
    .sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name))
  return {
    total: matches.length,
    nextOffset: offset + limit < matches.length ? offset + limit : null,
    skills: matches.slice(offset, offset + limit).map(({ skill }) => ({
      id: skill.id, name: skill.name, description: skill.description, source: skill.source,
    })),
    warnings: catalog.warnings,
  }
}

interface Options {
  spawn(spec: SubprocessSpawnSpec): SubprocessHandle | Promise<SubprocessHandle>
  env: Readonly<Record<string, string>>
  maxJsonRpcLineBytes: number
  maxStderrBytes: number
  disposeGraceMs: number
  maxContextTokens: number
}

/** Owns temporary discovery processes and a refreshable, last-workspace metadata cache. */
export class NativeCodexSkills {
  private cached: { cwd: string; catalog: SkillCatalog } | undefined
  private readonly active = new Set<() => Promise<void>>()
  private disposed = false
  constructor(private readonly options: Options) {}

  private async connection<T>(cwd: string, signal: AbortSignal, task: (request: Request) => Promise<T>): Promise<T> {
    signal.throwIfAborted()
    if (this.disposed) throw new Error('Codex skill discovery is disposed')
    const child = await this.options.spawn({
      argv: [...codexAppServerArgv(undefined, true, 'discovery', 'native', this.options.maxContextTokens),
        '-c', 'features.skip_host_skill_discovery=false', '-c', 'skills.include_instructions=false'],
      cwd, env: this.options.env, graceMs: this.options.disposeGraceMs,
      stdio: { stdin: 'pipe', stdout: 'pipe', stderr: { maxBytes: this.options.maxStderrBytes } },
    })
    if (this.disposed || signal.aborted) { child.terminate(); signal.throwIfAborted(); throw new Error('Codex skill discovery is disposed') }
    const diagnostics = connectCodexProcess(child, this.options.maxJsonRpcLineBytes)
    const rpc = diagnostics.rpc
    let cleanup: Promise<void> | undefined
    const close = (): Promise<void> => cleanup ??= (async () => {
      rpc.dispose()
      diagnostics.markCleanup()
      child.terminate()
      await child.waitForExit(AbortSignal.timeout(this.options.disposeGraceMs * 2)).catch(() => {})
      this.active.delete(close)
    })()
    this.active.add(close)
    const abort = (): void => { void close() }
    signal.addEventListener('abort', abort, { once: true })
    try {
      await rpc.request('initialize', {
        clientInfo: { name: 'dsh_codex_skills', title: 'DSH Codex skills', version: '0.2.1' },
        capabilities: { experimentalApi: true, requestAttestation: false },
      })
      await rpc.notify('initialized', {})
      const result = await task((method, params) => {
        signal.throwIfAborted()
        return rpc.request(method, params)
      })
      signal.throwIfAborted()
      return result
    } catch (error: unknown) {
      await close()
      signal.throwIfAborted()
      throw diagnostics.failure(error)
    } finally {
      signal.removeEventListener('abort', abort)
      await close()
    }
  }

  async catalog(cwd: string, signal: AbortSignal, refresh = false): Promise<SkillCatalog> {
    signal.throwIfAborted()
    if (this.disposed) throw new Error('Codex skill discovery is disposed')
    if (!refresh && this.cached?.cwd === cwd) return this.cached.catalog
    const catalog = await this.connection(cwd, signal, request => discoverNativeSkills(request, cwd))
    if (catalog.warnings.length === 0 && !this.disposed) this.cached = { cwd, catalog }
    return catalog
  }

  async read(cwd: string, id: string, signal: AbortSignal, offset = 1, limit = 400) {
    if (!Number.isSafeInteger(offset) || offset < 1) throw new Error('offset must be a positive line number')
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) throw new Error('limit must be between 1 and 1000')
    const catalog = await this.catalog(cwd, signal)
    const skill = catalog.skills.find(skill => skill.id === id)
    if (!skill) throw new Error('Unknown skill id. Use codex_skill_search in this workspace first.')
    let contents: string
    if (skill.source === 'local') {
      contents = await readFile(skill.path!, { encoding: 'utf8', signal })
    } else {
      const result = await this.connection(cwd, signal, request => request('plugin/skill/read', {
        remoteMarketplaceName: skill.remoteMarketplace!, remotePluginId: skill.remotePluginId!, skillName: skill.skillName,
      }))
      const value = object(result, 'plugin/skill/read').contents
      if (typeof value !== 'string') throw new Error('The connector did not return this skill. Refresh codex_skill_search.')
      contents = value
    }
    // Load troubleshooting only when the selected skill is Computer Use, never in the catalog.
    if (skill.skillName === 'computer-use') contents += '\n\n' + COMPUTER_USE_GUIDE
    const lines = contents.split(/\r?\n/u)
    return {
      id: skill.id, name: skill.name, source: skill.source, path: skill.path,
      resourceBase: skill.path === null ? `skill://${skill.remotePluginId}/${skill.skillName}` : dirname(skill.path),
      dependencies: skill.dependencies,
      offset, totalLines: lines.length,
      nextOffset: offset - 1 + limit < lines.length ? offset + limit : null,
      contents: lines.slice(offset - 1, offset - 1 + limit).join('\n'),
    }
  }

  async dispose(): Promise<void> {
    this.disposed = true
    this.cached = undefined
    await Promise.all([...this.active].map(close => close()))
  }
}

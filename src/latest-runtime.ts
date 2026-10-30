/** Follow the official npm release channel when opening a new Codex process. */
import { abortable } from './abort.ts'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, mkdtemp, rename, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'

interface Manifest { version: string; optionalDependencies?: Record<string, string> }
interface Packages {
  manifest(spec: string, options: Record<string, unknown>): Promise<Manifest>
  extract(spec: string, destination: string, options: Record<string, unknown>): Promise<unknown>
}
const require = createRequire(import.meta.url)
const packages = require('pacote') as Packages
const options = { registry: 'https://registry.npmjs.org/', preferOnline: true }
const targetTriples: Record<string, string> = {
  'win32-x64': 'x86_64-pc-windows-msvc', 'win32-arm64': 'aarch64-pc-windows-msvc',
  'linux-x64': 'x86_64-unknown-linux-musl', 'linux-arm64': 'aarch64-unknown-linux-musl',
  'darwin-x64': 'x86_64-apple-darwin', 'darwin-arm64': 'aarch64-apple-darwin',
}
export interface Runtime { version: string; executable: string }
export class LatestCodexRuntime {
  private pending: { task: Promise<Runtime>; controller: AbortController; waiters: number } | undefined
  private current: Runtime | undefined
  private readonly platform = process.platform === 'android' ? 'linux' : process.platform
  private readonly key = `${this.platform}-${process.arch}`
  private readonly triple = targetTriples[this.key]
  constructor(
    private readonly warn: (message: string) => void,
    private readonly root = join(process.env.LOCALAPPDATA ?? process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), 'dsh-codex-native', 'runtimes'),
    private readonly source: Packages = packages,
  ) {}
  private executable(root: string): string {
    if (!this.triple) throw new Error(`Unsupported official Codex platform: ${this.key}`)
    return join(root, 'vendor', this.triple, 'bin', this.platform === 'win32' ? 'codex.exe' : 'codex')
  }
  private bundled(): Runtime {
    const manifest = require.resolve('@openai/codex/package.json')
    const version = (JSON.parse(readFileSync(manifest, 'utf8')) as Manifest).version
    let root = dirname(manifest)
    try { root = dirname(createRequire(manifest).resolve(`@openai/codex-${this.key}/package.json`)) } catch {}
    return { version, executable: this.executable(root) }
  }
  /** Concurrent opens share only the current refresh, never a permanent version lock. */
  async resolve(signal?: AbortSignal): Promise<Runtime> {
    signal?.throwIfAborted()
    if (!this.pending) {
      const controller = new AbortController()
      const pending = { task: Promise.resolve<Runtime>(undefined!), controller, waiters: 0 }
      pending.task = this.refresh(controller.signal).finally(() => {
        if (this.pending === pending) this.pending = undefined
      })
      this.pending = pending
    }
    const pending = this.pending
    pending.waiters++
    try { return await abortable(pending.task, signal) }
    finally {
      pending.waiters--
      if (pending.waiters === 0 && this.pending === pending) {
        this.pending = undefined
        pending.controller.abort(new Error('No Codex runtime refresh callers remain'))
      }
    }
  }
  private async refresh(signal: AbortSignal): Promise<Runtime> {
    this.current ??= this.bundled()
    try {
      const latest = await abortable(this.source.manifest('@openai/codex@latest', { ...options, signal }), signal)
      if (latest.version === this.current.version && existsSync(this.current.executable)) return this.current
      const alias = latest.optionalDependencies?.[`@openai/codex-${this.key}`]
      if (!alias) throw new Error(`Official Codex ${latest.version} has no package for ${this.key}`)
      const destination = join(this.root, `${encodeURIComponent(latest.version)}-${this.key}`)
      const executable = this.executable(destination)
      if (!existsSync(executable)) {
        await mkdir(this.root, { recursive: true })
        const staging = await mkdtemp(join(this.root, '.install-'))
        try {
          // Pacote uses npm's integrity-checked archive extraction; no custom downloader.
          await this.source.extract(alias.replace(/^npm:/, ''), staging, { ...options, signal })
          signal.throwIfAborted()
          if (!existsSync(this.executable(staging))) throw new Error('Official Codex archive has no executable')
          try { await rename(staging, destination) }
          catch (error) { if (!existsSync(executable)) throw error }
        } finally { await rm(staging, { recursive: true, force: true }) }
      }
      signal.throwIfAborted()
      this.current = { version: latest.version, executable }
    } catch (error) {
      signal.throwIfAborted()
      if (!existsSync(this.current.executable)) throw error
      this.warn(`Codex latest refresh failed; using installed ${this.current.version}: ${String(error)}`)
    }
    return this.current
  }
  async spawnSpec(spec: SubprocessSpawnSpec): Promise<SubprocessSpawnSpec> {
    spec.signal?.throwIfAborted()
    const runtime = await this.resolve(spec.signal)
    spec.signal?.throwIfAborted()
    // DSH owns the native process directly, including hidden Windows launch and teardown.
    return { ...spec, argv: [runtime.executable, ...spec.argv.slice(2)] }
  }
}

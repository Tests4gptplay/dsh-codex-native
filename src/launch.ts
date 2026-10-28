/** Launch only this plugin's official packaged Codex binary under DSH's existing process owner. */
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import type { SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'

/** Official Codex wrapper platform-package layout. */
export function windowsCodexBinary(packageJson: string, arch: string): string {
  const target = arch === 'x64' ? 'x86_64-pc-windows-msvc'
    : arch === 'arm64' ? 'aarch64-pc-windows-msvc' : undefined
  if (target === undefined) throw new Error(`Unsupported Codex Windows architecture: ${arch}`)
  const require = createRequire(packageJson)
  let vendor = join(dirname(packageJson), 'vendor')
  try { vendor = join(dirname(require.resolve(`@openai/codex-win32-${arch}/package.json`)), 'vendor') }
  catch { /* Official npm package may also ship vendor/ inline. */ }
  const executable = join(vendor, target, 'bin', 'codex.exe')
  if (!existsSync(executable)) throw new Error('Official Codex Windows binary is missing; reinstall the plugin including optional dependencies.')
  return executable
}

/** Avoid the JS wrapper's second spawn, which omits Windows hide flags. No global monkey patch and no shell. */
export function codexSpawnSpec(spec: SubprocessSpawnSpec, platform: NodeJS.Platform = process.platform): SubprocessSpawnSpec {
  if (platform !== 'win32') return spec
  const require = createRequire(import.meta.url)
  const manifest = require.resolve('@openai/codex/package.json')
  const wrapper = join(dirname(manifest), 'bin', 'codex.js')
  if (spec.argv[0] !== process.execPath || spec.argv[1] === undefined
    || resolve(spec.argv[1]) !== resolve(wrapper) || spec.argv[2] !== 'app-server') return spec
  return { ...spec, argv: [windowsCodexBinary(manifest, process.arch), ...spec.argv.slice(2)] }
}

// One-shot release installation check, never installed or run by the plugin.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync, spawn } from 'node:child_process'
import { readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const host = resolve('.tmp/dsh-reference')
const home = process.env.DSH_HOME
assert(home, 'DSH_HOME must identify the newly installed isolated profile')
const { loadProfile, createRuntimeResolution } = await import(pathToFileURL(join(host, 'packages/boot/app-boot/lib/index.js')).href)
const anchor = join(host, 'apps/cli/package.json')
const profile = loadProfile('dsh', 'web', anchor, home)
const resolution = await createRuntimeResolution({ installAnchor: anchor, profile, home })
const expected = {
  '@deepseek-ai/dsh-llm': 'packages/llm/llm',
  '@deepseek-ai/dsh-token-meter': 'packages/llm/token-meter',
  '@deepseek-ai/dsh-compaction-basic': 'packages/compaction/compaction-basic',
}
const resolvedHostPackages = {}
for (const [name, location] of Object.entries(expected)) {
  const entry = resolution.entries.find(value => value.name === name)
  assert(entry, 'Missing host module: ' + name)
  assert.equal(entry.scope, 'installation')
  assert.equal(realpathSync(entry.packageDir), realpathSync(join(host, location)))
  assert(!resolution.localPackageNames.includes(name), 'Profile shadows patched host: ' + name)
  resolvedHostPackages[name] = relative(host, realpathSync(entry.packageDir))
}
const manifest = JSON.parse(readFileSync('dist/release-manifest.json', 'utf8'))
const plugin = join(profile.dir, 'node_modules/dsh-codex-native')
const digest = path => createHash('sha256').update(readFileSync(path)).digest('hex')
for (const [file, hash] of Object.entries(manifest.runtimeSha256)) {
  assert.equal(digest(join(plugin, file)), hash, 'Installed runtime differs: ' + file)
}
console.log('PATCHED_HOST_PACKAGE_RESOLUTION_PASSED', resolvedHostPackages)

// The timeout bounds only this disposable Web-server startup check.
const child = spawn('pnpm', ['dsh', 'web', '--no-open'], {
  cwd: host, env: process.env, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
})
let log = ''
let checking = false
let stopped = false
let timer
const closed = new Promise(resolveClose => child.once('close', (...args) => resolveClose(args)))
let httpStatus
try {
  httpStatus = await new Promise((resolveReady, reject) => {
    timer = setTimeout(() => reject(new Error('Patched Web host did not become ready within 45 seconds')), 45_000)
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (!stopped) reject(new Error('Patched Web host exited before verification: ' + code + ' ' + signal))
    })
    const observe = data => {
      log = (log + data.toString()).slice(-100_000)
      if (checking || !log.includes('http://127.0.0.1:3080')) return
      checking = true
      fetch('http://127.0.0.1:3080', { signal: AbortSignal.timeout(10_000) }).then(async response => {
        assert.equal(response.status, 200, 'Patched Web host HTTP status')
        assert.match(response.headers.get('content-type') ?? '', /text\/html/i)
        assert((await response.text()).length > 100, 'Empty Web UI document')
        resolveReady(response.status)
      }).catch(reject)
    }
    child.stdout.on('data', observe)
    child.stderr.on('data', observe)
  })
} finally {
  clearTimeout(timer)
  stopped = true
  writeFileSync(join(root, '.tmp/paired-host-startup.log'), log)
  if (child.pid) {
    const signal = name => {
      try { process.kill(-child.pid, name) } catch (error) { if (error.code !== 'ESRCH') throw error }
    }
    signal('SIGTERM')
    const forced = setTimeout(() => signal('SIGKILL'), 5_000)
    try { await closed } finally { clearTimeout(forced) }
  }
}
const evidence = {
  hostBase: execFileSync('git', ['-C', host, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  hostPatchSha256: digest('dist/dsh-context-usage-0.2.1-rc.2.patch'),
  httpStatus,
  resolvedHostPackages,
  installedPluginVersion: JSON.parse(readFileSync(join(plugin, 'package.json'), 'utf8')).version,
}
writeFileSync('.tmp/paired-host-smoke.json', JSON.stringify(evidence, null, 2) + '\n')
console.log('PAIRED_SOURCE_HOST_INSTALL_AND_STARTUP_PASSED', evidence)

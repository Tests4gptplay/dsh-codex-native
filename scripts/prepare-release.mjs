// Release-only tooling. This file is excluded from every installed plugin snapshot.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'

const version = process.env.RELEASE_VERSION
const source = process.env.EXPECTED_SOURCE_SHA
const runId = process.env.TESTED_RUN
const hostBase = '687f282e8625c6b8d11ff58211a90524be2e4317'
const patchName = 'dsh-context-usage-0.2.1-rc.2.patch'
const patchHash = 'dd8049f33fea9187cc025e792fc25feb68a8ad5ccb1044cc85e063429c2b717e'
assert.equal(version, '0.2.1-alpha.9')
assert.match(source ?? '', /^[0-9a-f]{40}$/)
assert.match(runId ?? '', /^\d+$/)
const root = process.cwd()
const dist = resolve('dist')
const stage = resolve('.tmp/release-runtime')
const tgzName = 'dsh-codex-native-' + version + '.tgz'
const json = path => JSON.parse(readFileSync(path, 'utf8'))
const digest = path => createHash('sha256').update(readFileSync(path)).digest('hex')
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
const render = text => text.replaceAll('__SOURCE_SHA__', source).replaceAll('__CI_RUN__', runId)
const writeJson = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n')
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    assert(!entry.isSymbolicLink(), 'Unexpected symlink: ' + path)
    return entry.isDirectory() ? files(path) : [path]
  })
}

if (process.argv[2] === 'finalize') {
  const manifest = json(join(dist, 'release-manifest.json'))
  const tests = json('.tmp/release-verification.json')
  assert.equal(tests.success, true)
  assert.equal(tests.numFailedTests, 0)
  assert.equal(tests.numPassedTests, 28)
  assert.equal(tests.numTotalTests, 28)
  const host = json('.tmp/paired-host-smoke.json')
  assert.equal(host.hostBase, hostBase)
  assert.equal(host.hostPatchSha256, patchHash)
  assert.equal(host.bootstrapHttpStatus, 303)
  assert.equal(host.httpStatus, 200)
  manifest.verification = { packagedRuntimeTests: 28, pairedSourceHost: host }
  manifest.assets = Object.fromEntries([tgzName, patchName, 'INSTALL_PATCHED_HOST.md', 'DSH-LICENSE.txt'].map(name => [name, {
    sha256: digest(join(dist, name)),
    bytes: readFileSync(join(dist, name)).length,
  }]))
  writeJson(join(dist, 'release-manifest.json'), manifest)
  const names = [...Object.keys(manifest.assets), 'release-manifest.json']
  writeFileSync(join(dist, 'SHA256SUMS'), names.map(name => digest(join(dist, name)) + '  ' + name).join('\n') + '\n')
  console.log('RELEASE_MANIFEST_AND_CHECKSUMS_READY', { version, source, runId, files: names.length })
  process.exit(0)
}

assert.equal(git('rev-parse', 'HEAD'), source, 'Release source differs from tested source')
const artifacts = files(resolve('.tmp/verified-artifact'))
const one = name => {
  const matches = artifacts.filter(path => basename(path) === name)
  assert.equal(matches.length, 1, 'Expected exactly one ' + name)
  return matches[0]
}
const candidate = one(tgzName)
const evidence = json(one('source-manifest.json'))
assert.equal(evidence.version, version)
assert.equal(evidence.sourceCommit, source)
assert.equal(evidence.sourceTree, git('rev-parse', 'HEAD^{tree}'))
assert.equal(String(evidence.ciRun), runId)
assert.equal(evidence.hostBase, hostBase)
assert.equal(evidence.hostPatchSha256, patchHash)
assert.equal(evidence.artifact, tgzName)
assert.equal(evidence.artifactSha256, digest(candidate))
assert.equal(digest(join('patches', patchName)), patchHash)
assert.equal(git('-C', '.tmp/dsh-reference', 'rev-parse', 'HEAD'), hostBase)

mkdirSync(stage, { recursive: true })
mkdirSync(dist, { recursive: true })
execFileSync('tar', ['-xzf', candidate, '--strip-components=1', '-C', stage])
const pkg = json(join(stage, 'package.json'))
assert.equal(pkg.name, 'dsh-codex-native')
assert.equal(pkg.version, version)
assert.equal(pkg.icon, 'assets/chatgpt-auth.png')
assert.equal(pkg.exports['./locale/*.json'], './locale/*.json')
for (const language of ['en', 'zh']) {
  const metadata = json(join(stage, 'locale', language + '.json'))
  assert(metadata.meta.title && metadata.meta.description)
}
for (const field of ['scripts', 'devDependencies', 'packageManager', 'publishConfig']) delete pkg[field]
writeJson(join(stage, 'package.json'), pkg)
for (const name of ['README.md', 'README.zh.md']) {
  writeFileSync(join(stage, name), render(readFileSync(join('docs/releases/alpha.9', name), 'utf8')))
}
for (const [name, hash] of Object.entries(evidence.runtimeSha256)) {
  assert.equal(digest(join(stage, name)), hash, 'Runtime changed while preparing release: ' + name)
}
const allowed = new Set(['package.json', 'cordis.patch.yml', 'LICENSE', 'README.md', 'README.zh.md', 'assets/chatgpt-auth.png', 'assets/LOBE-ICONS-LICENSE.txt', 'locale/en.json', 'locale/zh.json'])
for (const path of files(stage)) {
  const name = relative(stage, path).replaceAll('\\', '/')
  assert(allowed.has(name) || /^lib\/(?:index\.js|client\.js|(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.d\.ts)$/.test(name), 'Unexpected runtime file: ' + name)
}
for (const name of ['lib/index.js', 'lib/client.js']) {
  const js = readFileSync(join(stage, name), 'utf8')
  for (const token of ['mock-app-server.mjs', 'TEST_CODEX_SCENARIO', 'fixture-secret', 'vitest', '#dsh-primitives', 'tests/official-primitives', 'account-lifecycle.mjs', 'AUDIT_RECEIVED:']) {
    assert(!js.includes(token), 'Test code leaked into ' + name + ': ' + token)
  }
}
assert(readFileSync(join(stage, 'lib/client.js'), 'utf8').includes('@deepseek-ai/dsh-client-ui-primitives'))
copyFileSync(join('patches', patchName), join(dist, patchName))
copyFileSync('.tmp/dsh-reference/LICENSE', join(dist, 'DSH-LICENSE.txt'))
writeFileSync(join(dist, 'INSTALL_PATCHED_HOST.md'), render(readFileSync('docs/releases/alpha.9/INSTALL_PATCHED_HOST.md', 'utf8')))
writeFileSync('.tmp/release-notes.md', render(readFileSync('docs/releases/alpha.9/notes.md', 'utf8')))

const run = json(join(process.env.RUNNER_TEMP, 'run.json'))
const list = json(join(process.env.RUNNER_TEMP, 'artifacts.json')).artifacts
const artifact = list.find(item => item.name === 'codex-reproduction-ubuntu-latest')
assert(artifact && !artifact.expired)
writeJson(join(dist, 'release-manifest.json'), {
  version,
  sourceCommit: source,
  sourceTree: evidence.sourceTree,
  candidateCI: { runId: Number(runId), attempt: run.run_attempt, workflow: run.path, url: run.html_url },
  candidateArtifact: { id: artifact.id, name: artifact.name, archiveDigest: artifact.digest, tgzSha256: evidence.artifactSha256 },
  host: { repository: 'deepseek-ai/deepseek-harness', base: hostBase, patch: patchName, patchSha256: patchHash, requiresPatchedSourceHost: true },
  runtimeSha256: evidence.runtimeSha256,
})
console.log('SOURCE_FREE_TEST_FREE_RUNTIME_READY', { version, source, files: files(stage).length, stage: relative(root, stage) })

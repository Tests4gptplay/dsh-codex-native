// Produce matching scoped and unscoped distributions without altering attribution.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const root = process.cwd(), dist = resolve('dist')
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
assert.equal(pkg.name, '@tests4gptplay/dsh-codex-native')
mkdirSync(dist, { recursive: true })
mkdirSync('.tmp', { recursive: true })
const npm = (...args) => JSON.parse(execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
  cwd: root, encoding: 'utf8', shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'inherit'],
}))
const files = npm('pack', '--dry-run', '--json', '--ignore-scripts')[0].files.map(file => file.path)
assert(files.includes('lib/index.js') && files.includes('lib/client.js'))
assert(!files.some(file => /^(src|tests|scripts|\.github)\//.test(file)))
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const distributions = []
for (const name of [pkg.name, 'dsh-codex-native']) {
  const stage = mkdtempSync(resolve('.tmp/package-'))
  for (const file of files) {
    mkdirSync(dirname(join(stage, file)), { recursive: true })
    copyFileSync(join(root, file), join(stage, file))
  }
  const manifest = { ...pkg, name }
  writeFileSync(join(stage, 'package.json'), JSON.stringify(manifest, null, 2) + '\n')
  if (name !== pkg.name) {
    const patch = readFileSync(join(stage, 'cordis.patch.yml'), 'utf8')
    assert(patch.includes(`name: '${pkg.name}'`))
    writeFileSync(join(stage, 'cordis.patch.yml'), patch.replace(`name: '${pkg.name}'`, `name: '${name}'`))
    const client = readFileSync(join(stage, 'lib/client.js'), 'utf8')
    assert(client.includes(`id: "${pkg.name}"`))
    writeFileSync(join(stage, 'lib/client.js'), client.replace(`id: "${pkg.name}"`, `id: "${name}"`))
  }
  const packed = npm('pack', stage, '--json', '--ignore-scripts', '--pack-destination', dist)[0]
  const artifact = join(dist, packed.filename)
  const extracted = mkdtempSync(resolve('.tmp/unpack-'))
  execFileSync('tar', ['-xzf', artifact, '-C', extracted])
  for (const file of files) {
    assert(readFileSync(join(extracted, 'package', file)).equals(readFileSync(join(stage, file))), `TGZ differs: ${file}`)
  }
  assert.deepEqual({ ...JSON.parse(readFileSync(join(extracted, 'package/package.json'), 'utf8')), name: pkg.name }, pkg)
  distributions.push({ name, file: packed.filename, sha256: sha256(readFileSync(artifact)), integrity: packed.integrity,
    files: Object.fromEntries(files.map(file => [file, sha256(readFileSync(join(stage, file)))])) })
}
const differences = files.filter(file => distributions[0].files[file] !== distributions[1].files[file])
assert.deepEqual(differences.sort(), ['cordis.patch.yml', 'lib/client.js', 'package.json'])
const manifest = { version: pkg.version, sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  distributions, variantDifferences: differences,
  attribution: 'LICENSE, icon licenses, author/contributor metadata, repository and publishConfig preserved; no signatures copied or forged.' }
writeFileSync(join(dist, 'release-manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
writeFileSync(join(dist, 'SHA256SUMS'), distributions.map(d => `${d.sha256}  ${d.file}`).join('\n') + '\n')
console.log(JSON.stringify({ version: pkg.version, distributions: distributions.map(({ files, ...d }) => d), variantDifferences: differences }, null, 2))

// First-publication bridge only: use npm's pinned signer in real GitHub Actions.
// No npm credential is sent to CI; the resulting bundle authenticates exact TGZ bytes.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
assert.equal(process.env.GITHUB_ACTIONS, 'true');
assert.equal(process.env.GITHUB_REPOSITORY, 'Tests4gptplay/dsh-codex-native');
const npmRoot = execFileSync('npm', ['root', '--global'], { encoding: 'utf8' }).trim();
assert.equal(require(join(npmRoot, 'npm/package.json')).version, '11.20.0');
const { generateProvenance, verifyProvenance } = require(join(npmRoot, 'npm/node_modules/libnpmpublish/lib/provenance.js'));
const npa = require(join(npmRoot, 'npm/node_modules/npm-package-arg'));
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const artifact = `dist/dsh-codex-native-${version}.tgz`;
const subject = { name: npa.toPurl(npa.resolve('dsh-codex-native', version)),
  digest: { sha512: createHash('sha512').update(readFileSync(artifact)).digest('hex') } };
(async () => {
  const file = `${artifact}.sigstore`;
  writeFileSync(file, JSON.stringify(await generateProvenance([subject], {})) + '\n');
  await verifyProvenance(subject, file);
  console.log('Verified genuine npm provenance bundle:', file);
})().catch(error => { console.error(error); process.exitCode = 1; });

import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
const root = new URL('../', import.meta.url)
const file = (path: string): Buffer => readFileSync(new URL(path, root))
const pkg = JSON.parse(file('package.json').toString('utf8'))
describe('installed plugin metadata', () => {
  it('packages a real ChatGPT authentication channel icon', () => {
    expect(pkg.icon).toBe('assets/chatgpt-auth.png')
    expect(pkg.files).toContain(pkg.icon)
    const bytes = file(pkg.icon)
    expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect(bytes.length).toBeLessThan(256 * 1024)
    expect(file('assets/LOBE-ICONS-LICENSE.txt').toString('utf8')).toContain('Copyright (c) 2023 LobeHub')
  })
  it('provides packaged Chinese and English labels for the plugin manager', () => {
    expect(pkg.exports['./locale/*.json']).toBe('./locale/*.json')
    expect(pkg.files).toContain('locale/*.json')
    for (const language of ['zh', 'en']) {
      const { meta } = JSON.parse(file('locale/' + language + '.json').toString('utf8'))
      expect(meta.title).toBe('Codex Native')
      expect(meta.description).toContain('ChatGPT')
      expect(meta.description).toContain('Codex')
    }
  })
  it('accepts host-provided peer versions without an artificial compatibility gate', () => {
    const hostPeers = Object.entries(pkg.peerDependencies ?? {})
    expect(hostPeers.length).toBeGreaterThan(0)
    for (const [name, version] of hostPeers) {
      expect(version, `${name} should accept the host-provided version`).toBe('*')
    }
  })
})

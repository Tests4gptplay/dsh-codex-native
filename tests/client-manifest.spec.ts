import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
const p = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
describe('DSH 0.2.1 client manifest', () => {
  it('loads the official account settings and DSH authenticated connection without a second model provider', () => {
    const inject = p.dsh.client.inject
    expect(inject).toContain('@deepseek-ai/dsh-client-connection')
    expect(inject).toContain('@deepseek-ai/dsh-client-locale')
    expect(inject).toContain('@deepseek-ai/dsh-client-ui-settings')
    expect(inject).not.toContain('@deepseek-ai/dsh-client-runtime')
    expect(p.name).toBe('dsh-codex-native')
  })
})

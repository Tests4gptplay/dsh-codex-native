// Synthetic region fixtures test routing/transactions only, not executable compatibility.
import { afterEach, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, writeFile, rename, rm, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { profiles, profileForHash } from '../src/computer-use-profile.ts'
const { hashAliases } = vi.hoisted(() => ({ hashAliases: new Map<string, string>() }))
vi.mock('node:crypto', async importOriginal => {
  const actual = await importOriginal<typeof import('node:crypto')>()
  return { ...actual, createHash: (...args: Parameters<typeof actual.createHash>) => {
    const h = actual.createHash(...args)
    const digest = h.digest.bind(h)
    h.digest = ((encoding: 'hex') => {
      const result = digest(encoding)
      return hashAliases.get(result) ?? result
    }) as typeof h.digest
    return h
  } }
})
import { discoverHelpers, patchHelper, replaceHelper } from '../src/computer-use-recovery.ts'
const dirs: string[] = []
afterEach(async () => { hashAliases.clear(); await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))) })
const digest = (b: Buffer) => createHash('sha256').update(b).digest('hex')
for (const profile of profiles) {
  it(`${profile.skyVersion}: exact hash selection and distinct profile`, () => {
    expect(profileForHash(profile.originalSha256)).toBe(profile)
    expect(profileForHash(profile.patchedSha256)).toBe(profile)
    expect(profileForHash('unknown')).toBeUndefined()
    expect(new Set(profiles.flatMap(p => [p.originalSha256, p.patchedSha256])).size).toBe(4)
  }, 30_000)
  it(`${profile.skyVersion}: synthetic repair/status/repeat/rollback without or with backup`, async () => {
    const original = Buffer.alloc(Math.max(...profile.regions.map(r => r.offset + r.original.length / 2)))
    const patched = Buffer.from(original)
    for (const region of profile.regions) {
      expect(region.original.length).toBe(region.patched.length)
      Buffer.from(region.original, 'hex').copy(original, region.offset)
      Buffer.from(region.patched, 'hex').copy(patched, region.offset)
    }
    hashAliases.set(digest(original), profile.originalSha256)
    hashAliases.set(digest(patched), profile.patchedSha256)
    expect(patchHelper(original).equals(patched)).toBe(true)
    const root = await mkdtemp(join(tmpdir(), 'dsh-profile-test-')); dirs.push(root)
    const bin = join(root, 'test/bin/node_modules/@oai/sky/bin/windows')
    await mkdir(bin, { recursive: true })
    const target = join(bin, 'codex-computer-use.exe')
    await writeFile(target, original)
    const signal = new AbortController().signal
    const replace = async (temp: string, previous: string) => { await rename(target, previous); await rename(temp, target) }
    expect((await discoverHelpers(root))[0]?.state).toBe('original')
    expect(await replaceHelper(target, 'repair', signal, replace)).toMatchObject({ changed: true })
    expect((await discoverHelpers(root))[0]?.state).toBe('patched')
    expect(await replaceHelper(target, 'repair', signal, replace)).toEqual({ changed: false })
    expect(await replaceHelper(target, 'rollback', signal, replace)).toMatchObject({ changed: true })
    expect((await readFile(target)).equals(original)).toBe(true)
    expect(await replaceHelper(target, 'rollback', signal, replace)).toEqual({ changed: false })
    await replaceHelper(target, 'repair', signal, replace)
    await unlink(target + '.dsh-original')
    expect(await replaceHelper(target, 'rollback', signal, replace)).toMatchObject({ changed: true })
    expect((await readFile(target)).equals(original)).toBe(true)
    await writeFile(target + '.dsh-original', 'wrong backup')
    await expect(replaceHelper(target, 'repair', signal, replace)).rejects.toThrow('backup mismatch')
    expect((await readFile(target)).equals(original)).toBe(true)
  }, 30_000)
}

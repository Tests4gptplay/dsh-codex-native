import { afterEach, expect, it } from 'vitest'
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { COMPUTER_USE_GUIDE, discoverHelpers, patchHelper, releaseScript, replaceHelper } from '../src/computer-use-recovery.ts'

const dirs: string[] = []
afterEach(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))) })
it('refuses unknown binaries without modifying the input', () => {
  const bytes = Buffer.from('unknown helper')
  expect(() => patchHelper(bytes)).toThrow('Unsupported')
  expect(bytes.toString()).toBe('unknown helper')
})
it('discovers only bounded runtime layout and reports unknown helpers', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-cu-')); dirs.push(root)
  const bin = join(root, 'runtime', 'bin/node_modules/@oai/sky/bin/windows')
  await mkdir(bin, { recursive: true })
  await writeFile(join(bin, 'codex-computer-use.exe'), 'unknown')
  const found = await discoverHelpers(root)
  expect(found).toHaveLength(1)
  expect(found[0]?.state).toBe('unsupported')
  await expect(replaceHelper(found[0]!.target, 'repair', new AbortController().signal)).rejects.toThrow('Unsupported')
  expect((await readFile(found[0]!.target)).toString()).toBe('unknown')
})
it('embeds exact path and creation-time checks without killing parents', () => {
  const script = releaseScript("C:\\one's runtime\\codex-computer-use.exe")
  expect(script).toContain("one''s runtime")
  expect(script).toContain('$current.ExecutablePath -eq $target')
  expect(script).toContain('$current.CreationDate -eq $before.CreationDate')
  expect(script).not.toMatch(/taskkill|ParentProcessId|node_repl/i)
})
it('guide distinguishes cancellation, native capture and transport failures', () => {
  expect(COMPUTER_USE_GUIDE).toContain('FrameArrived')
  expect(COMPUTER_USE_GUIDE).toContain('Esc / user stop')
  expect(COMPUTER_USE_GUIDE).toContain('Transport timeout')
  expect(COMPUTER_USE_GUIDE).toContain('allowStop=true')
})
// Optional local fixture tests execute the integrated file transaction, never desktop control.
it.runIf(Boolean(process.env.DSH_CU_ORIGINAL))('patches and rolls back the known binary with retained backups', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-cu-')); dirs.push(root)
  const target = join(root, 'codex-computer-use.exe')
  const original = await readFile(process.env.DSH_CU_ORIGINAL!)
  await writeFile(target, original)
  const signal = new AbortController().signal
  expect(await replaceHelper(target, 'repair', signal)).toMatchObject({ changed: true })
  expect((await readFile(target)).equals(patchHelper(original))).toBe(true)
  expect(await replaceHelper(target, 'repair', signal)).toEqual({ changed: false })
  expect(await replaceHelper(target, 'rollback', signal)).toMatchObject({ changed: true })
  expect((await readFile(target)).equals(original)).toBe(true)
}, 30_000)

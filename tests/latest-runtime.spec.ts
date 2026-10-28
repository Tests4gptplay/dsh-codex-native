import { afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LatestCodexRuntime } from '../src/latest-runtime.ts'
const roots: string[] = []
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }) })
async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'codex-latest-test-')); roots.push(root)
  const triples: Record<string, string> = {
    'win32-x64': 'x86_64-pc-windows-msvc', 'win32-arm64': 'aarch64-pc-windows-msvc',
    'linux-x64': 'x86_64-unknown-linux-musl', 'linux-arm64': 'aarch64-unknown-linux-musl',
    'darwin-x64': 'x86_64-apple-darwin', 'darwin-arm64': 'aarch64-apple-darwin',
  }
  let version = '0.0.1-fixture'
  const source = {
    manifest: vi.fn(async () => ({ version, optionalDependencies: { [`@openai/codex-${process.platform}-${process.arch}`]: `npm:@openai/codex@${version}-${process.platform}-${process.arch}` } })),
    extract: vi.fn(async (_spec: string, destination: string) => {
      const bin = join(destination, 'vendor', triples[`${process.platform}-${process.arch}`]!, 'bin')
      await mkdir(bin, { recursive: true })
      await writeFile(join(bin, process.platform === 'win32' ? 'codex.exe' : 'codex'), 'fixture, never executed')
    }),
  }
  const warn = vi.fn()
  return { root, source, warn, runtime: new LatestCodexRuntime(warn, root, source), version: (next: string) => { version = next } }
}
it('follows a changed latest tag and keeps existing executable files intact', async () => {
  const x = await setup()
  const first = await x.runtime.resolve()
  x.version('0.0.2-fixture')
  const second = await x.runtime.resolve()
  expect(second.version).toBe('0.0.2-fixture')
  expect(second.executable).not.toBe(first.executable)
  expect(existsSync(first.executable)).toBe(true)
  await x.runtime.resolve()
  expect(x.source.extract).toHaveBeenCalledTimes(2)
  expect(x.source.manifest).toHaveBeenLastCalledWith('@openai/codex@latest', expect.objectContaining({ preferOnline: true }))
})
it('shares a concurrent refresh without caching the tag forever', async () => {
  const x = await setup()
  await Promise.all([x.runtime.resolve(), x.runtime.resolve()])
  expect(x.source.manifest).toHaveBeenCalledTimes(1)
  await x.runtime.resolve()
  expect(x.source.manifest).toHaveBeenCalledTimes(2)
})
it('keeps the usable runtime and reports a failed update', async () => {
  const x = await setup()
  const first = await x.runtime.resolve()
  x.source.manifest.mockRejectedValueOnce(new Error('offline'))
  expect(await x.runtime.resolve()).toEqual(first)
  expect(x.warn).toHaveBeenCalledWith(expect.stringContaining('offline'))
})

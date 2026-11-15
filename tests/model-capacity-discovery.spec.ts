import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SubprocessHandle } from '@deepseek-ai/dsh-subprocess'
import { NativeCodexAccount } from '../src/native-account.ts'
import { CodexAppServerAdapter } from '../src/adapter.ts'

const homes: string[] = []
afterEach(async () => { await Promise.all(homes.splice(0).map(home => rm(home, { recursive: true, force: true }))) })
async function home(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'native-capacity-'))
  homes.push(path)
  return path
}
function account(codexHome: string, contextWindow?: unknown): NativeCodexAccount {
  return new NativeCodexAccount(() => {
    const stdin = new PassThrough(), stdout = new PassThrough()
    let buffer = ''
    const done = Promise.withResolvers<{ exitCode: number; signal: null }>()
    stdin.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()
      let nl: number
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const request = JSON.parse(buffer.slice(0, nl)) as { id?: number; method: string }
        buffer = buffer.slice(nl + 1)
        if (request.id === undefined) continue
        const result = request.method === 'model/list' ? {
          data: [{ id: 'future-model', displayName: 'Future model', inputModalities: ['text'],
            supportedReasoningEfforts: [{ reasoningEffort: 'high' }], defaultReasoningEffort: 'high',
            ...(contextWindow === undefined ? {} : { contextWindow }) }], nextCursor: null,
        } : {}
        stdout.write(JSON.stringify({ id: request.id, result }) + '\n')
      }
    })
    return {
      stdin, stdout, stderr: new PassThrough(), done: done.promise, control: {},
      terminate: () => { stdout.end(); done.resolve({ exitCode: 0, signal: null }) },
      waitForExit: async () => ({ exitCode: 0, signal: null }),
    } as unknown as SubprocessHandle
  }, { env: { CODEX_HOME: codexHome } })
}
describe('automatic native model capacity discovery', () => {
  it('reads the same CODEX_HOME catalog after model/list and refreshes new model defaults without a name table', async () => {
    const dir = await home(), manager = account(dir)
    await writeFile(join(dir, 'models_cache.json'), JSON.stringify({ models: [{ slug: 'future-model', context_window: 500000, max_context_window: 872000 }] }))
    expect((await manager.models())[0]).toMatchObject({ id: 'future-model', contextWindow: 500000, defaultReasoningEffort: 'high' })
    await writeFile(join(dir, 'models_cache.json'), JSON.stringify({ models: [{ slug: 'future-model', context_window: 600000 }] }))
    expect((await manager.models())[0]?.contextWindow).toBe(600000)
    await manager.dispose()
  })
  it('prefers capacity returned by App Server over its local catalog', async () => {
    const dir = await home(), manager = account(dir, 400000)
    await writeFile(join(dir, 'models_cache.json'), JSON.stringify({ models: [{ slug: 'future-model', context_window: 500000 }] }))
    expect((await manager.models())[0]?.contextWindow).toBe(400000)
    await manager.dispose()
  })
  it.each([undefined, '{broken', JSON.stringify({ models: [{ slug: 'another-model', context_window: 500000 }] })])('does not invent a capacity when the catalog is absent, malformed or has no exact match: %s', async content => {
    const dir = await home(), manager = account(dir)
    if (content !== undefined) await writeFile(join(dir, 'models_cache.json'), content)
    expect((await manager.models())[0]).toMatchObject({ id: 'future-model', defaultReasoningEffort: 'high' })
    expect((await manager.models())[0]?.contextWindow).toBeUndefined()
    await manager.dispose()
  })
  it('ignores invalid server capacity and uses a positive integer from the matching cache entry', async () => {
    const dir = await home(), manager = account(dir, -1)
    await writeFile(join(dir, 'models_cache.json'), JSON.stringify({ models: [{ slug: 'future-model', context_window: 500000 }] }))
    expect((await manager.models())[0]?.contextWindow).toBe(500000)
    await manager.dispose()
  })
  it('preserves an explicit user capacity limit over automatic discovery', async () => {
    const adapter = new CodexAppServerAdapter({
      provider: 'codex-local', displayName: 'Codex', modelProvider: 'openai',
      models: [{ id: 'future-model', name: 'Future model', contextWindow: 200000, inputModalities: ['text'], reasoningEfforts: [] }],
      fetchModels: async () => [{ id: 'future-model', name: 'Future model', contextWindow: 500000, inputModalities: ['text'], reasoningEfforts: [] }],
      maxRetries: 0, maxRequestImageBytes: 0, maxCachedSessions: 1, sessionIdleTimeoutMs: 600000,
      onCleanupError: vi.fn(), resolveAttachments: () => undefined,
      runner: { open: vi.fn(), stream: vi.fn() },
    })
    await adapter.listModels('codex-local')
    expect((await adapter.resolveModel('codex-local', 'future-model')).context?.contextWindow).toBe(200000)
    await adapter.dispose()
  })
})

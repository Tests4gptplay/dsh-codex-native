import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime from '@deepseek-ai/dsh-llm'
// Only vitest.release.config.ts runs this file; this exact import resolves to
// DSH_RELEASE_ROOT/lib/index.js, never the workspace implementation.
import { CodexAppServerAdapter } from '../src/adapter.ts'

const provider = 'codex-release'
const cataloguedModel = 'gpt-6-astra'

describe('published adapter metadata through the patched host normalizer', () => {
  it.each([
    { model: cataloguedModel, name: 'GPT-6 Astra', contextWindow: 272_000 },
    { model: 'uncatalogued-codex-model', name: 'uncatalogued-codex-model', contextWindow: undefined },
  ])('retains pressure ownership for $model', async ({ model, name, contextWindow }) => {
    const ctx = new Context()
    const adapter = new CodexAppServerAdapter({
      provider,
      displayName: 'Release model metadata smoke',
      modelProvider: 'openai',
      models: [{
        id: cataloguedModel, name: 'GPT-6 Astra', contextWindow: 272_000,
        inputModalities: ['text'], reasoningEfforts: [],
      }],
      maxRetries: 0,
      maxRequestImageBytes: 20 * 1024 * 1024,
      maxCachedSessions: 1,
      sessionIdleTimeoutMs: 60_000,
      onCleanupError: error => { throw error },
      resolveAttachments: () => undefined,
      runner: {
        open: async () => { throw new Error('metadata resolution must not open a native thread') },
        async *stream() { throw new Error('metadata resolution must not call a model') },
      },
    })
    try {
      await ctx.plugin(LlmRuntime)
      ctx.llm.registerAdapter([provider], adapter)
      // This calls the real runtime normalizer, which must not drop ownership
      // when it validates and detaches the adapter's exact model metadata.
      const resolved = await ctx.llm.resolveModelInfo(provider, model)
      expect(resolved).toEqual({
        provider, id: model, name, inputModalities: ['text'],
        pressureCompaction: 'provider',
        ...(contextWindow === undefined ? {} : { context: { contextWindow } }),
      })
    } finally {
      await ctx.fiber.dispose()
      await adapter.dispose()
    }
  })
})

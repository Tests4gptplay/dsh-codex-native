import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import * as CodexAppServer from '../src/index.ts'
import { NativeCodexAccount } from '../src/native-account.ts'

const contexts: Context[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
  vi.restoreAllMocks()
})

async function context(): Promise<Context> {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(LocalSubprocessRuntime)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  ctx.provide('workingDirectory', { ensure: async () => process.cwd() } as never)
  return ctx
}

describe('plugin composition', () => {
  it('materializes the default model catalog through Cordis config parsing', async () => {
    const ctx = await context()
    // Model-picker metadata comes from a native app-server RPC, not a live login in CI.
    vi.spyOn(NativeCodexAccount.prototype, 'models').mockResolvedValue(
      CodexAppServer.Config({}).models!.map(model => ({
        ...model,
        name: model.name ?? model.id,
        inputModalities: model.inputModalities ?? ['text'],
        reasoningEfforts: model.reasoningEfforts ?? [],
      })),
    )
    await ctx.plugin(CodexAppServer, {})

    expect(ctx.llm.listProviders()).toContainEqual({
      id: 'codex-local',
      name: 'Codex (local login)',
    })
    expect(ctx.llm.providerRetryPolicy('codex-local')).toMatchObject({
      mode: 'normal',
      maxRetries: 1,
      maxDelayMs: 300_000,
    })
    const models = await ctx.llm.listModels('codex-local')
    expect(models.map(model => model.id)).toEqual([
      'gpt-6-astra',
      'gpt-6.1-sol',
      'gpt-5.6-sol',
      'gpt-5.6-terra',
      'gpt-5.6-luna',
      'gpt-5.5',
      'gpt-5.3-codex-spark',
    ])
    expect(models).toEqual(expect.arrayContaining([
      expect.objectContaining({
        provider: 'codex-local',
        id: 'gpt-6-astra',
        name: 'GPT-6-Astra',
        inputModalities: ['text', 'image'],
      }),
      expect.objectContaining({
        provider: 'codex-local',
        id: 'gpt-5.6-terra',
        name: 'GPT-5.6-Terra',
        inputModalities: ['text', 'image'],
      }),
      expect.objectContaining({
        provider: 'codex-local',
        id: 'gpt-5.3-codex-spark',
        name: 'GPT-5.3-Codex-Spark',
        inputModalities: ['text'],
      }),
    ]))
    await expect(ctx.llm.resolveModelInfo('codex-local', 'gpt-6-astra')).resolves.toMatchObject({
      inputModalities: ['text', 'image'],
      context: { contextWindow: 272_000 },
      reasoning: { defaultEffort: 'medium' },
    })
    await expect(ctx.llm.resolveModelInfo('codex-local', 'gpt-5.6-terra')).resolves.toMatchObject({
      inputModalities: ['text', 'image'],
      context: { contextWindow: 272_000 },
      reasoning: { defaultEffort: 'medium' },
    })
    await expect(ctx.llm.resolveModelInfo('codex-local', 'gpt-5.3-codex-spark')).resolves.toMatchObject({
      context: { contextWindow: 128_000 },
      reasoning: { defaultEffort: 'high' },
    })
  })

  it('offers compact skill tools to all DSH models and removes them on unload', async () => {
    const ctx = await context()
    const spawn = vi.spyOn(ctx.subprocess, 'spawn')
    const fiber = await ctx.plugin(CodexAppServer, {})
    expect(spawn).not.toHaveBeenCalled()
    expect(ctx.tools.get('codex_skill_search')).toBeDefined()
    expect(ctx.tools.get('codex_skill_read')).toBeDefined()
    const prompt = await ctx.systemPrompt.assemble()
    const section = prompt.sections.find(section => section.name === 'dsh-codex-skill-discovery')
    expect(section?.text).toContain('codex_skill_search')
    expect(section?.text).not.toContain('nte-mod-authoring')
    expect(section!.text.length).toBeLessThan(700)
    expect(CodexAppServer.Config({}).skillsMaxContextTokens).toBe(10000)
    await fiber.dispose()
    expect(ctx.tools.get('codex_skill_search')).toBeUndefined()
    expect((await ctx.systemPrompt.assemble()).sections.some(section => section.name === 'dsh-codex-skill-discovery')).toBe(false)
  })

  it('defaults custom routes to text-only and rejects duplicate modalities', async () => {
    const ctx = await context()
    await ctx.plugin(CodexAppServer, {
      models: [{ id: 'custom-model', name: 'Custom' }],
    })
    await expect(ctx.llm.resolveModelInfo('codex-local', 'custom-model')).resolves.toMatchObject({
      inputModalities: ['text'],
    })

    const invalid = await context()
    await expect(invalid.plugin(CodexAppServer, {
      models: [{
        id: 'invalid-model',
        name: 'Invalid',
        inputModalities: ['text', 'text'],
      }],
    })).rejects.toThrow('invalid inputModalities')
  })

  it('rejects an explicitly empty model catalog', async () => {
    const ctx = await context()
    await expect(ctx.plugin(CodexAppServer, { models: [] })).rejects.toThrow('models must not be empty')
  })

  it('delegates web_search unchanged for a non-Codex initiating Agent', async () => {
    const ctx = await context()
    await ctx.plugin(CodexAppServer, {})
    const downstream = {
      isError: false as const,
      value: null,
      content: [],
    }
    const next = vi.fn(async () => downstream)
    const result = await ctx.waterfall(
      ctx as never,
      'tools/execute',
      {
        name: 'web_search',
        arguments: { queries: ['query'] },
        signal: new AbortController().signal,
        agent: {
          options: { provider: 'another-provider', model: 'another-model' },
          session: { requestHeader: () => undefined },
        },
      } as never,
      next,
    )

    expect(result).toBe(downstream)
    expect(next).toHaveBeenCalledOnce()
  })

})

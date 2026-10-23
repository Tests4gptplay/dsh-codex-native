import { describe, expect, it, vi } from 'vitest'
import { setTimeout as delay } from 'node:timers/promises'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import * as CodexPlugin from '../src/index.ts'
import { NativeCodexAccount } from '../src/native-account.ts'

// Real Cordis plugin disposal; only the cleanup duration is controlled here.
describe('official DSH plugin teardown ownership', () => {
  it('joins account cleanup instead of leaving its promise detached from plugin disposal', async () => {
    const ctx = new Context()
    const entered = Promise.withResolvers<void>()
    const finish = Promise.withResolvers<void>()
    const spy = vi.spyOn(NativeCodexAccount.prototype, 'dispose').mockImplementation(() => {
      entered.resolve()
      return finish.promise
    })
    let disposed = false
    try {
      await ctx.plugin(LlmRuntime)
      await ctx.plugin(LocalSubprocessRuntime)
      await ctx.plugin(SystemPrompt)
      await ctx.plugin(ToolRuntime)
      const plugin = await ctx.plugin(CodexPlugin, {})
      const cleanup = plugin.dispose().then(() => { disposed = true })
      await entered.promise
      await delay(20)
      expect(disposed).toBe(false)
      finish.resolve()
      await cleanup
      expect(disposed).toBe(true)
    } finally {
      finish.resolve()
      await ctx.fiber.dispose()
      spy.mockRestore()
    }
  })
})

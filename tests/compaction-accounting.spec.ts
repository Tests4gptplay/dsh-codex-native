import { describe, expect, it } from 'vitest'
import { LlmError } from '@deepseek-ai/dsh-llm'
import { adapterChunks, lastUsageEvent, nativeUsageEvent, reportedUsage } from './compaction-pressure-fixture.ts'
import type { CodexAppServerEvent } from '../src/runner.ts'

const first = { inputTokens: 90_000, cachedInputTokens: 50_000, cacheWriteInputTokens: 10_000, outputTokens: 1_000, reasoningOutputTokens: 200 }
const next = { inputTokens: 120_000, cachedInputTokens: 70_000, cacheWriteInputTokens: 20_000, outputTokens: 2_000, reasoningOutputTokens: 400 }

function compaction(phase: 'started' | 'completed'): CodexAppServerEvent {
  return { kind: 'notification', method: `item/${phase}`, params: {
    threadId: 'isolated-thread', turnId: 'isolated-turn', item: { type: 'contextCompaction', id: 'compact-1' },
  } }
}

describe('consumption survives separation from context pressure', () => {
  it('preserves the structured context-overflow classification from the real native cold-replay failure', async () => {
    // Exact error payload observed from the isolated official 0.154 App Server.
    const failure = await adapterChunks([{
      kind: 'notification', method: 'turn/completed', params: {
        threadId: 'isolated-thread', turn: {
          id: 'isolated-turn', status: 'failed', error: {
            message: "Codex ran out of room in the model's context window. Start a new thread or clear earlier history before retrying.",
            codexErrorInfo: 'contextWindowExceeded', additionalDetails: null, misalignment: null,
          },
        },
      },
    }]).then(() => undefined, error => error)
    expect(failure).toBeInstanceOf(LlmError)
    expect(failure).toMatchObject({ code: 'CONTEXT_WINDOW_EXCEEDED' })
  })

  it('keeps cache-read, cache-write and uncached input disjoint, with reasoning included in output', async () => {
    const usage = reportedUsage(await adapterChunks([nativeUsageEvent(first)]))
    expect(usage).toEqual({
      inputTokens: 30_000, cacheReadTokens: 50_000, cacheWriteTokens: 10_000, outputTokens: 1_000, reasoningTokens: 200,
      contextUsage: { inputTokens: 90_000, outputTokens: 1_000 },
    })
    expect(usage!.inputTokens + usage!.cacheReadTokens! + usage!.cacheWriteTokens! + usage!.outputTokens).toBe(91_000)
  })

  it.each(['raw-first', 'fallback-first'] as const)('does not double-count matching raw and last-window notifications (%s)', async order => {
    const pair = (usage: typeof first) => order === 'raw-first'
      ? [nativeUsageEvent(usage), lastUsageEvent(usage)]
      : [lastUsageEvent(usage), nativeUsageEvent(usage)]
    const usage = reportedUsage(await adapterChunks([...pair(first), ...pair(next)]))
    expect(usage).toEqual({
      inputTokens: 60_000, cacheReadTokens: 120_000, cacheWriteTokens: 30_000, outputTokens: 3_000, reasoningTokens: 600,
      contextUsage: { inputTokens: 120_000, outputTokens: 2_000 },
    })
    expect(usage!.inputTokens + usage!.cacheReadTokens! + usage!.cacheWriteTokens! + usage!.outputTokens).toBe(213_000)
  })

  it('does not bill fallback-only snapshots that cannot be attributed to the current Harness step', async () => {
    const usage = reportedUsage(await adapterChunks([lastUsageEvent(first), lastUsageEvent(next), lastUsageEvent(next)]))
    expect(usage).toBeUndefined()
  })

  it('uses the latest smaller window rather than a previous maximum while retaining all consumption', async () => {
    const reduced = { inputTokens: 60_000, cachedInputTokens: 20_000, outputTokens: 500, reasoningOutputTokens: 100 }
    const usage = reportedUsage(await adapterChunks([
      nativeUsageEvent(next), lastUsageEvent(next), nativeUsageEvent(reduced), lastUsageEvent(reduced),
    ]))
    expect(usage).toEqual({
      inputTokens: 70_000, cacheReadTokens: 90_000, cacheWriteTokens: 20_000, outputTokens: 2_500, reasoningTokens: 500,
      contextUsage: { inputTokens: 60_000, outputTokens: 500 },
    })
  })

  it('does not let a delayed duplicate last snapshot overwrite a newer raw response window', async () => {
    const usage = reportedUsage(await adapterChunks([
      nativeUsageEvent(first), lastUsageEvent(first), nativeUsageEvent(next), lastUsageEvent(first), lastUsageEvent(first),
    ]))
    expect(usage).toMatchObject({
      inputTokens: 60_000, cacheReadTokens: 120_000, cacheWriteTokens: 30_000, outputTokens: 3_000,
      contextUsage: { inputTokens: 120_000, outputTokens: 2_000 },
    })
  })

  it('marks the window unknown after a raw response without usage rather than keeping an old small snapshot', async () => {
    const usage = reportedUsage(await adapterChunks([nativeUsageEvent(first), nativeUsageEvent(null), lastUsageEvent(first)]))
    expect(usage).toMatchObject({ inputTokens: 30_000, cacheReadTokens: 50_000, cacheWriteTokens: 10_000, outputTokens: 1_000, contextUsage: null })
  })

  it('does not fabricate usage from an estimated-only fallback snapshot', async () => {
    const usage = reportedUsage(await adapterChunks([
      lastUsageEvent(first), lastUsageEvent({ inputTokens: 0, outputTokens: 0, totalTokens: 5_000 }),
    ]))
    expect(usage).toBeUndefined()
  })

  it('leaves accounting absent when a raw response has no usage and only a possibly stale last snapshot follows', async () => {
    expect(reportedUsage(await adapterChunks([nativeUsageEvent(null), lastUsageEvent(first)]))).toBeUndefined()
  })

  it('preserves compaction request consumption without treating its prompt or estimated zero buckets as the post-compaction window', async () => {
    const usage = reportedUsage(await adapterChunks([
      nativeUsageEvent(first), compaction('started'), nativeUsageEvent(next),
      lastUsageEvent({ inputTokens: 0, outputTokens: 0, totalTokens: 5_000 }), compaction('completed'),
    ]))
    expect(usage).toMatchObject({
      inputTokens: 60_000, cacheReadTokens: 120_000, cacheWriteTokens: 30_000, outputTokens: 3_000, reasoningTokens: 600,
      contextUsage: null,
    })
  })

  it('restores a measured current window after compaction when the next normal response completes', async () => {
    const resumed = { inputTokens: 60_000, cachedInputTokens: 20_000, outputTokens: 500, reasoningOutputTokens: 100 }
    const usage = reportedUsage(await adapterChunks([
      nativeUsageEvent(first), compaction('started'), nativeUsageEvent(next),
      lastUsageEvent({ inputTokens: 0, outputTokens: 0, totalTokens: 5_000 }), compaction('completed'),
      nativeUsageEvent(resumed),
    ]))
    expect(usage).toMatchObject({
      inputTokens: 100_000, cacheReadTokens: 140_000, cacheWriteTokens: 30_000, outputTokens: 3_500, reasoningTokens: 700,
      contextUsage: { inputTokens: 60_000, outputTokens: 500 },
    })
  })

  it('leaves usage absent when the provider gave no accounting evidence', async () => {
    expect(reportedUsage(await adapterChunks([]))).toBeUndefined()
  })

  it('rejects cache buckets larger than their inclusive input total', async () => {
    await expect(adapterChunks([nativeUsageEvent({ inputTokens: 100, cachedInputTokens: 80, cacheWriteInputTokens: 30, outputTokens: 1 })]))
      .rejects.toMatchObject({ code: 'MALFORMED_RESPONSE' })
  })
})

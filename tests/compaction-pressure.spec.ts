import { describe, expect, it } from 'vitest'
import { adapterChunks, adapterModelInfo, lastUsageEvent, measurePressure, nativeUsageEvent, reportedUsage } from './compaction-pressure-fixture.ts'

const smallWindow = { inputTokens: 90_000, cachedInputTokens: 60_000, outputTokens: 1_000, reasoningOutputTokens: 200 }

describe('current context pressure across native Codex responses', () => {
  it.each([1, 2, 3])('keeps the latest 91k window after %i native responses in one DSH step', async responses => {
    const chunks = await adapterChunks([
      ...Array.from({ length: responses }, () => nativeUsageEvent(smallWindow)),
      lastUsageEvent(smallWindow),
    ])
    const pressure = await measurePressure(chunks)
    // Billing remains the sum of native requests, even though pressure is one window.
    expect(reportedUsage(chunks)).toMatchObject({
      inputTokens: 30_000 * responses,
      cacheReadTokens: 60_000 * responses,
      outputTokens: 1_000 * responses,
      reasoningTokens: 200 * responses,
      contextUsage: { inputTokens: 90_000, outputTokens: 1_000 },
    })
    expect(pressure.thresholdRatio).toBe(0.8)
    expect(pressure.headroomTokens).toBe(65_536)
    expect(pressure.baselineKind).toBe('usage')
    expect(pressure.totalTokens).toBe(91_000)
    expect(pressure.compactionSelected).toBe(false)
    expect(pressure.storedContextUsage).toEqual({ inputTokens: 90_000, outputTokens: 1_000 })
    expect(pressure.storedStreamContextUsage).toEqual({ inputTokens: 90_000, outputTokens: 1_000 })
    expect(pressure.projections.tokenUsage).toEqual({
      uncachedInputTokens: 30_000 * responses,
      cacheReadTokens: 60_000 * responses,
      cacheWriteTokens: 0,
      outputTokens: 1_000 * responses,
    })
    expect(pressure.projections.contextPressure).toMatchObject({ pressureTokens: 90_000 })
  })

  it('keeps old providers without contextUsage compatible with the ordinary usage baseline', async () => {
    const chunks = await adapterChunks([nativeUsageEvent(smallWindow)])
    const legacyChunks = chunks.map(chunk => {
      if (chunk.type !== 'usage') return chunk
      const { contextUsage: _contextUsage, ...usage } = reportedUsage([chunk])!
      return { ...chunk, usage }
    })
    const pressure = await measurePressure(legacyChunks)
    expect(pressure.totalTokens).toBe(91_000)
    expect(pressure.baselineKind).toBe('usage')
    expect(pressure.compactionSelected).toBe(false)
    expect(pressure.storedContextUsage).toBeUndefined()
    expect(pressure.storedStreamContextUsage).toBeUndefined()
  })

  it('clears a previous known context snapshot when the next provider marks its window unknown', async () => {
    const previous = await adapterChunks([nativeUsageEvent(smallWindow)])
    const chunks = await adapterChunks(Array.from({ length: 3 }, () => nativeUsageEvent(smallWindow)))
    // Explicitly exercise the public host API's unknown-window signal. Consumption is unchanged.
    const unknownChunks = chunks.map(chunk => chunk.type === 'usage'
      ? { ...chunk, usage: { ...chunk.usage, contextUsage: null } }
      : chunk)
    expect(reportedUsage(unknownChunks)).toMatchObject({ inputTokens: 90_000, cacheReadTokens: 180_000, outputTokens: 3_000, contextUsage: null })
    const pressure = await measurePressure(unknownChunks, previous)
    expect(pressure.storedContextUsage).toBeNull()
    expect(pressure.storedStreamContextUsage).toBeNull()
    expect(pressure.baselineKind).toBe('estimated')
    expect(pressure.totalTokens).toBeLessThan(91_000)
    expect(pressure.compactionSelected).toBe(false)
    expect(pressure.projections.contextPressure).not.toHaveProperty('pressureTokens')
    expect(pressure.projections.contextPressure).not.toHaveProperty('projectedTokens')
    expect(pressure.projections.tokenUsage).toEqual({
      uncachedInputTokens: 120_000, cacheReadTokens: 240_000, cacheWriteTokens: 0, outputTokens: 4_000,
    })
  })

  it('still compacts an ordinary provider with no ownership declaration at a 220k window under the same default policy', async () => {
    const chunks = await adapterChunks([nativeUsageEvent({ inputTokens: 219_000, cachedInputTokens: 60_000, outputTokens: 1_000 })])
    const pressure = await measurePressure(chunks)
    expect(pressure.thresholdRatio).toBe(0.8)
    expect(pressure.headroomTokens).toBe(65_536)
    expect(pressure.totalTokens).toBe(220_000)
    expect(pressure.compactionSelected).toBe(true)
  })
})

describe('Codex owns proactive pressure compaction', () => {
  it('declares provider pressure ownership in real catalogued model metadata while preserving its context capacity', async () => {
    expect(await adapterModelInfo()).toMatchObject({
      provider: 'codex-local', id: 'gpt-6-astra',
      pressureCompaction: 'provider', context: { contextWindow: 272_000 },
    })
  })

  it('declares ownership for an uncatalogued Codex model even when no context capacity is known', async () => {
    const info = await adapterModelInfo('uncatalogued-codex-model')
    expect(info).toMatchObject({ provider: 'codex-local', id: 'uncatalogued-codex-model', pressureCompaction: 'provider' })
    expect(info.context).toBeUndefined()
  })

  it.each(['pressure', 'context-overflow'] as const)('delegates proactive pressure while retaining emergency recovery at a 220k window (%s)', async trigger => {
    const modelInfo = await adapterModelInfo()
    const chunks = await adapterChunks([
      nativeUsageEvent(smallWindow),
      nativeUsageEvent({ inputTokens: 219_000, cachedInputTokens: 60_000, outputTokens: 1_000 }),
    ])
    const pressure = await measurePressure(chunks, undefined, { modelInfo, trigger })
    expect(pressure.totalTokens).toBe(220_000)
    expect(pressure.baselineKind).toBe('usage')
    expect(pressure.projections.tokenUsage).toEqual({
      uncachedInputTokens: 189_000, cacheReadTokens: 120_000, cacheWriteTokens: 0, outputTokens: 2_000,
    })
    expect(reportedUsage(chunks)).toMatchObject({
      inputTokens: 189_000, cacheReadTokens: 120_000, outputTokens: 2_000,
      contextUsage: { inputTokens: 219_000, outputTokens: 1_000 },
    })
    expect(pressure.thresholdRatio).toBe(0.8)
    expect(pressure.headroomTokens).toBe(65_536)
    if (trigger === 'pressure') {
      expect(pressure.compactionSelected).toBe(false)
      expect(pressure.compactionResult).toBeNull()
    } else {
      expect(pressure.compactionSelected).toBe(true)
    }
  })
})

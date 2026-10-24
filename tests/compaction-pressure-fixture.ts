import { Context } from '@deepseek-ai/cordis'
import { AssistantStreamAccumulator, createMessage, createUserMessage, lastAssistantStreamChunk } from '@deepseek-ai/dsh-llm'
import type { LlmResolvedModelInfo, StreamChunk, TokenUsage } from '@deepseek-ai/dsh-llm'
import { Session, SessionId, canonicalHeader } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import TokenMeter from '@deepseek-ai/dsh-token-meter'
import BasicCompactionEngine from '@deepseek-ai/dsh-compaction-basic'
import { CodexAppServerAdapter } from '../src/adapter.ts'
import type { CodexAppServerEvent } from '../src/runner.ts'

export interface NativeUsage {
  inputTokens: number
  cachedInputTokens?: number
  cacheWriteInputTokens?: number
  outputTokens: number
  reasoningOutputTokens?: number
  totalTokens?: number
}

const TARGET = { provider: 'codex-local', model: 'gpt-6-astra' }
const COMPACTION_SELECTED = new Error('test stopped before model summarization')
type PressureAgent = Parameters<BasicCompactionEngine['compactIfNeeded']>[0]

export interface PressureOptions {
  modelInfo?: LlmResolvedModelInfo
  trigger?: Parameters<BasicCompactionEngine['compactIfNeeded']>[1]
}

export type UsageWithContext = TokenUsage & {
  contextUsage?: { inputTokens: number; outputTokens: number } | null
}

class ObservedCompactionEngine extends BasicCompactionEngine {
  selected = false

  override async compactRegion(): Promise<never> {
    this.selected = true
    throw COMPACTION_SELECTED
  }
}

export function nativeUsageEvent(usage: NativeUsage | null): CodexAppServerEvent {
  return { kind: 'notification', method: 'rawResponse/completed', params: {
    threadId: 'isolated-thread', turnId: 'isolated-turn', usage,
  } }
}

export function lastUsageEvent(usage: NativeUsage): CodexAppServerEvent {
  return { kind: 'notification', method: 'thread/tokenUsage/updated', params: {
    threadId: 'isolated-thread', turnId: 'isolated-turn', tokenUsage: { last: usage },
  } }
}

function fixtureAdapter(events: readonly CodexAppServerEvent[]): CodexAppServerAdapter {
  return new CodexAppServerAdapter({
    provider: TARGET.provider,
    displayName: 'isolated test',
    modelProvider: 'openai',
    models: [{ id: TARGET.model, name: 'GPT-6 Astra', contextWindow: 272_000, inputModalities: ['text'], reasoningEfforts: [] }],
    maxRetries: 0,
    maxRequestImageBytes: 20 * 1024 * 1024,
    maxCachedSessions: 1,
    sessionIdleTimeoutMs: 60_000,
    onCleanupError: error => { throw error },
    resolveAttachments: () => undefined,
    runner: {
      open: async () => { throw new Error('unexpected stateful runner call') },
      async *stream() {
        yield* events
        yield { kind: 'notification', method: 'rawResponseItem/completed', params: {
          threadId: 'isolated-thread', turnId: 'isolated-turn',
          item: { type: 'message', id: 'answer', role: 'assistant', content: [{ type: 'output_text', text: 'answer' }] },
        } }
        yield { kind: 'notification', method: 'item/completed', params: {
          threadId: 'isolated-thread', turnId: 'isolated-turn', item: { type: 'agentMessage', id: 'answer', text: 'answer' },
        } }
        yield { kind: 'notification', method: 'turn/completed', params: {
          threadId: 'isolated-thread', turn: { id: 'isolated-turn', status: 'completed', error: null },
        } }
      },
    },
  })
}

/** Resolve the real adapter's metadata without reaching any native process. */
export async function adapterModelInfo(model = TARGET.model): Promise<LlmResolvedModelInfo> {
  const adapter = fixtureAdapter([])
  try {
    return await adapter.resolveModel(TARGET.provider, model)
  } finally {
    await adapter.dispose()
  }
}

/** Real adapter with a protocol-event fixture; no process or model call occurs. */
export async function adapterChunks(events: readonly CodexAppServerEvent[]): Promise<StreamChunk[]> {
  const adapter = fixtureAdapter(events)
  try {
    const result: StreamChunk[] = []
    for await (const chunk of adapter.stream({
      ...TARGET,
      messages: [createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'continue' }] })],
    })) result.push(chunk)
    return result
  } finally {
    await adapter.dispose()
  }
}

export function reportedUsage(chunks: readonly StreamChunk[]): UsageWithContext | undefined {
  const chunk = chunks.findLast(chunk => chunk.type === 'usage')
  return chunk?.type === 'usage' ? chunk.usage : undefined
}

/** Exercise official Session, stream accumulator, token meter and pressure policy. */
export async function measurePressure(
  chunks: readonly StreamChunk[],
  previousChunks?: readonly StreamChunk[],
  options: PressureOptions = {},
) {
  const ctx = new Context()
  new SessionProjectionRegistry(ctx)
  const meter = new TokenMeter(ctx)
  // The default metadata is an ordinary provider control. Ownership cases pass
  // the complete metadata returned by the real Codex adapter, unchanged.
  ctx.reflect.provide('llm', {
    imageRequestPricing: () => undefined,
    fileRequestText: () => undefined,
    resolveModelInfo: async () => options.modelInfo ?? { ...TARGET, name: TARGET.model, context: { contextWindow: 272_000 } },
  })
  const engine = new ObservedCompactionEngine(ctx, { auto: false })
  const session = Session.create(SessionId('context-pressure-regression'))
  try {
    // Enough durable surface to leave a valid compactable prefix above retainTokens.
    // The fixed surface is identical in the failing case and the control.
    for (let index = 0; index < 6; index++) {
      session.append('user/message', createUserMessage({
        source: { kind: 'user' },
        content: [{ type: 'text', text: String(index) + 'x'.repeat(40_000) }],
      }), { surfaceOp: 'append' })
    }
    const steps = previousChunks === undefined ? [chunks] : [previousChunks, chunks]
    for (const [stepIndex, stepChunks] of steps.entries()) {
      const step = stepIndex + 1
      session.append('step/start', { turn: 1, step })
      session.append('request/header', { header: canonicalHeader({ config: TARGET }), reason: 'initial' })
      const accumulator = new AssistantStreamAccumulator()
      for (const [index, chunk] of stepChunks.entries()) accumulator.push({ time: index, chunk })
      const usage = reportedUsage(stepChunks)
      session.append('assistant/message', {
        turn: 1, step,
        stream: [...accumulator.snapshot()],
        message: createMessage({ role: 'assistant', source: { kind: 'model', ...TARGET }, content: [{ type: 'text', text: 'answer' }] }),
        ...(usage === undefined ? {} : { usage }),
      }, { surfaceOp: 'append' })
      session.append('step/end', { turn: 1, step })
    }
    const measurement = meter.measure(session)
    let compactionResult: Awaited<ReturnType<BasicCompactionEngine['compactIfNeeded']>> | undefined
    try {
      compactionResult = await engine.compactIfNeeded(
        { session, options: TARGET } as PressureAgent,
        options.trigger ?? 'pressure',
        new AbortController().signal,
      )
    } catch (error) {
      if (error !== COMPACTION_SELECTED) throw error
    }
    const storedAssistant = session.snapshotEvents().findLast(event => event.type === 'assistant/message')
    const streamUsage = storedAssistant === undefined ? undefined : lastAssistantStreamChunk(storedAssistant.data.stream, 'usage')?.usage
    return {
      totalTokens: measurement.totalTokens,
      baselineKind: measurement.baseline.kind,
      surfaceTokens: measurement.surfaceTokens,
      compactionSelected: engine.selected,
      compactionResult,
      thresholdRatio: engine.config.thresholdRatio,
      headroomTokens: engine.config.headroomTokens,
      storedContextUsage: (storedAssistant?.data.usage as UsageWithContext | undefined)?.contextUsage,
      storedStreamContextUsage: (streamUsage as UsageWithContext | undefined)?.contextUsage,
      projections: ctx.sessionProjections.snapshot(session).values,
    }
  } finally {
    await ctx.fiber.dispose()
  }
}

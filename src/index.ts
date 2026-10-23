/** DeepSeek Harness main-model provider backed by the locally authenticated Codex App Server. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-attachment'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-tools'
import type { ModelModality } from '@deepseek-ai/dsh-llm'
import z from '@deepseek-ai/schemastery'
import { DshCodexAdapter } from './dsh-adapter.ts'
import { codexSpawnSpec } from './launch.ts'
import type { CodexModel } from './adapter.ts'
import { SAFE_MODEL_ID, SAFE_REASONING_EFFORT } from './identifiers.ts'
import { CodexAppServerRunner } from './runner.ts'
import { NativeCodexAccount } from './native-account.ts'
import { registerNativeCodexTransport } from './native-transport.ts'

export { CodexAppServerAdapter } from './adapter.ts'
export type { CodexAdapterOptions, CodexModel } from './adapter.ts'
export { boundRequestImageHistory, imageAttachmentMarker, NativeImageBridge } from './images.ts'
export type { CodexImageStorePort, ExternalizedCodexEvent } from './images.ts'
export {
  AppServerEventMapper,
  appServerDynamicTools,
  appServerHistory,
  assertCompletedTurn,
  codexFailureCode,
  harnessToolCall,
} from './protocol.ts'
export type { CodexActionBlock, CodexReplayState, HarnessToolCall } from './protocol.ts'
export {
  CODEX_APP_SERVER_VERSION,
  CodexAppServerRunner,
  codexAppServerArgv,
  codexCliEntry,
} from './runner.ts'
export type {
  CodexAppServerEvent,
  CodexAppServerHydratedToolResult,
  CodexAppServerRequest,
  CodexAppServerRunnerOptions,
  CodexAppServerRunnerPort,
  CodexAppServerThreadPort,
  CodexAppServerThreadRequest,
  CodexAppServerToolResult,
  CodexAppServerTurnRequest,
  JsonValue,
} from './runner.ts'

export const name = 'dsh-codex-native'
export const inject = ['llm', 'subprocess', 'tools']

/** Plugin configuration for one static provider route. */
export interface Config {
  imageGenerationEnabled?: boolean
  provider?: string
  displayName?: string
  modelProvider?: string
  models?: Array<{
    id: string
    name?: string
    description?: string
    contextWindow?: number
    inputModalities?: ModelModality[]
    reasoningEfforts?: string[]
    defaultReasoningEffort?: string
  }>
  timeoutMs?: number
  disposeGraceMs?: number
  maxJsonRpcLineBytes?: number
  maxRequestImageBytes?: number
  maxStderrBytes?: number
  maxRetries?: number
  maxCachedSessions?: number
  sessionIdleTimeoutMs?: number
  env?: Record<string, string>
}

const MODEL_MODALITIES = ['text', 'image'] as const

const DEFAULT_MODELS = [
  {
    id: 'gpt-6-astra',
    name: 'GPT-6-Astra',
    description: 'Our most capable model for complex, demanding work.',
    contextWindow: 272_000,
    inputModalities: ['text', 'image'],
    reasoningEfforts: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'],
    defaultReasoningEffort: 'medium',
  },
  {
    id: 'gpt-5.6-sol',
    name: 'GPT-5.6-Sol',
    description: 'Reliable agentic workhorse for everyday tasks.',
    contextWindow: 272_000,
    inputModalities: ['text', 'image'],
    reasoningEfforts: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'],
    defaultReasoningEffort: 'low',
  },
  {
    id: 'gpt-5.6-terra',
    name: 'GPT-5.6-Terra',
    description: 'Balanced agentic coding model for everyday work.',
    contextWindow: 272_000,
    inputModalities: ['text', 'image'],
    reasoningEfforts: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'],
    defaultReasoningEffort: 'medium',
  },
  {
    id: 'gpt-5.6-luna',
    name: 'GPT-5.6-Luna',
    description: 'Fast and affordable agentic coding model.',
    contextWindow: 272_000,
    inputModalities: ['text', 'image'],
    reasoningEfforts: ['low', 'medium', 'high', 'xhigh', 'max'],
    defaultReasoningEffort: 'medium',
  },
  {
    id: 'gpt-5.5',
    name: 'GPT-5.5',
    description: 'Proven previous-generation model for coding and general work.',
    contextWindow: 272_000,
    inputModalities: ['text', 'image'],
    reasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
    defaultReasoningEffort: 'medium',
  },
  {
    id: 'gpt-5.3-codex-spark',
    name: 'GPT-5.3-Codex-Spark',
    description: 'Ultra-fast coding model.',
    contextWindow: 128_000,
    inputModalities: ['text'],
    reasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
    defaultReasoningEffort: 'high',
  },
] satisfies Array<Required<NonNullable<Config['models']>[number]>>

const DEFAULT_MAX_JSON_RPC_LINE_BYTES = 8 * 1024 * 1024
const DEFAULT_MAX_REQUEST_IMAGE_BYTES = 20 * 1024 * 1024

const modelSchema = z.object({
  id: z.string().required(),
  name: z.string(),
  description: z.string(),
  contextWindow: z.number().step(1).min(1),
  inputModalities: z.array(z.union(MODEL_MODALITIES)).min(1).default(['text']),
  reasoningEfforts: z.array(z.string()),
  defaultReasoningEffort: z.string(),
})

export const Config: z<Config> = z.object({
  provider: z.string().default('codex-local'),
  displayName: z.string().default('Codex (local login)'),
  modelProvider: z.string().default('openai'),
  models: z.array(modelSchema).default(DEFAULT_MODELS),
  timeoutMs: z.number().min(0).max(2_147_483_647).default(0),
  disposeGraceMs: z.number().max(2_147_483_647).default(3_000),
  maxJsonRpcLineBytes: z.number().step(1).min(1).default(DEFAULT_MAX_JSON_RPC_LINE_BYTES),
  maxRequestImageBytes: z.number().step(1).min(1).default(DEFAULT_MAX_REQUEST_IMAGE_BYTES),
  maxStderrBytes: z.number().step(1).min(1).default(64 * 1024),
  maxRetries: z.number().step(1).min(0).max(Number.MAX_SAFE_INTEGER).default(1),
  maxCachedSessions: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER).default(8),
  sessionIdleTimeoutMs: z.number().step(1).min(1).max(2_147_483_647).default(600_000),
  imageGenerationEnabled: z.boolean().default(true),
  env: z.dict(z.string()).default({}),
})

interface ResolvedConfig {
  readonly provider: string
  readonly displayName: string
  readonly modelProvider: string
  readonly models: readonly CodexModel[]
  readonly timeoutMs: number
  readonly disposeGraceMs: number
  readonly maxJsonRpcLineBytes: number
  readonly maxRequestImageBytes: number
  readonly maxStderrBytes: number
  readonly maxRetries: number
  readonly maxCachedSessions: number
  readonly sessionIdleTimeoutMs: number
  readonly imageGenerationEnabled: boolean
  readonly env: Readonly<Record<string, string>>
}

const SAFE_ROUTE = /^[a-z0-9][a-z0-9._-]{0,79}$/u

function resolveConfig(config: Config): ResolvedConfig {
  const provider = config.provider ?? 'codex-local'
  const displayName = config.displayName ?? 'Codex (local login)'
  const modelProvider = config.modelProvider ?? 'openai'
  const timeoutMs = config.timeoutMs ?? 0
  const disposeGraceMs = config.disposeGraceMs ?? 3_000
  const maxJsonRpcLineBytes = config.maxJsonRpcLineBytes ?? DEFAULT_MAX_JSON_RPC_LINE_BYTES
  const maxRequestImageBytes = config.maxRequestImageBytes ?? DEFAULT_MAX_REQUEST_IMAGE_BYTES
  const maxStderrBytes = config.maxStderrBytes ?? 64 * 1024
  const maxRetries = config.maxRetries ?? 1
  const maxCachedSessions = config.maxCachedSessions ?? 8
  const sessionIdleTimeoutMs = config.sessionIdleTimeoutMs ?? 600_000
  const imageGenerationEnabled = config.imageGenerationEnabled ?? true
  const env = config.env ?? {}
  if (!SAFE_ROUTE.test(provider)) throw new Error('llm-codex-app-server: provider is not a safe route id')
  if (displayName.trim().length === 0) throw new Error('llm-codex-app-server: displayName must not be empty')
  if (!SAFE_ROUTE.test(modelProvider)) {
    throw new Error('llm-codex-app-server: modelProvider is not a safe Codex provider id')
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0 || timeoutMs > 2_147_483_647) {
    throw new Error('dsh-codex-native: timeoutMs must be a non-negative finite number (0 disables the additional hard timer)')
  }
  if (!Number.isFinite(disposeGraceMs) || disposeGraceMs <= 0 || disposeGraceMs > 2_147_483_647) {
    throw new Error('llm-codex-app-server: disposeGraceMs must be a positive finite number')
  }
  if (!Number.isSafeInteger(maxJsonRpcLineBytes) || maxJsonRpcLineBytes <= 0) {
    throw new Error('llm-codex-app-server: maxJsonRpcLineBytes must be a positive safe integer')
  }
  if (!Number.isSafeInteger(maxRequestImageBytes) || maxRequestImageBytes <= 0) {
    throw new Error('llm-codex-app-server: maxRequestImageBytes must be a positive safe integer')
  }
  if (!Number.isSafeInteger(maxStderrBytes) || maxStderrBytes <= 0) {
    throw new Error('llm-codex-app-server: maxStderrBytes must be a positive safe integer')
  }
  if (!Number.isSafeInteger(maxRetries) || maxRetries < 0) {
    throw new Error('llm-codex-app-server: maxRetries must be a non-negative safe integer')
  }
  if (!Number.isSafeInteger(maxCachedSessions) || maxCachedSessions <= 0) {
    throw new Error('llm-codex-app-server: maxCachedSessions must be a positive safe integer')
  }
  if (!Number.isSafeInteger(sessionIdleTimeoutMs)
    || sessionIdleTimeoutMs <= 0
    || sessionIdleTimeoutMs > 2_147_483_647) {
    throw new Error('llm-codex-app-server: sessionIdleTimeoutMs must be a positive timer duration')
  }
  const configuredModels = config.models ?? DEFAULT_MODELS
  if (configuredModels.length === 0) throw new Error('llm-codex-app-server: models must not be empty')
  const seen = new Set<string>()
  const models = configuredModels.map((candidate): CodexModel => {
    if (!SAFE_MODEL_ID.test(candidate.id) || seen.has(candidate.id)) {
      throw new Error(`llm-codex-app-server: invalid or duplicate model id ${JSON.stringify(candidate.id)}`)
    }
    seen.add(candidate.id)
    const inputModalities = [...(candidate.inputModalities ?? ['text'])]
    if (inputModalities.length === 0
      || inputModalities.some(modality => !MODEL_MODALITIES.includes(modality))
      || new Set(inputModalities).size !== inputModalities.length) {
      throw new Error(`llm-codex-app-server: model ${JSON.stringify(candidate.id)} has invalid inputModalities`)
    }
    const efforts = [...(candidate.reasoningEfforts ?? [])]
    if (efforts.some(effort => !SAFE_REASONING_EFFORT.test(effort)) || new Set(efforts).size !== efforts.length) {
      throw new Error(`llm-codex-app-server: model ${JSON.stringify(candidate.id)} has invalid reasoningEfforts`)
    }
    if (candidate.defaultReasoningEffort !== undefined && !efforts.includes(candidate.defaultReasoningEffort)) {
      throw new Error(`llm-codex-app-server: model ${JSON.stringify(candidate.id)} default reasoning effort is not advertised`)
    }
    return {
      id: candidate.id,
      name: candidate.name ?? candidate.id,
      ...(candidate.description === undefined ? {} : { description: candidate.description }),
      ...(candidate.contextWindow === undefined ? {} : { contextWindow: candidate.contextWindow }),
      inputModalities,
      reasoningEfforts: efforts,
      ...(candidate.defaultReasoningEffort === undefined
        ? {}
        : { defaultReasoningEffort: candidate.defaultReasoningEffort }),
    }
  })
  return {
    provider,
    displayName,
    modelProvider,
    models,
    timeoutMs,
    disposeGraceMs,
    maxJsonRpcLineBytes,
    maxRequestImageBytes,
    maxStderrBytes,
    maxRetries,
    maxCachedSessions,
    sessionIdleTimeoutMs,
    imageGenerationEnabled,
    env,
  }
}

/** Register the configured Codex App Server route on `ctx.llm`. */
export function apply(ctx: Context, config: Config): void {
  const resolved = resolveConfig(config)
  const runner = new CodexAppServerRunner({
    timeoutMs: resolved.timeoutMs,
    disposeGraceMs: resolved.disposeGraceMs,
    maxJsonRpcLineBytes: resolved.maxJsonRpcLineBytes,
    maxStderrBytes: resolved.maxStderrBytes,
    env: resolved.env,
    spawn: spec => ctx.subprocess.spawn(codexSpawnSpec(spec)),
  })
  const reportCleanupError = (error: unknown): void => {
    ctx.logger.warn(`llm-codex-app-server: cached session cleanup failed: ${String(error)}`)
  }
  const adapter = new DshCodexAdapter({
    provider: resolved.provider,
    displayName: resolved.displayName,
    modelProvider: resolved.modelProvider,
    models: resolved.models,
    maxRetries: resolved.maxRetries,
    maxRequestImageBytes: resolved.maxRequestImageBytes,
    maxCachedSessions: resolved.maxCachedSessions,
    sessionIdleTimeoutMs: resolved.sessionIdleTimeoutMs,
    onCleanupError: reportCleanupError,
    resolveAttachments: () => ctx.get('attachments'),
    resolveImageGenerationEnabled: () => resolved.imageGenerationEnabled,
    runner,
  })
  ctx.llm.registerAdapter([resolved.provider], adapter)
  ctx.on('session/disposed', (session) => {
    void adapter.disposeSession(String(session.id)).catch(reportCleanupError)
  })
  const account = new NativeCodexAccount(spec => ctx.subprocess.spawn(codexSpawnSpec(spec)))
  ctx.inject(['connection'], (scoped) => {
    scoped.effect(
      () => registerNativeCodexTransport(scoped.connection, account),
      'dsh-codex-native: authenticated account RPC',
    )
  })
  ctx.effect(() => () => { void account.dispose() }, 'dsh-codex-native: close account login process')
  ctx.effect(() => () => adapter.dispose(), 'llm-codex-app-server: dispose cached sessions')
}

/** Harness LLM adapter backed by one ephemeral Codex App Server per request. */
import { LlmAdapter } from '@deepseek-ai/dsh-llm';
import type { GenerateOptions, LlmModelInfo, LlmProviderInfo, LlmResolvedModelInfo, ModelModality, ResolvedRetryPolicy, StreamChunk } from '@deepseek-ai/dsh-llm';
import type { CodexImageStorePort } from './images.ts';
import type { CodexAppServerRunnerPort } from './runner.ts';
/** One model exposed in the Harness selector. */
export interface CodexModel {
    readonly id: string;
    readonly name: string;
    readonly description?: string;
    readonly contextWindow?: number;
    readonly inputModalities: readonly ModelModality[];
    readonly reasoningEfforts: readonly string[];
    readonly defaultReasoningEffort?: string;
}
/** Stable route facts captured by one adapter instance. */
export interface CodexAdapterOptions {
    readonly provider: string;
    readonly displayName: string;
    readonly modelProvider: string;
    readonly models: readonly CodexModel[];
    readonly maxRetries: number;
    readonly maxRequestImageBytes: number;
    readonly maxCachedSessions: number;
    readonly sessionIdleTimeoutMs: number;
    readonly onCleanupError: (error: unknown) => void;
    readonly resolveAttachments: () => CodexImageStorePort | undefined;
    /** Resolve the live settings snapshot captured by the next model operation. */
    readonly resolveImageGenerationEnabled?: () => boolean;
    readonly runner: CodexAppServerRunnerPort;
}
/** Main-model adapter that maps live App Server events into the Harness loop. */
export declare class CodexAppServerAdapter extends LlmAdapter {
    private readonly options;
    private readonly cache;
    constructor(options: CodexAdapterOptions);
    providerInfo(provider: string): LlmProviderInfo;
    providerRetryPolicy(_provider: string): ResolvedRetryPolicy;
    listModels(provider: string): Promise<readonly LlmModelInfo[]>;
    resolveModel(provider: string, model: string, _signal?: AbortSignal): Promise<LlmResolvedModelInfo>;
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
    /** Dispose the cached process for one ended Harness session. */
    disposeSession(sessionId: string): Promise<void>;
    /** Dispose every cached process owned by this adapter. */
    dispose(): Promise<void>;
    private cacheEpoch;
    private settleCache;
}

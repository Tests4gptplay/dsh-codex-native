/** DeepSeek Harness main-model provider backed by the locally authenticated Codex App Server. */
import type { Context } from '@deepseek-ai/cordis';
import type { ModelModality } from '@deepseek-ai/dsh-llm';
import z from '@deepseek-ai/schemastery';
export { CodexAppServerAdapter } from './adapter.ts';
export type { CodexAdapterOptions, CodexModel } from './adapter.ts';
export { boundRequestImageHistory, imageAttachmentMarker, NativeImageBridge } from './images.ts';
export type { CodexImageStorePort, ExternalizedCodexEvent } from './images.ts';
export { AppServerEventMapper, appServerDynamicTools, appServerHistory, assertCompletedTurn, codexFailureCode, harnessToolCall, } from './protocol.ts';
export type { CodexActionBlock, CodexReplayState, HarnessToolCall } from './protocol.ts';
export { CODEX_APP_SERVER_VERSION, CodexAppServerRunner, codexAppServerArgv, codexCliEntry, } from './runner.ts';
export type { CodexAppServerEvent, CodexAppServerHydratedToolResult, CodexAppServerRequest, CodexAppServerRunnerOptions, CodexAppServerRunnerPort, CodexAppServerThreadPort, CodexAppServerThreadRequest, CodexAppServerToolResult, CodexAppServerTurnRequest, JsonValue, } from './runner.ts';
export declare const name = "dsh-codex-native";
export declare const inject: string[];
/** Plugin configuration for one static provider route. */
export interface Config {
    imageGenerationEnabled?: boolean;
    provider?: string;
    displayName?: string;
    modelProvider?: string;
    models?: Array<{
        id: string;
        name?: string;
        description?: string;
        contextWindow?: number;
        inputModalities?: ModelModality[];
        reasoningEfforts?: string[];
        defaultReasoningEffort?: string;
    }>;
    timeoutMs?: number;
    disposeGraceMs?: number;
    maxJsonRpcLineBytes?: number;
    maxRequestImageBytes?: number;
    maxStderrBytes?: number;
    maxRetries?: number;
    maxCachedSessions?: number;
    sessionIdleTimeoutMs?: number;
    env?: Record<string, string>;
}
export declare const Config: z<Config>;
/** Register the configured Codex App Server route on `ctx.llm`. */
export declare function apply(ctx: Context, config: Config): void;

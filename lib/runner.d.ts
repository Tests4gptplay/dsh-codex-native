/** Disposable App Server process and thread lifecycle. */
import type { SubprocessHandle, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess';
import type { CodexAppServerEvent, JsonValue } from './wire.ts';
export type { CodexAppServerEvent, JsonValue } from './wire.ts';
export declare const CODEX_APP_SERVER_VERSION = "0.154.0";
/** Complete input for one stateless App Server turn. */
export interface CodexAppServerRequest {
    readonly model: string;
    readonly modelProvider: string;
    readonly reasoningEffort?: string;
    readonly system: string;
    readonly history: readonly JsonValue[];
    readonly dynamicTools: readonly JsonValue[];
    /** Native Codex web-search policy for this process. */
    readonly webSearch?: CodexWebSearchMode;
    /** Whether the pinned native image-generation feature is offered to this turn. */
    readonly imageGenerationEnabled?: boolean;
    readonly signal?: AbortSignal;
}
/** Thread-level values fixed for one disposable App Server process. */
export interface CodexAppServerThreadRequest {
    readonly model: string;
    readonly modelProvider: string;
    readonly system: string;
    readonly dynamicTools: readonly JsonValue[];
    /** Native Codex web-search policy for this process. */
    readonly webSearch?: CodexWebSearchMode;
    /** Whether the pinned native image-generation feature is offered to this thread. */
    readonly imageGenerationEnabled?: boolean;
    readonly signal?: AbortSignal;
}
/** Top-level Codex web-search policy passed to the pinned App Server. */
export type CodexWebSearchMode = 'disabled' | 'live';
/** Durable Harness result used to match one pending App Server callback exactly. */
export interface CodexAppServerToolResult {
    readonly callId: string;
    readonly output: JsonValue;
    readonly success: boolean;
}
/** Transport-ready result that resolves one pending App Server dynamic-tool callback. */
export interface CodexAppServerHydratedToolResult {
    readonly callId: string;
    readonly contentItems: readonly JsonValue[];
    readonly success: boolean;
}
/** One Harness model step on an open App Server thread. */
export interface CodexAppServerTurnRequest {
    readonly reasoningEffort?: string;
    readonly injectedItems?: readonly JsonValue[];
    readonly input?: readonly JsonValue[];
    /** Additional user messages steered into the active turn in order. */
    readonly steeringInputs?: readonly (readonly JsonValue[])[];
    readonly toolResult?: CodexAppServerHydratedToolResult;
    readonly signal?: AbortSignal;
}
/** One process-owned ephemeral thread that may span consecutive Harness steps. */
export interface CodexAppServerThreadPort {
    readonly threadId: string;
    /** True only after the owned process/pipe has actually closed. */
    readonly closed?: boolean;
    stream(request: CodexAppServerTurnRequest): AsyncIterable<CodexAppServerEvent>;
    dispose(): Promise<void>;
}
/** Deployment values for one App Server process. */
export interface CodexAppServerRunnerOptions {
    readonly timeoutMs: number;
    readonly disposeGraceMs: number;
    readonly maxJsonRpcLineBytes: number;
    readonly maxStderrBytes: number;
    readonly env: Readonly<Record<string, string>>;
    readonly spawn: (spec: SubprocessSpawnSpec) => SubprocessHandle;
    readonly skillsMode?: 'dsh' | 'native';
    readonly skillsMaxContextTokens?: number;
}
/** Testable streaming process contract used by the adapter. */
export interface CodexAppServerRunnerPort {
    open(request: CodexAppServerThreadRequest): Promise<CodexAppServerThreadPort>;
    stream(request: CodexAppServerRequest): AsyncIterable<CodexAppServerEvent>;
}
/** Resolve the pinned official CLI's JavaScript entry without a shell lookup. */
export declare function codexCliEntry(): string;
/** Keep native features and permissions; select HTTP for the OpenAI transport. */
export declare function codexAppServerArgv(webSearch?: CodexWebSearchMode, imageGenerationEnabled?: boolean, modelProvider?: string, skillsMode?: 'dsh' | 'native', skillsMaxContextTokens?: number): string[];
/** App Server process factory; open threads remain alive until their owner disposes them. */
export declare class CodexAppServerRunner implements CodexAppServerRunnerPort {
    private readonly options;
    constructor(options: CodexAppServerRunnerOptions);
    open(request: CodexAppServerThreadRequest): Promise<CodexAppServerThreadPort>;
    stream(request: CodexAppServerRequest): AsyncIterable<CodexAppServerEvent>;
}

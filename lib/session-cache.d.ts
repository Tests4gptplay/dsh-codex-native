/** Disposable App Server thread leases keyed by Harness session identity. */
import type { CodexAppServerEvent, CodexAppServerRunnerPort, CodexAppServerThreadRequest, CodexAppServerHydratedToolResult, CodexAppServerToolResult, JsonValue } from './runner.ts';
/** Values controlling bounded session-thread reuse. */
export interface CodexSessionCacheOptions {
    readonly runner: CodexAppServerRunnerPort;
    readonly maxSessions: number;
    readonly idleTimeoutMs: number;
    readonly onCleanupError: (error: unknown) => void;
}
/** One fully assembled Harness request offered to the session cache. */
export interface CodexSessionRequest {
    readonly sessionId: string;
    readonly epoch: JsonValue;
    readonly thread: Omit<CodexAppServerThreadRequest, 'signal'>;
    /** Wire-projected history used only to prove an exact warm continuation. */
    readonly history: readonly JsonValue[];
    /** Resolve provider-ready history only when a new thread must be reconstructed. */
    readonly loadInjectedHistory: () => Promise<readonly JsonValue[]>;
    /** Hydrate one exact appended durable user-message content array for turn/start. */
    readonly loadUserInput: (content: readonly JsonValue[]) => Promise<readonly JsonValue[]>;
    /** Hydrate one exact durable Harness tool result for the pending callback. */
    readonly loadToolResult: (result: CodexAppServerToolResult) => Promise<CodexAppServerHydratedToolResult>;
    readonly reasoningEffort?: string;
    readonly toolResults: readonly CodexAppServerToolResult[];
    readonly signal?: AbortSignal;
}
/** Active cache step; exactly one terminal method must settle it. */
export interface CodexSessionStep {
    readonly events: AsyncIterable<CodexAppServerEvent>;
    commit(history: readonly JsonValue[], pendingCallId?: string): void;
    discard(): Promise<void>;
}
/** Bounded in-memory cache of disposable App Server session threads. */
export declare class CodexSessionCache {
    private readonly options;
    private readonly leases;
    private clock;
    private disposed;
    private readonly opening;
    constructor(options: CodexSessionCacheOptions);
    /** Open or exactly continue the thread lease for one Harness request. */
    begin(request: CodexSessionRequest): Promise<CodexSessionStep>;
    private beginOwned;
    /** Dispose the lease owned by one ended Harness session, when present. */
    disposeSession(sessionId: string): Promise<void>;
    /** Dispose every lease and reject future requests. */
    dispose(): Promise<void>;
    private retire;
    private expire;
    private settled;
    private trimToSize;
}

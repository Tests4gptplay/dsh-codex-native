/** Serialized turn state for one open Codex App Server thread. */
import { LlmError } from '@deepseek-ai/dsh-llm';
import type { CodexAppServerThreadPort, CodexAppServerTurnRequest } from './runner.ts';
import { JsonRpcConnection } from './wire.ts';
import type { CodexAppServerEvent } from './wire.ts';
/** Construction values owned by the process factory. */
export interface ManagedCodexThreadOptions {
    readonly timeoutMs: number;
    readonly connection: JsonRpcConnection;
    readonly threadId: string;
    readonly startedEvent: Extract<CodexAppServerEvent, {
        kind: 'thread-started';
    }>;
    readonly abort: (reason: unknown) => void;
    readonly dispose: () => Promise<void>;
}
/** Normalize one operation failure without losing timeout or caller cancellation. */
export declare function operationFailure(error: unknown, timedOut: boolean, caller: AbortSignal | undefined): LlmError;
/** Validate the configurable fields sent at a turn boundary. */
export declare function validateTurnRequest(request: CodexAppServerTurnRequest): void;
/** Process-owned App Server thread with one serialized turn consumer. */
export declare class ManagedCodexThread implements CodexAppServerThreadPort {
    private readonly options;
    private state;
    private active;
    private announced;
    constructor(options: ManagedCodexThreadOptions);
    get threadId(): string;
    stream(request: CodexAppServerTurnRequest): AsyncIterable<CodexAppServerEvent>;
    private beginOrResume;
    private steer;
    private assertToolRequest;
    dispose(): Promise<void>;
}

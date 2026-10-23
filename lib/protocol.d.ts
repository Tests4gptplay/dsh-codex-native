/** App Server history, event, and Harness stream translation. */
import { ToolCallId } from '@deepseek-ai/dsh-llm';
import type { GenerateOptions, StreamChunk, TokenUsage, ToolSchema } from '@deepseek-ai/dsh-llm';
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import type { CodexAppServerToolResult } from './runner.ts';
import type { CodexAppServerEvent, JsonValue } from './wire.ts';
declare const REPLAY_KIND = "codex-app-server";
declare const REPLAY_VERSION = 4;
export declare const CODEX_MODEL_CAPACITY_CODE = "MODEL_CAPACITY";
export declare const CODEX_MODEL_CAPACITY_RETRY_AFTER_MS: number;
/** Logged Codex-owned lifecycle, context, action, or diagnostic snapshot. */
export interface CodexActionBlock {
    readonly type: 'codex-action';
    readonly actionId: string;
    readonly actionType: string;
    readonly category: 'lifecycle' | 'context' | 'action' | 'diagnostic';
    readonly phase: 'requested' | 'started' | 'updated' | 'completed' | 'failed' | 'declined';
    readonly protocolEvent: string;
    readonly snapshot: JsonValue;
}
declare module '@deepseek-ai/dsh-llm' {
    interface ContentBlockMap {
        'codex-action': CodexActionBlock;
    }
}
/** Adapter state needed to reproduce one App Server response in a later request. */
export interface CodexReplayState {
    readonly kind: typeof REPLAY_KIND;
    readonly version: typeof REPLAY_VERSION;
    readonly items: readonly JsonValue[];
    readonly contextItems: readonly JsonValue[];
}
/** Validated Harness dynamic-tool call decoded from an App Server callback. */
export interface HarnessToolCall {
    readonly id: ToolCallId;
    readonly name: string;
    readonly arguments: string;
}
/** Reconstruct the App Server-visible conversation exclusively from the Harness request. */
export declare function appServerHistory(options: GenerateOptions): JsonValue[];
/** Append newly logged provider outputs using the same identities as request reconstruction. */
export declare function extendAppServerHistory(history: readonly JsonValue[], outputs: readonly JsonValue[]): JsonValue[];
/** Extract logged Harness tool outcomes for exact App Server callback continuation. */
export declare function appServerToolResults(options: GenerateOptions, modelHistory?: readonly JsonValue[]): CodexAppServerToolResult[];
/** Translate available Harness tools to App Server dynamic tools. */
export declare function appServerDynamicTools(tools: readonly ToolSchema[] | undefined, messages?: GenerateOptions['messages']): JsonValue[];
/** Decode one App Server dynamic callback without executing it in the provider. */
export declare function harnessToolCall(event: Extract<CodexAppServerEvent, {
    kind: 'server-request';
}>, tools: readonly ToolSchema[] | undefined, messages?: GenerateOptions['messages']): HarnessToolCall;
/** Stateful conversion of one App Server turn to indexed Harness blocks and replay data. */
export declare class AppServerEventMapper {
    private readonly open;
    private readonly initialHistory;
    private readonly harnessToolNames;
    private readonly rawItems;
    private readonly contextItems;
    private readonly contextFingerprints;
    private exactBaseline;
    private looseBaseline;
    private readonly accumulatedUsage;
    private fallbackUsage;
    private rawUsageSeen;
    private nativeCompactionSeen;
    private nextIndex;
    private nextRawAction;
    constructor(history?: readonly JsonValue[], harnessToolNames?: readonly string[]);
    private resetBaseline;
    private consumeBaseline;
    private retainRawItem;
    private rawActionId;
    private rawItemAction;
    private atomicBlock;
    private action;
    private delta;
    private close;
    private addUsage;
    /** Translate one decoded event to zero or more immediately publishable chunks. */
    accept(event: CodexAppServerEvent): StreamChunk[];
    /** Close any delta block left open at a terminal protocol event. */
    closeOpen(): StreamChunk[];
    /** Emit one durable Harness image attachment produced by a Codex-native action. */
    image(attachment: ImageAttachmentRef): StreamChunk[];
    /** Emit one Harness-owned tool request and retain an injectable raw call item. */
    toolCall(call: HarnessToolCall): StreamChunk[];
    /** Return disjoint token accounting for the whole App Server turn when available. */
    usage(): TokenUsage | undefined;
    /** Whether the live thread still has only reconstructible Harness-owned history. */
    canReuseThread(): boolean;
    /** Snapshot raw provider items so the next Harness request can inject them. */
    replayState(): CodexReplayState;
}
/** Classify a Codex diagnostic into Harness's stable LLM failure taxonomy. */
export declare function codexFailureCode(message: string): string;
/** Read the terminal turn status and raise only for an actual model/transport failure. */
export declare function assertCompletedTurn(event: CodexAppServerEvent): void;
export {};

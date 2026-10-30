/** Newline-delimited JSON-RPC transport with an optional explicit byte budget. */
import type { Readable, Writable } from 'node:stream';
/** Lossless JSON value accepted by the App Server protocol. */
export type JsonValue = null | boolean | number | string | JsonValue[] | {
    [key: string]: JsonValue;
};
/** Decoded JSON object at the App Server boundary. */
export interface JsonObject {
    readonly [key: string]: unknown;
}
/** Request identifier accepted by JSON-RPC. */
export type JsonRpcId = number | string;
/** One decoded App Server event retained at the provider boundary. */
export type CodexAppServerEvent = {
    readonly kind: 'thread-started';
    readonly threadId: string;
    readonly userAgent: string;
    readonly instructionSources: readonly JsonValue[];
} | {
    readonly kind: 'notification';
    readonly method: string;
    readonly params: JsonObject;
} | {
    readonly kind: 'server-request';
    readonly id: JsonRpcId;
    readonly method: string;
    readonly params: JsonObject;
    readonly resolution: 'answered' | 'declined' | 'rejected';
    readonly resolutionMessage?: string;
};
/** Require a decoded value to be a JSON object. */
export declare function object(value: unknown, label: string): JsonObject;
/** Copy and validate one decoded lossless JSON value. */
export declare function jsonValue(value: unknown, label: string): JsonValue;
/** One connected App Server JSON-RPC peer. */
export declare class JsonRpcConnection {
    private readonly input;
    private readonly output;
    private readonly maxJsonRpcLineBytes;
    private readonly pending;
    private readonly serverRequests;
    private readonly events;
    private nextId;
    private fragments;
    private bufferedBytes;
    private stopped;
    private failure;
    private readonly stopSignal;
    /**
     * @param input - writable App Server stdin.
     * @param output - readable App Server stdout.
     * @param maxJsonRpcLineBytes - opt-in maximum UTF-8 bytes per frame; 0 disables it.
     */
    constructor(input: Writable, output: Readable, maxJsonRpcLineBytes: number);
    /** Cancels pending native interactions when the protocol connection closes. */
    get signal(): AbortSignal;
    /** Observed pipe state only; no heartbeat, polling, or model request. */
    get closed(): boolean;
    private limitExceeded;
    private readonly onData;
    private readonly onEnd;
    private readonly onError;
    private receive;
    private send;
    /** Send one client request and resolve its correlated response. */
    request(method: string, params: JsonObject): Promise<unknown>;
    /** Send one client notification. */
    notify(method: string, params: JsonObject): Promise<void>;
    /** Resolve one App Server request. */
    respond(id: JsonRpcId, result: JsonValue): Promise<void>;
    /** Reject one App Server request. */
    respondError(id: JsonRpcId, code: number, message: string): Promise<void>;
    /** Cancellation for an actually received native RPC, including queued withdrawals. */
    serverRequestSignal(id: JsonRpcId): AbortSignal;
    /** Release a consumed request, whether answered or already withdrawn. */
    forgetServerRequest(id: JsonRpcId): void;
    /** Read the next notification or server request. */
    next(): Promise<IteratorResult<CodexAppServerEvent>>;
    /** Fail every waiter and detach the stream listeners. */
    fail(error: Error): void;
    /** Close every waiter without manufacturing a transport failure. */
    dispose(): void;
    private detach;
}

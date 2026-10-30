/** DSH-owned browser RPC; plugin never handles tokens. */
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client';
export interface NativeCodexRpc {
    call<T = unknown>(endpoint: string, payload?: Record<string, unknown>, signal?: AbortSignal): Promise<T>;
}
export declare function makeNativeCodexRpc(connection: ConnectionHandle): NativeCodexRpc;

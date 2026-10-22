/** DSH-owned browser RPC; plugin never handles tokens. */
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'

export interface NativeCodexRpc {
  call<T = unknown>(endpoint: string, payload?: Record<string, unknown>): Promise<T>
}
export function makeNativeCodexRpc(connection: ConnectionHandle): NativeCodexRpc {
  return {
    async call<T>(endpoint: string, payload: Record<string, unknown> = {}): Promise<T> {
      const response = await connection.rpc.call('/api', 'codex-native/' + endpoint, payload) as {
        ok?: boolean
        value?: T
        error?: { message?: string }
      }
      if (!response?.ok) throw new Error(response?.error?.message || 'Codex account request failed')
      return response.value as T
    },
  }
}

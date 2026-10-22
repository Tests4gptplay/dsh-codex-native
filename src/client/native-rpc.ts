/** DSH-owned browser RPC; plugin never handles tokens. */
export interface NativeCodexRpc {
  call<T = unknown>(endpoint: string, payload?: Record<string, unknown>): Promise<T>
}
export function makeNativeCodexRpc(connection: {
  rpc: { call: (base: string, method: string, data: unknown) => Promise<unknown> }
}): NativeCodexRpc {
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

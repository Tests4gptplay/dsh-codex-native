/** Use the existing authenticated DSH connection; never create a public HTTP listener. */
import { clientRequestSchema } from '@deepseek-ai/dsh-client-connection'
import type { HostConnectionHandle } from '@deepseek-ai/dsh-client-connection'
import type { NativeCodexAccount } from './native-account.ts'
export const CODEX_NATIVE_RPC = '/codex-native'
export const CODEX_NATIVE_ENDPOINTS = ['status', 'quota', 'usage', 'login/start', 'login/status', 'login/cancel', 'logout'] as const
export type CodexNativeEndpoint = typeof CODEX_NATIVE_ENDPOINTS[number]
export function registerNativeCodexTransport(connection: HostConnectionHandle, account: NativeCodexAccount): () => void {
  const disposers: Array<() => Promise<void>> = []
  try {
    for (const endpoint of CODEX_NATIVE_ENDPOINTS) {
      const method = `codex-native/${endpoint}`
      disposers.push(connection.fetch.register({
        path: `/api/${method}`, methods: ['POST'], requestBody: 'buffered',
        async fetch(request: Request): Promise<Response> {
          if (request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') return new Response('Expected JSON', { status: 415 })
          let body: unknown
          try { body = await request.json() } catch { return new Response('Invalid JSON', { status: 400 }) }
          const received = clientRequestSchema.safeParse(body)
          if (!received.success || received.data.method !== method) return new Response('Invalid authenticated DSH RPC', { status: 400 })
          const payload = received.data.payload as Record<string, unknown> | undefined
          try {
            request.signal.throwIfAborted()
            let value: unknown
            switch (endpoint) {
              case 'status': value = await account.status(); break
              case 'quota': value = await account.quota(); break
              case 'usage': value = await account.usage(); break
              case 'login/start': {
                const mode = payload?.mode
                if (mode !== 'browser' && mode !== 'device') throw new Error('Unknown Codex login mode')
                value = await account.start(mode); break
              }
              case 'login/status': {
                if (typeof payload?.id !== 'string') throw new Error('Login id required')
                value = account.loginStatus(payload.id); break
              }
              case 'login/cancel': {
                if (typeof payload?.id !== 'string') throw new Error('Login id required')
                value = await account.cancel(payload.id); break
              }
              case 'logout': value = await account.logout(); break
            }
            return Response.json({ type: 'server-response', rpcId: received.data.rpcId, result: { ok: true, value } })
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message.slice(0, 160) : 'Codex account operation failed'
            return Response.json({ type: 'server-response', rpcId: received.data.rpcId, result: { ok: false, error: { code: 'native_codex', message, details: { issues: [] } } } })
          }
        },
      }))
    }
  } catch (error: unknown) {
    for (const dispose of disposers.reverse()) void dispose()
    throw error
  }
  return async () => { await Promise.all(disposers.reverse().map(dispose => dispose())) }
}

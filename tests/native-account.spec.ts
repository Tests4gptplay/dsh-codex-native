import { PassThrough } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'
import type { SubprocessHandle } from '@deepseek-ai/dsh-subprocess'
import { NativeCodexAccount } from '../src/native-account.ts'

type JsonObject = Record<string, unknown>
function mockOfficialCodex() {
  const invocations: string[] = []
  const input = new PassThrough()
  const output = new PassThrough()
  const terminated = vi.fn()
  let buffer = ''
  input.setEncoding('utf8')
  input.on('data', (chunk: string) => {
    buffer += chunk
    let nl
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl)
      buffer = buffer.slice(nl + 1)
      if (!line) continue
      const request = JSON.parse(line) as JsonObject
      if (typeof request.method !== 'string') continue
      invocations.push(request.method)
      if (request.id === undefined) continue
      let result: JsonObject = {}
      switch (request.method) {
        case 'account/read':
          result = { account: { type: 'chatgpt', email: 'test@example.test', planType: 'pro' } }
          break
        case 'account/rateLimits/read':
          result = { rateLimits: { primary: { usedPercent: 40 } } }
          break
        case 'account/login/start':
          result = (request.params as JsonObject).type === 'chatgptDeviceCode'
            ? { loginId: 'native-device', verificationUrl: 'https://auth.openai.com/codex/device', userCode: 'ABCD-1234' }
            : { loginId: 'native-browser', authUrl: 'https://chatgpt.com/official-auth' }
          break
      }
      output.write(JSON.stringify({ id: request.id, result }) + '\n')
      if (request.method === 'account/login/start') {
        queueMicrotask(() => output.write(JSON.stringify({
          method: 'account/login/completed',
          params: { loginId: (result as JsonObject).loginId, success: true, error: null },
        }) + '\n'))
      }
    }
  })
  const handle = {
    stdin: input, stdout: output, stderr: new PassThrough(),
    terminate: terminated, waitForExit: async () => ({}),
    done: Promise.resolve({ exitCode: 0 }),
    control: {},
  } as unknown as SubprocessHandle
  return { handle, invocations, terminated }
}
describe('official Codex app-server account lifecycle', () => {
  it('reads native account and quota without custom OAuth credentials', async () => {
    const clients: ReturnType<typeof mockOfficialCodex>[] = []
    const manager = new NativeCodexAccount(() => {
      const client = mockOfficialCodex(); clients.push(client); return client.handle
    })
    expect(await manager.status()).toEqual({ authenticated: true, email: 'test@example.test', planType: 'pro' })
    expect(await manager.quota()).toEqual({ primary: { usedPercent: 40 } })
    expect(clients.flatMap(client => client.invocations)).toContain('account/read')
    expect(clients.flatMap(client => client.invocations)).toContain('account/rateLimits/read')
    expect(clients.every(client => client.terminated.mock.calls.length === 1)).toBe(true)
    await manager.dispose()
  })
  it.each(['browser', 'device'] as const)('delegates %s OAuth to official app-server', async mode => {
    const client = mockOfficialCodex()
    const manager = new NativeCodexAccount(() => client.handle)
    const started = await manager.start(mode)
    expect(started.mode).toBe(mode)
    expect(started.phase).toBe('pending')
    expect(mode === 'browser' ? started.authUrl : started.userCode).toBeTruthy()
    await vi.waitFor(() => expect(manager.loginStatus(started.id).phase).toBe('authenticated'))
    expect(client.invocations).toContain('account/login/start')
    expect(client.terminated).toHaveBeenCalled()
    await manager.dispose()
  })
})

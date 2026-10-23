import { PassThrough, Writable } from 'node:stream'
import { setImmediate as nextTick } from 'node:timers/promises'
import { describe, expect, it, vi } from 'vitest'
import { LlmError } from '@deepseek-ai/dsh-llm'
import type { SubprocessHandle, SubprocessOutcome } from '@deepseek-ai/dsh-subprocess'
import { JsonRpcConnection } from '../src/wire.ts'
import { connectCodexProcess, diagnosticText } from '../src/process-connection.ts'
import { NativeCodexAccount } from '../src/native-account.ts'

function pipes(blocked = false) {
  const input = blocked
    ? new Writable({ highWaterMark: 1, write(_chunk, _encoding, _callback) { /* a blocked OS pipe */ } })
    : new PassThrough()
  if (input instanceof PassThrough) input.resume()
  const output = new PassThrough()
  const rpc = new JsonRpcConnection(input, output, 65536)
  return { input, output, rpc, close() { rpc.dispose(); input.destroy(); output.destroy() } }
}

function processHandle() {
  const input = new PassThrough(); input.resume()
  const output = new PassThrough()
  const done = Promise.withResolvers<SubprocessOutcome>()
  let stderr = ''
  const handle: SubprocessHandle = {
    stdin: input, stdout: output, stderr: undefined,
    collected: { stderr: { readFrom: () => ({ text: stderr, nextOffset: stderr.length, lossy: false }) } },
    done: done.promise,
    terminate: vi.fn(() => { output.destroy(); done.resolve({ exitCode: 0, signal: null }) }),
    waitForExit: vi.fn(async () => true),
  }
  return { input, output, done, handle, stderr(value: string) { stderr = value } }
}

/** A test deadline detects a hang; no such timer is added to model execution. */
describe('protocol stream lifecycle regressions', () => {
  it('rejects a backpressured request on EOF without waiting for drain or leaking a rejection', async () => {
    const p = pipes(true)
    try {
      const result = p.rpc.request('initialize', {}).catch(error => error)
      p.output.end()
      const error = await result
      expect(error).toMatchObject({ code: 'TRANSPORT' })
      await nextTick()
      expect(p.input.listenerCount('drain')).toBe(0)
      expect(p.rpc.closed).toBe(true)
    } finally { p.close() }
  })

  it('rejects on stdout close even when end was never emitted', async () => {
    const p = pipes()
    try {
      const result = p.rpc.request('initialize', {}).catch(error => error)
      p.output.destroy()
      expect(await result).toMatchObject({ code: 'TRANSPORT' })
    } finally { p.close() }
  })

  it('rejects on stdin close even when stdout remains open', async () => {
    const p = pipes()
    try {
      const result = p.rpc.request('initialize', {}).catch(error => error)
      p.input.destroy()
      expect(await result).toMatchObject({ code: 'TRANSPORT' })
    } finally { p.close() }
  })

  it('releases a backpressured notification on explicit disposal', async () => {
    const p = pipes(true)
    const result = p.rpc.notify('initialized', {}).catch(error => error)
    p.rpc.dispose()
    expect(await result).toMatchObject({ code: 'ABORTED' })
    expect(p.input.listenerCount('drain')).toBe(0)
    p.close()
  })

  it('keeps successful JSON-RPC requests and buffered terminal events intact', async () => {
    const p = pipes()
    try {
      const response = p.rpc.request('initialize', {})
      p.output.end(JSON.stringify({ id: 1, result: { ok: true } }) + '\n' + JSON.stringify({ method: 'turn/completed', params: { turn: { id: 't' } } }) + '\n')
      expect(await response).toEqual({ ok: true })
      expect(await p.rpc.next()).toMatchObject({ done: false, value: { method: 'turn/completed' } })
    } finally { p.close() }
  })

  it('does not crash the host on a late teardown EPIPE', async () => {
    const p = pipes(); p.rpc.dispose()
    expect(() => p.input.emit('error', Object.assign(new Error('closed pipe'), { code: 'EPIPE' }))).not.toThrow()
    p.close()
  })

  it('preserves malformed-message failures instead of calling them a process crash', async () => {
    const p = pipes()
    try {
      const result = p.rpc.request('initialize', {}).catch(error => error)
      p.output.end('{not-json}\n')
      expect(await result).toMatchObject({ code: 'MALFORMED_RESPONSE' })
    } finally { p.close() }
  })
})

describe('model and account process evidence', () => {
  it('keeps exit status and stderr that arrive after stdout EOF', async () => {
    const p = processHandle(); const connection = connectCodexProcess(p.handle, 65536)
    const result = connection.rpc.request('initialize', {}).catch(error => error)
    p.output.end()
    const original = await result
    p.stderr('fatal configuration fixture')
    p.done.resolve({ exitCode: 42, signal: null })
    await nextTick()
    const error = connection.failure(original)
    expect(error.message).toContain('exit=42')
    expect(error.message).toContain('fatal configuration fixture')
    expect(error.message).not.toContain('observed during cleanup')
    connection.rpc.dispose(); p.input.destroy(); p.output.destroy()
  })

  it('labels exit observations during cleanup rather than asserting they caused EOF', async () => {
    const p = processHandle(); const connection = connectCodexProcess(p.handle, 65536)
    const result = connection.rpc.request('initialize', {}).catch(error => error)
    p.output.end(); const original = await result
    connection.markCleanup(); p.handle.terminate(); await nextTick()
    expect(connection.failure(original).message).toContain('observed during cleanup')
    connection.rpc.dispose(); p.input.destroy()
  })

  it('rejects an account startup failure without requiring any pipe event', async () => {
    const p = processHandle(); const account = new NativeCodexAccount(() => p.handle)
    const result = account.status().catch(error => error)
    p.done.reject(new Error('spawn fixture ENOENT'))
    const error = await result
    expect(error.message).toContain('failed to start')
    expect(error.message).toContain('ENOENT')
    expect(p.handle.terminate).toHaveBeenCalledOnce()
    await account.dispose(); p.input.destroy(); p.output.destroy()
  })

  it('does not reclassify cancellation or protocol errors as transport retry candidates', () => {
    const p = processHandle(); const connection = connectCodexProcess(p.handle, 65536)
    for (const code of ['ABORTED', 'CODEX_PROTOCOL', 'TIMEOUT'] as const) {
      const error = new LlmError('original', code)
      expect(connection.failure(error)).toBe(error)
    }
    connection.rpc.dispose(); p.handle.terminate(); p.input.destroy()
  })

  it('bounds and masks common secret shapes in surfaced stderr', () => {
    const source = 'Bearer sample-secret access_token=sample-access refresh_token="sample-refresh" user@example.invalid https://auth.example.invalid/?code=private-code sk-test123456'
    const text = diagnosticText(source)
    for (const secret of ['sample-secret', 'sample-access', 'sample-refresh', 'user@example.invalid', 'private-code', 'sk-test123456']) expect(text).not.toContain(secret)
    expect(diagnosticText('x'.repeat(5000)).length).toBeLessThanOrEqual(2000)
  })
})

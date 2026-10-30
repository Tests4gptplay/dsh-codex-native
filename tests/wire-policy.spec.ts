import { PassThrough } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'
import { JsonRpcConnection } from '../src/wire.ts'

function setup(limit = 0) {
  const input = new PassThrough(); input.resume()
  const output = new PassThrough()
  const rpc = new JsonRpcConnection(input, output, limit)
  return { input, output, rpc, close() { rpc.dispose(); input.destroy(); output.destroy() } }
}

describe('transparent fragmented JSON framing with opt-in budgets', () => {
  it('accepts a >8 MiB frame without repeatedly rescanning partial input', async () => {
    const s = setup(), value = 'x'.repeat(9 * 1024 * 1024)
    const frame = JSON.stringify({ method: 'qa/large', params: { value } }) + '\n'
    const byteLength = vi.spyOn(Buffer, 'byteLength')
    try {
      for (let i = 0; i < frame.length; i += 4093) s.output.write(frame.slice(i, i + 4093))
      const traversed = byteLength.mock.calls.reduce((total, [value]) => total + (typeof value === 'string' ? value.length : 0), 0)
      expect(traversed).toBeLessThanOrEqual(frame.length * 2)
      const received = await s.rpc.next()
      expect(received).toMatchObject({ done: false, value: { method: 'qa/large' } })
      if (received.value?.kind !== 'notification') throw new Error('notification expected')
      expect(received.value.params.value).toBe(value)
    } finally { byteLength.mockRestore(); s.close() }
  })

  it('decodes split UTF-8 bytes, multiple frames, and split CRLF without changing values', async () => {
    const s = setup()
    try {
      const bytes = Buffer.from(JSON.stringify({ method: 'qa/one', params: { text: '界🙂é' } }) + '\r\n\n' + JSON.stringify({ method: 'qa/two', params: {} }) + '\n')
      for (let i = 0; i < bytes.length; i++) s.output.write(bytes.subarray(i, i + 1))
      expect(await s.rpc.next()).toMatchObject({ value: { method: 'qa/one', params: { text: '界🙂é' } } })
      expect(await s.rpc.next()).toMatchObject({ value: { method: 'qa/two' } })
    } finally { s.close() }
  })

  it('preserves explicit byte limits including exact UTF-8 boundaries and CRLF', async () => {
    const frame = JSON.stringify({ method: 'qa/frame', params: { text: '界🙂' } })
    const exact = setup(Buffer.byteLength(frame))
    try {
      exact.output.write(frame + '\r'); exact.output.write('\n')
      expect(await exact.rpc.next()).toMatchObject({ value: { method: 'qa/frame' } })
    } finally { exact.close() }
    const small = setup(Buffer.byteLength(frame) - 1)
    try { small.output.write(frame + '\n'); await expect(small.rpc.next()).rejects.toMatchObject({ code: 'OUTPUT_LIMIT' }) }
    finally { small.close() }
  })

  it.each(['{invalid}\n', '{"method":"unfinished"}'])('still reports malformed/incomplete input %s', async text => {
    const s = setup()
    try { s.output.end(text); await expect(s.rpc.next()).rejects.toMatchObject({ code: 'MALFORMED_RESPONSE' }) }
    finally { s.close() }
  })

  it('cancels and detaches while an unlimited frame is incomplete', async () => {
    const s = setup()
    s.output.write('x'.repeat(9 * 1024 * 1024)); s.rpc.dispose()
    expect(s.rpc.signal.aborted).toBe(true)
    expect(s.output.listenerCount('data')).toBe(0)
    expect(await s.rpc.next()).toMatchObject({ done: true })
    s.close()
  })
})

describe('native request withdrawal cancels a waiting answerer immediately', () => {
  it('does not misclassify local response-write failure as native withdrawal', async () => {
    const s = setup()
    try {
      s.output.write(JSON.stringify({ id: 'write-failure', method: 'item/commandExecution/requestApproval', params: { threadId: 'th', turnId: 't', itemId: 'i' } }) + '\n')
      const signal = s.rpc.serverRequestSignal('write-failure')
      vi.spyOn(s.input, 'write').mockImplementation(() => { throw new Error('synthetic response write failed') })
      await expect(s.rpc.respond('write-failure', { decision: 'accept' })).rejects.toThrow('synthetic response write failed')
      expect(signal.aborted).toBe(false)
      expect(s.rpc.signal.aborted).toBe(false)
    } finally { s.close() }
  })
  it('matches request id type and thread, without draining the event queue first', async () => {
    const s = setup()
    try {
      s.output.write(JSON.stringify({ id: 7, method: 'item/commandExecution/requestApproval', params: { threadId: 'th', turnId: 't', itemId: 'i' } }) + '\n')
      const signal = s.rpc.serverRequestSignal(7)
      s.output.write(JSON.stringify({ method: 'serverRequest/resolved', params: { threadId: 'th', requestId: '7' } }) + '\n')
      expect(signal.aborted).toBe(false)
      s.output.write(JSON.stringify({ method: 'serverRequest/resolved', params: { threadId: 'other', requestId: 7 } }) + '\n')
      expect(signal.aborted).toBe(false)
      s.output.write(JSON.stringify({ method: 'serverRequest/resolved', params: { threadId: 'th', requestId: 7 } }) + '\n')
      expect(signal.aborted).toBe(true)
      await expect(s.rpc.respond(7, { decision: 'accept' })).rejects.toMatchObject({ code: 'ABORTED' })
    } finally { s.close() }
  })

  it('turn completion cancels only matching pending requests and disconnect cancels the remainder', () => {
    const s = setup()
    for (const [id, turnId] of [['a', 't1'], ['b', 't2']]) s.output.write(JSON.stringify({ id, method: 'item/fileChange/requestApproval', params: { threadId: 'th', turnId, itemId: id } }) + '\n')
    const a = s.rpc.serverRequestSignal('a'), b = s.rpc.serverRequestSignal('b')
    s.output.write(JSON.stringify({ method: 'turn/completed', params: { threadId: 'th', turn: { id: 't1' } } }) + '\n')
    expect(a.aborted).toBe(true); expect(b.aborted).toBe(false)
    s.rpc.dispose(); expect(b.aborted).toBe(true); s.close()
  })
})

// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UsagePanel } from '../src/client/UsagePanel.tsx'
import { zh } from '../src/client/native-locales.ts'
import type { NativeCodexRpc } from '../src/client/native-rpc.ts'
import type { UsageSnapshot } from '../src/usage.ts'
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const t = (key: keyof typeof zh) => zh[key]
const example: UsageSnapshot = {
  queriedAt: '2026-10-23T12:00:00Z', lifetimeTokens: '100', incomplete: false,
  days: [{ date: '2026-10-20', tokens: '10' }, { date: '2026-10-22', tokens: '20' }],
  resets: [{ date: '2026-10-20', announcedAt: '2026-10-20T12:00:00Z' }, { date: '2026-10-22', announcedAt: '2026-10-22T12:00:00Z' }],
  windows: [], resetSource: 'codex-reset.com',
}
const cleanups: Array<() => void> = []
afterEach(() => { for (const close of cleanups.splice(0)) act(close) })
describe('official DSH controls with exclusively manual history requests', () => {
  it('mount and expand do not query; one top clear resets only the view; a new query restores history', async () => {
    const call = vi.fn(async () => example)
    const rpc = { call } as NativeCodexRpc
    const box = document.createElement('div'); document.body.append(box)
    const root = createRoot(box)
    cleanups.push(() => { root.unmount(); box.remove() })
    await act(async () => root.render(<UsagePanel rpc={rpc} t={t} enabled />))
    expect(call).not.toHaveBeenCalled()
    expect(box.querySelectorAll('[data-usage-clear]')).toHaveLength(1)
    const query = box.querySelector<HTMLButtonElement>('[data-usage-query]')!
    expect(query.className).toContain('outline')
    await act(async () => query.click())
    expect(call.mock.calls).toEqual([['usage']])
    expect(box.querySelector('[data-usage-total]')?.textContent).toBe('30')
    const disclosure = box.querySelector<HTMLElement>('[data-disclosure-row]')!
    await act(async () => disclosure.click())
    expect(call).toHaveBeenCalledTimes(1)
    await act(async () => box.querySelector<HTMLButtonElement>('[data-usage-clear]')!.click())
    expect(box.querySelector('[data-usage-total]')?.textContent).toBe('—')
    expect(call).toHaveBeenCalledTimes(1)
    await act(async () => query.click())
    expect(call).toHaveBeenCalledTimes(2)
    expect(box.querySelector('[data-usage-total]')?.textContent).toBe('30')
    const notes = box.querySelector('[data-usage-sources]')!
    expect(notes.textContent).toContain('account/usage/read')
    expect(notes.textContent).toContain('codex-reset.com')
    expect(notes.textContent).toContain('ChatGPT 账号总用量')
    expect(notes.textContent).toContain('历史周期参考公开重置公告')
    expect(notes.textContent).toContain('清除当前表格')
    expect(box.querySelectorAll('[data-usage-clear]')).toHaveLength(1)
    expect(box.querySelectorAll('tr')).toHaveLength(2)
  })
  it('a query failure leaves the prior returned counts visible', async () => {
    const call = vi.fn().mockResolvedValueOnce(example).mockRejectedValueOnce(Error('offline'))
    const box = document.createElement('div'); document.body.append(box)
    const root = createRoot(box); cleanups.push(() => { root.unmount(); box.remove() })
    await act(async () => root.render(<UsagePanel rpc={{ call } as NativeCodexRpc} t={t} enabled />))
    await act(async () => box.querySelector<HTMLButtonElement>('[data-usage-query]')!.click())
    await act(async () => box.querySelector<HTMLButtonElement>('[data-usage-query]')!.click())
    expect(box.querySelector('[data-usage-total]')?.textContent).toBe('30')
    expect(box.querySelector('[role=alert]')?.textContent).toContain('offline')
  })
})

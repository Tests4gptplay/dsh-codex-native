import { describe, expect, it, vi } from 'vitest'
import { groupUsage, normalizeResets, normalizeUsage, normalizeWindows, sumUsage } from '../src/usage.ts'
import { createTimelineReader, queryUsage } from '../src/usage-query.ts'
const NOW = Date.parse('2026-10-23T12:00:00Z')
const usage = { summary: { lifetimeTokens: 500 }, dailyUsageBuckets: [
  { startDate: '2026-10-20', tokens: 10 }, { startDate: '2026-10-21', tokens: 20 }, { startDate: '2026-10-22', tokens: 30 },
] }
const timeline = { events: [
  { id: 'reset1', group: 'reset', announcement_state: 'announced', announced_at: '2026-10-20T12:00:00Z' },
  { id: 'reset2', group: 'reset', announcement_state: 'announced', announced_at: '2026-10-22T12:00:00Z' },
  { id: 'future', group: 'reset', announcement_state: 'none', announced_at: '2026-10-23T10:00:00Z' },
  { id: 'banked', group: 'credits', announcement_state: 'announced', announced_at: '2026-10-21T12:00:00Z' },
] }
describe('official history, not plugin-side consumption estimates', () => {
  it('keeps official lifetime separate from available daily totals', () => {
    const value = normalizeUsage(usage)
    expect(value.lifetimeTokens).toBe('500')
    expect(sumUsage(value.days!)).toBe('60')
  })
  it('keeps unavailable data distinct from zero and skips malformed dates/counts', () => {
    expect(normalizeUsage({ summary: {}, dailyUsageBuckets: null }).days).toBeNull()
    const result = normalizeUsage({ dailyUsageBuckets: [
      { startDate: '2026-02-30', tokens: 3 }, { startDate: '2026-10-20', tokens: -1 }, { startDate: '2026-10-21', tokens: 0 },
    ] })
    expect(result.incomplete).toBe(true)
    expect(result.days).toEqual([{ date: '2026-10-21', tokens: '0' }])
  })
  it('does not count repeated daily snapshots twice and sums without floating point rounding', () => {
    const value = normalizeUsage({ dailyUsageBuckets: [
      { startDate: '2026-10-20', tokens: 10 }, { startDate: '2026-10-20', tokens: 12 },
      { startDate: '2026-10-21', tokens: '9007199254740993' },
    ] })
    expect(value.days?.length).toBe(2)
    expect(sumUsage(value.days!)).toBe('9007199254741005')
  })
  it('groups each daily bucket once and ignores banked or unconfirmed signals', () => {
    const resets = normalizeResets(timeline, NOW)
    expect(resets.map(r => r.date)).toEqual(['2026-10-20', '2026-10-22'])
    const groups = groupUsage(normalizeUsage(usage).days!, resets)
    expect(groups.map(g => [g.id, g.tokens])).toEqual([['2026-10-22', '30'], ['2026-10-20', '30']])
    expect(groups.flatMap(g => g.days).length).toBe(3)
  })
  it('does not invent historical cycles before the first known reset or split same-day usage', () => {
    const resets = normalizeResets({ events: [
      ...timeline.events,
      { group: 'reset', announcement_state: 'announced', announced_at: '2026-10-20T16:00:00Z' },
      { group: 'reset', announcement_state: 'announced', announced_at: '2027-01-01T00:00:00Z' },
    ] }, NOW)
    expect(resets.length).toBe(2)
    const grouped = groupUsage([{ date: '2026-01-01', tokens: '5' }, { date: '2026-10-20', tokens: '10' }], resets)
    expect(grouped.map(g => g.id)).toEqual(['2026-10-20', 'unassigned'])
  })
  it('reads official multiple windows without treating future resets as past records', () => {
    const windows = normalizeWindows({ rateLimitsByLimitId: { codex: { primary: null, secondary: { usedPercent: 25, resetsAt: 1793000000 } } } })
    expect(windows).toEqual([{ name: 'codex · secondary', usedPercent: 25, resetsAt: 1793000000 }])
  })
})
describe('manual read-only query', () => {
  it('uses official usage and current limits; no model or reset-consume operation', async () => {
    const official = vi.fn(async (method: string) => method === 'account/usage/read' ? usage : {})
    const result = await queryUsage(official, async () => timeline, () => NOW)
    expect(official.mock.calls.map(c => c[0])).toEqual(['account/usage/read', 'account/rateLimits/read'])
    expect(result.resetSource).toBe('codex-reset.com')
    expect(result.resets.length).toBe(2)
  })
  it('an optional reference or quota error cannot discard official usage', async () => {
    const result = await queryUsage(async method => {
      if (method === 'account/usage/read') return usage
      throw Error('limits unavailable')
    }, async () => { throw Error('public site offline') }, () => NOW)
    expect(result.days?.length).toBe(3)
    expect(result.resetSource).toBe('unavailable')
    expect(result.windows).toEqual([])
  })
  it('does not contact the public site when the official history query fails', async () => {
    const site = vi.fn()
    await expect(queryUsage(async () => { throw Error('not signed in') }, site)).rejects.toThrow('not signed in')
    expect(site).not.toHaveBeenCalled()
  })
  it('performs only a public GET with attribution, reusing the one-minute publication cache', async () => {
    let clock = NOW
    const get = vi.fn(async () => new Response(JSON.stringify(timeline), { status: 200, headers: { 'content-type': 'application/json' } }))
    const read = createTimelineReader(get as typeof fetch, () => clock)
    expect(get).not.toHaveBeenCalled()
    await read(); await read()
    expect(get).toHaveBeenCalledTimes(1)
    const args = get.mock.calls[0] as unknown as [string, RequestInit]
    expect(args[0]).toBe('https://codex-reset.com/api/timeline')
    expect(args[1].credentials).toBe('omit')
    expect(args[1].method).toBe('GET')
    expect(args[1].body).toBeUndefined()
    expect((args[1].headers as Record<string, string>)['User-Agent']).toContain('dsh-codex-native')
    expect(JSON.stringify(args)).not.toContain('Authorization')
    clock += 61000
    await read()
    expect(get).toHaveBeenCalledTimes(2)
  })
})

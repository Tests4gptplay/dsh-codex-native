/** Read-only account history and reference grouping. No model hooks, timers, or persistence. */
export interface UsageDay { date: string; tokens: string }
export interface ResetReference { date: string; announcedAt: string }
export interface UsageWindow { name: string; usedPercent: number | null; resetsAt: number | null }
export interface UsageSnapshot {
  queriedAt: string
  lifetimeTokens: string | null
  days: UsageDay[] | null
  incomplete: boolean
  resets: ResetReference[]
  resetSource: 'codex-reset.com' | 'unavailable'
  windows: UsageWindow[]
}
export interface UsagePeriod {
  id: string
  startDate: string | null
  endDate: string
  days: UsageDay[]
  tokens: string
}
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {}
}
function tokenString(value: unknown): string | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value)
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value).toString()
  return null
}
function validDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const n = Date.parse(value + 'T00:00:00Z')
  return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === value
}
export function normalizeUsage(value: unknown): Pick<UsageSnapshot, 'days' | 'lifetimeTokens' | 'incomplete'> {
  const root = record(value)
  const lifetimeTokens = tokenString(record(root.summary).lifetimeTokens)
  if (!Array.isArray(root.dailyUsageBuckets)) return { lifetimeTokens, days: null, incomplete: false }
  const byDate = new Map<string, UsageDay>()
  let incomplete = false
  for (const entry of root.dailyUsageBuckets) {
    const item = record(entry)
    const tokens = tokenString(item.tokens)
    if (!validDay(item.startDate) || tokens === null) { incomplete = true; continue }
    // Repeated snapshots for a date replace one another; they are not additional spend.
    byDate.set(item.startDate, { date: item.startDate, tokens })
  }
  return { lifetimeTokens, days: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)), incomplete }
}
/** Only documented, announced resets. Predictions and banked credits are not reset events. */
export function normalizeResets(value: unknown, now: number): ResetReference[] {
  const events = record(value).events
  if (!Array.isArray(events)) return []
  const byDate = new Map<string, ResetReference>()
  for (const value of events) {
    const event = record(value)
    if (event.group !== 'reset' || event.announcement_state !== 'announced') continue
    if (typeof event.announced_at !== 'string') continue
    const at = Date.parse(event.announced_at)
    if (!Number.isFinite(at) || at > now) continue
    const announcedAt = new Date(at).toISOString(), date = announcedAt.slice(0, 10)
    const previous = byDate.get(date)
    // Daily input cannot be split into multiple resets on the same day.
    if (!previous || previous.announcedAt < announcedAt) byDate.set(date, { date, announcedAt })
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}
export function normalizeWindows(value: unknown): UsageWindow[] {
  const root = record(value)
  const multi = record(root.rateLimitsByLimitId)
  const entries = Object.keys(multi).length ? Object.entries(multi) : [['codex', root.rateLimits]]
  const windows: UsageWindow[] = []
  for (const [id, raw] of entries) {
    const bucket = record(raw)
    for (const slot of ['primary', 'secondary'] as const) {
      const window = record(bucket[slot])
      if (!Object.keys(window).length) continue
      windows.push({
        name: `${typeof bucket.limitName === 'string' ? bucket.limitName : id} · ${slot}`,
        usedPercent: typeof window.usedPercent === 'number' && Number.isFinite(window.usedPercent) ? window.usedPercent : null,
        resetsAt: typeof window.resetsAt === 'number' && Number.isSafeInteger(window.resetsAt) ? window.resetsAt : null,
      })
    }
  }
  return windows
}
export function sumUsage(days: readonly UsageDay[]): string {
  return days.reduce((sum, day) => sum + BigInt(day.tokens), 0n).toString()
}
/** Assign whole official date buckets, not fabricated hourly fractions, to reference periods. */
export function groupUsage(days: readonly UsageDay[], resets: readonly ResetReference[]): UsagePeriod[] {
  const boundaries = [...resets].sort((a, b) => a.date.localeCompare(b.date))
  const groups = new Map<string, UsagePeriod>()
  for (const day of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    const start = boundaries.filter(boundary => boundary.date <= day.date).at(-1)?.date ?? null
    const id = start ?? 'unassigned'
    let period = groups.get(id)
    if (!period) {
      period = { id, startDate: start, endDate: day.date, days: [], tokens: '0' }
      groups.set(id, period)
    }
    period.days.push(day)
    period.endDate = day.date
    period.tokens = (BigInt(period.tokens) + BigInt(day.tokens)).toString()
  }
  return [...groups.values()].reverse().map(period => ({ ...period, days: [...period.days].reverse() }))
}

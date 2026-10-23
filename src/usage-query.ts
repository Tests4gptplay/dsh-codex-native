import { normalizeResets, normalizeUsage, normalizeWindows } from './usage.ts'
import type { UsageSnapshot } from './usage.ts'

const TIMELINE_URL = 'https://codex-reset.com/api/timeline'
const READER_ID = 'dsh-codex-native/0.2.1-alpha.5 (+https://github.com/Tests4gptplay/dsh-codex-native)'
/** A shared public-response cache, evaluated only on a manual query, never by a timer. */
export function createTimelineReader(fetcher: typeof fetch = globalThis.fetch, now: () => number = Date.now): () => Promise<unknown> {
  let cached: { expires: number; value: Promise<unknown> } | undefined
  return () => {
    if (cached && now() < cached.expires) return cached.value
    const entry = { expires: now() + 60_000, value: Promise.resolve<unknown>(null) }
    entry.value = (async () => {
      // Independent public GET: no account ID, token, email, prompt, or usage is sent.
      const response = await fetcher(TIMELINE_URL, {
        method: 'GET', credentials: 'omit', redirect: 'error',
        headers: { Accept: 'application/json', 'User-Agent': READER_ID },
        signal: AbortSignal.timeout(8_000),
      })
      if (!response.ok) {
        const retry = response.headers.get('retry-after')
        const retryAt = retry === null ? NaN : /^\d+$/.test(retry) ? now() + Number(retry) * 1000 : Date.parse(retry)
        if (Number.isFinite(retryAt)) entry.expires = Math.max(entry.expires, retryAt)
        throw new Error(`Reset reference unavailable (${response.status})`)
      }
      const data: unknown = await response.json()
      if (!data || typeof data !== 'object' || !Array.isArray((data as { events?: unknown }).events)) {
        throw new Error('Reset reference format unavailable')
      }
      return data
    })()
    cached = entry
    return entry.value
  }
}
const readTimeline = createTimelineReader()
/** This function is reached only by the Settings Query button, never by the agent loop. */
export async function queryUsage(
  readOfficial: (method: string) => Promise<unknown>,
  timeline: () => Promise<unknown> = readTimeline,
  now: () => number = Date.now,
): Promise<UsageSnapshot> {
  const usage = normalizeUsage(await readOfficial('account/usage/read'))
  // Current official window information is not a historical reset ledger.
  // Its absence must not discard successfully queried historical token values.
  const [limits, reference] = await Promise.allSettled([
    readOfficial('account/rateLimits/read'), timeline(),
  ])
  const queriedAt = now()
  return {
    ...usage, queriedAt: new Date(queriedAt).toISOString(),
    windows: normalizeWindows(limits.status === 'fulfilled' ? limits.value : null),
    resets: normalizeResets(reference.status === 'fulfilled' ? reference.value : null, queriedAt),
    resetSource: reference.status === 'fulfilled' ? 'codex-reset.com' : 'unavailable',
  }
}

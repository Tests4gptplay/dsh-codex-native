import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, DisclosureRow, IconChevronDownOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { NativeCodexRpc } from './native-rpc.ts'
import type { UsageSnapshot } from '../usage.ts'
import { groupUsage, sumUsage } from '../usage.ts'
import { ui } from './ui-style.ts'

type Translator = TranslateNS<'codex-native'>
interface ViewProps {
  snapshot: UsageSnapshot | null
  busy: boolean
  enabled: boolean
  error: string
  open: ReadonlySet<string>
  onQuery: () => void
  onClear: () => void
  onToggle: (id: string) => void
  t: Translator
}
/** Pure view, also used by offline rendering tests. Never starts a query. */
export function UsageView({ snapshot, busy, enabled, error, open, onQuery, onClear, onToggle, t }: ViewProps): ReactNode {
  const periods = groupUsage(snapshot?.days ?? [], snapshot?.resets ?? [])
  const total = snapshot?.days == null ? snapshot?.lifetimeTokens ?? null : sumUsage(snapshot.days)
  const format = (tokens: string | null): string => tokens === null ? '—' : new Intl.NumberFormat(t('locale')).format(BigInt(tokens))
  const dateTime = (value: number | string): string => new Intl.DateTimeFormat(t('locale'), {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
  return (
    <section style={ui.card} aria-label={t('usageTitle')} data-codex-usage>
      <h3 style={{ ...ui.heading, marginBottom: 12 }}>{t('usageTitle')}</h3>
      <div style={ui.toolbar}>
        <Button variant="outline" size="sm" disabled={busy || snapshot === null} onClick={onClear} data-usage-clear>{t('clearUsage')}</Button>
        <Button variant="outline" size="sm" disabled={busy || !enabled} onClick={onQuery} data-usage-query>{busy ? t('queryingUsage') : t('queryUsage')}</Button>
        <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={ui.secondary}>{snapshot?.days == null && snapshot?.lifetimeTokens ? t('lifetimeUsage') : t('totalUsage')}</span>
          <span style={{ ...ui.count, fontSize: 18 }} data-usage-total aria-live="polite">{format(total)}</span>
          <span style={ui.secondary}>tokens</span>
        </div>
      </div>
      {snapshot && <p style={{ ...ui.note, margin: '8px 0 0' }}>
        {t('updatedAt')} {dateTime(snapshot.queriedAt)}
        {snapshot.days !== null && snapshot.lifetimeTokens !== null ? ` · ${t('lifetimeUsage')} ${format(snapshot.lifetimeTokens)} tokens` : ''}
      </p>}
      {error && <p role="alert" style={{ ...ui.secondary, margin: '12px 0 0' }}>{t('error')}: {error}</p>}
      {!snapshot && <p style={{ ...ui.secondary, margin: '18px 0' }}>{enabled ? t('usageEmpty') : t('usageNeedsLogin')}</p>}
      {snapshot && snapshot.days === null && <p style={{ ...ui.secondary, margin: '18px 0' }}>{t('dailyUnavailable')}</p>}
      {snapshot?.days?.length === 0 && <p style={{ ...ui.secondary, margin: '18px 0' }}>{t('noDailyRows')}</p>}
      {periods.length > 0 && <div style={{ marginTop: 14 }}>
        {periods.map(period => (
          <div key={period.id} style={{ borderTop: '0.5px solid var(--dsw-alias-border-l2)', padding: '10px 0' }}>
            <DisclosureRow
              icon={<IconChevronDownOutlineRegular />}
              title={period.startDate ? `${period.startDate} — ${period.endDate}` : t('ungroupedPeriod')}
              open={open.has(period.id)} expandable expandOnRowClick previewChevron={false}
              onToggle={() => onToggle(period.id)}
              headerAccessory={<span style={{ ...ui.count, marginInlineStart: 'auto', fontSize: 13, paddingInlineStart: 12 }} data-period-total>{format(period.tokens)} <span style={ui.secondary}>tokens</span></span>}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 8 }}>
                <thead><tr style={ui.note}>
                  <th scope="col" style={{ textAlign: 'start', padding: '4px 0 6px 24px', fontWeight: 400 }}>{t('usageDate')}</th>
                  <th scope="col" style={{ textAlign: 'end', padding: '4px 0 6px', fontWeight: 400 }}>Tokens</th>
                </tr></thead>
                <tbody>{period.days.map(day => <tr key={day.date}>
                  <td style={{ padding: '5px 0 5px 24px', color: 'var(--dsw-alias-label-secondary)' }}>{day.date}</td>
                  <td style={{ padding: '5px 0', textAlign: 'end', fontVariantNumeric: 'tabular-nums' }}>{format(day.tokens)}</td>
                </tr>)}</tbody>
              </table>
            </DisclosureRow>
          </div>
        ))}
      </div>}
      <footer style={{ ...ui.note, marginTop: 16, paddingTop: 12, borderTop: '0.5px solid var(--dsw-alias-border-l2)' }} data-usage-sources>
        <div>{t('usageSource')} <a style={ui.link} href="https://developers.openai.com/codex/app-server/" target="_blank" rel="noopener noreferrer">OpenAI Codex · account/usage/read</a>{t('accountScope')}</div>
        <div>{t('resetSource')} <a style={ui.link} href="https://codex-reset.com/" target="_blank" rel="noopener noreferrer">codex-reset.com</a>{t('resetSourceSuffix')}{snapshot?.resetSource === 'unavailable' ? ` · ${t('resetUnavailable')}` : ''}</div>
        <div>{t('referenceNote')}</div>
        <div>{t('clearNote')}</div>
        {snapshot?.incomplete && <div>{t('partialUsage')}</div>}
        {snapshot && snapshot.windows.length > 0 && <div style={{ marginTop: 8 }}>
          <div>{t('officialWindowSource')}</div>
          {snapshot.windows.map((window, index) => <div key={`${window.name}:${index}`}>
            {window.name} · {t('used')} {window.usedPercent === null ? '—' : `${window.usedPercent}%`}
            {window.resetsAt !== null ? ` · ${t('nextReset')} ${dateTime(window.resetsAt * 1000)}` : ''}
          </div>)}
        </div>}
      </footer>
    </section>
  )
}
/** Query and clear are manual actions; expanding, mounting and clearing never call the backend. */
export function UsagePanel({ rpc, t, enabled }: { rpc: NativeCodexRpc; t: Translator; enabled: boolean }): ReactNode {
  const [snapshot, setSnapshot] = useState<UsageSnapshot | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set())
  const alive = useRef(true)
  const requesting = useRef(false)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const query = async (): Promise<void> => {
    if (requesting.current || !enabled) return
    requesting.current = true
    setBusy(true); setError('')
    try {
      const result = await rpc.call<UsageSnapshot>('usage')
      if (!alive.current) return
      setSnapshot(result)
      const first = groupUsage(result.days ?? [], result.resets)[0]
      setOpen(new Set(first ? [first.id] : []))
    } catch (err) {
      if (alive.current) setError(err instanceof Error ? err.message : String(err))
    } finally {
      requesting.current = false
      if (alive.current) setBusy(false)
    }
  }
  const clear = (): void => { setSnapshot(null); setError(''); setOpen(new Set()) }
  const toggle = (id: string): void => setOpen(previous => {
    const next = new Set(previous)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  return <UsageView snapshot={snapshot} busy={busy} enabled={enabled} error={error} open={open}
    onQuery={() => { void query() }} onClear={clear} onToggle={toggle} t={t} />
}

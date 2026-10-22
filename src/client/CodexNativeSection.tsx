import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { NativeCodexRpc } from './native-rpc.ts'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'

interface Account {
  authenticated: boolean
  email?: string
  planType?: string
}
interface Flow {
  id: string
  phase: 'pending' | 'authenticated' | 'failed' | 'cancelled'
  mode: 'browser' | 'device'
  authUrl?: string
  verificationUrl?: string
  userCode?: string
  error?: string
}
interface Quota {
  primary?: { usedPercent?: number; windowDurationMins?: number; resetsAt?: number }
  secondary?: { usedPercent?: number; windowDurationMins?: number; resetsAt?: number }
}
type Translator = TranslateNS<'codex-native'>

/** Primary DSH settings surface for native Codex OAuth and account usage. */
export function CodexNativeSection({ rpc, t }: { rpc: NativeCodexRpc; t: Translator }): ReactNode {
  const [account, setAccount] = useState<Account | null>(null)
  const [flow, setFlow] = useState<Flow | null>(null)
  const [quota, setQuota] = useState<Quota | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    const next = await rpc.call<Account>('status')
    setAccount(next)
    if (next.authenticated) {
      try { setQuota(await rpc.call<Quota>('quota')) } catch { setQuota(null) }
    } else {
      setQuota(null)
    }
  }, [rpc])

  useEffect(() => {
    let active = true
    void refresh().catch(err => { if (active) setError(String(err)) })
    return () => { active = false }
  }, [refresh])

  useEffect(() => {
    if (!flow || flow.phase !== 'pending') return
    let active = true
    const timer = setInterval(() => {
      void rpc.call<Flow>('login/status', { id: flow.id }).then(async next => {
        if (!active) return
        setFlow(next)
        if (next.phase === 'authenticated') {
          try { await refresh() } catch (err) { if (active) setError(String(err)) }
        }
      }).catch(err => { if (active) setError(String(err)) })
    }, 1500)
    return () => { active = false; clearInterval(timer) }
  }, [flow?.id, flow?.phase, rpc, refresh])

  const run = async (operation: () => Promise<void>): Promise<void> => {
    setBusy(true)
    setError('')
    try { await operation() } catch (err) { setError(err instanceof Error ? err.message : String(err)) }
    finally { setBusy(false) }
  }
  const start = (mode: 'browser' | 'device'): void => {
    void run(async () => {
      const next = await rpc.call<Flow>('login/start', { mode })
      setFlow(next)
    })
  }
  const cancel = (): void => {
    if (!flow) return
    void run(async () => { setFlow(await rpc.call<Flow>('login/cancel', { id: flow.id })) })
  }
  const logout = (): void => {
    void run(async () => {
      await rpc.call('logout')
      setFlow(null)
      await refresh()
    })
  }
  const rows = [quota?.primary, quota?.secondary].filter((r): r is NonNullable<typeof r> => !!r)
  return (
    <section style={{ padding: '16px', maxWidth: '640px' }}>
      <h2>{t('title')}</h2>
      <p>{t('description')}</p>
      <p><strong>{account?.authenticated ? t('connected') : t('disconnected')}</strong>
        {account?.email ? ' · ' + account.email : ''}
        {account?.planType ? ' · ' + t('plan') + ': ' + account.planType : ''}</p>
      {account?.authenticated
        ? <div>
            <button type="button" disabled={busy} onClick={() => { void run(refresh) }}>{t('refresh')}</button>
            {' '}
            <button type="button" disabled={busy} onClick={logout}>{t('logout')}</button>
          </div>
        : <div>
            <button type="button" disabled={busy || flow?.phase === 'pending'} onClick={() => start('browser')}>{t('signIn')}</button>
            {' '}
            <button type="button" disabled={busy || flow?.phase === 'pending'} onClick={() => start('device')}>{t('deviceCode')}</button>
          </div>}
      {flow?.phase === 'pending'
        ? <div>
            <p>{t('waiting')}</p>
            {flow.authUrl ? <a href={flow.authUrl} target="_blank" rel="noopener noreferrer">{t('openPage')}</a> : null}
            {flow.verificationUrl ? <p><a href={flow.verificationUrl} target="_blank" rel="noopener noreferrer">{t('openPage')}</a></p> : null}
            {flow.userCode ? <p>{t('code')}: <strong style={{ letterSpacing: '.08em' }}>{flow.userCode}</strong></p> : null}
            <p>{t('instructions')}</p>
            <button type="button" disabled={busy} onClick={cancel}>{t('cancel')}</button>
          </div>
        : null}
      {flow?.phase === 'authenticated' ? <p>{t('loginSuccess')}</p> : null}
      {flow?.error ? <p role="alert">{flow.error}</p> : null}
      {error ? <p role="alert">{t('error')}: {error}</p> : null}
      {busy ? <p aria-live="polite">{t('working')}</p> : null}
      {account?.authenticated
        ? <div>
            <h3>{t('quota')}</h3>
            {rows.length
              ? rows.map((row, index) => <p key={index}>{index === 0 ? 'Primary' : 'Secondary'}: {t('used')} {row.usedPercent ?? '—'}%</p>)
              : <p>{t('quotaUnknown')}</p>}
          </div>
        : null}
    </section>
  )
}

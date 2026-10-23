import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { NativeCodexRpc } from './native-rpc.ts'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { UsagePanel } from './UsagePanel.tsx'
import { ui } from './ui-style.ts'
interface Account { authenticated: boolean; email?: string; planType?: string }
interface Flow {
  id: string; phase: 'pending' | 'authenticated' | 'failed' | 'cancelled'; mode: 'browser' | 'device'
  authUrl?: string; verificationUrl?: string; userCode?: string; error?: string
}
type Translator = TranslateNS<'codex-native'>
/** DSH-native account controls plus a manually queried usage view. */
export function CodexNativeSection({ rpc, t }: { rpc: NativeCodexRpc; t: Translator }): ReactNode {
  const [account, setAccount] = useState<Account | null>(null)
  const [flow, setFlow] = useState<Flow | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const refresh = useCallback(async () => { setAccount(await rpc.call<Account>('status')) }, [rpc])
  useEffect(() => {
    let active = true
    void rpc.call<Account>('status').then(value => { if (active) setAccount(value) }).catch(err => { if (active) setError(String(err)) })
    return () => { active = false }
  }, [rpc])
  useEffect(() => {
    if (!flow || flow.phase !== 'pending') return
    let active = true, pending = false
    // Existing OAuth completion check only. Usage history never runs on this timer.
    const timer = setInterval(() => {
      if (pending) return
      pending = true
      void rpc.call<Flow>('login/status', { id: flow.id }).then(async next => {
        if (!active) return
        setFlow(next)
        if (next.phase === 'authenticated') {
          const status = await rpc.call<Account>('status')
          if (active) setAccount(status)
        }
      }).catch(err => { if (active) setError(String(err)) }).finally(() => { pending = false })
    }, 1500)
    return () => { active = false; clearInterval(timer) }
  }, [flow?.id, flow?.phase, rpc])
  const run = async (operation: () => Promise<void>): Promise<void> => {
    setBusy(true); setError('')
    try { await operation() } catch (err) { setError(err instanceof Error ? err.message : String(err)) }
    finally { setBusy(false) }
  }
  const start = (mode: 'browser' | 'device'): void => { void run(async () => setFlow(await rpc.call<Flow>('login/start', { mode }))) }
  const cancel = (): void => {
    if (flow) void run(async () => setFlow(await rpc.call<Flow>('login/cancel', { id: flow.id })))
  }
  const logout = (): void => { void run(async () => { await rpc.call('logout'); setFlow(null); await refresh() }) }
  return (
    <section style={ui.section}>
      <header>
        <h2 style={{ margin: 0, fontSize: 22, lineHeight: 1.4 }}>{t('title')}</h2>
        <p style={{ ...ui.secondary, margin: '8px 0 0' }}>{t('description')}</p>
      </header>
      <section style={ui.card} aria-label={t('accountTitle')}>
        <div style={{ ...ui.toolbar, marginBottom: 12 }}>
          <h3 style={ui.heading}>{t('accountTitle')}</h3>
          <span style={{ ...ui.secondary, marginInlineStart: 'auto' }}>{account?.authenticated ? t('connected') : t('disconnected')}</span>
        </div>
        {account?.authenticated && <p style={{ ...ui.secondary, margin: '0 0 12px', overflowWrap: 'anywhere' }}>
          {account.email ?? ''}{account.planType ? ` · ${t('plan')}: ${account.planType}` : ''}
        </p>}
        <div style={ui.toolbar}>
          {account?.authenticated ? <>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => { void run(refresh) }}>{t('refresh')}</Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={logout}>{t('logout')}</Button>
          </> : <>
            <Button variant="outline" size="sm" disabled={busy || flow?.phase === 'pending'} onClick={() => start('browser')}>{t('signIn')}</Button>
            <Button variant="outline" size="sm" disabled={busy || flow?.phase === 'pending'} onClick={() => start('device')}>{t('deviceCode')}</Button>
          </>}
        </div>
        {flow?.phase === 'pending' && <div style={{ ...ui.secondary, marginTop: 14 }}>
          <p>{t('waiting')}</p>
          {flow.authUrl && <a style={ui.link} href={flow.authUrl} target="_blank" rel="noopener noreferrer">{t('openPage')}</a>}
          {flow.verificationUrl && <a style={ui.link} href={flow.verificationUrl} target="_blank" rel="noopener noreferrer">{t('openPage')}</a>}
          {flow.userCode && <p>{t('code')}: <strong>{flow.userCode}</strong></p>}
          <p>{t('instructions')}</p>
          <Button variant="outline" size="sm" disabled={busy} onClick={cancel}>{t('cancel')}</Button>
        </div>}
        {flow?.phase === 'authenticated' && <p style={ui.secondary}>{t('loginSuccess')}</p>}
        {flow?.error && <p role="alert" style={ui.secondary}>{flow.error}</p>}
        {error && <p role="alert" style={ui.secondary}>{t('error')}: {error}</p>}
      </section>
      <UsagePanel key={account?.authenticated ? account.email ?? 'connected' : 'logged-out'} rpc={rpc} t={t} enabled={account?.authenticated === true} />
    </section>
  )
}

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
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
  const [starting, setStarting] = useState(false)
  const lifetime = useRef(new AbortController())
  const operation = useRef<AbortController | null>(null)
  useEffect(() => {
    lifetime.current = new AbortController()
    return () => { lifetime.current.abort(); operation.current?.abort() }
  }, [])
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const value = await rpc.call<Account>('status', {}, signal)
    signal?.throwIfAborted()
    setAccount(value)
  }, [rpc])
  useEffect(() => {
    const controller = new AbortController()
    void refresh(controller.signal).catch(err => { if (!controller.signal.aborted) setError(String(err)) })
    return () => controller.abort()
  }, [refresh])
  useEffect(() => {
    if (!flow || flow.phase !== 'pending') return
    const controller = new AbortController()
    let pending = false
    // This only reads the already-running login attempt; no usage or model polling.
    const timer = setInterval(() => {
      if (pending) return
      pending = true
      void rpc.call<Flow>('login/status', { id: flow.id }, controller.signal).then(next => {
        if (!controller.signal.aborted) setFlow(next)
      }).catch(err => { if (!controller.signal.aborted) setError(String(err)) }).finally(() => { pending = false })
    }, 1500)
    return () => { controller.abort(); clearInterval(timer) }
  }, [flow?.id, flow?.phase, rpc])
  // Completion changes the polling effect's lifetime. Refresh under its own lifetime,
  // not the just-cancelled pending-phase effect.
  useEffect(() => {
    if (flow?.phase !== 'authenticated') return
    const controller = new AbortController()
    void refresh(controller.signal).catch(err => { if (!controller.signal.aborted) setError(String(err)) })
    return () => controller.abort()
  }, [flow?.id, flow?.phase, refresh])
  const run = async (action: (signal: AbortSignal) => Promise<void>): Promise<void> => {
    if (operation.current !== null) return
    const controller = new AbortController()
    operation.current = controller
    const signal = AbortSignal.any([controller.signal, lifetime.current.signal])
    setBusy(true); setError('')
    try { await action(signal) }
    catch (err) { if (!signal.aborted) setError(err instanceof Error ? err.message : String(err)) }
    finally {
      if (operation.current === controller) {
        operation.current = null
        if (!lifetime.current.signal.aborted) setBusy(false)
      }
    }
  }
  const start = (mode: 'browser' | 'device'): void => {
    void run(async signal => {
      setStarting(true)
      try {
        const next = await rpc.call<Flow>('login/start', { mode }, signal)
        signal.throwIfAborted()
        setFlow(next)
      } finally { if (!lifetime.current.signal.aborted) setStarting(false) }
    })
  }
  const cancel = (): void => {
    if (starting) { operation.current?.abort(); setStarting(false); return }
    if (flow) void run(async signal => {
      const next = await rpc.call<Flow>('login/cancel', { id: flow.id }, signal)
      signal.throwIfAborted(); setFlow(next)
    })
  }
  const logout = (): void => { void run(async signal => {
    await rpc.call('logout', {}, signal)
    signal.throwIfAborted(); setFlow(null); setAccount({ authenticated: false })
  }) }
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
          <Button variant="outline" size="sm" disabled={busy} onClick={() => { void run(refresh) }}>{t('refresh')}</Button>
          {account?.authenticated ? <>
            <Button variant="outline" size="sm" disabled={busy} onClick={logout}>{t('logout')}</Button>
          </> : <>
            <Button variant="outline" size="sm" disabled={busy || flow?.phase === 'pending'} onClick={() => start('browser')}>{t('signIn')}</Button>
            <Button variant="outline" size="sm" disabled={busy || flow?.phase === 'pending'} onClick={() => start('device')}>{t('deviceCode')}</Button>
          </>}
        </div>
        {starting && <Button variant="outline" size="sm" onClick={cancel}>{t('cancel')}</Button>}
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

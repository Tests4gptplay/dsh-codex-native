/** DSH 0.2.1 browser plugin: official Codex account UI in Settings. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { CodexNativeSection } from './CodexNativeSection.tsx'
import { makeNativeCodexRpc } from './native-rpc.ts'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import { NS, zh, en } from './native-locales.ts'

export const inject = ['slots', 'locale', 'connection']

export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-codex-native: language')
  const rpc = makeNativeCodexRpc(ctx.connection as unknown as ConnectionHandle)
  const t = ctx.locale.bind(NS)
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'dsh-codex-native-login',
    order: 15,
    label: () => t('nav'),
    locale: NS,
    inject: () => ({ rpc, t }),
  }, CodexNativeSection))
}

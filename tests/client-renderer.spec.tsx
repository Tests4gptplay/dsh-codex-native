import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CodexNativeSection } from '../src/client/CodexNativeSection.tsx'
import { en, zh } from '../src/client/native-locales.ts'
import type { NativeCodexRpc } from '../src/client/native-rpc.ts'

const rpc: NativeCodexRpc = { async call() { return undefined as never } }
const translate = (dict: Record<string, string>) => (key: keyof typeof zh) => dict[key] ?? key

describe('official Codex login settings', () => {
  it('keeps customer-visible locale copy focused on actions and data sources', () => {
    for (const dict of [zh, en]) {
      for (const text of Object.values(dict)) {
        expect(text).not.toMatch(/(?:不会自动刷新|非仅本插件|不是历史重置流水|不拆分当天用量|不能宣传|No automatic refresh|not only this plugin|not a historical reset ledger|not a signed-in|no separate API key is needed)/i)
      }
    }
    expect(zh.usageEmpty).toContain('点击「查询」')
    expect(en.clearNote).toContain('Query reloads official history')
    expect(zh.accountScope).toContain('账号总用量')
  })
  it('renders native ChatGPT browser and device login choices in Chinese', () => {
    const html = renderToStaticMarkup(<CodexNativeSection rpc={rpc} t={translate(zh)} />)
    expect(html).toContain('使用 ChatGPT 登录')
    expect(html).toContain('使用设备码登录')
    expect(html).toContain('连接 ChatGPT 账号，使用 Codex 模型与工具。')
    expect(html).not.toContain('sk-proj')
  })
  it('renders English locale and never asks for an OpenAI API key', () => {
    const html = renderToStaticMarkup(<CodexNativeSection rpc={rpc} t={translate(en)} />)
    expect(html).toContain('Sign in with ChatGPT')
    expect(html).toContain('Use device code')
    expect(html).toContain('Connect your ChatGPT account to use Codex models and tools.')
  })
})

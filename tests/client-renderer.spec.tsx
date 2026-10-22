import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CodexNativeSection } from '../src/client/CodexNativeSection.tsx'
import { en, zh } from '../src/client/native-locales.ts'
import type { NativeCodexRpc } from '../src/client/native-rpc.ts'

const rpc: NativeCodexRpc = { async call() { return undefined as never } }
const translate = (dict: Record<string, string>) => (key: keyof typeof zh) => dict[key] ?? key

describe('official Codex login settings', () => {
  it('renders native ChatGPT browser and device login choices in Chinese', () => {
    const html = renderToStaticMarkup(<CodexNativeSection rpc={rpc} t={translate(zh)} />)
    expect(html).toContain('使用 ChatGPT 登录')
    expect(html).toContain('使用设备码登录')
    expect(html).toContain('不保存 OAuth 凭据')
    expect(html).not.toContain('sk-proj')
  })
  it('renders English locale and never asks for an OpenAI API key', () => {
    const html = renderToStaticMarkup(<CodexNativeSection rpc={rpc} t={translate(en)} />)
    expect(html).toContain('Sign in with ChatGPT')
    expect(html).toContain('Use device code')
    expect(html).not.toContain('API key')
  })
})

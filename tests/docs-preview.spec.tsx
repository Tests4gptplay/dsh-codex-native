import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CodexNativeSection } from '../src/client/CodexNativeSection.tsx'
import { en } from '../src/client/native-locales.ts'
import type { NativeCodexRpc } from '../src/client/native-rpc.ts'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'

/** Isolated component capture; it does not start a DSH host or OpenAI session. */
const offlineRpc: NativeCodexRpc = { async call() { throw new Error('Isolated preview has no RPC backend') } }
function translation(): TranslateNS<'codex-native'> {
  return ((key: keyof typeof en) => en[key]) as TranslateNS<'codex-native'>
}

function html(): string {
  const component = renderToStaticMarkup(
    <CodexNativeSection rpc={offlineRpc} t={translation()} />,
  )
  const title = 'Codex official login'
  const description = 'Isolated component preview · No DSH Host · No real login'
  const notice = 'Browser rendering of this repository’s actual CodexNativeSection component. The sidebar is an illustrative shell, not a live DSH app.'
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>DSH Codex Native · ${title}</title>
  <style>
  :root {color-scheme:dark;font-family:Inter,"Noto Sans CJK SC","Noto Sans SC","Microsoft YaHei",Arial,sans-serif;color:#e6eaf1}
  *{box-sizing:border-box}
  body{margin:0;background:#10141e}
  .app{display:grid;grid-template-columns:240px minmax(0,1fr);height:100vh;min-height:730px}
  aside{background:#141923;border-right:1px solid #2a3041;padding:30px 20px}
  .brand{font-weight:700;font-size:19px;letter-spacing:.2px;display:flex;align-items:center;gap:11px}
  .brand span{display:grid;place-items:center;background:#4159a5;color:#fff;border-radius:10px;width:33px;height:33px;font-size:16px}
  .sidecaption{color:#8590a6;font-size:12px;margin:35px 0 14px}
  .sidelink{border-radius:11px;padding:13px 15px;color:#abb6ca;font-size:14px;margin:5px 0}
  .sidelink.active{background:#293554;color:#e7eeff;border:1px solid #3d568b}
  main{padding:44px 56px;min-width:0}
  .eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#8ba8ff;font-weight:700}
  header h1{font-size:31px;margin:10px 0 4px;letter-spacing:-.5px}
  .sub{color:#9aa5ba;font-size:14px;margin-top:8px}
  .preview{margin-top:32px;background:#1b2230;border:1px solid #354054;box-shadow:0 12px 28px #0003;border-radius:18px;max-width:820px;overflow:hidden}
  .preview section{padding:29px 35px !important;max-width:100% !important}
  .preview h2{font-size:21px;margin:0 0 12px}
  .preview section p{color:#a5b1c6;line-height:1.65}
  .preview section p strong{color:#ffd59a;font-size:14px;border-radius:25px;padding:6px 12px;background:#463620}
  .preview button{font:inherit;color:#fff;border-radius:9px;cursor:default;padding:11px 18px;margin:5px 3px 5px 0;background:#475fba;border:1px solid #6b84dd}
  .preview button+button{background:#273348;border-color:#536279}
  .disclaimer{background:#1a283a;border-left:4px solid #749cfa;max-width:820px;padding:16px 20px;margin-top:24px;border-radius:0 10px 10px 0;color:#c2cde0;font-size:13px;line-height:1.6}
  .corner{position:fixed;right:26px;bottom:18px;color:#687892;font:11px monospace}
  </style></head><body><div class="app">
  <aside><div class="brand"><span>CN</span>DSH Codex Native</div>
    <div class="sidecaption">DEVELOPMENT PREVIEW</div>
    <div class="sidelink">Plugin overview</div>
    <div class="sidelink active">${title}</div>
    <div class="sidelink">Model adapter</div>
    <div class="sidelink">Build & tests</div>
  </aside>
  <main><header><div class="eyebrow">OPENAI CODEX APP-SERVER · COMPONENT PREVIEW</div>
    <h1>${title}</h1><div class="sub">${description}</div></header>
    <div class="preview">${component}</div>
    <div class="disclaimer">${notice}</div>
    <div class="corner">DSH CODEX NATIVE · 0.2.1-alpha.0 · OFFLINE RENDER</div>
  </main></div></body></html>`
}

describe('repository-owned screenshot source', () => {
  it('renders the actual English Codex-login component without external assets', () => {
    const markup = html()
    expect(markup).toContain('Welcome to Codex')
    expect(markup).toContain('ChatGPT account that has Codex access')
    expect(markup).toContain('Sign in with ChatGPT')
    expect(markup).toContain('No real login')
    expect(markup).not.toContain('<img')
    expect(markup).not.toContain('sk-proj-')
  })

  it('writes the isolated English preview only when capture is requested', () => {
    const directory = process.env.DSH_DOC_PREVIEW_OUTPUT
    if (!directory) return
    const target = resolve(directory)
    mkdirSync(target, { recursive: true })
    writeFileSync(resolve(target, 'en.html'), html(), 'utf8')
  })
})

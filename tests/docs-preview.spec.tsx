import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { UsageView } from '../src/client/UsagePanel.tsx'
import { en } from '../src/client/native-locales.ts'
import type { UsageSnapshot } from '../src/usage.ts'
import buttonCss from '#dsh-primitives/Button.module.css?inline'
import disclosureCss from '#dsh-primitives/DisclosureRow.module.css?inline'
import shimmerCss from '#dsh-primitives/TextShimmer.module.css?inline'
const t = (key: keyof typeof en) => en[key]
const sample: UsageSnapshot = {
  queriedAt: '2026-10-23T12:00:00Z', lifetimeTokens: '8420650', incomplete: false, windows: [], resetSource: 'codex-reset.com',
  days: [
    { date: '2026-10-18', tokens: '245800' }, { date: '2026-10-19', tokens: '183500' },
    { date: '2026-10-20', tokens: '620450' }, { date: '2026-10-21', tokens: '405200' },
    { date: '2026-10-22', tokens: '312500' }, { date: '2026-10-23', tokens: '128650' },
  ],
  resets: [
    { date: '2026-10-17', announcedAt: '2026-10-17T20:00:00Z' },
    { date: '2026-10-20', announcedAt: '2026-10-20T06:00:00Z' },
    { date: '2026-10-22', announcedAt: '2026-10-22T17:00:00Z' },
  ],
}
function markup(): string {
  return renderToStaticMarkup(<UsageView snapshot={sample} busy={false} enabled error="" open={new Set(['2026-10-22'])}
    onQuery={() => {}} onClear={() => {}} onToggle={() => {}} t={t} />)
}
describe('actual native-control preview (sample data only)', () => {
  it('renders one toolbar, real official controls, and source notes', () => {
    const view = markup()
    expect(view).toContain('account/usage/read')
    expect(view).toContain('Reference periods follow public reset announcements')
    expect(view).toContain('codex-reset.com')
    expect(view.match(/data-usage-clear/g)).toHaveLength(1)
    expect(view).toContain('outline')
    expect(buttonCss).toContain('--dsw-alias-border-l3')
  })
  it('exports offline HTML only when the CI preview path is explicitly set', () => {
    const output = process.env.DSH_REPRO_OUTPUT ?? process.env.DSH_DOC_PREVIEW_OUTPUT
    if (!output) return
    mkdirSync(output, { recursive: true })
    const css = [buttonCss, disclosureCss, shimmerCss].join('\n')
    for (const mode of ['light', 'dark'] as const) {
      // Test-only theme values. Production inherits DSH/skin variables without overrides.
      const tokens = mode === 'light'
        ? '--dsw-alias-label-primary:#171717;--dsw-alias-label-secondary:#60646c;--dsw-alias-label-tertiary:#858991;--dsw-alias-border-l2:#e2e3e6;--dsw-alias-border-l3:#d3d5da;--dsw-alias-interactive-bg-hover:#f1f2f4;background:#fff;'
        : '--dsw-alias-label-primary:#ebedf0;--dsw-alias-label-secondary:#b3b7be;--dsw-alias-label-tertiary:#8c929c;--dsw-alias-border-l2:#363b42;--dsw-alias-border-l3:#4d545e;--dsw-alias-interactive-bg-hover:#2e343c;background:#1c2026;'
      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Codex usage — isolated component preview</title><style>${css}\n:root{${tokens}--dsw-radius-lg:16px;--dsw-radius-md:12px;--dsw-radius-sm:8px;color:var(--dsw-alias-label-primary);font-family:Arial,sans-serif}body{margin:0;padding:40px}main{max-width:680px;margin:auto}button{font-family:inherit}h1{font-size:24px;margin:0 0 8px}.caption{font-size:12px;line-height:1.6;color:var(--dsw-alias-label-tertiary);margin-bottom:24px}</style></head><body><main><h1>Codex</h1><p class="caption">Actual official DSH controls and styles. Illustrative data only — not a signed-in account or full Desktop screenshot.</p>${markup()}</main></body></html>`
      writeFileSync(join(output, `usage-${mode}.html`), html)
      if (mode === 'light') writeFileSync(join(output, 'en.html'), html)
    }
  })
})

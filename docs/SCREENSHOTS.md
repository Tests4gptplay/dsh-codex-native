# Screenshot provenance / 截图来源

## Documentation rule

Documentation images must be **our own captures of this fork**, not screenshots inherited from upstream. No real personal login, OAuth URL, device code, token, account identifier, or user directory may appear in a captured image.

Three imported upstream screenshots and their old CDP capture evidence were removed on 2026-10-22:

- `docs/images/conversation-screenshot.png`
- `docs/images/model-selector-screenshot.png`
- `docs/images/codex-settings-card.png`

They showed the old plugin UI, not the new `CodexNativeSection` login page.

## Current image categories

1. **Isolated component preview / 组件预览**: A browser rendering of the **actual** React `src/client/CodexNativeSection.tsx` component in its unauthenticated initial state, with a neutral preview shell. This is not a screenshot of a running DSH Web/Desktop Host. Chinese and English are captured separately.
2. **Live DSH host screenshot / 真实 DSH 截图**: Captured only after installing a frozen plugin build in an isolated real DSH Host. Requires a reproducible build/test reference.
3. **Authenticated account / 已登录账号**: Not permitted for public demo by default. Mocking a connected account must always say **mock**, and cannot be presented as a successful real login.

An image is not proof that account login, model requests, or tooling works. Those claims require the actual integration test.

## Reproduction

The hosted screenshot workflow [`docs-preview.yml`](../.github/workflows/docs-preview.yml) renders the real React component via a test-only server-side render and captures it with Chrome in a **disposable GitHub Actions runner**, with no ChatGPT account. Generated PNGs use the `docs/screenshots/` directory.

The preview never imports third-party image assets and never makes a network connection to OpenAI. The React UI logic is the same as the package's settings component, but the surrounding preview shell is **not** the DSH application. Do not crop out the preview disclaimer.

## Caption required in README

> Isolated screenshot of this fork's official-login React component, unauthenticated state. Not a DSH integration test or a real OAuth login.
> 
> 本仓库官方登录组件的隔离浏览器截图（未登录）；不是 DSH 实机验收，也不表示 OAuth 已真实完成。

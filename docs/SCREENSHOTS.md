# Screenshot provenance / 截图来源

## Rule / 规则

All public screenshots must be generated from **this fork's actual UI**, not inherited from the original author. Account email, OAuth URLs, device codes, API tokens and personal machine data may not appear. A component screenshot does not establish that DSH integration or OAuth works.

本项目只使用当前源码生成的截图；不引用原作者界面。组件截图不能作为 DSH 实机或真实登录成功的证据。

## Current preview / 当前预览

- [English Codex account login preview](screenshots/codex-native-login-en.png) — **English only**, no CJK font dependency.
- Reproduction: [original screenshot workflow](../.github/workflows/docs-preview.yml).
- React source: `src/client/CodexNativeSection.tsx` with `src/client/native-locales.ts`.
- Offline browser-render source: `tests/docs-preview.spec.tsx`.
- Context: a disposable Ubuntu GitHub Actions environment, without DSH Host or OpenAI authentication.
- Welcome copy: **"Welcome to Codex"**; under it, **"Sign in with a ChatGPT account that has Codex access. Requests use your Codex plan allowance; no separate API key is needed."**
- The navigation column is a test-only illustrative shell. It is not the real DSH interface.

## Removed inherited or defective images / 已移除图片

Three prior upstream screenshots and their old CDP logs were removed on 2026-10-22. A broken Chinese-language preview with missing CJK glyphs was also removed; we retain the accurate, legible English preview. This does **not** remove Chinese text support from the actual plugin, which keeps both localizations.

## Real DSH Host acceptance / 实机截图

A screenshot of the real DSH settings page will only be added after the released plugin has been installed in an isolated real DSH Host. No real-account screenshot is fabricated. Authentication, actual model execution and tools still require their own integration tests.

**Required caption:** Isolated capture of this fork's actual Codex-login React component, unauthenticated state. Not a real DSH Host screenshot or an OAuth login test.

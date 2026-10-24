# Alpha.4 — chat content and Windows launch reproduction

**Date:** 2026-10-23 · **Source:** `141dfa2960fbd58f2e43d361745e6ca3b815dbbc`

[Windows and Linux CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39947758087) · [Release installation](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39948312538) · [Alpha.4 Release](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.4)

## Chat presentation

After an earlier renderer cleanup, `AppServerEventMapper` continued to produce `codex-action` blocks. The official DSH `AssistantMarkdown` rendered those items with its fallback JSON presentation.

`src/presentation.ts` now projects lifecycle metadata into the appropriate DSH content types, renders native action completion and failure status, and preserves assistant answers and DSH tool-call content.

The real official renderer test observed **3 unknown blocks before and 0 after** while retaining the answer and action status.

## Windows native launch

The Codex `codex-cli/bin/codex.js` wrapper started another executable process. `src/launch.ts` now resolves the packaged Windows Codex binary so DSH manages its app-server process directly.

## Regression setup

- `tests/fixtures/mock-app-server.mjs` provides deterministic JSON-RPC protocol messages.
- `tests/mock-stdio.spec.ts` exercises DSH LocalSubprocessRuntime-backed protocol calls.
- `tests/official-renderer.spec.tsx` exercises the pinned official DSH renderer and compares rendered content.
- `tests/launch.spec.ts` checks the official Windows executable's initialization and account query under an isolated `CODEX_HOME`.

## Results

Linux **126 passed / one Windows-specific skip**; Windows **127/127**. Typecheck, build and exact Git-tag installation passed. The alpha.4 installation snapshot contained 25 runtime files.

[Runtime audit](AUDIT.md) · [Subsequent transport repair](PROTOCOL_STREAM_FIX.md)

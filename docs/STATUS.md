# Release status

Updated 2026-10-23. Current test preview: **v0.2.1-alpha.4**, DSH 0.2.1-rc.2, official Codex 0.154.0.

[Release](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.4) · [Regression CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39947758087) · [Publication CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39948312538).

## Passed

- Typecheck/build on Linux and Windows.
- 126 account-free tests on Linux, with one Windows-only test skipped; 127 on Windows.
- Mock stdio child -> plugin -> standard DSH visible content.
- Official pinned DSH renderer reproduces unknown blocks before the fix and no unknown blocks after it; replies and meaningful action status retained.
- Real Windows official Codex executable initialized through DSH with an isolated, unauthenticated CODEX_HOME.
- Minimal Git installation: 25 files; no tests, source, mock backend, CI, scripts or devDependencies; no allowBuilds exception.

## Remaining boundaries

- Actual Electron desktop window visibility is not directly observed in hosted CI. Direct-launch protocol correctness is verified.
- Existing historical `codex-action` blocks are not rewritten; the fix applies to new replies after upgrade and restart.
- Model-menu entries do not prove current account support. Provider `openai-codex` is not this plugin's `codex-local`.
- Native Codex approvals/elicitation are not fully bridged to DSH interactive UI.
- Live subscribed OAuth/model/tool end-to-end is not certified; test fixtures never use or alter a user's account.

See [reproduction details](REPRODUCTION.md) and [cleanup audit](AUDIT.md).

# DSH Codex Native — runtime and distribution cleanup audit

Date: 2026-10-22 · Scope: released `v0.2.1-alpha.1` and current `main`, preparing minimum-artifact `v0.2.1-alpha.2`.

**No user computer, DSH installation, account or token was accessed for this audit.** Read-only inspection was performed first, followed by source changes on GitHub main and CI.

## Findings in alpha.1 and disposition

| Area | Evidence in alpha.1 | Current cleanup |
|---|---|---|
| Installation-time builds | Alpha.0 had a `prepare` lifecycle script and failed pnpm's `allowBuilds` policy | Alpha.1 removed `prepare`; planned alpha.2 distribution strips **all scripts and devDependencies**, includes compiled JS directly |
| Source/test exposure | GitHub source tree had `tests/`, `src/`, CI and legacy docs; published npm `.tgz` excludes tests, but one-line GitHub installs download the entire tree | Minimum alpha.2 Git tag built from a separate isolated commit with only `lib/`, manifest, bundle patch, READMEs, LICENSE |
| Test execution after install | Compiled `lib/index.js` and `lib/client.js` have **no Vitest import, test-suite invocation or auto-test registration** | No test files permitted in alpha.2 git tag; cloud test and source test suites remain in development repository |
| Unused UI | Older `CodexAssistantNodeView`, `CodexSettingsCard`, CSS and form controller were no longer imported by active `src/client/index.ts`, but remained in the source tree | Deleted; removed unused CSS compiler/transitive packages and obsolete tests |
| Extraneous DSH tool behavior | `ctx.on('tools/execute')` intercepted `web_search` on Codex models and spawned a separate Codex search worker | Removed; ordinary DSH web tool handling is left unchanged |
| Blanket native-feature prohibitions | `src/runner.ts` provided `CODEX_DISABLED_FEATURES` containing shell, plugins, MCP, multi-agent, browser, etc. and forced `--strict-config` | Removed; official Codex user's feature configuration is no longer globally overridden |
| Approval policy override | `thread/start` unconditionally specified `approvalPolicy: 'never'` | Removed, so Codex's own approval configuration is not forcibly suppressed |
| Forced compaction and identity | `model_auto_compact_token_limit=Number.MAX_SAFE_INTEGER`, `CODEX_INTERNAL_ORIGINATOR_OVERRIDE`, forced telemetry/update flags and exact userAgent version abort | Removed; native compaction and user settings are no longer overridden |
| Hard request timer | `timeoutMs` defaulted to 300000 ms both in schema and shipped patch | Default 0; code only installs the extra timeout when explicitly configured positive; DSH abort signal still works |
| Idle cache | `sessionIdleTimeoutMs=600000` and max 8 cached sessions | Retained: only idle/pending leases evicted, not actively running task; avoids retaining unused processes |
| Authentication status | Browser UI requests account status when the settings component mounts; pending login polls `login/status` every 1.5s and cancels timer on unmount | Retained as on-demand UI behavior; **not** a global background test or watchdog |
| Protocol parsing and dynamic-tool namespace | JSON-RPC shape validation, per-session tool-id matching and namespacing remain | Retained: necessary for protocol correctness and to avoid accidentally treating an arbitrary native Codex call as a DSH operation |

## Remaining integration risks — do not mask with green unit tests

1. **Interactive native approvals:** `src/thread.ts` has legacy handlers that decline native Codex approval/elicitation requests; there is not yet a tested DSH approval UI bridge. DSH dynamic tools retain DSH's own execution/approval path, but Codex-native tools follow Codex's own sandbox policy. Real interactive approval completion must be tested or implemented before claiming parity with the official Codex app.
2. **Real login and model:** Account-free unit tests use mocked app-server messages. Actual OAuth, subscribed Codex rate limits, model picker capability and tool round-trips require independent integration evidence, not an end user's production installation.
3. **No extra wall-clock limit:** Disabling the plugin's arbitrary 5-minute limit avoids terminating useful long work, but a hung app-server may still require caller cancellation or DSH session disposal. Not a promise that every hung process is detected automatically.
4. **Resource bounds:** JSON-RPC line limits, image limits and idle lease capacity are runtime resource bounds, not extra per-boundary user confirmation steps. Adjust only with measured functionality and memory impact.
5. **Official runtime dependency:** `@openai/codex@0.154.0` uses platform-specific optional binaries. A clean install alone does not prove the Windows binary starts; the upcoming Windows DSH Host smoke is an independent gate.

## Cloud-only acceptance required for next user-facing installer

- Successful TypeScript build and full account-free unit suite (development repo only).
- Minimal Git tag has *no* tests, src, scripts, GitHub workflows, development dependencies, or npm lifecycle script, including in the actual installed Node package.
- Clean `pnpm add github:...#v0.2.1-alpha.2` without `allowBuilds`.
- Real DSH `0.2.1-rc.2` plugin/host composition on both Linux and Windows with a disposable `DSH_HOME`; no Codex account is used.
- Release created **only** if all those gates pass; real account-level parity still unverified.

[Current CI](https://github.com/Tests4gptplay/dsh-codex-native/actions) · [Source code](https://github.com/Tests4gptplay/dsh-codex-native).

This is an evidence-bounded audit, not a claim of mathematically eliminating all possible failure modes or malicious dependencies.

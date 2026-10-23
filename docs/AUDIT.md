# DSH Codex Native — runtime and distribution audit

Updated: **2026-10-23** · Release: **v0.2.1-alpha.3**

## What was removed

| Finding in old versions | Outcome in alpha.3 |
|---|---|
| `prepare` install-time build blocked by DSH pnpm | No lifecycle `scripts` in tagged package |
| Git-source installation bundled `src/`, `tests/`, CI, old docs | Tagged Git tree has 22 source-free runtime files |
| Unreferenced old UI renderer, settings card, CSS compiler | Removed from active development source and distribution |
| Plugin silently intercepted DSH `web_search` | Removed that listener; DSH retains its original provider chain |
| Codex forced blanket `--disable` feature list | Removed; official Codex configuration remains authoritative |
| Forced `approvalPolicy=never` | Removed; plugin does not grant its own blanket approval |
| Forced compaction threshold, originator identity, hard exact userAgent check | Removed |
| Plugin-level hard timeout default 300 seconds | Default now 0 (disabled); caller cancellation remains |
| Legacy React component screenshot | Only own isolated demonstration, **no images in installation tag** |

## What remains and why

- DSH dynamic-tool namespace and tool-call association: avoids dispatching a Codex-native tool under the wrong DSH owner; this is **functional routing**, not user confirmation at every boundary.
- JSON-RPC protocol framing and malformed-response detection: ensures messages can be routed correctly; not an independently scheduled watchdog.
- Codex account login state checks: only while DSH Settings login UI is in use; pending login polls 1.5 seconds and the timer is cleared on unmount/completion.
- Session cache idle expiry and capacity eviction: releases idle app-server process trees; **does not kill actively running model turns** merely for being long.
- Codex process cleanup on DSH session/plugin shutdown: prevents orphan processes rather than scheduling tests.
- No `vitest` or test-suite runtime references in the tagged `lib/index.js` or `lib/client.js`.

## Release verification

[CI #39879247613](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39879247613) **passed**: 117 non-account unit tests, production bundle, clean 22-file Git tree, GitHub-tag pnpm add with no `allowBuilds` exemption, and official DSH 0.2.1 Web Profile configuration smoke on hosted Linux/Windows.

## Nontrivial risks not yet signed off

**Live Codex authorization and native approval handling are not fully verified.** The existing `src/thread.ts` resolves several native Codex approval/elicitation requests by declining them, rather than forwarding a real user-approval dialog into DSH. Removing the former forced no-approval setting does **not** implement that missing UI bridge.

Native Codex may still have permissions and tools controlled by its own configuration. Do not treat the plugin as a sandbox replacement. The source-free installer reduces packaging and automatic script risk, not all consequences of enabling Codex native capabilities.

No user's local DSH files, OAuth tokens, or home directory were accessed during these cloud tests. Nothing in the release is represented as a production security certification.

# 账号生命周期风险审计 / Account lifecycle audit

2026-10-24 JST. Scope: plugin-created validation/handshake/cleanup risks. The user required reproduction before modification. No user installation, account, credentials or model quota was used.

## Environment and sequence

Local temporary container could not install network dependencies. Execution therefore used disposable GitHub-hosted Ubuntu and Windows workspaces, not the user's CAH host. Each new case used a real Cordis Context and official `@deepseek-ai/dsh-subprocess-local` 0.2.1-rc.2 to start a real child, with temporary DSH_HOME/CODEX_HOME and no API key. Only the Codex peer was a fixture deliberately withholding selected replies; DSH process management and plugin code were real. The full suite also checked official DSH rendering source at `687f282e8625c6b8d11ff58211a90524be2e4317` and Windows's real Codex binary without an account.

Production baseline: main `718356eb00fde0d7a6002ebcdbe13df5f81e56f8`, alpha.6. Test-only baseline commit `f9d2122420546851fd261dd4bd95522363da2537` changed no runtime source. [Before-fix run 40047676806](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40047676806) reproduced the same six failures on Windows and Ubuntu. Existing tests passed; the two added positive controls passed. Baseline totals: Windows 156 pass / 6 fail; Ubuntu 155 pass / 6 fail / 1 Windows-only skip.

Only after reading both failure logs was the production fix committed: `e434e5fc57fd647fac7332c6304e6515cd11c5bd`. [After-fix run 40048042517](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40048042517) passed both OS jobs, including typecheck, unchanged eight added assertions, existing regression suite, build and pack.

## Reproduced cases

| Case | Unchanged alpha.6 | Repair |
|---|---|---|
| Account initialize never replies, then dispose account service | Request stays pending | Request settles; owned child exits |
| Status read never replies, then dispose | Request stays pending | Request settles; owned child exits |
| Quota read never replies, then dispose | Request stays pending | Request settles; owned child exits |
| Usage read never replies, then dispose | Request stays pending | Request settles; owned child exits |
| Login cancel never acknowledges | Cancel stays pending | Cancel returns cancelled; its child exits |
| Device login initialize never replies, then dispose | Start stays pending | Start rejects; child released |
| Normal account read | PASS: one initialize, no model turn, child exits | PASS unchanged |
| Active model turn with idle-cache threshold shorter than turn duration | PASS: no idle-timeout kill | PASS unchanged |

The 2.5-second observation bound is test-only, not a runtime deadline. The slow peer deliberately never replies; before-fix disposal has no ownership path to those children, and cancellation waits on an acknowledgement before cleanup. This is evidence of the two code defects, not a claim that a real account usually stalls. The active-turn control uses a 20ms cache threshold and a 180ms fixture response: an accelerated boundary test, NOT an hour-long live-model run.

## Minimal repair

Only production source `src/native-account.ts` changes: 18 additions / 11 deletions. Record every owned account connection before initialize can suspend; remove it on close; dispose all currently owned account connections. Explicit cancel detaches its login state, sends best-effort protocol cancellation, and closes that connection without awaiting acknowledgement. It does not touch model-runner children or delete official login files.

No dependencies changed. No new validation challenge, handshake, heartbeat, Watchdog, usage poller, reconnect loop, model hard deadline or automatic in-flight replay was added. Existing six-second account teardown wait is unchanged and only applies when closing a process. Official initialize/initialized remains; default model timeout remains zero. `runner.ts`, `thread.ts`, `session-cache.ts`, permissions and frontend source are unchanged.

## Runtime payload inspection

Downloaded the actual passing Ubuntu artifact `12542246673` and inspected its compiled runtime locally. This is a DEVELOPMENT artifact; its manifest is not the stripped release manifest.

| File | Bytes | Git blob SHA-1 |
|---|---:|---|
| lib/index.js | 125240 | b43ab035cd141d1459123b3412c4f36c085a5d80 |
| lib/client.js | 25925 | ba4fd9fbaba03f81fa4e4beb24901ae4083716d8 |
| cordis.patch.yml | 2304 | 135a27ce43c9be6350ec495502f6645208569c12 |

The client bundle is byte-identical to alpha.6. Server bundle contained none of `account-lifecycle.mjs`, `AUDIT_RECEIVED`, `NOT-A-CODE`, `silent-initialize`, `mock-app-server.mjs`, `TEST_CODEX_SCENARIO`, `vitest` or `setInterval(`. Absence of these strings is a packaging check, not a general security proof. The existing release pipeline separately strips scripts/devDependencies and verifies the final whitelist and exact Git-tag install before publishing.

Tests stay in source development directories for repeatable regression; they are not imported by production and must not be shipped in the installation snapshot. Test cleanup terminates only fixture-owned processes and removes the temporary homes. No new workflow file was introduced; the existing CI gained one audit-branch trigger.

## Limits / not changed speculatively

This is not a full Electron desktop or all-skins acceptance test, a real-account OAuth/cancellation test, or a cloud outage diagnosis. The initiating cause of the user's original protocol-stream closure is still unproven. Native Codex approval/elicitation bridging remains a known separate limitation; this audit does not replace it with automatic approvals. Concurrent login starts, browser-disconnect propagation and every OS-specific teardown failure were not certified by these eight cases. Suspected but unproven risks were not used to justify unrelated production changes.

Audit branch: `audit/account-lifecycle-20261024`. Exact test paths: `tests/account-lifecycle-integration.spec.ts`, `tests/fixtures/account-lifecycle.mjs`. Published-version status and installation evidence belong in [STATUS.md](STATUS.md).

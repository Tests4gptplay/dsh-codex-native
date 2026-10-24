# DSH Codex Native — releases and validation

## Current release — v0.2.1-alpha.8

Published **2026-10-24 17:40:42 JST**.

[Release and assets](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.8) · [Installation](INSTALL_PATCHED_HOST.md) · [Technical audit](CONTEXT_COMPACTION_AUDIT.md)

This release combines alpha.6/alpha.7 connection-stability improvements with Token-accounting corrections and Codex-managed routine context compaction. The paired DSH `0.2.1-rc.2` integration patch is included among the release assets, with build and installation steps linked above.

## Validated improvements

- **Connection lifecycle:** protocol pipe closure, account-process cleanup and login cancellation behavior.
- **Token accounting:** total consumption and the current context-window sample are tracked separately; delayed native snapshots are reconciled with raw completed responses.
- **Compaction ownership:** Codex processes routine pressure compaction; DSH retains actual-overflow recovery.
- **Structured overflow errors:** native `contextWindowExceeded` is mapped to the DSH recovery path.
- **User interface:** manual Token-history Query/Clear controls, quota and login settings.

## Alpha.8 test results

| Test stage | Verified result |
|---|---|
| Focused before/after regression | 22 passed / 4 failed at baseline; **26/26 after repair** |
| Windows plugin tests | **188/188** |
| Ubuntu plugin tests | **187 passed; 1 platform-specific skip** |
| Final packaged-runtime and model-info tests | **28/28** |
| Full patched DSH build | **9/9** |
| Fresh profile installation | Passed |
| Patched LLM/token-meter/compaction module resolution | Passed |
| Web startup and authentication | HTTP **303 → 200** |
| Fixed Git tag installation and runtime hash comparison | Passed |

[Candidate CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40078589328) · [Publication CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40078708238)

## Alpha.8 delivery identity

| Item | Identity |
|---|---|
| Tested source | `455d273e8ea6825a5275e665845a5557e068b0cd` |
| Tested source tree | `d3783189984d765ad8e148c67156dd2aa84c5994` |
| Runtime tag commit | `1a1c0f7b044df93ffec1689418d8835c73ff346a` |
| Runtime tag tree | `52ad629ef7e027ae3fbb6702f0bb3ed10153773b` |
| Package | `dsh-codex-native-0.2.1-alpha.8.tgz` — 52,848 bytes |
| Package SHA256 | `e9b65da495cac7fe7b86626da7482076d2e9e4ede9bdc2bdced5712653962eda` |
| DSH companion patch SHA256 | `dd8049f33fea9187cc025e792fc25feb68a8ad5ccb1044cc85e063429c2b717e` |

Published assets contain the compiled plugin TGZ, host integration patch, installation guide, upstream license, provenance manifest and SHA256SUMS. The fixed tag contains a 30-file distribution snapshot.

## Previous releases

### Alpha.7 — account lifecycle stability

Published **2026-10-24 10:11:37 JST**. Account-owned subprocesses are registered prior to initialization and released during disposal; login cancellation closes the relevant connection promptly.

[Release](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.7) · [Account lifecycle audit](ACCOUNT_LIFECYCLE_AUDIT.md) · [Windows/Ubuntu regression](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40048042517)

Alpha.7 TGZ: 52,264 bytes; GitHub asset SHA256 `3cec67b8c13f91c8a9d84f2a2a8ff458ca3deaf9ee655e3c6899880f06b39295`.

### Alpha.6 — protocol transport resilience

Handle pipe close/backpressure races, preserve bounded exit diagnostics and reconstruct closed cached sessions from recorded history.

[Transport repair](PROTOCOL_STREAM_FIX.md) · [CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39996592077)

### Alpha.5 — Token history UI

Introduced the manual account-history panel. The user confirmed its operation in DSH Desktop on 2026-10-23 and approved the anonymized [real screenshot](screenshots/codex-usage-desktop-anonymized.png).

[UI delivery](DELIVERY-alpha5.md) · [Screenshot provenance](SCREENSHOTS.md)

## Engineering references

[Context accounting and compaction](CONTEXT_COMPACTION_AUDIT.md) · [Usage data mapping](USAGE.md) · [Alpha.4 runtime research](AUDIT.md) · [Protocol closure diagnostics](PROTOCOL_STREAM_FIX.md)

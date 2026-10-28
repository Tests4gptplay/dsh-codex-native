# DSH Codex Native — releases and validation

## Current release — v0.2.1-alpha.9-http.10

[Release and assets](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.9-http.10) · [Native installation](INSTALL.md)

- New processes resolve the official `@openai/codex@latest` runtime; downloaded platform binaries are reused.
- Concurrent process starts share an update. Running processes retain their executable; failed refreshes retain an available runtime and report the error.
- Official `model/list` discovery supplies model IDs, names, input capabilities and reasoning efforts.
- Windows verification on 2026-10-28: build and 21 focused tests passed. The updater launched `codex-cli 0.165.0`; the official catalog returned GPT-6.1-Sol and GPT-6.1-Terra.
- Existing Computer Use recovery, native questions and HTTP transport are retained.

## Previous release — v0.2.1-alpha.9-http.9

[Release and assets](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.9-http.9) · [Native installation](INSTALL.md)

- On-demand native `model/list` refresh updates DSH model selection and reasoning/input metadata from the App Server.
- Uses existing account RPC and keeps Codex runtime, login, HTTP transport, and settings.

## Previous release — v0.2.1-alpha.9-http.7

[Release and assets](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.9-http.7) · [Native installation](INSTALL.md)

- Embedded Windows Computer Use guide, runtime discovery, Win10 screenshot repair, targeted helper release and rollback.
- Full recovery guidance loads on demand with the Computer Use skill body or the guide action.
- Build and 16 focused tests passed, including real Windows file replacement and rollback.
- Windows 10 build 19045 live verification on 2026-10-27: the installed release action stopped the selected helper; the supported Computer Use API reconnected and captured the DSH window in approximately 0.4 seconds. No mouse, keyboard or window-activation action was used.

## Previous release — v0.2.1-alpha.9-http.6

[Release and assets](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.9-http.6) · [Native installation](INSTALL.md)

- Codex blocking and asynchronous questions use DSH's native selectable UI and notifications.
- Asynchronous answers automatically return to the active task and appear as readable user messages.
- Windows validation on 2026-10-26: 33 focused question, runner, and package-metadata tests and the build passed. Both compiled runtime bundles match the accepted installed version byte-for-byte. The installed update was confirmed in the live DSH conversation: select, submit, receive a user-message receipt, and continue the task with no extra send step.
- Existing HTTP transport, skills, settings, Token history, and MCP failure presentation are preserved.

## Previous release — v0.2.1-alpha.9-http.4

[Release and assets](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.9-http.4) · [Native installation](INSTALL.md)

- DSH host-provided peer dependency ranges are unrestricted (`*`); runtime API errors remain visible.
- Authenticated HTTP, Codex sign-in, context management, skill discovery, and Token history preserved.
- Verified on Windows: 209/209 tests; Ubuntu: 208 passed, 1 skipped; final packaged-runtime tests: 28/28 on both systems.
- [Windows and Ubuntu candidate CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40190137989).

## Previous release — v0.2.1-alpha.9-http.3

[Release and assets](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.9-http.3) · [Native installation](INSTALL.md)

- Authenticated HTTP transport for the OpenAI route, using existing ChatGPT sign-in.
- Session-scoped warning deduplication, restored from recorded message history.
- DSH-wide on-demand local and remote connector skill search/read, with connector preference for duplicate plugin skills.
- Process-local maximum skill budget of 10,000 tokens and compact startup discovery instructions.

Windows validation on 2026-10-25: **44 focused tests passed**, plugin build and type declarations passed, and the update was installed through DSH's plugin manager. Live discovery found 21 enabled local skills and 41 connector skills; NTE and Google Drive skill reads succeeded. The native request capture removed an 18,292-character automatic skill section. The client UI bundle retained identical bytes.

## Previous release — v0.2.1-alpha.9

Published **2026-10-25 09:52:55 JST**.

[Release and assets](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.9) · [Installation](INSTALL_PATCHED_HOST.md) · [Technical audit](CONTEXT_COMPACTION_AUDIT.md)

This release includes refined bilingual login and Token-history UI, installed-plugin Chinese and English metadata, a bundled ChatGPT authentication-channel icon, and the previously tested connection, Token accounting and Codex context-management improvements.

## Alpha.9 verification

| Check | Verified result |
|---|---|
| Windows plugin tests | **191/191** |
| Ubuntu plugin tests | **190 passed, 1 platform skip** |
| Final packaged-runtime and model-info tests | **28/28** |
| Full patched DSH source build | Passed |
| Fresh-profile installation and module resolution | Passed |
| Authenticated Web startup | HTTP **303 → 200** |
| Fixed Git tag installation and runtime hashes | Passed |
| Distribution files | **34** |
| Market screenshots | Three PNGs, anonymized real Desktop first |

[Candidate CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40124345944) · [Publication CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40148183107)

## Alpha.9 release identity

| Item | Identity |
|---|---|
| Tested source | `ce85bb24750915cb9623a2e60967538058f17e5b` |
| Runtime tag commit | `f207a1f82ea43a5987aa3244dd590f12b4da56bc` |
| Release package | `dsh-codex-native-0.2.1-alpha.9.tgz` — 65,650 bytes |
| Release package SHA256 | `2ec0360587e55350aed1c897d632014680eec00a71f8f612230c742832201395` |
| Companion DSH patch SHA256 | `dd8049f33fea9187cc025e792fc25feb68a8ad5ccb1044cc85e063429c2b717e` |

Distribution includes compiled runtime, bilingual manager metadata, ChatGPT channel icon and MIT attribution for icon artwork. Release attachments also include the DSH rc.2 host patch, setup guide, asset manifest and checksums.

## Previous release — v0.2.1-alpha.8
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

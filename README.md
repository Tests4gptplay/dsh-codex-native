# DSH Codex Native

## Core capabilities

- **Dynamic model selection:** integrates Codex app-server as a DSH main-model provider and reads available models, input capabilities and reasoning efforts from the current account's `model/list`.
- **Native tools and interaction:** connects DSH tools, Codex settings, selectable/free-text question cards, and native command/file approvals to one-time decisions in the active DSH session.
- **Reliable history continuation:** preserves tool-call/result associations during replay; generated images are stored as attachments and restored from history after restart.
- **Large-image handling:** Buffer-based encoding avoids call-stack errors from expanding large byte arrays. Extra JSON-RPC line limits and image-substitution budgets are disabled by default. An explicitly positive image budget can replace older images with text; Host and upstream limits still apply.
- **Account and usage:** ChatGPT sign-in/sign-out, on-demand Token history/quota queries, and clearing the panel cache before querying again.
- **Windows Computer Use maintenance:** bundled guidance, status checks, known-helper repair, exact-process release and rollback. The Windows 10 repair targets the known `@oai/sky 0.7.13` binary; see the operation guidance below for signature changes and interruption confirmation.

**An OpenAI Codex app-server main-model integration for DeepSeek Harness.** Use ChatGPT sign-in, DSH tools, native Codex model settings and an on-demand Token usage history panel.

[简体中文](README.zh.md) · [Releases](https://github.com/Tests4gptplay/dsh-codex-native/releases) · [Installation guide](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/INSTALL.md) · [Release verification](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/STATUS.md)


This test candidate is 0.2.1-alpha.9-http.11-candidate.7. Use its accompanying frozen package and SHA-256 manifest; older tags below refer to historical releases.

## Historical release — v0.2.1-alpha.9-http.10

New Codex processes resolve the official npm `@openai/codex@latest` channel and download the platform runtime when needed. Existing processes keep running; subsequent processes use the updated executable. An unavailable update retains the usable runtime and logs the reason. Updates are demand-driven, with no background polling.

The DSH model selector now reads the official Codex App Server `model/list` catalog on each model-list request, automatically reflecting newly available models, names, input capabilities and reasoning efforts when refreshed. Existing account sign-in and settings are preserved.

Embedded `codex_computer_use_recovery` provides `guide`, `status`, `repair`, `release`, and `rollback`. Patch bytes, exact-path process recovery and troubleshooting instructions ship in the plugin; no external BAT, PS1 or Python dependency is required.

The full guide loads only with the Computer Use skill body or an explicit guide call, not in the standing system prompt. It distinguishes native FrameArrived timeouts, file locks, transport failures, stale handles and intentional Esc cancellation. The Windows 10 patch accepts only the verified @oai/sky 0.7.13 binary and requires agreement to invalidating its signature. Release requires permission to interrupt the selected screenshot helper; it does not terminate DSH, Codex or parent processes.

## Included features

[Release and downloads](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.9-http.10) · [Context accounting details](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/CONTEXT_COMPACTION_AUDIT.md)

- **Native questions and notifications:** Codex questions use DSH's selectable question cards and native notifications, including free-text answers.
- **Automatic chat replies:** submitted answers return to the active task and appear as ordinary user messages, with a single submission and no extra send step.
- **Host version compatibility:** plugin peer dependencies use host-provided DSH modules without version-range gating.
- **Direct HTTP connection:** the OpenAI route uses authenticated HTTP with existing ChatGPT sign-in, reducing reconnect waits after WebSocket interruptions.
- **On-demand skill discovery:** DSH searches local and remote connector skills and reads selected instructions. Startup carries a compact discovery hint. The skill budget follows the upstream configuration unless explicitly set.
- **Session warning deduplication:** configuration, deprecation, and ordinary warnings are recorded once per session in Host diagnostic logs; changed notices and errors remain available there without entering model replies or compaction summaries.

- **Context management:** Codex manages routine context compaction, with DSH's overflow recovery available for exceptional cases.
- **Accurate usage accounting:** total token consumption is tracked independently from the latest active context-window sample; delayed reports are reconciled with completed responses.
- **Connection stability:** retains the transport recovery and account lifecycle improvements from alpha.6 and alpha.7.
- **Manual Token history:** query account usage, review dated totals and reference periods, and clear the displayed table.
- **Main-model integration:** official Codex app-server, ChatGPT sign-in, DSH tools and model settings.
- **Installed-plugin identity:** ChatGPT authentication-channel icon and bilingual plugin-manager descriptions are included in the installable package.

### Installation

```text
github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.9-http.10
```

In Desktop, open **Plugins → Add plugin**, paste the fixed-version source above, and enable it. For Web:

```sh
dsh plugin --profile web add 'github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.9-http.10'
```

The fixed tag includes prebuilt runtime files. Upgrades retain existing configuration and sign-in. The [installation guide](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/INSTALL.md) covers login and the alternative TGZ package.

## On-demand skill discovery

Version `0.2.1-alpha.9-http.10` provides `codex_skill_search` and `codex_skill_read` through DSH: models search summaries, then read the skills they need. The catalog covers local files and installed remote connector skills, preferring connectors for duplicate entries from the same plugin while retaining independently authored local skills. Both HTTP and local DSH models can use these tools.

The default `skillsMode: dsh` replaces Codex's automatic skill catalog injection with these discovery tools. Set `skillsMaxContextTokens` to pass an explicit skill budget to Codex; leave it unset to use the upstream configuration. Metadata is cached by working directory; use `refresh: true` after changing skills or plugins. `skillsMode: native` selects the native catalog. These settings apply to plugin-owned processes and retain existing authentication, connectors, and native tools.

## Token usage panel

The history panel queries official Codex account data when **Query** is clicked. The header shows the returned daily-row total, while a separate value identifies the official lifetime total. The cycle grouping uses dated public reset announcements from [codex-reset.com](https://codex-reset.com/developers/) as reference information.

**Clear** resets the displayed table; **Query** retrieves it again. The panel uses DSH interface primitives and respects the active theme.

## Real Desktop screenshot

![Anonymized real DSH Desktop Token history panel](https://raw.githubusercontent.com/Tests4gptplay/dsh-codex-native/main/docs/screenshots/codex-usage-desktop-anonymized.png)

*User-confirmed alpha.5 Desktop history view, with a fictional account label substituted before publication.* [Screenshot provenance](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/SCREENSHOTS.md) · [Light example](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/screenshots/codex-usage-light.png) · [Dark example](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/screenshots/codex-usage-dark.png)

The market screenshot order is defined in [screenshots.json](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/screenshots.json).

## Verification and engineering notes

The http.7 update passed the build and 16 focused tests, including native file replacement and rollback. On Windows 10 build 19045, the installed recovery tool released the selected helper, reconnected and captured the live DSH window in approximately 0.4 seconds.

The http.6 question update passed **33 focused tests** and the build. Native selection, automatic answer delivery, and visible chat receipts were confirmed in a live DSH session. Both compiled bundles retain the accepted installed runtime bytes.

The http.4 compatibility update passed Windows **209/209** plugin tests and Ubuntu **208 passed / one platform skip**. Final packaged-runtime tests passed **28/28** on both platforms. [Compatibility update CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40190137989).

The alpha.9 candidate passed Windows **191/191** plugin tests and Ubuntu **190 passed / one platform skip**. The final packaged-runtime suite passed **28/28**; the patched DSH host build, fresh installation, authenticated Web startup, and fixed-tag installation passed.

[Candidate CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40124345944) · [Publication CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40148183107) · [Technical audit](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/CONTEXT_COMPACTION_AUDIT.md) · [Account lifecycle repair](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/ACCOUNT_LIFECYCLE_AUDIT.md) · [Transport repair](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/PROTOCOL_STREAM_FIX.md)

## License and attribution

Windows 10 MTA-dispatch patch reference: [chen0416ccc-cpu/codex-windows-fast-patch-skill](https://github.com/chen0416ccc-cpu/codex-windows-fast-patch-skill/blob/main/scripts/patch-computer-use-helper-win10.ps1). The bundled profile adapts the reference regions to the tested @oai/sky 0.7.13 binary.

Community integration based on MIT-licensed [wss534857356/dsh-plugin-codex](https://github.com/wss534857356/dsh-plugin-codex), baseline `f1f61886f4defcf7294d63c3641fba01ee554e7b`. Original attribution is retained in [LICENSE](LICENSE). DeepSeek Harness is developed by DeepSeek; Codex is developed by OpenAI. Public reset-date data is credited to **codex-reset.com**. The ChatGPT icon uses [Lobe Icons](https://github.com/lobehub/lobe-icons) artwork; its MIT license is bundled in `assets/LOBE-ICONS-LICENSE.txt`.

### Bridge boundaries and optional resource budgets

The adapter forwards the Host-selected model and image content; catalog modality metadata is advisory for the Host picker, not an additional admission gate. Model/provider/effort identifiers are opaque nonempty JSON strings, never interpolated into shell commands.

`maxJsonRpcLineBytes` defaults to `0` (no extra adapter frame limit). `maxRequestImageBytes` defaults to `0` (no adapter replacement of historical images). Explicit positive values remain opt-in resource controls; the image budget may replace oldest images with reference text and is not lossless caching. Host attachment validation/normalization and native protocol constraints still apply. Existing explicit custom budgets remain explicit on upgrade.

Native command/file approvals use the composed Host approval service with the real Agent and current turn. Only an offered one-time accept can be granted. Unavailable answerers, unsupported approval protocols, cancellation, and native withdrawal are distinguished from a human rejection. This does not claim that the entire DSH tool-guard pipeline ran for a native operation; native sandbox and permission policy remain in force. No session/permanent approval is fabricated.

## 支持项目 / Support

[GitHub Sponsors](https://github.com/sponsors/Tests4gptplay) · [Ko-fi](https://ko-fi.com/kou392350) · [Patreon](https://www.patreon.com/cw/Kou848) · [爱发电 / Afdian](https://afdian.com/a/kkt_ifd1) · [支付宝 / Alipay](SPONSOR.md)


## 候选7交付

[安装与包校验](test-artifacts/INSTALL.md) · [验收与实机验证要求](docs/testing/ACCEPTANCE.md) · [变更](docs/testing/CHANGES.md)

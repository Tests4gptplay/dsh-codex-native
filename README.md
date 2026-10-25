# DSH Codex Native

**An OpenAI Codex app-server main-model integration for DeepSeek Harness.** Use ChatGPT sign-in, DSH tools, native Codex model settings and an on-demand Token usage history panel.

[简体中文](README.zh.md) · [Releases](https://github.com/Tests4gptplay/dsh-codex-native/releases) · [Installation guide](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/INSTALL.md) · [Release verification](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/STATUS.md)

## Latest release — v0.2.1-alpha.9-http.6

[Release and downloads](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.9-http.6) · [Context accounting details](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/CONTEXT_COMPACTION_AUDIT.md)

- **Native questions and notifications:** Codex questions use DSH's selectable question cards and native notifications, including free-text answers.
- **Automatic chat replies:** submitted answers return to the active task and appear as ordinary user messages, with a single submission and no extra send step.
- **Host version compatibility:** plugin peer dependencies use host-provided DSH modules without version-range gating.
- **Direct HTTP connection:** the OpenAI route uses authenticated HTTP with existing ChatGPT sign-in, reducing reconnect waits after WebSocket interruptions.
- **On-demand skill discovery:** DSH searches local and remote connector skills and reads selected instructions. Startup carries a compact discovery hint, with a 10,000-token skill budget.
- **Session warning deduplication:** identical configuration, deprecation, and ordinary warnings appear once per session; changed notices and errors remain visible.

- **Context management:** Codex manages routine context compaction, with DSH's overflow recovery available for exceptional cases.
- **Accurate usage accounting:** total token consumption is tracked independently from the latest active context-window sample; delayed reports are reconciled with completed responses.
- **Connection stability:** retains the transport recovery and account lifecycle improvements from alpha.6 and alpha.7.
- **Manual Token history:** query account usage, review dated totals and reference periods, and clear the displayed table.
- **Main-model integration:** official Codex app-server, ChatGPT sign-in, DSH tools and model settings.
- **Installed-plugin identity:** ChatGPT authentication-channel icon and bilingual plugin-manager descriptions are included in the installable package.

### Installation

```text
github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.9-http.6
```

In Desktop, open **Plugins → Add plugin**, paste the fixed-version source above, and enable it. For Web:

```sh
dsh plugin --profile web add 'github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.9-http.6'
```

The fixed tag includes prebuilt runtime files. Upgrades retain existing configuration and sign-in. The [installation guide](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/INSTALL.md) covers login and the alternative TGZ package.

## On-demand skill discovery

Version `0.2.1-alpha.9-http.6` provides `codex_skill_search` and `codex_skill_read` through DSH: models search summaries, then read the skills they need. The catalog covers local files and installed remote connector skills, preferring connectors for duplicate entries from the same plugin while retaining independently authored local skills. Both HTTP and local DSH models can use these tools.

The default `skillsMode: dsh` replaces Codex's automatic skill catalog injection with these discovery tools. `skillsMaxContextTokens: 10000` selects the maximum native budget. Metadata is cached by working directory; use `refresh: true` after changing skills or plugins. `skillsMode: native` selects the native catalog. These settings apply to plugin-owned processes and retain existing authentication, connectors, and native tools.

## Token usage panel

The history panel queries official Codex account data when **Query** is clicked. The header shows the returned daily-row total, while a separate value identifies the official lifetime total. The cycle grouping uses dated public reset announcements from [codex-reset.com](https://codex-reset.com/developers/) as reference information.

**Clear** resets the displayed table; **Query** retrieves it again. The panel uses DSH interface primitives and respects the active theme.

## Real Desktop screenshot

![Anonymized real DSH Desktop Token history panel](https://raw.githubusercontent.com/Tests4gptplay/dsh-codex-native/main/docs/screenshots/codex-usage-desktop-anonymized.png)

*User-confirmed alpha.5 Desktop history view, with a fictional account label substituted before publication.* [Screenshot provenance](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/SCREENSHOTS.md) · [Light example](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/screenshots/codex-usage-light.png) · [Dark example](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/screenshots/codex-usage-dark.png)

The market screenshot order is defined in [screenshots.json](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/screenshots.json).

## Verification and engineering notes

The http.6 question update passed **33 focused tests** and the build. Native selection, automatic answer delivery, and visible chat receipts were confirmed in a live DSH session. Both compiled bundles retain the accepted installed runtime bytes.

The http.4 compatibility update passed Windows **209/209** plugin tests and Ubuntu **208 passed / one platform skip**. Final packaged-runtime tests passed **28/28** on both platforms. [Compatibility update CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40190137989).

The alpha.9 candidate passed Windows **191/191** plugin tests and Ubuntu **190 passed / one platform skip**. The final packaged-runtime suite passed **28/28**; the patched DSH host build, fresh installation, authenticated Web startup, and fixed-tag installation passed.

[Candidate CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40124345944) · [Publication CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40148183107) · [Technical audit](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/CONTEXT_COMPACTION_AUDIT.md) · [Account lifecycle repair](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/ACCOUNT_LIFECYCLE_AUDIT.md) · [Transport repair](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/PROTOCOL_STREAM_FIX.md)

## License and attribution

Community integration based on MIT-licensed [wss534857356/dsh-plugin-codex](https://github.com/wss534857356/dsh-plugin-codex), baseline `f1f61886f4defcf7294d63c3641fba01ee554e7b`. Original attribution is retained in [LICENSE](LICENSE). DeepSeek Harness is developed by DeepSeek; Codex is developed by OpenAI. Public reset-date data is credited to **codex-reset.com**. The ChatGPT icon uses [Lobe Icons](https://github.com/lobehub/lobe-icons) artwork; its MIT license is bundled in `assets/LOBE-ICONS-LICENSE.txt`.

# DSH Codex Native

**An OpenAI Codex app-server main-model integration for DeepSeek Harness.** Use ChatGPT sign-in, DSH tools, native Codex model settings and an on-demand Token usage history panel.

[简体中文](README.zh.md) · [Releases](https://github.com/Tests4gptplay/dsh-codex-native/releases) · [Installation guide](docs/INSTALL_PATCHED_HOST.md) · [Release verification](docs/STATUS.md)

## Latest release — v0.2.1-alpha.9

[Download alpha.9](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.9) · [Context accounting details](docs/CONTEXT_COMPACTION_AUDIT.md)

- **Context management:** Codex manages routine context compaction, with DSH's overflow recovery available for exceptional cases.
- **Accurate usage accounting:** total token consumption is tracked independently from the latest active context-window sample; delayed reports are reconciled with completed responses.
- **Connection stability:** retains the transport recovery and account lifecycle improvements from alpha.6 and alpha.7.
- **Manual Token history:** query account usage, review dated totals and reference periods, and clear the displayed table.
- **Main-model integration:** official Codex app-server, ChatGPT sign-in, DSH tools and model settings.
- **Installed-plugin identity:** ChatGPT authentication-channel icon and bilingual plugin-manager descriptions are included in the installable package.

### Installation

```text
github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.9
```

The release provides the prebuilt plugin package and the companion DSH rc.2 host integration patch. [Build and installation steps](docs/INSTALL_PATCHED_HOST.md) cover the tested host configuration, including DSH `0.2.1-rc.2` and Codex `0.154.0`.

## Token usage panel

The history panel queries official Codex account data when **Query** is clicked. The header shows the returned daily-row total, while a separate value identifies the official lifetime total. The cycle grouping uses dated public reset announcements from [codex-reset.com](https://codex-reset.com/developers/) as reference information.

**Clear** resets the displayed table; **Query** retrieves it again. The panel uses DSH interface primitives and respects the active theme.

## Real Desktop screenshot

![Anonymized real DSH Desktop Token history panel](docs/screenshots/codex-usage-desktop-anonymized.png)

*User-confirmed alpha.5 Desktop history view, with a fictional account label substituted before publication.* [Screenshot provenance](docs/SCREENSHOTS.md) · [Light example](docs/screenshots/codex-usage-light.png) · [Dark example](docs/screenshots/codex-usage-dark.png)

The market screenshot order is defined in [screenshots.json](screenshots.json).

## Verification and engineering notes

The alpha.9 candidate passed Windows **191/191** plugin tests and Ubuntu **190 passed / one platform skip**. The final packaged-runtime suite passed **28/28**; the patched DSH host build, fresh installation, authenticated Web startup, and fixed-tag installation passed.

[Candidate CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40124345944) · [Publication CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40148183107) · [Technical audit](docs/CONTEXT_COMPACTION_AUDIT.md) · [Account lifecycle repair](docs/ACCOUNT_LIFECYCLE_AUDIT.md) · [Transport repair](docs/PROTOCOL_STREAM_FIX.md)

## License and attribution

Community integration based on MIT-licensed [wss534857356/dsh-plugin-codex](https://github.com/wss534857356/dsh-plugin-codex), baseline `f1f61886f4defcf7294d63c3641fba01ee554e7b`. Original attribution is retained in [LICENSE](LICENSE). DeepSeek Harness is developed by DeepSeek; Codex is developed by OpenAI. Public reset-date data is credited to **codex-reset.com**. The ChatGPT icon uses [Lobe Icons](https://github.com/lobehub/lobe-icons) artwork; its MIT license is bundled in `assets/LOBE-ICONS-LICENSE.txt`.

# DSH Codex Native

**DeepSeek Harness main-model adapter using the official OpenAI Codex app-server** · Independent community project · MIT

[简体中文](README.zh.md) · [Release status and evidence](docs/STATUS.md) · [Usage rules](docs/USAGE.md) · [Protocol repair](docs/PROTOCOL_STREAM_FIX.md)

## Current preview: v0.2.1-alpha.6

2026-10-24 JST: fixes confirmed local protocol lifecycle defects following a report of `Codex App Server closed its protocol stream`. Targets **DSH 0.2.1-rc.2**, official **Codex 0.154.0**. The original initiating process-exit cause remains unproven; this message alone does not establish an OpenAI cloud outage.

### DSH Desktop installation

Open **Plugins → Add plugin** and paste:

```text
github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.6
```

Enable the plugin and fully quit and reopen DSH. Use **Settings → Codex official login** with a ChatGPT account that has Codex access, and select `codex-local` as the main-model provider. An `openai-codex` provider is a different integration.

No npm account, separate API key, local source checkout, TypeScript build or `allowBuilds` exception is required. Install the fixed tag, not `main` or a development branch. Existing sign-in files are not deleted by this repair.

```bash
dsh plugin --profile web add 'github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.6'
```

The Web and Desktop profiles are separate. [Release](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.6) · [Prebuilt TGZ](https://github.com/Tests4gptplay/dsh-codex-native/releases/download/v0.2.1-alpha.6/dsh-codex-native-0.2.1-alpha.6.tgz)

## alpha.6 repair

Closed protocol pipes now settle backpressured requests instead of leaving them waiting indefinitely. Errors preserve local exit code/signal and bounded stderr, with common credential shapes masked; exits first observed during cleanup are labelled rather than presented as the initiating cause. Account startup rejection is observed even without a stdout event.

An already-closed cached thread is rebuilt on the next request from recorded history, including existing tool outputs. This does not add automatic replay of an in-flight turn or rerun an already-recorded tool itself. No heartbeat, watchdog, reconnect poller or new hard model-task limit is added. Existing host retries, cancellation and model policies are unchanged.

## Usage history — manual, not a background meter

Only **Query** requests history. One toolbar contains **Clear**, **Query** and the listed total. Folded periods retain their totals; expanded periods show daily counts. The controls use host-owned DSH `Button`, `DisclosureRow` and `--dsw-*` variables. The browser bundle is unchanged from alpha.5.

Tokens come from official `account/usage/read` and are account-wide, not plugin-only. Listed total sums returned daily rows; lifetime total is separately labelled. Missing values are not treated as zero.

Official `account/rateLimits/read` supplies current windows and next reset timestamps, not a complete reset ledger. Historical grouping references **Data: codex-reset.com** public announcements by UTC date. It is reference-only, not proof of private account boundaries; no intraday fractions are invented. The public request receives no credentials, account identity, prompts or usage. Source failure does not stop model execution.

Clear empties only this view. It does not delete official history, conversations or credentials, or redeem reset credits. Query restores the official data. These notes also appear below the table.

## User-confirmed UI (alpha.5)

The user confirmed manual history querying in their DSH Desktop and skin and approved this capture. It does not certify alpha.6 on their machine.

![User-confirmed Desktop history with a fictional account label](docs/screenshots/codex-usage-desktop-anonymized.png)

*Only the account row was replaced with `GPT-Codex@OpenAI.com`, a fictional placeholder, not an actual OpenAI account. Other pixels, dates and usage values are unchanged; this is not an AI-redrawn interface.*

[Light sample](docs/screenshots/codex-usage-light.png) · [Dark sample](docs/screenshots/codex-usage-dark.png) · [Provenance](docs/SCREENSHOTS.md)

## Verification and boundaries

[Ubuntu/Windows regressions](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39996592077) and [release / exact Git installation](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39997058708) passed. The downloaded tested runtime matches the published tag's JS blobs. Tests include a real isolated subprocess exit through the official DSH runtime, without user credentials or model quota.

The installer contains compiled runtime, declarations, patch, metadata, license and READMEs only: no source, tests, mock process, CI, screenshots, install scripts or devDependencies. Dependencies still use normal disk space. Existing native Codex approval/elicitation limitations remain. Full Electron/skin compatibility and the initiating user-machine failure are not proven by cloud tests. [Detailed evidence](docs/STATUS.md).

## Attribution

Adapted from MIT-licensed [wss534857356/dsh-plugin-codex](https://github.com/wss534857356/dsh-plugin-codex), import baseline `f1f61886f4defcf7294d63c3641fba01ee554e7b`. Original LICENSE retained. DSH is from DeepSeek and Codex is from OpenAI; this community plugin is not endorsed by either. Public reset data is credited to **codex-reset.com**.

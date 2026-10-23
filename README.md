# DSH Codex Native

**DeepSeek Harness main-model adapter using the official OpenAI Codex app-server** · Independent community project · MIT

[简体中文](README.zh.md) · [Status](docs/STATUS.md) · [Usage contract](docs/USAGE.md) · [Delivery verification](docs/DELIVERY-alpha5.md)

## Current preview: v0.2.1-alpha.5

2026-10-23: manual account history and native DSH settings controls are implemented and available in the fixed installation tag. Targets **DSH 0.2.1-rc.2**, official **Codex 0.154.0**. Hosted regressions and installation checks passed. Real-account history availability and every Desktop/skin combination have not been exercised with user credentials.

### DSH Desktop

Open **Plugins → Add plugin** and paste:

```text
github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.5
```

Enable the plugin and fully restart DSH. Open **Settings → Codex official login**, sign in with a ChatGPT account that has Codex access, and select the `codex-local` main-model provider. A provider called `openai-codex` belongs to a different integration.

No npm account, separate OpenAI API key, development checkout or local TypeScript compilation is needed. Do not relax `allowBuilds`. Install the fixed tag, not the development branch or `main`.

### Web CLI

```bash
dsh plugin --profile web add 'github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.5'
```

The `web` and `desktop` profiles are separate.

[GitHub Release](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.5) · [Prebuilt TGZ](https://github.com/Tests4gptplay/dsh-codex-native/releases/download/v0.2.1-alpha.5/dsh-codex-native-0.2.1-alpha.5.tgz)

## Usage history — manual, not a background meter

Only clicking **Query** requests usage history. A single top toolbar contains **Clear**, **Query**, and the listed total. Each collapsible period retains its total while folded and shows daily rows when expanded. Account and usage controls use the actual host-owned DSH `Button`, `DisclosureRow`, and `--dsw-*` theme variables, without bundling another control stylesheet.

- **Tokens:** official Codex `account/usage/read`, account-wide rather than plugin-only. Listed total sums returned daily rows; the separately labelled lifetime total can differ. Missing values are not converted to zero.
- **Reset grouping:** official `account/rateLimits/read` supplies current windows and next reset timestamps, not a full historical reset ledger. Historical groups use [codex-reset.com](https://codex-reset.com/) public announcements by UTC date. **Reference only:** not proof of individual-account boundaries; no invented intraday division of daily totals.
- **Clear:** clears the displayed result/total only. It does not delete official history, conversations or credentials, and does not redeem reset credits. Query retrieves the official history again.

These source and limitation notes appear directly below the table. No usage poller, chat metering hook or extra model turn is added. The separate public GET sends no credentials, account identity, prompts or usage to the reference site. Reference-source failure does not discard returned official tokens or stop the Agent.

## User-confirmed Desktop result (2026-10-23)

The user confirmed that alpha.5's manual account-history query works in their DSH Desktop installation and current skin, and approved this screenshot for publication.

![User-confirmed alpha.5 Desktop usage history with a fictional account label](docs/screenshots/codex-usage-desktop-anonymized.png)

*Only the account row was replaced with `GPT-Codex@OpenAI.com`, a fictional display placeholder, not an actual OpenAI account. Original dimensions, other UI pixels, dates and token values are unchanged. This is not an AI-redrawn interface. Reference periods do not certify personal account reset timestamps.*

This confirms this user's observed environment, not all accounts, skins or native-tool paths. Development-only light/dark examples below remain explicitly labelled as samples.

![Actual official DSH controls, sample usage data](docs/screenshots/codex-usage-light.png)

*Original component preview using sample data, not a signed-in account screenshot.* [Dark preview](docs/screenshots/codex-usage-dark.png) · [Provenance](docs/SCREENSHOTS.md)

## Verification and remaining boundaries

[Cross-platform regressions](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39959031468), [branch recheck](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39961943894), and [release/actual Git-tag installation](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39959807125) passed. The downloaded branch build's server/client JS blobs exactly match the published alpha.5 tag.

The installation snapshot contains only compiled runtime, declarations, metadata, patch, license and READMEs. No source, tests, mock backend, screenshots, CI, build scripts or devDependencies are shipped. Runtime dependencies still need disk space; source-repository tests do not run when the installed plugin starts.

Official account history can be unavailable or delayed. Native Codex approval/elicitation bridging remains an earlier limitation, not a feature changed by this report. The alpha.4 standard-content and direct Windows-launch fixes are retained; already stored custom history blocks are not rewritten.

## Attribution

Adapted from MIT-licensed [wss534857356/dsh-plugin-codex](https://github.com/wss534857356/dsh-plugin-codex), import baseline `f1f61886f4defcf7294d63c3641fba01ee554e7b`. Original LICENSE retained. DSH is from DeepSeek and Codex is from OpenAI; this community integration is not endorsed by either. Public reset data: **Data: codex-reset.com**, with on-surface credit and documented read-only API usage.

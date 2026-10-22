# DSH Codex Native

**A DeepSeek Harness main-model plugin using the official OpenAI Codex app-server** · Independent community project · MIT

> **Development preview: 0.2.1-alpha.0.** Porting to DSH `0.2.1-rc.2` is in progress. Typecheck, all 124 account-free unit tests and hosted packaging have passed; actual DSH installation, OAuth login and subscribed-model E2E have **not yet been verified**. **Do not treat this as a stable release.** [Current CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/workflows/ci.yml).

[简体中文](README.zh.md) · [Development status](docs/STATUS.md) · [Screenshot provenance](docs/SCREENSHOTS.md)

## What this plugin does

The plugin registers the **official OpenAI Codex app-server** as DSH's `codex-local` **main LLM provider**. Unlike the built-in one-shot Codex subagent, DSH retains its Agent Loop, tool scheduling, and durable session history. Model inference uses the native app-server protocol from `@openai/codex@0.154.0`.

- **No separate OpenAI API key**: Use ChatGPT sign-in managed by Codex itself, which owns and refreshes its OAuth credentials. Inference consumes applicable Codex/ChatGPT plan allowances, **not** unlimited free usage or ordinary Chat-message allowances.
- **Selectable main model**: Route normal multi-turn DSH conversations to `codex-local`.
- **In-app native sign-in (under validation)**: A DSH Settings section has been implemented for browser/device-code sign-in, account status, sign-out and native Codex usage lookup. The frontend never receives OAuth tokens.
- **Native DSH tools**: Codex app-server Dynamic Tools are passed back through DSH's tool loop and permissions. Codex still owns additional native instruction/tool layers; this is not a raw model API.
- **Conversation and images**: The upstream session cache, streaming, and image mapping have been carried forward and still require full validation under the current DSH host.

## Sign-in flow

```text
DSH Settings → Codex official login
    ├─ Sign in with ChatGPT → official OpenAI authorization page
    └─ Device code → official verification page + user code
                          ↓
            Codex app-server owns credentials
                          ↓
             Select codex-local in DSH
```

The plugin uses the official `account/read`, `account/login/start`, `account/login/completed`, `account/logout`, and `account/rateLimits/read` protocol operations. The Codex process handles the browser callback; device-code login is available for a remote host. It does not request your API key or use a community plugin's direct non-public ChatGPT backend route.

**Implementation is not the same as successful integration testing.** The real DSH + ChatGPT account sign-in flow is not yet verified. Reference: [OpenAI official app-server documentation](https://developers.openai.com/codex/app-server/).

## Installation (development stage)

The repository contains the source and CI validation workflow; **no stable installer has been released**. Installing from a GitHub source spec may cause DSH to build dependencies locally. You need not keep a separate development checkout, but the installed plugin and Codex runtime still require some disk space.

Target installation command, **only after successful release validation**:

```bash
dsh plugin --profile web add github:Tests4gptplay/dsh-codex-native
```

Prefer a reviewed commit/tag for repeatable installs. Restart DSH as requested, sign in through Settings, and choose `codex-local` in the main model picker. **Do not run this command yet as a production installation instruction.**

[Successful hosted build and 124-unit-test run](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39786235347) · [Candidate tarball in the run's CI artifacts](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39786235347). **This is a build artifact, not a production-certified plugin release.**

## Implementation and test status

| Capability | Status |
|---|---|
| MIT upstream imported into independent public repository | Completed |
| Native `@openai/codex` app-server main-model adapter | Ported in code |
| DSH 0.2.1 tool-message and stream type adaptation | Typecheck + 124 account-free tests passed; real Codex E2E excluded |
| Official browser/device-code sign-in Settings UI | Implemented; real-host verification pending |
| Native Codex quota reading | Implemented; live verification pending |
| Live multi-turn Codex, real DSH installation, Windows host | Not verified |
| Stable installable release | Not published |

See [docs/STATUS.md](docs/STATUS.md) for the actual CI record and known blockers.

## Original screenshots only

All inherited upstream screenshots were removed. This **English-language, unauthenticated screenshot** is rendered from the current `CodexNativeSection.tsx` component by our [GitHub-hosted capture workflow](https://github.com/Tests4gptplay/dsh-codex-native/actions/workflows/docs-preview.yml). The welcome text explicitly directs users to sign in with a **ChatGPT account that has Codex access**, not a separate OpenAI API key.

![Welcome to Codex—sign in with a ChatGPT account that has Codex access (English component preview)](docs/screenshots/codex-native-login-en.png)

*Original component preview. The navigation is an illustrative shell, **not a running DSH application or a verified OAuth login**.*

Reproduction and real-host acceptance requirements: [docs/SCREENSHOTS.md](docs/SCREENSHOTS.md).

## Architectural boundary

This plugin uses the **OpenAI-published `codex app-server`**. DSH owns durable history, permissions, and tool execution; Codex can still add its own system context and native tools. This is an intentional layered model, documented in the upstream [ADR 0002](docs/adr/0002-use-app-server-as-a-layered-codex-provider.md). The plugin is **not an official OpenAI or DeepSeek release**.

## Attribution and license

Adapted from the MIT-licensed [wss534857356/dsh-plugin-codex](https://github.com/wss534857356/dsh-plugin-codex), pinned to upstream commit `f1f61886f4defcf7294d63c3641fba01ee554e7b`. The original LICENSE and historical ADRs are retained for attribution. The official Codex runtime is from OpenAI and DSH is from DeepSeek; neither project endorses this community integration.

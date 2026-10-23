# DSH Codex Native

**A DeepSeek Harness main-model plugin using the official OpenAI Codex app-server** · Independent community project · MIT

> **Published test preview: 0.2.1-alpha.3.** Targets DSH 0.2.1-rc.2. Typecheck, 117 account-free unit tests, hosted Linux/Windows DSH Web Profile loading and direct Git installation without allowBuilds overrides passed. **Real ChatGPT account sign-in, Desktop Electron integration and Codex-native approvals remain unverified.** [Release CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39879247613).

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

## One-line GitHub installation (v0.2.1-alpha.3 alpha)

In DSH Desktop open **Plugins → Add plugin**, paste:

```text
github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.3
```

Enable and restart DSH. Open **Settings → Codex official login**, sign in with a ChatGPT account that has Codex access, and select the `codex-local` main-model provider.

**The GitHub tag is a 22-file precompiled runtime snapshot.** It has no source files, unit tests, CI, build scripts, dev dependencies or legacy UI. It does not require an `allowBuilds` exception or local TypeScript build.

[Release](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.3) · [Linux/Windows DSH profile CI and clean Git install](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39879247613) · [Audit](docs/AUDIT.md)

**Alpha only:** The Windows DSH Web profile configuration loaded in a disposable runner. Actual Electron Desktop sign-in, live subscribed inference and native approval interactions have not yet been verified.

## Implementation and test status

| Capability | Status |
|---|---|
| MIT upstream imported into independent public repository | Completed |
| Native `@openai/codex` app-server main-model adapter | Ported in code |
| DSH 0.2.1 tool-message and stream type adaptation | Typecheck + 117 account-free tests passed; real Codex E2E excluded |
| Official browser/device-code sign-in Settings UI | Implemented; real-host verification pending |
| Native Codex quota reading | Implemented; live verification pending |
| Live multi-turn Codex, real DSH installation, Windows host | Not verified |
| GitHub testing prerelease | `v0.2.1-alpha.3`; minimal tag / Linux and Windows Web Profile checks passed; real account/Electron not verified |

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

# DSH Codex Native

A community DeepSeek Harness main-model adapter using the **official OpenAI Codex app-server** and its native ChatGPT login. Not an official OpenAI/DeepSeek product.

**Test preview v0.2.1-alpha.4, targeting DSH 0.2.1-rc.2.** Fixes new-message unknown content blocks and the Windows wrapper's extra console-spawning layer. Live subscribed inference and complete Electron Desktop behavior are not certified.

[中文](README.zh.md) · [Reproduction](docs/REPRODUCTION.md) · [Status](docs/STATUS.md) · [Audit](docs/AUDIT.md)

## Desktop GitHub installation

Open **Plugins → Add plugin**, paste:

```text
github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.4
```

Enable, **fully exit and restart DSH**, then open **Settings → Codex official login**. Sign in with a ChatGPT account with Codex access and select **codex-local / Codex (local login)** in the main model picker.

No npm account or separate API key is required. Usage is charged to the applicable Codex plan allowance, not ordinary Chat-message allowances or unlimited free usage. Installed runtime dependencies still consume disk space; no source checkout or local TypeScript build is needed.

[Release](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.4) · [Prebuilt TGZ](https://github.com/Tests4gptplay/dsh-codex-native/releases/download/v0.2.1-alpha.4/dsh-codex-native-0.2.1-alpha.4.tgz)

### Web CLI

```bash
dsh plugin --profile web add 'github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.4'
```

Web and Desktop profiles are separate. Use the frozen release tag, not the source-only main branch.

## Changes in alpha.4

**Unknown content:** The prior cleanup removed the custom UI renderer while continuing to emit `codex-action` blocks. Official DSH treated them as unknown JSON. A narrow presentation boundary now drops private lifecycle/empty diagnostic chat blocks, maps meaningful native action notices to standard text, and preserves answers, reasoning, DSH tool calls, actual errors and replay state.

**Windows launch:** The fixed Codex JS wrapper spawns its native binary without a Windows visibility flag. Only plugin-owned Windows login/model launches now bypass that second spawn and start the official packaged executable directly through DSH's existing process manager. No global patch, arbitrary process termination or extra watchdog is introduced.

**Historical messages are not rewritten.** Previously persisted custom blocks may still appear in old messages. The fix applies to new replies after upgrade/restart; it does not erase chat history.

## Verification and package boundary

[Cross-platform regression run](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39947758087): Linux 126 passed with the Windows-only case skipped; Windows 127 passed. Official DSH source is pinned to `687f282e8625c6b8d11ff58211a90524be2e4317`.

Tests use an actual local stdio child process as a fake Codex peer, the reported lifecycle/moderation notifications, official DSH `AssistantMarkdown` rendering logic, tool/reasoning/replay preservation, genuine failure propagation, and a real no-account native Codex initialize/account-read on Windows. The renderer test substitutes leaf widgets but **not the official unknown-block decision**; it is not a full Desktop screenshot test.

The release tag contains **25 runtime files** and no mock server, tests, source, CI, development dependencies, or install/build scripts. [Release and exact Git-tag installation check](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39948312538).

## Known limits

- Static model-menu entries are not proof of account eligibility. Codex determines supported models.
- This plugin's provider is `codex-local`, not `openai-codex`; old conversations can retain a different provider.
- Windows binary startup/JSON-RPC was tested, but hosted CI does not establish visual console behavior in a user's Electron Desktop session.
- Some native Codex approvals/elicitation are not fully bridged to DSH's interactive UI. DSH dynamic tools retain their own execution path.
- No real OAuth account or private credentials were used for the mock tests.

## Original UI preview

![Unauthenticated isolated login component](docs/screenshots/codex-native-login-en.png)

Generated from this repository's React login component, not copied from upstream and not a real signed-in Desktop session. [Provenance](docs/SCREENSHOTS.md).

## Attribution

Based on MIT-licensed [wss534857356/dsh-plugin-codex](https://github.com/wss534857356/dsh-plugin-codex), baseline `f1f61886f4defcf7294d63c3641fba01ee554e7b`. LICENSE retained. Official runtime: `@openai/codex@0.154.0`. Framework: DeepSeek Harness.

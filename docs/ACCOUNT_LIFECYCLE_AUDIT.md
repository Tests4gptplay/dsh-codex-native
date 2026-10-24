# Account lifecycle repair — alpha.7 / 账号生命周期修复

**Date:** 2026-10-24 JST · [Release](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.7)

## Reproduction environment

The tests ran in isolated GitHub-hosted Ubuntu and Windows workspaces, with real Cordis Context, official `@deepseek-ai/dsh-subprocess-local 0.2.1-rc.2` and real child processes. Controlled Codex protocol peers reproduced delayed initialization, status queries and cancellation.

Baseline: `718356eb00fde0d7a6002ebcdbe13df5f81e56f8`. The test baseline `f9d2122420546851fd261dd4bd95522363da2537` reproduced six failures on both platforms. [Baseline CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40047676806)

Repair: `e434e5fc57fd647fac7332c6304e6515cd11c5bd`. The same eight assertions, existing tests, typecheck, build and pack passed on both platforms. [Repair CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40048042517)

## Reproduced cases

| Case | Alpha.6 baseline | Alpha.7 |
|---|---|---|
| Pending account initialization followed by service disposal | Pending request | Settled; owned child exits |
| Pending account status read followed by disposal | Pending request | Settled; owned child exits |
| Pending quota read followed by disposal | Pending request | Settled; owned child exits |
| Pending usage read followed by disposal | Pending request | Settled; owned child exits |
| Login cancel with delayed acknowledgement | Pending cancel | Cancel returns; login child exits |
| Pending device login initialization followed by disposal | Pending start | Request settles; child released |
| Normal account read | Passed | Passed |
| Active model turn across accelerated idle threshold | Passed | Passed |

Two underlying changes resolve these cases: account connections are registered before initialization begins, and explicit login cancellation releases its connection promptly after recording cancellation state.

## Production change

`src/native-account.ts`: 18 added and 11 removed lines. Account-owned connection tracking covers initialization and queries; service disposal closes these connections. Cancellation sends a best-effort protocol message and completes locally.

The six-second account process teardown grace and existing model runner remain part of the runtime. The accelerated idle-cache control uses a 20 ms threshold and 180 ms fixture reply.

## Build and artifact identity

| Runtime file | Bytes | Git blob SHA-1 |
|---|---:|---|
| `lib/index.js` | 125,240 | `b43ab035cd141d1459123b3412c4f36c085a5d80` |
| `lib/client.js` | 25,925 | `ba4fd9fbaba03f81fa4e4beb24901ae4083716d8` |
| `cordis.patch.yml` | 2,304 | `135a27ce43c9be6350ec495502f6645208569c12` |

Inspected artifact: `12542246673`. Test files: `tests/account-lifecycle-integration.spec.ts` and `tests/fixtures/account-lifecycle.mjs`.

[Published release status](STATUS.md) · [Transport investigation](PROTOCOL_STREAM_FIX.md)

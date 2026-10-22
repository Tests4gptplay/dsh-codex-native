# Development and verification status / 开发及验收状态

Updated: 2026-10-22 · Target: **DSH 0.2.1-rc.2** · Plugin: **0.2.1-alpha.1**

## Authoritative status

**Development alpha, not a stable release.** Hosted CI has successfully completed typecheck, 124 account-free unit tests in 14 test files, plugin build and .tgz packaging, but those tests explicitly excluded `tests/real-codex.e2e.ts`. This is **not** proof of a live ChatGPT authentication, working DSH installation, or a real DSH Desktop integration.

| Layer | Current evidence | Acceptance |
|---|---|---|
| Public source | [Tests4gptplay/dsh-codex-native](https://github.com/Tests4gptplay/dsh-codex-native), MIT upstream pinned import | Source available |
| Official transport | `@openai/codex@0.154.0`, native `app-server --stdio`, `src/runner.ts` | Existing upstream implementation ported |
| DSH main-model bridge | `src/adapter.ts`, `ctx.llm.registerAdapter` | TypeScript source typecheck has passed in CI |
| DSH 0.2 tool messages | `src/protocol.ts` and migrated fixtures | Protocol suite has run, tests migrated |
| Native account bridge | `src/native-account.ts`, `src/native-transport.ts` | Implemented; tests written, no actual OAuth sign-in observed |
| DSH settings login UI | `src/client/CodexNativeSection.tsx` | Component-level preview only; DSH Host still unverified |
| Hosted CI | [Successful run #39786235347](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39786235347) | **PASS**: typecheck, 124 unit tests / 14 files, build and .tgz package; real-account E2E excluded |
| Package artifact | [Run #39786235347 artifacts](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39786235347) | `dsh-codex-native-0.2.1-alpha.0.tgz` generated on disposable Linux Runner; **not installed in real DSH** |
| Model/account entitlement | Real account & model response | **Not tested** |
| DSH installation / Windows | Isolated DSH Web/Desktop with installed .tgz | **Not tested** |


## Verified GitHub install fix in v0.2.1-alpha.1

- [Published GitHub prerelease](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.1): immutable tag `v0.2.1-alpha.1` → commit `daaca2987135fdd82b0c521076cdf5beb2bc5df6`.
- [Release workflow #39789788735 PASS](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39789788735): typecheck, 124 account-free unit tests, build, packaged JS/declarations, tag source inclusion, **`pnpm add github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.1` in a clean isolated consumer with `autoInstallPeers:false` and no `allowBuilds` override**, and successful GitHub prerelease upload.
- Installed package contained `lib/index.js` and `lib/client.js`, and had no `prepare` lifecycle script. The previous alpha.0 tag remains unmodified.
- **Not yet validated:** real DSH Desktop plugin-manager installation, Windows Codex login and subscribed model/tool execution.

### Root cause and implementation

- User reproduced `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED` installing `v0.2.1-alpha.0` in the DSH Desktop profile.
- Root cause: the tagged Git repository had `scripts.prepare = "pnpm run build"` and no checked-in `lib/` files, so pnpm tried to run a build that was not approved by the DSH profile's `allowBuilds`.
- `v0.2.1-alpha.1` fixes the package manifest by removing the `prepare` script and uses a release-only commit containing the checked-in, CI-built JavaScript and declaration files.
- Publishing is gated on an actual `pnpm add github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.1` in an isolated consumer without relaxing its build policy. **This is an install-path smoke, not a real Desktop/Codex sign-in test.**
- [Release workflow](https://github.com/Tests4gptplay/dsh-codex-native/actions/workflows/release-preview.yml).

## Previous published testing prerelease

- **GitHub tag:** [`v0.2.1-alpha.0`](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.0), pointing to commit `131b82ec9e013a71041df00eafd771f274a96c55`.
- **Release workflow:** [run #39788765405 — success](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39788765405). The tagged source passed hosted typecheck, account-free unit tests, production build, package structure checks and prerelease upload.
- **Distribution:** `dsh-codex-native-0.2.1-alpha.0.tgz` [download](https://github.com/Tests4gptplay/dsh-codex-native/releases/download/v0.2.1-alpha.0/dsh-codex-native-0.2.1-alpha.0.tgz).
- **DSH Desktop testing package spec:** `github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.0`.
- **Still unverified:** real DSH desktop installation, official native account sign-in, live subscribed model request and DSH tool round-trip. This prerelease is **for user testing, not stable production**.

## Release-blocking acceptance criteria

- **Completed in hosted CI**: Typecheck, account-free unit tests (124/124), plugin build, .tgz candidate generation. Freeze a reviewed commit for actual installation testing.
- Install the packed plugin in an **isolated** DSH 0.2.1 Host and ensure it is enabled and appears in the main model selector.
- Verify the app-server native browser login and device-code login paths; never export token data to browser storage or screenshots.
- Make one real subscribed Codex multi-turn conversation, one DSH tool round-trip, one cancellation/recovery flow, and one requested attachment/modality check.
- Ensure the same version has accurate Chinese/English README, original screenshot provenance, and exact installation/removal steps.

## Important constraints

- Work happens in a disposable GitHub-hosted or ChatGPT temporary workspace; no DSH source checkout is kept on the user's Windows computer.
- Do not copy old screenshots or imply a simulated UI has a real account connected.
- This plugin is not a replacement for ChatGPT ordinary Chat message entitlements. Actual permitted models and usage are determined by the subscribed Codex account.
- Installing a plugin or the official Codex runtime **does** consume some local disk space, even if the development workspace stays entirely remote.
- Historical upstream ADRs under `docs/adr/` describe architecture background for previous DSH/Codex versions. They are not independent acceptance of this fork's DSH 0.2.1 behavior.

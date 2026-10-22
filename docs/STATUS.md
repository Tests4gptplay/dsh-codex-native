# Development and verification status / 开发及验收状态

Updated: 2026-10-22 · Target: **DSH 0.2.1-rc.2** · Plugin: **0.2.1-alpha.0**

## Authoritative status

**Development alpha, not a stable release.** The README describes implemented source separately from validated capabilities. A completed GitHub workflow job is not proof of a live ChatGPT authentication or a real DSH Desktop installation.

| Layer | Current evidence | Acceptance |
|---|---|---|
| Public source | [Tests4gptplay/dsh-codex-native](https://github.com/Tests4gptplay/dsh-codex-native), MIT upstream pinned import | Source available |
| Official transport | `@openai/codex@0.154.0`, native `app-server --stdio`, `src/runner.ts` | Existing upstream implementation ported |
| DSH main-model bridge | `src/adapter.ts`, `ctx.llm.registerAdapter` | TypeScript source typecheck has passed in CI |
| DSH 0.2 tool messages | `src/protocol.ts` and migrated fixtures | Protocol suite has run, tests migrated |
| Native account bridge | `src/native-account.ts`, `src/native-transport.ts` | Implemented; tests written, no actual OAuth sign-in observed |
| DSH settings login UI | `src/client/CodexNativeSection.tsx` | Component-level preview only; DSH Host still unverified |
| Hosted CI | [Actions workflow](https://github.com/Tests4gptplay/dsh-codex-native/actions/workflows/ci.yml) | **Not yet green** as of this update |
| Test evidence | [CI #39781966899](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39781966899) | 117 unit tests passed; one suite could not import an unpublished transitive DSH dev dependency; this is **not** a passing test run |
| Model/account entitlement | Real account & model response | **Not tested** |
| DSH installation / Windows | Isolated DSH Web/Desktop with installed .tgz | **Not tested** |

## Release-blocking acceptance criteria

- Green typecheck, unit tests and plugin package build on a frozen revision.
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

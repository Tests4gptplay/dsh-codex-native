# alpha.5 delivery recheck — 2026-10-23

## Fixed installer

```text
github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.5
```

[Release](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.5). Asset: `dsh-codex-native-0.2.1-alpha.5.tgz`, **49,651 bytes**, GitHub-reported SHA-256 `a2fa8cae881e6d166a0615a317ef93c1a84802b452df6519fdfe50924bf65c7c`. The asset already existed before this audit; it was not overwritten. The asset digest is reported by GitHub, not a claim of independently downloading its bytes in this round.

## Evidence chain

1. Original tested source: `de9f3b766a5bbc9d03f2846186c8f1f8eee6424a`, [CI 39959031468](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39959031468).
2. Publication: [39959807125](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39959807125), job **120434651081**, all steps success: verify Linux/Windows tests, consume tested artifact, strip manifest/build payload, DSH profile install/composition, create runtime tag, exact Git-tag installation with no build exception, upload release.
3. Saved feature branch retest: [39961943894](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39961943894), source `291ce24fef48db4d30676d2e0048178db7574b55`, both OS jobs passed.
4. Artifact **12504514277** (`codex-reproduction-ubuntu-latest`) was downloaded into the agent's temporary environment and its TGZ inspected. Its compiled runtime Git blob hashes match the published installation tree exactly:

| File | Bytes | Git blob SHA-1 |
|---|---:|---|
| lib/index.js | 122045 | a29fd789061d2fdf2660dc944e22db1b6b69ad57 |
| lib/client.js | 25925 | ba4fd9fbaba03f81fa4e4beb24901ae4083716d8 |
| cordis.patch.yml | 2304 | 135a27ce43c9be6350ec495502f6645208569c12 |

5. Published tree SHA: `a823c35cad477ed5518a951b69666696dc0e0d91`. Published package manifest SHA: `5c653f72be5112fcc0b55bc428fe604795868f5d`; no scripts/devDependencies. Development artifact manifest intentionally differs and is **not the installer**.

## Checked behavior

The source/test review confirms: no history query on mount or disclosure expansion; only Query requests usage; one top Clear empties view/total; Query restores fetched history; a failed query preserves previous values. Source notes identify official account tokens, public reset announcements, approximate UTC-date grouping and clear semantics. Shared DSH Button/DisclosureRow imports and --dsw-* variables are retained. No independent token accumulator or background history timer is added; the existing OAuth-completion timer is separate.

Third-party schema was rechecked against `https://codex-reset.com/developers/`: only documented `group=reset` + `announcement_state=announced` events create boundaries. Forecasts and credits do not. Reader identifies itself and uses an on-demand 60-second cache/Retry-After, not a refresh timer. Public API data is attributed on the same UI surface. It receives no credentials or personal usage.

## What this does not prove

No real user account was queried here. Null/limited/delayed official history, full Electron skin compatibility and existing native Codex interactive approval gaps remain distinct runtime acceptance concerns. Public reset dates are not private-account reset history. No original conversation or user DSH installation was modified.

## Continuity

Development branch: `feat/usage-history-ui`. [Handoff](https://github.com/Tests4gptplay/dsh-codex-native/blob/feat/usage-history-ui/HANDOFF.md) and [isolated testing recipe](https://github.com/Tests4gptplay/dsh-codex-native/blob/feat/usage-history-ui/docs/TESTING_WORKSPACE.md) stay there. This closeout changes documentation only and does not merge the feature branch into main or change any installation tag.

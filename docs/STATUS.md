# Release status

Updated 2026-10-23. Published preview: **v0.2.1-alpha.5**, DSH **0.2.1-rc.2**, official Codex **0.154.0**.

[Release](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.5) · [Regression CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39959031468) · [Saved-branch regression](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39961943894) · [Publication and exact Git install](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39959807125).

## Correction to earlier handoff

The alpha.5 release already completed at **2026-10-23 13:16:44 UTC**. The prior handoff incorrectly called it unreleased. This round verified the actual tag, uploaded TGZ, publication steps and runtime hashes. It did not overwrite the tag or publish a duplicate version. Production source is unchanged between the alpha.5 tested source `de9f3b766a5bbc9d03f2846186c8f1f8eee6424a` and saved branch `998985e459c4157fddbe9646869833c52cf5ba1e`; differences are CI/documentation/previews.

## Delivered feature

Manual official account history; one top Clear/Query/total row; collapsible reference periods and daily counts; source and reference-only notes; shared official DSH controls and inherited skin variables. No history polling, model hook, independent accumulator or quota-reset operation. Clear affects the view only. Detailed rules: [USAGE.md](USAGE.md).

## Verified

- Ubuntu and Windows branch CI: official reference source, typecheck, account-free regression, build and pack passed.
- Exact published GitHub tag installation without allowBuilds exceptions passed in the publication job.
- Official DSH 0.2.1 Web Profile add/configuration smoke passed in that job.
- Published server JS blob `a29fd789061d2fdf2660dc944e22db1b6b69ad57`; browser JS blob `ba4fd9fbaba03f81fa4e4beb24901ae4083716d8`. Both match the actual downloaded branch CI artifact byte-for-byte.
- Published manifest has neither scripts nor devDependencies. Git tag has no tests/src/scripts/.github or preview images. Runtime JS has no Vitest/mock fixture/test selector strings. Browser primitives remain an external DSH-owned import.

## Boundaries

Real-account history availability, full Electron Desktop/third-party-skin combinations and complete native Codex approval/elicitation UI are not certified by mock/host-composition tests. The alpha.4 content and Windows launch regressions are retained; historical custom content is not rewritten.

The current temporary container cannot resolve github.com, so source reads use the GitHub connector and test execution remains in hosted CI. Downloaded artifacts were inspectable locally. An optional local Chromium rerender timed out without producing a new screenshot; no new screenshot success is claimed. Previously generated, source-linked light/dark previews remain the visual evidence.

See [delivery audit](DELIVERY-alpha5.md), [alpha.4 reproduction](REPRODUCTION.md), and [cleanup audit](AUDIT.md).

## User-confirmed Desktop check — 2026-10-23

After installing alpha.5, the user reported that manual history querying succeeded and supplied a screenshot of their real DSH Desktop with a custom skin. They explicitly approved a version with only the account text replaced by the fictional label `GPT-Codex@OpenAI.com`.

[Approved screenshot](screenshots/codex-usage-desktop-anonymized.png) · [Privacy edit and provenance](SCREENSHOTS.md).

This adds one real-user confirmation to the prior cloud-only checks; it does not claim all accounts/skins, precise private reset timestamps or native approval paths have been verified. No plugin code, release tag or installation package was changed for this documentation update.

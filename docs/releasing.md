# Build and release (this fork)

**As of 2026-10-22 the development preview is `0.2.1-alpha.1`. There is no stable npm release.**

A direct GitHub installer tag must contain precompiled `lib/index.js`, `lib/client.js` and declarations, and the tagged manifest must have **no install-time `prepare`, `prepack` or `postinstall` build script**. The previous alpha.0 Git installation was rejected by DSH pnpm's `allowBuilds` policy.

Release identity belongs to [`Tests4gptplay/dsh-codex-native`](https://github.com/Tests4gptplay/dsh-codex-native), **not** the upstream `dsh-llm-codex-app-server` package. Upstream npm trusted publishing settings, tags and release workflows do not authorize a release from this fork.

## Workflows that actually exist

| Workflow | Current responsibility |
|---|---|
| [`ci.yml`](../.github/workflows/ci.yml) | Compile, test and pack in an ephemeral GitHub-hosted runner. Only successful full checks qualify the artifact as a candidate. |
| [`docs-preview.yml`](../.github/workflows/docs-preview.yml) | Capture the current React login UI in Chinese and English as an **unauthenticated isolated component preview**, with no account. |
| [`import-pinned-mit-source.yml`](../.github/workflows/import-pinned-mit-source.yml) | Original pinned MIT import. Not a publishing workflow. |

## Remaining release blockers

- Complete green DSH `0.2.1-rc.2` typecheck, tests and pack.
- Actual isolated DSH plugin installation and model selection.
- Windows Desktop Host test, official native OAuth browser/device login and real subscribed model/tool turns.
- A reviewable tagged package and explicit release authorization. No npm trusted publisher or GitHub Release is configured here.

## Candidate build on temporary hosted runner

```bash
pnpm install --no-frozen-lockfile --ignore-scripts
pnpm run typecheck
pnpm run test:ci
pnpm run build
pnpm pack --pack-destination dist
```

The imported upstream lockfile is being regenerated for the DSH 0.2.1 cohort; it must not be treated as an immutable validated release lockfile until a frozen CI run passes.

Only after the checklist in [STATUS.md](STATUS.md) is satisfied can a frozen commit be considered installable. The intended installation distribution is a public GitHub source or verified packaged artifact, without retaining a development checkout on the user's machine. The installed plugin and official Codex runtime themselves still require local space.

[中文](releasing.zh.md).

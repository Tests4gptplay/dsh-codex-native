# Build and release

**Current published test release: [v0.2.1-alpha.3](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.3) (2026-10-23).** No stable production release is claimed.

Development repository retains TypeScript source, tests, GitHub Actions and historical attribution. Installation tags are **separate, source-free snapshots**, rather than clones of the development tree.

[CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39879247613) builds on disposable GitHub runners, executes 117 account-free tests, checks the clean 22-file package, verifies Git-tag installation without modifying `allowBuilds`, loads the DSH 0.2.1 Web Profile on Linux and Windows, then creates the immutable release tag.

Install test preview in DSH Desktop Plugins → Add plugin:

```text
github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.3
```

No local compilation, npm account or separate API key is required. A live Codex login, user approvals and actual Desktop Electron testing remain outside the completed CI.

See [status](STATUS.md) and [audit](AUDIT.md). Historical alpha.0 through alpha.2 tags must not be silently overwritten or recommended.

# Publishing the minimal runtime

Current release: [v0.2.1-alpha.4](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.4).

`ci.yml` fetches pinned official DSH source into an ignored temporary directory and tests on Linux/Windows. Its artifacts include the built plugin and neutral before/after rendering HTML; the HTML is test evidence, not an installed component.

`release-clean.yml` accepts a completed successful matrix run, extracts its tested package, removes development metadata and scripts, verifies only runtime files remain, runs official DSH profile installation, creates a fresh minimal tag, verifies the exact GitHub install, and publishes a prerelease. It does not rebuild untested runtime code or overwrite old tags.

The published tag contains 25 files, including three additional runtime declaration files for the presentation and native launch fix. No test/mock code, CI or src directory is included. Source remains in main for maintainability.

[Reproduction and limitations](REPRODUCTION.md) · [Release CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39948312538).

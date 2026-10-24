# Release build and distribution

Current release: [v0.2.1-alpha.8](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.8).

The Windows and Ubuntu candidate pipeline uses pinned DSH source, tests the adapter and prepares a plugin artifact. The publication pipeline builds the minimal runtime snapshot, validates it against the companion DSH host patch, checks clean installation and publishes a fixed Git tag with SHA256 checksums.

Alpha.8 assets: compiled plugin TGZ, paired DSH rc.2 host patch, setup guide, upstream license, provenance manifest and SHA256SUMS.

[Candidate CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40078589328) · [Release CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40078708238) · [Installation guide](INSTALL_PATCHED_HOST.md) · [Release status](STATUS.md)

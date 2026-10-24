# Runtime and distribution audit — alpha.4

[Reproduction and regression evidence](REPRODUCTION.md) · [Release](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.4)

## Runtime cleanup

Alpha.4 consolidated previous settings and UI components, simplified Codex feature configuration, and restored the official DSH chat content mapping. The integration uses native DSH rendering primitives for action status and answer content.

The Windows launch path resolves the packaged Codex executable directly through DSH's subprocess management, preserving the normal launch and cleanup lifecycle.

## Distribution

The alpha.4 installation snapshot has 25 files: compiled JS, declarations, `package.json`, `cordis.patch.yml`, LICENSE and README. [Release verification](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39948312538) checks the built runtime and fixed GitHub installation.

## Supported runtime workflows

- Native Codex app-server protocol parsing and DSH dynamic-tool callbacks.
- Account login, status and quota queries.
- Session-bound Codex processes, cancellation and idle-session eviction.
- DSH chat presentation and historical session replay.

[Detailed reproduction](REPRODUCTION.md) · [Later stability repair](PROTOCOL_STREAM_FIX.md)

# DSH Codex Native 0.2.1-alpha.8

Official OpenAI Codex app-server integration for DeepSeek Harness, featuring refined native connection handling, accurate Token accounting and Codex-managed context compaction.

[Release package and assets](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.8) · [Installation guide](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/INSTALL_PATCHED_HOST.md)

```text
github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.8
```

## Improvements

- Independent accounting for accumulated Token consumption and the latest context-window sample.
- Response-based reconciliation of delayed Token usage snapshots.
- Native Codex routine compaction with DSH context-overflow recovery.
- Structured Codex context-overflow error mapping.
- Transport stability, account lifecycle improvements, ChatGPT sign-in and the manual Token usage panel.

## Host integration

The release provides a DSH `0.2.1-rc.2` integration patch alongside the compiled plugin. The [installation guide](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/INSTALL_PATCHED_HOST.md) covers source preparation, patch application, plugin installation and startup.

## Verification

Windows 188/188; Ubuntu 187 passed / one platform skip; packaged checks 28/28; paired-host build 9/9.

[Candidate CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40078589328) · [Publication CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40078708238) · [Technical record](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/CONTEXT_COMPACTION_AUDIT.md)

MIT license; attribution in LICENSE.

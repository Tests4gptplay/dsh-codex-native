# DSH Codex Native 0.2.1-alpha.8

**Paired-host preview. The complete context-pressure repair requires the companion patch on official DSH rc.2 source `687f282e8625c6b8d11ff58211a90524be2e4317`. Installing only this plugin in stock Desktop does not enable the repair.**

[Release assets and prerequisites](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.8) · [Build and installation guide](https://github.com/Tests4gptplay/dsh-codex-native/blob/__SOURCE_SHA__/docs/INSTALL_PATCHED_HOST.md)

After preparing that host, install this immutable plugin:

```text
github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.8
```

The release also provides the prebuilt TGZ. Use the source-host CLI documented in the guide; a stock `pnpm dlx @deepseek-ai/dsh` command starts a different, unpatched host. Unmodified DSH rc.2 Desktop users can continue using alpha.7. This preview is not validated for rc.3 and does not patch an existing Desktop installation.

## Changes

- Preserve all reported consumption while separately recording the most recent native context window. Three 91k responses retain 273k consumption and a 91k current-window sample.
- Bill completed raw response receipts once. A delayed last-window notification cannot bill the previous response again.
- Let Codex manage routine pressure compaction for its models. DSH's existing recovery for an actual context-overflow error remains active.
- Recognize the native structured context-overflow error so the existing host recovery can run.

The first-step “Skill descriptions were shortened” warning describes a separate skill-catalog budget. It may still appear; it is not conversation-history compaction. Manual account history, Query/Clear, login behavior and existing task/retry policies remain as in alpha.7.

## Delivery and verification

This runtime snapshot contains compiled JS, declarations, plugin configuration, license and READMEs. Tests, fixtures, development source, CI and install hooks are excluded. The host patch is a separate release asset and is never applied automatically by this plugin.

[Candidate CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/__CI_RUN__) · [Repair audit](https://github.com/Tests4gptplay/dsh-codex-native/blob/__SOURCE_SHA__/docs/CONTEXT_COMPACTION_AUDIT.md)

Tests use artificial history and isolated peers, without account credentials or paid model calls. They do not certify every native long-session or Electron/skin combination. Fully restart the host after installing. This independent community integration retains the original MIT attribution in LICENSE.

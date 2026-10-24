# DSH Codex Native 0.2.1-alpha.9

Bring the official Codex app-server to DeepSeek Harness with ChatGPT sign-in, native model settings, DSH tools and an on-demand Token usage panel.

## Improvements

- Stable Codex connections and account login handling, including the alpha.6 and alpha.7 transport repairs.
- Accurate Token accounting: accumulated consumption and the latest context-window sample are tracked independently.
- Native Codex context management and structured context-overflow recovery.
- Manual Token history with daily totals, reference reset periods, a Query button and a Clear button.
- Refined Chinese and English interface descriptions.

## Installation

```text
github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.9
```

The release provides the compiled plugin and its DSH rc.2 host integration files. [Build and installation guide](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/INSTALL_PATCHED_HOST.md).

## Token history — real Desktop screenshot

![Anonymized Token history panel in DSH Desktop](https://raw.githubusercontent.com/Tests4gptplay/dsh-codex-native/main/docs/screenshots/codex-usage-desktop-anonymized.png)

The image is an anonymized real DSH Desktop capture approved for publication by the user. More images: [Light theme](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/screenshots/codex-usage-light.png) · [Dark theme](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/screenshots/codex-usage-dark.png).

## Sources and license

Token history uses Codex `account/usage/read`. Historical period labels reference public announcements from [codex-reset.com](https://codex-reset.com/developers/). See [LICENSE](LICENSE) for MIT attribution and upstream credit.

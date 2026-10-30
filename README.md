# Codex Native for DSH

Use your ChatGPT account to work with Codex models inside DeepSeek Harness. Chat, share images, use tools and skills, and continue longer tasks without leaving DSH.

[简体中文](README.zh.md) · [What's new in 0.2.3](RELEASE_NOTES.md)

## What you can do

- **Sign in and choose a model:** use your ChatGPT account, refresh the models available to it, and choose a model and thinking effort. New model choices and runtime updates are picked up when needed, without a separate manual update routine.
- **Chat and work with images:** send text and images, use DSH tools, and continue conversations with their earlier tool results and image attachments, including after a restart.
- **Carry out local tasks with permission:** connect Codex command and file-operation requests to DSH approval prompts. Approve an offered action once or reject it; the plugin does not silently grant lasting permission. Available actions still depend on your installed tools and sandbox settings.
- **Answer questions in the conversation:** select an option or enter your own answer. Your answer is sent back to the task and shown in chat without another send step.
- **Find and use skills:** search skills from local files and connected plugins, then read the instructions needed for the task. Choose DSH-managed discovery or the native skill catalog, and optionally set a skill-context budget.
- **Manage longer conversations:** use context compaction and overflow recovery, retain conversation continuity, and keep startup diagnostics out of replies and summaries. Explicit image/context settings remain under your control.
- **Check account usage:** query quota and Token history on demand, view daily totals and reference-period groups, and clear the displayed table before querying again. Consumption totals and the current context window are tracked separately.
- **Use familiar settings:** sign in or out, change native model settings, and use the bilingual interface with DSH's current theme.
- **Maintain a supported Windows screenshot helper:** view troubleshooting guidance and status, repair the supported known helper, release a selected stuck helper or roll it back. Repair and interruption require confirmation. This assists an installed Computer Use setup; it does not itself provide a desktop-control engine or fix every screenshot problem.

## Install or update

In DSH Desktop, open **Plugins → Add plugin**, paste this versioned package URL, then enable the plugin:

```text
https://github.com/Tests4gptplay/dsh-codex-native/releases/download/v0.2.3/dsh-codex-native-0.2.3.tgz
```

For Web:

```sh
dsh plugin --profile web add 'https://github.com/Tests4gptplay/dsh-codex-native/releases/download/v0.2.3/dsh-codex-native-0.2.3.tgz'
```

The package includes prebuilt runtime files. Restart DSH after upgrading; existing settings and sign-in are retained. Then open the plugin's account settings, sign in to ChatGPT if needed, and select a Codex model in DSH. Model availability and usage limits depend on your account.

## Important limits

Approval prompts do not bypass the sandbox. Windows helper maintenance is Windows-only and supports a specific known helper version; read its guidance before applying a repair. Linux and macOS runtime selection is included, but this release does not claim new macOS live testing. See the [release notes](RELEASE_NOTES.md) for the verified scope and remaining test boundaries.

## More information

[Detailed setup](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/INSTALL.md) · [Configuration and engineering records](https://github.com/Tests4gptplay/dsh-codex-native/tree/main/docs) · [Source and issue reports](https://github.com/Tests4gptplay/dsh-codex-native)

Community integration; DeepSeek Harness is developed by DeepSeek and Codex by OpenAI. Original project and artwork attribution are retained in [LICENSE](LICENSE), [project credits](https://github.com/Tests4gptplay/dsh-codex-native/blob/72b092f364c913722e2013de43878d22b35fc741/README.md#license-and-attribution), and the bundled Lobe Icons license. Reference-period dates use codex-reset.com announcements.

[Support the project](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/SPONSOR.md)

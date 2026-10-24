# Alpha.5 Token history delivery — 2026-10-23

[Release](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.5) · [Usage behavior](USAGE.md) · [Real Desktop screenshot](screenshots/codex-usage-desktop-anonymized.png)

## Package

```text
github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.5
```

Published TGZ: `dsh-codex-native-0.2.1-alpha.5.tgz`, **49,651 bytes**. GitHub asset SHA256: `a2fa8cae881e6d166a0615a317ef93c1a84802b452df6519fdfe50924bf65c7c`.

## Verification

1. Source `de9f3b766a5bbc9d03f2846186c8f1f8eee6424a` passed [Windows/Ubuntu CI 39959031468](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39959031468).
2. [Publication CI 39959807125](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39959807125) validated the fixed installation and published the runtime snapshot.
3. The feature branch also passed [CI 39961943894](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39961943894).
4. Published runtime tree: `a823c35cad477ed5518a951b69666696dc0e0d91`.

| Runtime file | Bytes | Git blob SHA-1 |
|---|---:|---|
| `lib/index.js` | 122,045 | `a29fd789061d2fdf2660dc944e22db1b6b69ad57` |
| `lib/client.js` | 25,925 | `ba4fd9fbaba03f81fa4e4beb24901ae4083716d8` |
| `cordis.patch.yml` | 2,304 | `135a27ce43c9be6350ec495502f6645208569c12` |

## Usage panel behavior

Manual **Query** retrieves Codex account history; the top toolbar displays totals and a **Clear** control. Daily usage is grouped using reference reset announcements published by codex-reset.com. Public reference attribution appears below the table, and DSH `Button` / `DisclosureRow` components provide theme-compatible presentation.

## User-confirmed Desktop view

On 2026-10-23 the user confirmed successful Token history queries in their DSH Desktop with a custom skin and approved the anonymized screenshot. The published image uses the fictional display label `GPT-Codex@OpenAI.com`.

[Approved screenshot](screenshots/codex-usage-desktop-anonymized.png) · [Screenshot provenance](SCREENSHOTS.md)

Engineering history: `feat/usage-history-ui`.

# alpha.9 candidate copy and package audit

**Scope:** bilingual UI labels, plugin description and the actual packed distribution.

## What users see

| Surface | Final candidate text or behavior |
| --- | --- |
| Login prompt (ZH) | 连接 ChatGPT 账号，使用 Codex 模型与工具。 |
| Login prompt (EN) | Connect your ChatGPT account to use Codex models and tools. |
| Token usage placeholder (ZH) | 点击「查询」获取官方 Token 历史用量。 |
| Token usage placeholder (EN) | Select Query to load official Token usage history. |
| Token scope | ChatGPT 账号总用量 / ChatGPT account total |
| Historical reference periods | Public reset announcements by UTC date |
| Clear and Query | Clear the current table; use Query to reload the official account history |
| Quota | Official current quota windows and next reset |
| Market tile | ChatGPT account authentication icon at [docs/icons/chatgpt-auth.png](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/icons/chatgpt-auth.png) |
| Store detail screenshots | Three curated images in `screenshots.json`; real anonymized Desktop usage capture first |

## Verification

The development CI assembles a cleaned TGZ for `0.2.1-alpha.9`, unpacks it and checks:

- exact UTF-8 byte match of both packaged READMEs against `docs/releases/alpha.9/`;
- the packaged `package.json` version and description;
- compiled `lib/client.js` with updated Chinese and English Token UI text;
- exclusion of superseded wording in compiled UI and packaged READMEs;
- runtime JS and plugin configuration hashes against the compiled CI artifact;
- 30 allowed runtime files, excluding source, test fixtures, CI scripts and development dependencies;
- unchanged plugin and DSH-host behavioral regression tests.

CI uploads `candidate-copy-audit.json` with the actual candidate TGZ and SHA256. The ChatGPT authentication-channel icon is at [docs/icons/chatgpt-auth.png](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/icons/chatgpt-auth.png) for the market card; the packaged README references the real Token-history screenshot separately.

## Review links

[Draft PR #2](https://github.com/Tests4gptplay/dsh-codex-native/pull/2) · [Screenshots](../../screenshots.json) · [ChatGPT sign-in icon](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/icons/chatgpt-auth.png)

Release and upstream marketplace PR remain separate from this development candidate.

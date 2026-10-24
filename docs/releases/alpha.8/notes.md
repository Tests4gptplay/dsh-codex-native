# Codex Native alpha.8 — stability, Token accounting and context management

## Highlights / 更新内容

- **Stable native connections:** transport lifecycle handling and account login cancellation improvements from alpha.6 and alpha.7.
- **Token accuracy:** accumulated consumption and the latest active context window are recorded separately. Three responses of 91,000 tokens each yield 273,000 tokens of consumption and a 91,000-token latest-window sample.
- **Response settlement:** delayed `thread/tokenUsage/updated.last` notifications are reconciled against completed raw-response receipts.
- **Codex context management:** routine compaction is delegated to Codex; DSH's existing context-overflow recovery remains available.
- **Native error mapping:** structured `contextWindowExceeded` errors connect to the recovery path.
- **Usage interface:** manual Token history, account quota and native settings are retained.

中文：本版整合连接稳定性、Token 计量与上下文压缩优化，支持 Codex 原生压缩管理、真实溢出恢复、延迟用量回执校准，并保留手动历史查询和额度设置界面。

## Install / 安装

```text
github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.8
```

发行文件提供预构建插件、DSH `0.2.1-rc.2` 配套宿主补丁、[安装指南](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/INSTALL_PATCHED_HOST.md)、来源记录和 SHA256 校验和。

The verified build uses official DSH `0.2.1-rc.2` source commit `687f282e8625c6b8d11ff58211a90524be2e4317` together with the companion integration patch. Full setup commands are provided in the installation guide.

## Verification / 验证

| Check / 项目 | Result / 结果 |
|---|---|
| Windows plugin tests | 188/188 |
| Ubuntu plugin tests | 187 passed, 1 platform skip |
| Packaged runtime + host-normalizer tests | 28/28 |
| Full paired-host build | 9/9 |
| Fresh-profile installation and authenticated Web startup | Passed |
| Immutable GitHub tag installation and runtime hashes | Passed |

[Candidate CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40078589328) · [Publication CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40078708238) · [Engineering audit](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/CONTEXT_COMPACTION_AUDIT.md)

Plugin TGZ SHA256: `e9b65da495cac7fe7b86626da7482076d2e9e4ede9bdc2bdced5712653962eda`.

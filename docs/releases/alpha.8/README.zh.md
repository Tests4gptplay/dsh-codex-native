# DSH Codex Native 0.2.1-alpha.8

将 OpenAI 官方 Codex app-server 接入 DeepSeek Harness，集成连接稳定性优化、Token 计量校准和 Codex 原生上下文压缩管理。

[下载发行文件](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.8) · [安装指南](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/INSTALL_PATCHED_HOST.md)

```text
github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.8
```

## 版本改进

- 分别计算累计 Token 消耗和最近一次上下文窗口。
- 根据原始响应完成回执校准延迟的 Token 用量快照。
- 日常压缩由 Codex 原生机制负责，DSH 保留上下文溢出恢复。
- 识别 Codex 结构化上下文溢出错误。
- 延续协议稳定性、账号生命周期、ChatGPT 登录和手动 Token 历史统计功能。

## 宿主集成

发行页提供 DSH `0.2.1-rc.2` 配套集成补丁与预编译插件。[安装指南](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/INSTALL_PATCHED_HOST.md)包含源码准备、补丁应用、安装和启动步骤。

## 验证结果

Windows 188/188；Ubuntu 187 项通过、1 项平台跳过；安装包专项 28/28；配套宿主构建 9/9。

[候选版本 CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40078589328) · [发布 CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40078708238) · [技术记录](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/CONTEXT_COMPACTION_AUDIT.md)

MIT 许可，来源及署名保留于 LICENSE。

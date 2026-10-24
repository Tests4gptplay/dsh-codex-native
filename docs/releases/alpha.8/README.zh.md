# DSH Codex Native 0.2.1-alpha.8

**需要配套宿主的预发布版。完整的上下文压力修复要求对官方 DSH rc.2 源码 `687f282e8625c6b8d11ff58211a90524be2e4317` 应用随附补丁。只在原版 Desktop 安装本插件，不会启用完整修复。**

[发布文件与前提](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.8) · [构建和安装步骤](https://github.com/Tests4gptplay/dsh-codex-native/blob/__SOURCE_SHA__/docs/INSTALL_PATCHED_HOST.md)

准备好该宿主后，使用固定插件标签：

```text
github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.8
```

Release 同时提供预编译 TGZ。请使用指南中的源码宿主 CLI；`pnpm dlx @deepseek-ai/dsh` 会启动另外一份未修改的宿主。未修改的 DSH rc.2 Desktop 可继续使用 alpha.7。本预发布不支持未经验证的 rc.3，也不会修改已安装的 Desktop。

## 修复内容

- 分开累计消耗和最近一次原生上下文窗口。三次各 91k 的响应保留 273k 真实消耗，当前窗口仍为 91k。
- 只按已完成的原始响应回执结算；迟到的 last-window 通知不再把前一次消耗重复计算。
- Codex 负责其模型的日常压力压缩；真实上下文溢出继续使用 DSH 原有恢复机制。
- 识别 Codex 结构化上下文溢出错误，使宿主原有恢复路径能收到正确错误码。

新对话第一步的 “Skill descriptions were shortened” 提示属于独立的技能目录预算，仍可能出现，不代表对话历史压缩。手动账号历史、查询/清除、登录以及原有任务/重试策略保持 alpha.7 的行为。

## 交付与验证

运行快照只含编译 JS、声明、插件配置、许可证和说明，不含测试、替身、开发源码、CI 或安装钩子。宿主补丁是独立发布文件，本插件不会自动应用它。

[候选版本 CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/__CI_RUN__) · [修复审计](https://github.com/Tests4gptplay/dsh-codex-native/blob/__SOURCE_SHA__/docs/CONTEXT_COMPACTION_AUDIT.md)

测试使用人工历史和隔离对端，不使用账号凭据或付费模型请求；不代表所有原生长会话、Electron 或皮肤组合均已验收。安装后完整重启宿主。本项目为独立社区集成，LICENSE 保留原 MIT 许可与署名。

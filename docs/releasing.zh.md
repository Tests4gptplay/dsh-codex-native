# 构建与发布

**当前测试预发行版：[v0.2.1-alpha.3](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.3)（2026-10-23）。** 还不是正式稳定版。

开发公库保留 TypeScript 源码、单元测试与 CI；供 DSH 安装的 GitHub 标签是**独立的 22 文件精简运行快照**，没有旧 UI、`src/`、`tests/`、构建脚本、开发依赖或 CI。

[本版发布 CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39879247613) 在 GitHub 临时 Linux/Windows 环境验证：117 项无账号单测、编译和打包、无 `allowBuilds` 例外的 GitHub 标签安装，以及 DSH 0.2.1 Web Profile 组装与 `codex-local` 配置。

DSH 桌面版在“插件 → 添加插件”粘贴：

```text
github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.3
```

无需 npm 账号和本地 TypeScript 编译。**真实 ChatGPT 登录、原生审批和 Electron 桌面运行仍需实机验证。**

详见 [验收状态](STATUS.md) 和 [清理审计](AUDIT.md)。旧 alpha.0～alpha.2 版本保留历史，但不再推荐安装。

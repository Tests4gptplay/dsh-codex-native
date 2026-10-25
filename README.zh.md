# DSH Codex Native

**将 OpenAI 官方 Codex app-server 接入 DeepSeek Harness 的主模型插件。** 支持 ChatGPT 账号登录、DSH 工具、Codex 原生模型设置，以及手动查询 Token 历史用量。

[English](README.md) · [版本发布](https://github.com/Tests4gptplay/dsh-codex-native/releases) · [安装指南](docs/INSTALL_PATCHED_HOST.md) · [发布验证](docs/STATUS.md)

## 最新版本 — v0.2.1-alpha.9

[下载 alpha.9](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.9) · [上下文计量技术记录](docs/CONTEXT_COMPACTION_AUDIT.md)

- **上下文管理：** 日常上下文压缩由 Codex 原生机制负责，极端上下文溢出时由 DSH 原有恢复路径处理。
- **Token 计量校准：** 累计消耗与最近一次上下文窗口分别计算，跨工具调用的延迟回执按已完成响应准确结算。
- **连接稳定性：** 延续 alpha.6 的协议传输修复和 alpha.7 的账号生命周期修复。
- **手动历史统计：** 查询账号历史用量、查看每日统计与周期分组，并可清空当前表格。
- **主模型接入：** 官方 Codex app-server、ChatGPT 登录、DSH 工具和原生模型设置。
- **已安装插件界面：** 安装包内置 ChatGPT 认证渠道图标及中英文插件管理器描述。

### 安装

```text
github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.9
```

发行文件包括预构建插件与配套的 DSH rc.2 宿主集成补丁。[构建与安装步骤](docs/INSTALL_PATCHED_HOST.md)提供已验证的宿主组合：DSH `0.2.1-rc.2`、Codex `0.154.0`。

## Token 历史用量

点击 **查询** 时，面板读取官方 Codex 账号历史用量。顶部显示返回的每日记录合计，同时单独显示官方终身累计。参考周期使用 [codex-reset.com](https://codex-reset.com/developers/) 公告日期进行分组。

点击 **清除** 可清空当前统计表格，重新点击 **查询** 即可再次获取数据。界面使用 DSH 原生组件，并随当前皮肤适配。

## 用户实测 Desktop 截图

![脱敏后的 DSH Desktop Token 历史用量实测界面](docs/screenshots/codex-usage-desktop-anonymized.png)

*用户在 alpha.5 实机确认过历史用量查询功能，发布前将账号一行替换为虚构展示名称。* [截图来源](docs/SCREENSHOTS.md) · [浅色示例](docs/screenshots/codex-usage-light.png) · [深色示例](docs/screenshots/codex-usage-dark.png)

市场截图顺序由 [screenshots.json](screenshots.json) 控制。

## 测试与工程记录

alpha.9 候选版本在 Windows 通过 **191/191** 项测试；Ubuntu **190 项通过、1 项平台跳过**。最终安装包专项检查 **28/28**，配套宿主构建、独立安装、Web 启动及 Git 固定标签安装均通过。

[候选版 CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40124345944) · [发布 CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40148183107) · [压缩与计量审计](docs/CONTEXT_COMPACTION_AUDIT.md) · [账号生命周期修复](docs/ACCOUNT_LIFECYCLE_AUDIT.md) · [协议修复](docs/PROTOCOL_STREAM_FIX.md)

## 许可与来源

基于 MIT 项目 [wss534857356/dsh-plugin-codex](https://github.com/wss534857356/dsh-plugin-codex)，导入基线 `f1f61886f4defcf7294d63c3641fba01ee554e7b`，原始署名保留于 [LICENSE](LICENSE)。DeepSeek Harness 来自 DeepSeek，Codex 来自 OpenAI。公共重置公告数据来源为 **codex-reset.com**。ChatGPT 图标素材采用 [Lobe Icons](https://github.com/lobehub/lobe-icons) 的 MIT 授权资源，许可文件已包含在安装包 `assets/LOBE-ICONS-LICENSE.txt` 中。

# DSH Codex Native

**将 OpenAI 官方 Codex app-server 接入 DeepSeek Harness 的主模型插件。** 支持 ChatGPT 账号登录、DSH 工具、Codex 原生模型设置，以及手动查询 Token 历史用量。

[English](README.md) · [版本发布](https://github.com/Tests4gptplay/dsh-codex-native/releases) · [安装指南](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/INSTALL.md) · [发布验证](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/STATUS.md)

## 最新版本 — v0.2.1-alpha.9-http.6

[版本与下载](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.9-http.6) · [上下文计量技术记录](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/CONTEXT_COMPACTION_AUDIT.md)

- **原生问答与通知：** Codex 中途提问接入 DSH 原生选项卡片和通知，支持点选及自由输入。
- **自动回传与聊天回执：** 提交后自动送回当前任务，并在聊天中显示为用户消息，一次提交即可继续，无需再点发送箭头。
- **宿主版本兼容：** 插件使用 DSH 宿主提供的依赖，不通过版本范围提前拦截加载。
- **直接 HTTP 连接：** OpenAI 路由使用认证 HTTP 传输，沿用已有 ChatGPT 登录，减少 WebSocket 断流后的重连等待。
- **按需技能发现：** DSH 统一搜索本地与远程连接器技能，选中后再读取；启动提示只保留简短入口，技能预算为 10,000 tokens。
- **会话提示去重：** 相同配置、弃用与普通警告在同一会话中显示一次；变化后的提示和错误继续显示。

- **上下文管理：** 日常上下文压缩由 Codex 原生机制负责，极端上下文溢出时由 DSH 原有恢复路径处理。
- **Token 计量校准：** 累计消耗与最近一次上下文窗口分别计算，跨工具调用的延迟回执按已完成响应准确结算。
- **连接稳定性：** 延续 alpha.6 的协议传输修复和 alpha.7 的账号生命周期修复。
- **手动历史统计：** 查询账号历史用量、查看每日统计与周期分组，并可清空当前表格。
- **主模型接入：** 官方 Codex app-server、ChatGPT 登录、DSH 工具和原生模型设置。
- **已安装插件界面：** 安装包内置 ChatGPT 认证渠道图标及中英文插件管理器描述。

### 安装

```text
github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.9-http.6
```

Desktop 打开 **插件 → 添加插件**，粘贴上面的固定版本来源并启用。Web 版执行：

```sh
dsh plugin --profile web add 'github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.9-http.6'
```

固定版本包含预构建运行文件；升级沿用原有配置与登录。[安装指南](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/INSTALL.md)包含登录步骤和备用 TGZ 安装方式。

## 按需技能发现

`0.2.1-alpha.9-http.6` 由 DSH 提供 `codex_skill_search` 和 `codex_skill_read`：模型先搜索相关摘要，再读取所需技能正文。本地技能与已安装的远程连接器技能统一检索，同一插件的重复项优先使用连接器；独立编写的本地技能保留。入口对 DSH 的 HTTP 与本地模型均可用。

默认 `skillsMode: dsh` 将 Codex 的自动技能目录注入交给这两个入口，`skillsMaxContextTokens: 10000` 使用原生支持的最大预算。发现结果按工作目录缓存，技能或插件变化后用 `refresh: true` 更新；`skillsMode: native` 可选用原生目录。设置只作用于本插件启动的进程，沿用现有登录、连接器和原生工具。

## Token 历史用量

点击 **查询** 时，面板读取官方 Codex 账号历史用量。顶部显示返回的每日记录合计，同时单独显示官方终身累计。参考周期使用 [codex-reset.com](https://codex-reset.com/developers/) 公告日期进行分组。

点击 **清除** 可清空当前统计表格，重新点击 **查询** 即可再次获取数据。界面使用 DSH 原生组件，并随当前皮肤适配。

## 用户实测 Desktop 截图

![脱敏后的 DSH Desktop Token 历史用量实测界面](https://raw.githubusercontent.com/Tests4gptplay/dsh-codex-native/main/docs/screenshots/codex-usage-desktop-anonymized.png)

*用户在 alpha.5 实机确认过历史用量查询功能，发布前将账号一行替换为虚构展示名称。* [截图来源](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/SCREENSHOTS.md) · [浅色示例](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/screenshots/codex-usage-light.png) · [深色示例](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/screenshots/codex-usage-dark.png)

市场截图顺序由 [screenshots.json](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/screenshots.json) 控制。

## 测试与工程记录

http.6 问答更新通过 **33 项专项测试**和构建；原生点选、自动回传和聊天回执已在 DSH 实际会话中确认。前后端编译文件与已验收的本机运行版本逐字节一致。

http.4 兼容性修复在 Windows 通过 **209/209** 项测试；Ubuntu **208 项通过、1 项平台跳过**；两个平台的最终安装包专项测试均 **28/28** 通过。[兼容性修复 CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40190137989)。

alpha.9 候选版本在 Windows 通过 **191/191** 项测试；Ubuntu **190 项通过、1 项平台跳过**。最终安装包专项检查 **28/28**，配套宿主构建、独立安装、Web 启动及 Git 固定标签安装均通过。

[候选版 CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40124345944) · [发布 CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40148183107) · [压缩与计量审计](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/CONTEXT_COMPACTION_AUDIT.md) · [账号生命周期修复](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/ACCOUNT_LIFECYCLE_AUDIT.md) · [协议修复](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/PROTOCOL_STREAM_FIX.md)

## 许可与来源

基于 MIT 项目 [wss534857356/dsh-plugin-codex](https://github.com/wss534857356/dsh-plugin-codex)，导入基线 `f1f61886f4defcf7294d63c3641fba01ee554e7b`，原始署名保留于 [LICENSE](LICENSE)。DeepSeek Harness 来自 DeepSeek，Codex 来自 OpenAI。公共重置公告数据来源为 **codex-reset.com**。ChatGPT 图标素材采用 [Lobe Icons](https://github.com/lobehub/lobe-icons) 的 MIT 授权资源，许可文件已包含在安装包 `assets/LOBE-ICONS-LICENSE.txt` 中。

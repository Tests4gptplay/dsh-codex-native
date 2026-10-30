# DSH Codex Native

## 核心功能

- **动态模型选择**：将 Codex app-server 接入 DSH 主模型，按 `model/list` 获取当前账号可用的模型、输入能力与推理档位。
- **原生工具与交互**：连接 DSH 工具、Codex 原生设置、可选择或自由填写的问题卡，并将原生命令/文件审批接到当前 DSH 会话的一次性决定。
- **可靠的历史续接**：回放工具调用时保留 ID 与结果的对应关系；生成图片保存为附件，重启后可从历史恢复。
- **大图处理**：使用 Buffer 编码恢复图片，解决大字节数组展开引起的调用栈错误。默认不添加额外 JSON-RPC 行上限或图片替换预算；如主动配置正数图片预算，较旧图片可能替换为文字，Host 与上游限制仍适用。
- **账户和用量**：ChatGPT 登录/退出、手动查询 Token 历史与额度、清空面板缓存后重新查询。
- **Windows Computer Use 维护**：内置指南、状态检查、已知 helper 修复、精确进程释放及回滚。Windows 10 的修复针对已知 `@oai/sky 0.7.13` 二进制；具体签名影响与中断确认见下方操作说明。

**将 OpenAI 官方 Codex app-server 接入 DeepSeek Harness 的主模型插件。** 支持 ChatGPT 账号登录、DSH 工具、Codex 原生模型设置，以及手动查询 Token 历史用量。

[English](README.md) · [版本发布](https://github.com/Tests4gptplay/dsh-codex-native/releases) · [安装指南](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/INSTALL.md) · [发布验证](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/STATUS.md)


本测试候选为 0.2.1-alpha.9-http.11-candidate.7，请使用随附的固定安装包及 SHA-256 清单；下列旧版标签为历史发布。

## 历史版本 — v0.2.1-alpha.9-http.10

启动新的 Codex 进程时检查官方 npm `@openai/codex@latest`，按需下载并复用对应平台的运行时。已运行的任务继续使用原进程；后续新进程使用更新版本。网络更新失败时保留可用运行时并记录原因。更新按实际使用触发，没有后台轮询。

模型选择器在每次 DSH 请求模型列表时读取 Codex App Server 官方 `model/list`，刷新列表即可同步新模型、名称、输入能力和推理档位。沿用已有账号登录及配置。

内置 `codex_computer_use_recovery`：`guide` 读取使用指引，`status` 定位实际运行时，`repair` 应用已验证的 Windows 10 截图补丁，`release` 定向结束占用截图助手，`rollback` 恢复原件。修补数据、恢复代码及指引全部随插件打包，不依赖外置 BAT、PS1 或 Python。

完整排障说明只在读取 Computer Use 技能或调用 `guide` 时返回，不加入日常系统提示。说明区分原生 FrameArrived 超时、文件占用、连接超时、失效句柄及 Esc 停止，并给出对应处理。修补只接受已知 @oai/sky 0.7.13 二进制；修改会使原签名失效，需用户同意。解除占用需获准中断目标截图助手，不结束 DSH、Codex 或父进程。

## 包含功能

[版本与下载](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.9-http.10) · [上下文计量技术记录](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/CONTEXT_COMPACTION_AUDIT.md)

- **原生问答与通知：** Codex 中途提问接入 DSH 原生选项卡片和通知，支持点选及自由输入。
- **自动回传与聊天回执：** 提交后自动送回当前任务，并在聊天中显示为用户消息，一次提交即可继续，无需再点发送箭头。
- **宿主版本兼容：** 插件使用 DSH 宿主提供的依赖，不通过版本范围提前拦截加载。
- **直接 HTTP 连接：** OpenAI 路由使用认证 HTTP 传输，沿用已有 ChatGPT 登录，减少 WebSocket 断流后的重连等待。
- **按需技能发现：** DSH 统一搜索本地与远程连接器技能，选中后再读取；启动提示只保留简短入口；技能预算默认沿用上游配置，也可显式设置。
- **会话提示去重：** 相同配置、弃用与普通警告在同一会话的宿主诊断日志中记录一次；变化后的提示和错误继续保留，不混入模型正文或压缩摘要。

- **上下文管理：** 日常上下文压缩由 Codex 原生机制负责，极端上下文溢出时由 DSH 原有恢复路径处理。
- **Token 计量校准：** 累计消耗与最近一次上下文窗口分别计算，跨工具调用的延迟回执按已完成响应准确结算。
- **连接稳定性：** 延续 alpha.6 的协议传输修复和 alpha.7 的账号生命周期修复。
- **手动历史统计：** 查询账号历史用量、查看每日统计与周期分组，并可清空当前表格。
- **主模型接入：** 官方 Codex app-server、ChatGPT 登录、DSH 工具和原生模型设置。
- **已安装插件界面：** 安装包内置 ChatGPT 认证渠道图标及中英文插件管理器描述。

### 安装

```text
github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.9-http.10
```

Desktop 打开 **插件 → 添加插件**，粘贴上面的固定版本来源并启用。Web 版执行：

```sh
dsh plugin --profile web add 'github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.9-http.10'
```

固定版本包含预构建运行文件；升级沿用原有配置与登录。[安装指南](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/INSTALL.md)包含登录步骤和备用 TGZ 安装方式。

## 按需技能发现

`0.2.1-alpha.9-http.10` 由 DSH 提供 `codex_skill_search` 和 `codex_skill_read`：模型先搜索相关摘要，再读取所需技能正文。本地技能与已安装的远程连接器技能统一检索，同一插件的重复项优先使用连接器；独立编写的本地技能保留。入口对 DSH 的 HTTP 与本地模型均可用。

默认 `skillsMode: dsh` 将 Codex 的自动技能目录注入交给这两个入口，`skillsMaxContextTokens` 可显式传递技能预算，未设置时沿用上游配置。发现结果按工作目录缓存，技能或插件变化后用 `refresh: true` 更新；`skillsMode: native` 可选用原生目录。设置只作用于本插件启动的进程，沿用现有登录、连接器和原生工具。

## Token 历史用量

点击 **查询** 时，面板读取官方 Codex 账号历史用量。顶部显示返回的每日记录合计，同时单独显示官方终身累计。参考周期使用 [codex-reset.com](https://codex-reset.com/developers/) 公告日期进行分组。

点击 **清除** 可清空当前统计表格，重新点击 **查询** 即可再次获取数据。界面使用 DSH 原生组件，并随当前皮肤适配。

## 用户实测 Desktop 截图

![脱敏后的 DSH Desktop Token 历史用量实测界面](https://raw.githubusercontent.com/Tests4gptplay/dsh-codex-native/main/docs/screenshots/codex-usage-desktop-anonymized.png)

*用户在 alpha.5 实机确认过历史用量查询功能，发布前将账号一行替换为虚构展示名称。* [截图来源](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/SCREENSHOTS.md) · [浅色示例](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/screenshots/codex-usage-light.png) · [深色示例](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/screenshots/codex-usage-dark.png)

市场截图顺序由 [screenshots.json](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/screenshots.json) 控制。

## 测试与工程记录

http.7 更新通过构建及 **16 项专项测试**，包含实际文件替换与回滚。Windows 10 build 19045 实机完成了内置工具解除截图助手占用、重新连接、截取 DSH 窗口的完整流程，截图约 **0.4 秒**返回。

http.6 问答更新通过 **33 项专项测试**和构建；原生点选、自动回传和聊天回执已在 DSH 实际会话中确认。前后端编译文件与已验收的本机运行版本逐字节一致。

http.4 兼容性修复在 Windows 通过 **209/209** 项测试；Ubuntu **208 项通过、1 项平台跳过**；两个平台的最终安装包专项测试均 **28/28** 通过。[兼容性修复 CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40190137989)。

alpha.9 候选版本在 Windows 通过 **191/191** 项测试；Ubuntu **190 项通过、1 项平台跳过**。最终安装包专项检查 **28/28**，配套宿主构建、独立安装、Web 启动及 Git 固定标签安装均通过。

[候选版 CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40124345944) · [发布 CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40148183107) · [压缩与计量审计](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/CONTEXT_COMPACTION_AUDIT.md) · [账号生命周期修复](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/ACCOUNT_LIFECYCLE_AUDIT.md) · [协议修复](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/PROTOCOL_STREAM_FIX.md)

## 许可与来源

Windows 10 MTA 调度补丁参考 [chen0416ccc-cpu/codex-windows-fast-patch-skill](https://github.com/chen0416ccc-cpu/codex-windows-fast-patch-skill/blob/main/scripts/patch-computer-use-helper-win10.ps1)，内置配置将参考区域适配至本次实测的 @oai/sky 0.7.13 二进制。

基于 MIT 项目 [wss534857356/dsh-plugin-codex](https://github.com/wss534857356/dsh-plugin-codex)，导入基线 `f1f61886f4defcf7294d63c3641fba01ee554e7b`，原始署名保留于 [LICENSE](LICENSE)。DeepSeek Harness 来自 DeepSeek，Codex 来自 OpenAI。公共重置公告数据来源为 **codex-reset.com**。ChatGPT 图标素材采用 [Lobe Icons](https://github.com/lobehub/lobe-icons) 的 MIT 授权资源，许可文件已包含在安装包 `assets/LOBE-ICONS-LICENSE.txt` 中。

### 接线边界与可选资源预算

插件透传 Host 已选择的模型与图片。模型目录的能力描述仅供 Host 选择界面使用，不是适配器增加的准入门槛。模型、provider 与 effort 标识是非空 JSON 字符串，不作为 shell 片段拼接。

`maxJsonRpcLineBytes` 默认 `0`：不再额外限制一行协议大小；`maxRequestImageBytes` 默认 `0`：不由适配器替换历史图片。主动设置正值仍可启用资源预算；图片预算可能把最旧图片替换为引用文字，因此不能称为无损缓存。Host 的附件校验、标准化与原生协议约束仍生效；升级不会擅自抹掉用户明确配置的预算。

原生命令/文件审批接 Host 的真实 Agent、当前 turn 与一次性批准服务；仅映射原生请求明示允许的一次 accept。服务不可用、未支持的审批协议、取消和原生撤回均区别于用户拒绝。不声称原生操作已经走完 DSH 全套工具 guards，不改变原生 sandbox/permission policy，不捏造会话级或永久授权。

## 支持项目 / Support

[GitHub Sponsors](https://github.com/sponsors/Tests4gptplay) · [Ko-fi](https://ko-fi.com/kou392350) · [Patreon](https://www.patreon.com/cw/Kou848) · [爱发电 / Afdian](https://afdian.com/a/kkt_ifd1) · [支付宝 / Alipay](SPONSOR.md)


## 候选7交付

[安装与包校验](test-artifacts/INSTALL.md) · [验收与实机验证要求](docs/testing/ACCEPTANCE.md) · [变更](docs/testing/CHANGES.md)

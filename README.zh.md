# DSH Codex Native

使用 ChatGPT 账号在 DeepSeek Harness 中调用 Codex 模型。直接在 DSH 里聊天、使用图片、调用工具与技能，并持续完成较长的任务。

[English](README.md) · [0.2.3 更新说明](RELEASE_NOTES.md)

## 可以用它做什么

- **登录和选择模型**：使用 ChatGPT 账号登录，刷新账号可用模型，选择模型与思考档位。按需获取新模型选项与运行时更新，无需另行手动维护更新流程。
- **图文对话与工具协作**：发送文字和图片，调用 DSH 工具；续聊时保留先前的工具结果和图片附件，重启后也可恢复历史。
- **经许可执行本机任务**：将 Codex 的命令和文件操作请求接到 DSH 审批提示。可以对提供的操作批准一次或拒绝，不会默默授予永久权限；实际可用操作仍取决于已安装工具和沙箱设置。
- **在聊天中回答问题**：选择选项或自由填写答案，提交后自动回传当前任务，并在聊天中显示，无需再点一次发送。
- **查找和使用技能**：统一搜索本地文件和已连接插件提供的技能，按任务需要读取说明；可选择 DSH 管理的检索入口或原生技能目录，并自行设置技能上下文预算。
- **处理较长对话**：提供上下文压缩、溢出恢复和历史续接；启动诊断不混入回复或摘要，用户明确设置的图片和上下文预算仍由用户掌握。
- **查看账号用量**：按需查询额度与 Token 历史，查看每日合计和参考周期分组；可清空当前表格再查询。累计消耗与当前上下文窗口分别统计。
- **使用熟悉的设置界面**：登录或退出账号，调整原生模型设置；中英文界面随 DSH 当前主题显示。
- **维护受支持的 Windows 截图辅助程序**：查看排障指南和状态，修复受支持的已知辅助程序、释放选定的卡住进程或回滚。修复和中断均需确认。它辅助已有 Computer Use 环境，不是另一个桌面控制引擎，也不承诺修复所有截图问题。

## 安装与升级

当前版本：**0.2.3**。安装包与固定标签均已包含运行文件，无需编译。

**首次安装（Desktop）：** 打开侧栏 **插件 → 添加插件**（箭头菜单的 **安装第三方插件** 也可进入），把下面一整行填入 **包名或地址**，点击 **安装**，核对版本后点击 **立即启用**。

```text
github:Tests4gptplay/dsh-codex-native#v0.2.3
```

**升级已有插件：** 同样填写上面的新版来源，成功后核对版本并启用；已有设置与用户文件保留。若宿主提示已安装或要求先卸载，再按提示仅卸载该插件条目并安装新版，不清除 DSH 数据或手工删除插件目录。是否需要重启以 DSH 提示为准；需要时完全退出并重新打开（Desktop 包括托盘）。

启用后在插件设置中按需登录，并在 DSH 选择模型；升级不需要清除账号存储。

**备用安装包：** 将下面的 `.tgz` 直链填入同一个 **包名或地址**；也可下载后填写文件的完整绝对路径，无需解压。该路径应属于运行 DSH 的电脑。

```text
https://github.com/Tests4gptplay/dsh-codex-native/releases/download/v0.2.3/dsh-codex-native-0.2.3.tgz
```

**Web：** 在运行服务的环境中执行。升级前停止对应 Web profile，成功后重新启动；Web 与 Desktop 分别安装。

```sh
dsh plugin --profile web add 'github:Tests4gptplay/dsh-codex-native#v0.2.3'
```

备用时将命令中的来源换成上面的 `.tgz` 直链或下载文件的完整绝对路径。

## 使用边界

审批不会绕过沙箱。截图辅助程序维护仅适用于 Windows 和指定已知版本，修复前请先阅读其指南。已包含 Linux 与 macOS 运行时选择，但本次不新增 macOS 实机验证声明。具体已验证范围及仍未覆盖的情况见[更新说明](RELEASE_NOTES.md)。

## 更多信息

[详细安装配置](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/INSTALL.md) · [配置与工程记录](https://github.com/Tests4gptplay/dsh-codex-native/tree/main/docs) · [源码与问题反馈](https://github.com/Tests4gptplay/dsh-codex-native)

本项目为社区集成；DeepSeek Harness 由 DeepSeek 开发，Codex 由 OpenAI 开发。原项目及图标署名保留于 [LICENSE](LICENSE)、[项目来源说明](https://github.com/Tests4gptplay/dsh-codex-native/blob/72b092f364c913722e2013de43878d22b35fc741/README.zh.md#许可与来源)及随包的 Lobe Icons 许可文件。参考周期日期采用 codex-reset.com 公告。

[支持项目](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/SPONSOR.md)

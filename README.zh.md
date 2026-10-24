# DSH Codex Native 0.2.1-alpha.7

DSH 插件 → 添加插件：

github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.7

通过 OpenAI 官方 Codex app-server 接入 DSH 主模型，提供 ChatGPT 原生登录和手动账号历史用量查询。独立社区项目，保留原 MIT 许可和署名。

## alpha.7 账号生命周期修复

先在 Windows/Linux 的官方 DSH 子进程运行时中复现，再修改代码：停用账号服务后，卡住的初始化、状态/额度/历史查询仍挂起；取消登录也可能卡在等待服务端确认。

现在从初始化之前开始记录本服务拥有的账号子进程，停用时只回收这些进程。明确取消登录时尽力发送协议取消请求，然后关闭该登录连接，不无限等确认，不结束模型任务进程，也不删除已保存凭据。

原样八个新增用例及既有回归均通过。正常握手仍每连接一次；活动模型任务通过缩短缓存空闲阈值的测试。这不是一小时真实模型耐久测试，也未证明此前用户进程退出的最初原因。

相对 alpha.6 只修改一个生产源文件 src/native-account.ts。依赖、模型/审批策略、前端不变；不增加 Watchdog、心跳、用量轮询、模型任务硬超时或执行途中自动重放。保留 alpha.6 断流处理。

保留手动查询、单清除按钮、折叠每日用量与 DSH 原生控件。Token 是账号口径；历史周期参考 codex-reset.com 公告，仅供参考。清除只清本页显示。

安装快照不含测试、替身、源码、CI、截图、安装脚本或开发依赖。测试后端只在隔离开发环境运行，未使用真实账号或模型额度。

升级后完全退出并重新打开 DSH。原生审批交互仍有已知局限。详细审计：https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/ACCOUNT_LIFECYCLE_AUDIT.md

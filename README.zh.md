# DSH Codex Native 0.2.1-alpha.6

DSH 插件 → 添加插件：

github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.6

通过 OpenAI 官方 Codex app-server 接入 DSH 主模型，提供 ChatGPT 原生登录和手动账号历史用量查询。本插件为独立社区项目，保留原 MIT 许可和署名。

## alpha.6 协议断流修复

修复管道关闭后仍等 drain 导致请求挂起的问题；保留本地进程退出码与标准错误证据，并遮盖常见凭据内容。在清理阶段才观察到的退出明确标注，不冒充最初原因。已关闭的缓存连接在下一次请求时按已有历史重建，工具结果作为已有记录保留，不新增执行途中自动重放。

不增加心跳、轮询、Watchdog 或模型任务硬超时；原有 DSH 重试设置不变。用户最初为何退出仍需实际退出日志确认，不能据此认定 OpenAI 云端宕机。

保留 alpha.5 的手动查询、单清除按钮、折叠每日用量及 DSH 官方控件。Token 是账号口径；历史周期参考 codex-reset.com，按 UTC 日期归组，仅供参考。清除只清本页显示，第三方不接收账号或用量数据。

安装标签只包含编译运行文件、声明、配置、许可证和说明；不含测试、模拟后端、源码、CI、截图、安装脚本或开发依赖。Linux/Windows 回归及隔离真实子进程退出测试通过，未使用真实账号或模型额度。

升级后完全退出并重新打开 DSH。源码和详细证据：https://github.com/Tests4gptplay/dsh-codex-native

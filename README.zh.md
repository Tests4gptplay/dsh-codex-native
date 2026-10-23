# DSH Codex Native 0.2.1-alpha.5

安装：github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.5

设置页新增手动历史查询，使用 Codex 官方 account/usage/read；按钮和折叠行直接复用 DSH 官方控件及皮肤变量。顶部只有清除、查询和列表总用量；下方按参考周期折叠，每组可展开每日明细。表格下标明用量与周期来源。

历史周期参考 codex-reset.com 公共公告，不是个人账户完整重置历史。重置当天用量不拆分；清除只清空本页结果，再次查询会恢复官方历史。没有用量轮询、模型统计钩子或自动重置操作，也不向第三方发送账户凭据或用量。

精简发行标签没有测试、模拟数据、截图、源码、CI、构建脚本或开发依赖。Windows/Linux 回归通过；未在云端使用真实账号查询，也未声称所有第三方皮肤均已实测。

源码、许可与来源：https://github.com/Tests4gptplay/dsh-codex-native

# 精简发行物发布

当前版本：[v0.2.1-alpha.4](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.4)。

`ci.yml` 在 Linux/Windows 临时环境读取固定提交的官方 DSH 源码，执行模拟 Codex 标准输入输出和官方渲染分支测试。产物含编译插件和对照 HTML；HTML 是测试证据，不是用户插件组成部分。

`release-clean.yml` 只接受成功的跨平台测试运行，取其中同一份编译产物，剥离开发依赖和脚本、核对文件清单、通过官方 DSH 安装，再创建独立精简标签并实测该 GitHub 标识安装后发布。旧标签不覆盖。

alpha.4 发行物只有 25 个运行文件：增加的是修复所需声明文件，而不是测试文件。没有源码、模拟后端、CI、安装脚本或开发依赖。

[复现及限制](REPRODUCTION.md) · [发布 CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39948312538)。

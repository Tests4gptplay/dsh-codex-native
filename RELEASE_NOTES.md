# Codex Native 0.2.3

Connect your ChatGPT account to use Codex models in DeepSeek Harness, with current model choices, tools, questions, approval integration and usage information.

## What changed
- Corrected the installed English and Chinese README version labels and installation URLs.
- Expanded plugin-manager descriptions to explain account sign-in, model and thinking choices, image conversations, tools and skills, local-task approvals, interactive questions, long-conversation continuation and compaction, usage information and supported Windows screenshot-helper maintenance.
- Included these release notes inside the package so documentation links work after installation.
- Preserved the tested candidate7 executable runtime; this documentation correction does not change model or tool behavior.

## Install
In DSH Desktop, open Plugins → Add plugin and paste:

```text
https://github.com/Tests4gptplay/dsh-codex-native/releases/download/v0.2.3/dsh-codex-native-0.2.3.tgz
```

For Web:

```sh
dsh plugin --profile web add 'https://github.com/Tests4gptplay/dsh-codex-native/releases/download/v0.2.3/dsh-codex-native-0.2.3.tgz'
```

Restart DSH after upgrading. Existing configuration and sign-in are retained.

## Verification boundaries
The changes in this release are documentation and package metadata corrections; model and tool behavior are unchanged. Earlier Windows checks covered conversations, skills, compaction, question selection and DSH tool-write approvals. That does not imply every native command/file approval case was tested. There is no new macOS live-testing claim, and Windows helper maintenance does not promise to fix every screenshot timeout.

Detailed implementation and historical test evidence remain in the [repository engineering records](https://github.com/Tests4gptplay/dsh-codex-native/tree/main/docs).

## 中文
0.2.3 修正安装包内中英文版本说明和安装地址，补全插件管理器功能介绍，并随包提供发行说明。实际模型、工具与运行代码沿用已测版本，不因本次文档修正而改变。Desktop 在“插件→添加插件”中粘贴上方 TGZ 地址；Web 使用上方命令，升级后重启 DSH。已有配置和登录保留。

既有实测覆盖范围与未覆盖项保持区分：Host 写入审批成功不冒充原生命令/文件协议审批实测，Windows 辅助程序维护不等于提供桌面控制引擎；不新增 macOS 实机通过声明。

# Codex Native 0.2.3

Connect your ChatGPT account to use Codex models in DeepSeek Harness, with current model choices, tools, questions, approval integration and usage information.

## What changed
- Corrected the installed English and Chinese README version labels and installation URLs.
- Expanded plugin-manager descriptions to explain account sign-in, model and thinking choices, image conversations, tools and skills, local-task approvals, interactive questions, long-conversation continuation and compaction, usage information and supported Windows screenshot-helper maintenance.
- Included these release notes inside the package so documentation links work after installation.
- Preserved the tested candidate7 executable runtime; this documentation correction does not change model or tool behavior.

## Install or update

Current version: **0.2.3**. The fixed tag and installation package include runtime files; no build is needed.

**First installation (Desktop):** Open **Plugins → Add plugin** in the sidebar (or **Install a third-party plugin** in the arrow menu). Paste the complete line below into **Package name or address**, click **Install**, check the version and click **Enable now**.

```text
github:Tests4gptplay/dsh-codex-native#v0.2.3
```

**Updating:** Use the same dialog with the new versioned source above, verify the installed version and enable it. Retain existing settings and user files. If DSH reports that it is already installed or requires removal first, follow that message to remove only the plugin entry and install the new version; do not clear DSH data or manually delete plugin directories. Restart only when DSH asks you to; fully quit and reopen it, including the Desktop tray process.

After enabling, sign in through the plugin settings if needed and select a model in DSH. Updating does not require clearing account storage.

**Alternative package:** Paste this `.tgz` URL into the same **Package name or address** field, or download it and enter its full absolute path. No extraction is needed. The path must be on the computer running DSH.

```text
https://github.com/Tests4gptplay/dsh-codex-native/releases/download/v0.2.3/dsh-codex-native-0.2.3.tgz
```

**Web:** Run this on the computer hosting the service. Stop the corresponding Web profile before updating and restart it after success. Web and Desktop installations are separate.

```sh
dsh plugin --profile web add 'github:Tests4gptplay/dsh-codex-native#v0.2.3'
```

Alternatively, replace the source in the command with the `.tgz` URL above or the downloaded file's absolute path.

## Verification boundaries
The changes in this release are documentation and package metadata corrections; model and tool behavior are unchanged. Earlier Windows checks covered conversations, skills, compaction, question selection and DSH tool-write approvals. That does not imply every native command/file approval case was tested. There is no new macOS live-testing claim, and Windows helper maintenance does not promise to fix every screenshot timeout.

Detailed implementation and historical test evidence remain in the [repository engineering records](https://github.com/Tests4gptplay/dsh-codex-native/tree/main/docs).

## 中文
0.2.3 修正安装包内中英文版本说明和安装地址，补全插件管理器功能介绍，并随包提供发行说明。实际模型、工具与运行代码沿用已测版本，不因本次文档修正而改变。Desktop 在“插件 → 添加插件”的“包名或地址”填入上方固定版本来源，TGZ为备用；按实际安装结果和重启提示操作。Web 使用上方命令，保留已有配置和账号存储。

既有实测覆盖范围与未覆盖项保持区分：Host 写入审批成功不冒充原生命令/文件协议审批实测，Windows 辅助程序维护不等于提供桌面控制引擎；不新增 macOS 实机通过声明。

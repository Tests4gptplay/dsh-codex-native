# Install Codex Native / 安装 Codex Native

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

## Sign in and select a model / 登录与选择模型

In **Settings → Codex official login**, sign in with your ChatGPT account. Select **Codex (local login)** as the model provider and choose a model. The available models are loaded from the official App Server when DSH requests the list. Existing installations reuse their saved sign-in and configuration.

在 **设置 → Codex 官方登录** 中登录 ChatGPT 账号，再选择 **Codex (local login)** 提供方和所需模型。DSH 请求模型列表时会从官方 App Server 读取最新目录；已有安装沿用保存的登录与配置。

The plugin uses DSH-provided host modules with unrestricted DSH peer version ranges and includes official Codex `latest` as a dependency. The Git tag contains prebuilt plugin runtime files; DSH installs its dependencies through the native plugin installer.

插件使用 DSH 宿主提供的模块，DSH 的 peer 依赖版本范围不设限制，另依赖官方 Codex `latest`。固定 Git 标签已包含预构建的插件运行文件，依赖由 DSH 原生安装流程准备。

## Questions during a task / 任务中的提问

Codex questions appear through DSH's native question cards and notifications. Choose an option or enter your own answer, then submit. Asynchronous answers are delivered to the active task and shown in Chat as user messages automatically.

Codex 中途提问通过 DSH 原生卡片和通知呈现。点选选项或输入自己的回答后提交，异步回答会自动送回当前任务，并在聊天中显示为用户消息。

## Skill discovery / 技能发现

The default `skillsMode: dsh` provides `codex_skill_search` and `codex_skill_read` to DSH models. Search first, then read the selected skill. The catalog covers enabled local skills and installed remote connector skills; duplicate skills from the same plugin prefer the connector. Use `refresh: true` after changing skills or plugins.

默认 `skillsMode: dsh` 向 DSH 模型提供 `codex_skill_search` 和 `codex_skill_read`，先搜索再读取。目录覆盖已启用的本地技能和已安装的远程连接器技能，同一插件的重复技能优先连接器。技能或插件变化后可用 `refresh: true` 更新目录。

`skillsMaxContextTokens` defaults to `10000`. `skillsMode: native` selects Codex's native skill catalog. These settings apply to plugin-owned processes.

`skillsMaxContextTokens` 默认为 `10000`；`skillsMode: native` 可切换至 Codex 原生技能目录。设置作用于本插件启动的进程。

## Earlier integration notes / 历史集成说明

Earlier alpha.9 source-host integration notes remain in the [engineering installation guide](INSTALL_PATCHED_HOST.md).

较早的 alpha.9 宿主源码集成步骤保留在 [工程安装记录](INSTALL_PATCHED_HOST.md)。

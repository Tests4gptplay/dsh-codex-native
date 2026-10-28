# Install Codex Native / 安装 Codex Native

## Desktop

Open **Plugins → Add plugin**, paste the fixed-version source below, and enable the plugin.

打开 **插件 → 添加插件**，粘贴以下固定版本来源并启用：

```text
github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.9-http.10
```

## Web

```sh
dsh plugin --profile web add 'github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.9-http.10'
```

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

## Alternative package / 备用安装包

Download the TGZ from the [Release](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.9-http.10), then enter its absolute path in **Add plugin**. `SHA256SUMS` records the package checksum.

也可以从 [Release](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.9-http.10) 下载 TGZ，在 **添加插件** 中输入其绝对路径。文件校验和见 `SHA256SUMS`。

Earlier alpha.9 source-host integration notes remain in the [engineering installation guide](INSTALL_PATCHED_HOST.md).

较早的 alpha.9 宿主源码集成步骤保留在 [工程安装记录](INSTALL_PATCHED_HOST.md)。

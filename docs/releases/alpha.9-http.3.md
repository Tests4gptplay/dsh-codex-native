# Codex Native alpha.9-http.3 — HTTP stability and on-demand skills

## 更新内容

- OpenAI 路由直接使用认证 HTTP，沿用现有 ChatGPT 登录，减少 WebSocket 断流后的重连等待。
- 相同的普通、配置及弃用警告在同一会话中显示一次，重新打开会话后沿用已显示记录。
- 新增 `codex_skill_search` 和 `codex_skill_read`，统一搜索本地与远程连接器技能，需要时再读取正文。同一插件的重复项优先使用连接器，独立本地技能保留。
- 技能预算设为 10,000 tokens，启动提示使用简短发现入口。工具供 DSH 的 HTTP 和本地模型使用。
- 保留既有登录、Token 历史界面、上下文管理和原生工具。

## 安装与升级

Desktop：**插件 → 添加插件**，粘贴并启用：

```text
github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.9-http.3
```

Web：

```sh
dsh plugin --profile web add 'github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.9-http.3'
```

固定 Git 标签包含预构建运行文件，升级保留配置与登录。Release 同时提供备用 TGZ 与 SHA-256 校验和。

## What's new

- Authenticated HTTP for the OpenAI route with existing ChatGPT sign-in.
- Session-scoped warning deduplication, including restored sessions.
- On-demand local and connector skill search/read through DSH, preferring connectors for duplicate plugin skills.
- A 10,000-token native skill budget and compact startup discovery instructions.
- Existing login, Token history UI, context management, and native tools retained.

Windows: 44 focused tests passed; build, local installation, and live local/connector skill reads passed.

[Installation guide](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/INSTALL.md)

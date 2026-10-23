# DSH Codex Native

**基于 OpenAI 官方 Codex app-server 的 DeepSeek Harness 主模型插件** · 独立社区项目 · MIT

> **已发布测试预览版：0.2.1-alpha.3。** 面向 DSH 0.2.1-rc.2。117 项非账号单元测试、类型检查、Linux/Windows DSH Web Profile 加载测试和 GitHub 无构建许可安装已通过；**真实 ChatGPT 账号登录、桌面 Electron 集成和 Codex 原生交互审批仍未验收。** [本版 CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39879247613)。

[English](README.md) · [开发进度与验收边界](docs/STATUS.md) · [截图来源](docs/SCREENSHOTS.md)

## 项目做什么？

将本地**官方 OpenAI Codex app-server**注册为 DSH 的`codex-local`主模型提供方。与 DSH 官方仅提供一次性子 Agent 的 Codex 组件不同，这里的 Agent Loop、工具调度和持久会话仍归 DSH，模型推理通过 `@openai/codex@0.154.0` 的原生 app-server 协议执行。

- **不用 OpenAI API Key**：选择 Codex 管理的 ChatGPT 账号登录，由 Codex 自己保管和更新 OAuth 凭据。请求消耗**适用的 Codex/ChatGPT 计划额度**，不代表普通 Chat 消息额度或无限免费调用。
- **DSH 主对话选模型**：把 Codex 注册进原生模型目录，保留多轮会话与 DSH Agent Loop。
- **官方登录入口（移植中）**：DSH「设置 → Codex 官方登录」计划支持浏览器授权、设备码、状态、退出登录和查询原生 Codex 用量；不会向网页客户端提供 OAuth token。
- **DSH 原生工具**：app-server Dynamic Tools 映射到 DSH 自己的执行路径。Codex 仍具有自己的系统指令/工具层，不是裸模型 API。
- **会话处理与多模态**：继承上游的 Codex Session Cache、流式事件和图片附件映射；在当前 DSH 0.2.1 上仍需完整验收。

## 登录流程

```text
DSH 设置 → Codex 官方登录
    ├─ 使用 ChatGPT 登录 → 打开 OpenAI 官方授权页
    └─ 使用设备码登录 → 官方验证页 + 验证码
                   ↓
        官方 codex app-server 管理凭据
                   ↓
         DSH 主模型选择 codex-local
```

插件调用 **`account/read`、`account/login/start`、`account/login/completed`、`account/logout` 和 `account/rateLimits/read`**。浏览器登录回调由 Codex 原生进程负责，远程 Host 优先使用设备码。不会自动发送 API Key，也不通过第三方 ChatGPT 私有订阅模型接口。

**注意：** 这是已编码的实现路径，目前账号登录/设备码尚未在真实 DSH + 真实 ChatGPT 账号组合上验收；请以实际 CI 与后续测试记录为准。

参考：[OpenAI Codex app-server 官方文档](https://developers.openai.com/codex/app-server/)。

## GitHub 桌面安装（v0.2.1-alpha.3 测试版）

打开 DSH 桌面应用，选择 **插件 → 添加插件**，将下列整行粘贴到安装框：

```text
github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.3
```

安装完成后启用插件、重启 DSH，进入 **设置 → Codex 官方登录**，使用具备 Codex 权限的 ChatGPT 账号登录，再在主聊天模型选择器中查找 `codex-local`。

**新版本安装标签仅含 22 个文件**：预编译 JS、类型声明、插件清单、Cordis 补丁、LICENSE 和 README。没有 `src/`、`tests/`、CI、构建脚本、开发依赖或旧 UI；不需要本地编译 TypeScript，也不需要修改 `allowBuilds`。

[GitHub Release](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.3) · [真实安装链路的云端 CI 记录](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39879247613) · [代码与打包审计](docs/AUDIT.md)

这是方便实机测试的 Alpha 版。Linux/Windows 的 DSH Web Profile **加载检查已通过**，但不等价于 Windows 桌面 Electron 实际登录及完整模型工具验收。

## 当前实现与待验证事项

| 项目 | 当前状态 |
|---|---|
| MIT 上游源码导入；独立公库 | 已完成 |
| `@openai/codex` app-server 主模型适配器 | 代码已移植 |
| DSH 0.2.1 Tool Role / `StreamChunk` 类型适配 | 类型检查及 117 项非账号单测通过；真实 Codex E2E 未执行 |
| 插件设置页官方浏览器/设备码登录 UI | 已编写，待真实 Host 验证 |
| 官方 Codex 额度读取 | 已编写，待真实 Host 验证 |
| 多轮真实 Codex、插件安装及 Windows 运行 | 尚未验收 |
| GitHub 测试预发行版 | `v0.2.1-alpha.3`；精简标签、Linux/Windows Web Profile 与安装测试通过；真实登录和 Electron 待验 |

详细测试证据与阻断项维护在 [docs/STATUS.md](docs/STATUS.md)，每次主要功能变化均以**实际状态**更新 README，不以“代码存在”等同“已验证”。

## 项目界面（自有截图）

本仓库不使用原作者的旧界面截图。下图为[独立 GitHub Actions 截图流程](https://github.com/Tests4gptplay/dsh-codex-native/actions/workflows/docs-preview.yml)从**当前 `CodexNativeSection.tsx` 登录组件**生成的英文未登录预览。欢迎文案明确提示：需要具有 Codex 权限的 ChatGPT 账号，而非单独的 OpenAI API Key。

![DSH Codex Native：Welcome to Codex，提示使用具有 Codex 权限的 ChatGPT 账号登录（英文组件预览）](docs/screenshots/codex-native-login-en.png)

*图：英文登录组件预览，未连接 DSH Host、未使用真实账号。外围导航是独立预览外壳，**不是 DSH 实机截图，也不是 OAuth 登录成功证明**。*

截图生成方式与实机验收条件见 [docs/SCREENSHOTS.md](docs/SCREENSHOTS.md)。

## 实现边界

此插件使用由 OpenAI 发布的 **`codex app-server`**，而不是直接调用 ChatGPT 网页或直接用社区 OAuth 适配器访问私有后台。

DSH 负责主会话历史、工具执行和权限；Codex 自身还会加入原生上下文、指令及可启用的原生能力。两者协作的边界按上游 [ADR 0002](docs/adr/0002-use-app-server-as-a-layered-codex-provider.md) 保留。

**这是客户端插件，不是 OpenAI 官方发布的 DSH 产品。** 账号/额度必须以真实 Codex 返回值为准。该插件不应被理解为免除网络访问、订阅计量或所有本地安装占用。

## 致谢和许可

本项目移植自 [wss534857356/dsh-plugin-codex](https://github.com/wss534857356/dsh-plugin-codex) 的 MIT 许可实现（基线 commit `f1f61886f4defcf7294d63c3641fba01ee554e7b`），保留原始 LICENSE 和历史 ADR 作为来源与研究依据。官方 Codex 引擎来自 OpenAI 的 `@openai/codex`，DSH 框架来自 DeepSeek。三方互不构成官方背书。

如文档与实际测试冲突，以 [Actions CI](https://github.com/Tests4gptplay/dsh-codex-native/actions) 和当前源码为准；未通过的能力明确标记待验收。

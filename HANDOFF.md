# 接续入口：Codex 历史查询 / 原生控件 — 已交付 alpha.5

更新：2026-10-23。开发分支：`feat/usage-history-ui`。阅读顺序：本文件 → [交付核验](docs/DELIVERY-alpha5.md) → [隔离 DSH 测试方法](docs/TESTING_WORKSPACE.md) → [用量规则](docs/USAGE.md)。

## 当前结论（更正旧记录）

**固定安装版本 `v0.2.1-alpha.5` 已发布，可按原需求进行真实账号安装测试。**

```text
github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.5
```

[Release](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.5)。该 Release 实际在 **2026-10-23 13:16:44 UTC** 已发布；上一轮 HANDOFF 把它描述为未发布，是遗漏，不是后续需要再次发版。**不要覆盖现有标签，也不要为了文档纠正制造 alpha.6。**

本轮检查没有改生产代码。下载了保存分支的 CI artifact，计算运行文件 Git blob，与 alpha.5 标签完全一致：

- `lib/index.js`：122045 bytes，`a29fd789061d2fdf2660dc944e22db1b6b69ad57`
- `lib/client.js`：25925 bytes，`ba4fd9fbaba03f81fa4e4beb24901ae4083716d8`
- `cordis.patch.yml`：2304 bytes，`135a27ce43c9be6350ec495502f6645208569c12`

Tag tree `a823c35cad477ed5518a951b69666696dc0e0d91`。发布包没有 scripts/devDependencies，没有 tests/src/scripts/.github、预览截图或 mock。开发 CI artifact 的 package.json 仍有开发字段，**它不是用户安装包**。

主分支文档专用提交 `024329ee13e5aa3b6601dfec8864bd7354d50247` 仅同步双语 README、STATUS 和 DELIVERY；没有合并本功能分支、没有改生产代码和旧标签。本分支保留原有 CI 触发范围、测试环境说明及全部工作，文档与主分支同版。

## 用户要求与当前实现（必须保留）

1. 历史用量直接读官方 `account/usage/read`，账号口径；不另造累计账本。
2. **只有点击查询才读取历史**。打开页面、展开、清除不查询；没有用量后台轮询、聊天钩子或额外模型调用。原有 OAuth 完成状态计时器不是用量轮询。
3. 顶部同一行：唯一“清除”、查询、列表总用量。折叠周期保留合计，展开每日明细；周期或每日行没有删除按钮。
4. 清除只清本页显示，不删官方历史/聊天，不退登录，不用重置券；再查询会重新返回官方历史。
5. 官方当前窗口/下次重置来自 `account/rateLimits/read`；没有虚构官方历史重置接口。历史分组用用户指定的 codex-reset.com **文档明确的已宣布重置**，按 UTC 日期整桶归组，**仅供参考**；不将其当个人账户真实重置，不假造日内 token。
6. 表格下标明 token 来源、周期来源、仅供参考、清除含义。第三方公共 GET 不携带凭据/邮箱/账号/用量/提示词；60秒 on-demand cache + Retry-After，无刷新定时器。
7. 登录与统计区使用宿主官方 Button、DisclosureRow、--dsw-* 变量。测试用 CSS alias 与示例配色不进入生产。
8. 测试/mock/源码/CI/截图/开发依赖/安装 hooks 不随安装；不要改用户 allowBuilds；统计故障不能停止 Agent。
9. README 与实际版本一致；截图仅用本项目实际组件，示例数据说明，不公开用户邮箱或令牌截图。

## 真实证据，不用旧 alpha.4 冒充新功能

- [原始 alpha.5 跨平台测试 #39959031468](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39959031468)，source `de9f3b766a5bbc9d03f2846186c8f1f8eee6424a`。
- [保存分支重新验证 #39961943894](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39961943894)，source `291ce24fef48db4d30676d2e0048178db7574b55`：Ubuntu/Windows 均 success。手动查询/单清除/展开不请求/失败保留旧值/来源文案的实际断言通过。
- [发布 #39959807125](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39959807125)，job `120434651081` 全部步骤 success：使用已测构建、精简 manifest、真实 DSH Web Profile 安装/装配、固定 Git 标签无 allowBuilds 例外安装、Release 上传。
- artifact `12504514277` 已下载并对比运行字节；这轮没有重新运行模型或使用真实账号。
- 功能源码相对已发布基线无变化，GitHub compare 只有工作流、交接/测试文档和预览图片的变化。

## 代码入口与预览

`src/usage.ts` 数据/分组，`src/usage-query.ts` 手动读取，`src/native-account.ts`/`native-transport.ts` 官方账号桥接，`src/client/UsagePanel.tsx` 统计 UI，`CodexNativeSection.tsx` 登录与原生按钮，`native-locales.ts` 文案。测试入口：`tests/usage.spec.ts`、`tests/usage-ui.spec.tsx`、`tests/docs-preview.spec.tsx`、`tests/official-primitives.ts`。

[浅色预览](docs/screenshots/codex-usage-light.png)、[深色预览](docs/screenshots/codex-usage-dark.png) 已持久保存；它们使用示例数据，不是登录账号截图。当前容器 Chromium 新渲染尝试超时，没有产生新截图，不应声称这轮截图成功；已打开核对既有源码关联预览。

## 隔离环境方法不要丢失

完整可重建步骤在 [TESTING_WORKSPACE.md](docs/TESTING_WORKSPACE.md)：固定 DSH 源码 `687f282e8625c6b8d11ff58211a90524be2e4317`，DSH 0.2.1-rc.2、Codex 0.154.0、Node24、pnpm11.7.0；独立 DSH_HOME/CODEX_HOME；真实 DSH 框架/控件 + 测试边界 mock；stdIO、jsdom、原生CSS截图、Host加载、最小发行物及清理规则。没有强制 Docker，没有触碰用户本机。

当前临时容器无法解析 github.com，Node22.16.0、无pnpm；GitHub connector 能读写并下载 CI artifacts。不要反复 clone，不要因此改用户电脑。需要补测时复用本分支现有 CI，不新增重复 workflow。测试产物只在开发目录/云端 artifact，不随发行。

## 仍未认证的事项 / 后续工作

- 真实账号历史返回范围、null/延迟、完整 Electron 及用户皮肤组合；不是本轮 mock 或 --dump-config 可以证明的。
- 原生 Codex 审批交互桥接是已有独立问题，不把统计 UI 收尾说成解决了整个运行时。
- 原先默认5分钟硬杀/全局禁用原生功能/擅自拦截 web_search 的清理保留，不为统计页面重加。
- 后续收到用户真实问题时，针对该问题在本分支修复，再用新不可变版本发出；不要重写历史数据或已有标签。

**本轮交付已核验；现在应向用户提供 alpha.5 的固定安装码，不再停在“还没发布”的旧记录。**

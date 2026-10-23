# 接续入口：Codex 历史用量与原生设置 UI

更新日期：2026-10-23。**唯一接续工作分支：`feat/usage-history-ui`。**

## 0. 先从这里恢复，不依赖上一页聊天

本分支从实读的 `main` 提交 `866b1fcc731dc68668e69e336b3094c58f2a94a5` 创建；基线已经有用量功能开发代码、说明和浅/深色截图。分支保存完整基线并继续开发，**没有重写 main，没有覆盖任何已有标签，没有在本轮发布新版本**。

用户要求先保存分支和情况记录再继续，且必须保存“在临时工作区搭建隔离 DSH / 模拟 Codex 后端测试插件”的方法。现有 GitHub 连接器已经实测可以写：创建分支、写文档和修改该分支 CI 都成功。不需要让用户再开公库，不需要再为 GitHub 写权限找其他插件。

已持久化的主要检查点：

- `e4666d9bbac0c693e76200b20a35fa184d0a7e96`：首次需求与接续记录。
- `5d6643952103e79d045f20766c679991eaea454a`：[临时 DSH / 模拟 Codex 测试方法](docs/TESTING_WORKSPACE.md)。
- `291ce24fef48db4d30676d2e0048178db7574b55`：复用既有 CI 验证当前分支；只有 CI 触发范围变化，未改生产代码。

## 1. 用户确定的需求（不要再问，不要改方向）

- 历史 token 优先调用官方 Codex app-server `account/usage/read`；不要另造从插件安装时开始累计所有用量的系统。默认是**账号**历史，不标为仅本插件消耗。
- **只有用户点击查询才查询用量**。没有用量定时器、后台轮询、打开页面自动拉历史或每次聊天附加查询。已有登录完成状态轮询是另一个功能，不得混淆。
- 顶部同一行显示总用量、唯一的“清除”和“查询”按钮；周期/每日行不要添加删除按钮。
- 周期可折叠，折叠行显示该周期总用量，展开显示每日用量。版式参考用户手绘但要优化层次、对齐和可读性。
- 重置周期优先官方；当前没有完整官方历史重置流水时，参考用户指定 `codex-reset.com`。公共事件不是当前账号实际重置的权威证明。
- 每日聚合不能精确分开日内重置前后 token；不能编造准确分配或固定周周期。当前实现以 UTC 日期整桶分组，重置日归新参考组，必须说明只是参考。
- 清除只清当前页面缓存/显示，不删除 OpenAI 账号历史、不用重置券、不退出登录、不删聊天。再次点击查询会重新显示官方历史。
- 表格下必须注明 token 查询来源、重置周期来源、周期仅供参考和清除行为。
- 登录区/统计区复用 DSH 官方 Button、DisclosureRow 和主题变量，兼容皮肤；不使用突兀的默认按钮或硬编码生产配色。
- 测试、mock、源码、CI、截图生成程序、devDependencies、安装生命周期脚本不能进入 GitHub 安装标签/发行包。不改用户 allowBuilds，不因为统计失败阻断模型或工具。
- 中英文 README、说明与实现同步；只用本项目真实组件截图，示例数据明示；不上传含邮箱/令牌的原始用户截图。

## 2. 当前已保存的实现与预览

源代码声明版本是 **`0.2.1-alpha.5` 开发版**。声明版本和 CI 打包成功不等于该版本已发布。

| 文件 | 作用 |
|---|---|
| `src/usage.ts` | 用量数据转换、周期分组与第三方参考数据规则 |
| `src/native-account.ts` / `src/native-transport.ts` | 通过官方 app-server 和 DSH 现有连接提供账号查询 |
| `src/client/UsagePanel.tsx` | 手动查询、单个清除按钮、总计、折叠每日用量和来源说明 |
| `src/client/CodexNativeSection.tsx` | 登录页与用量页组合，原生账号按钮 |
| `src/client/native-locales.ts` | 中英文文案 |
| `tests/usage.spec.ts` | 数据归一化与分组回归 |
| `tests/usage-ui.spec.tsx` | jsdom 中真实组件的查询/清除/展开交互 |
| `tests/docs-preview.spec.tsx` / `tests/official-primitives.ts` | 原生控件和 CSS 的离线示例预览 |
| `docs/USAGE.md` | 功能、数据来源和限制说明 |
| `docs/TESTING_WORKSPACE.md` | 下次可复用的隔离环境、测试和截图命令 |

预览已随基线保存，不仅留在临时缓存中：

- [浅色原生控件预览](docs/screenshots/codex-usage-light.png)
- [深色原生控件预览](docs/screenshots/codex-usage-dark.png)

预览是官方控件+本插件组件+示例数据，不是已登录账号或完整 Electron 截图。正式 UI 引用宿主的控件/皮肤，测试 alias 与示例颜色不进入生产。

## 3. 本轮实际验证（不要用旧 alpha.4 结果冒充）

**[当前分支 CI #39961943894](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39961943894)，受测提交 `291ce24fef48db4d30676d2e0048178db7574b55`。** 已逐 job 读取结果：

| Job | 结果 | 已完成步骤 |
|---|---|---|
| `build (ubuntu-latest)`，120441855206 | success | 官方 DSH 固定源码、开发依赖、typecheck、回归测试、build/pack、artifact 上传 |
| `build (windows-latest)`，120441854611 | success | 同上；Windows 专属原生启动检查由当前测试集合执行 |

测试使用 DSH 源码提交 `687f282e8625c6b8d11ff58211a90524be2e4317`、DSH `0.2.1-rc.2`、Codex `0.154.0`、Node 24、pnpm 11.7.0。使用现有 `.github/workflows/ci.yml`，只扩展为在本分支也运行，不创建多余 workflow，不触发发布。

已核对 `tests/usage-ui.spec.tsx` 的实际断言：挂载/展开不查询；点击 Query 才调用 usage；一个顶部 Clear 只清空视图；再次查询恢复结果；失败保留前次统计；来源/仅供参考文字存在。云端通过的是当前代码的这些回归，不是未经登录的真实账号数据证明。

当前 ChatGPT 容器状态：旧完整 checkout/node_modules 没有保留，只有预览图、旧 alpha.4 ZIP 和 stage/README；Node v22.16.0，无 pnpm；一次 clone 因无法解析 github.com 失败。没有反复重试，也没有改用户电脑。GitHub 连接器写入与云端 CI 正常；复现与回退方法已完整记录。

## 4. 仍待完成/需要保留的边界

- 实际账号 `account/usage/read` 的返回范围、null 情况、服务更新延迟，以及真实网络下第三方 feed 的变化；不能拿固定 fixture 当用户实测。
- 完整 Electron/皮肤组合实测，不等于 jsdom/SSR/`--dump-config` 通过。
- 原生 Codex 交互审批桥接的既有局限没有因为本次统计页面而被解决。
- 当前 CI 的 .tgz 是开发候选包，不直接交付。发布前要清理 manifest 的 scripts/devDependencies，并核对最终 Git 标签和 TGZ 两个真实文件清单。
- `docs/STATUS.md` / 部分发布说明保留 alpha.4 的历史验收口径；不要无条件覆盖历史证据。正式推进新版本时同步新旧版本、测试和截图说明。

## 5. 下一步

1. 从本分支读取本文件和 [测试工作区文档](docs/TESTING_WORKSPACE.md)，不要让用户重述需求。
2. 需要重跑时直接复用当前分支 CI；需要浏览器实际交互时在隔离工作区创建自己的 DSH_HOME/CODEX_HOME，明确 mock 与真实 Host 的边界。
3. 完成必要的真实环境/发行物验收，再同步中英文 README 和发布说明；不要把开发分支直接给用户安装，不覆盖旧标签，不自动合并本分支。

特别避免：安装脚本偷偷编译；删除 renderer 但继续发送私有内容块；未知/null 记成 0；百分比下降即擅自标实际重置；把统计故障升级为全插件停止；把 mock 或截图说成真实账号验收。

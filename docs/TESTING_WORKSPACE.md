# 临时工作区里的隔离 DSH / 模拟 Codex 测试方法

日期：2026-10-23。接续分支：`feat/usage-history-ui`。先读 [HANDOFF.md](../HANDOFF.md) 和 [USAGE.md](USAGE.md)。

这份文档把此前的方法保存为可复现步骤。这里的“模拟 DSH 容器”指临时工作区中的隔离测试环境；现有实现不依赖 Docker，也不声称已在云端运行完整 Electron 桌面或登录用户的 Codex。测试使用真实 DSH 框架/控件，在必要边界注入假的 Codex 协议或账号返回值。不是修改用户 DSH、拦截真实令牌或冒充官方服务。

## 1. 已有材料和测试层级

| 层级 | 仓库中的实际入口 | 验证什么，不能证明什么 |
|---|---|---|
| 用量数据规则 | `tests/usage.spec.ts`、`src/usage.ts` | 官方每日用量归一化、数字精度、参考周期分组、第三方数据故障隔离；不证明用户账号一定返回历史 |
| 原生控件交互 | `tests/usage-ui.spec.tsx`、`src/client/UsagePanel.tsx` | jsdom 中挂载真实 React 组件，点击查询/折叠/清除；不用假的 HTML 按钮替代官方控件 |
| 原生样式预览 | `tests/docs-preview.spec.tsx`、`tests/official-primitives.ts`、`vitest.config.ts` | 真实 DSH Button/DisclosureRow 源码与模块 CSS，导出浅色/深色 HTML；示例用量不是真实账号 |
| Codex stdio 替身 | `tests/mock-stdio.spec.ts`、`tests/fixtures/mock-app-server.mjs` | 真子进程、真 DSH LocalSubprocessRuntime、真插件映射器；只有对端返回值是固定 fixture，无联网和真实 shell 执行 |
| DSH 聊天渲染回归 | `tests/official-renderer.spec.tsx` | 读取固定官方 DSH AssistantMarkdown 源码，验证未知内容块不会泄漏；外围叶子控件替身不等于完整桌面 |
| Windows 原生启动 | `tests/launch.spec.ts` | Windows 上启动真实官方 Codex 二进制，空 CODEX_HOME，仅 initialize/account/read；不使用订阅账号、不发送模型任务 |
| Host 装配/安装 | 历史发布 workflow 中的官方 DSH Web Profile smoke | 打包后插件能被 DSH 加载，配置里有 codex-local；`--dump-config` 不是聊天 E2E，也不是视觉验收 |
| 真实账号/桌面 | 单独授权的实机验收 | OAuth、额度/历史真实返回、完整工具往返、Electron 皮肤组合；不能用 mock 冒充此层 |

## 2. 固定版本与目录边界

当前源码依赖：Node 24（项目 engines 至少为 `^22.19.0 || >=24.0.0`）、pnpm `11.7.0`、DSH `0.2.1-rc.2`、Codex `0.154.0`。官方 DSH 参考源码固定为：

```text
https://github.com/deepseek-ai/deepseek-harness
687f282e8625c6b8d11ff58211a90524be2e4317
```

建议每次创建自己的临时根目录；它只是 agent/云端 Runner 的工作目录，不是用户需要维护的本地项目：

```text
<temporary-root>/
  plugin/                    # 本分支 checkout
    .tmp/dsh-reference/      # 固定提交的官方源码，仅测试使用
    node_modules/           # 开发依赖，不能复制进发行快照
  homes/dsh/                # 隔离 DSH_HOME
  homes/codex/              # 隔离、未登录 CODEX_HOME
  evidence/                 # 日志、HTML、截图、文件清单
  distribution/             # 严格按发行白名单构造的运行快照
```

`DSH_HOME` 和 `CODEX_HOME` 都必须指向这次自己创建的目录。不要继承或挂载用户的 `~/.dsh`、`~/.codex`、浏览器会话或 auth.json。不要配置 API Key，不要复制 token，不在公共 artifact 中输出邮箱、登录验证码或授权 URL。

## 3. 重建临时环境（Bash，联网云端 Runner）

以下命令是给后续 agent/CI 的，不要求用户在自己的电脑上执行。先确认 Node/pnpm 版本已经由 Runner 提供；不修改用户系统全局 Node 设置。

```bash
set -euo pipefail
node --version
pnpm --version
ROOT="$(mktemp -d "${TMPDIR:-/tmp}/dsh-codex-test.XXXXXX")"
mkdir -p "$ROOT/homes/dsh" "$ROOT/homes/codex" "$ROOT/evidence"
export DSH_HOME="$ROOT/homes/dsh"
export CODEX_HOME="$ROOT/homes/codex"
unset OPENAI_API_KEY

git clone --single-branch --branch feat/usage-history-ui \
  https://github.com/Tests4gptplay/dsh-codex-native.git "$ROOT/plugin"
cd "$ROOT/plugin"
git rev-parse HEAD | tee "$ROOT/evidence/plugin-commit.txt"

mkdir -p .tmp/dsh-reference
git -C .tmp/dsh-reference init -q
git -C .tmp/dsh-reference remote add origin \
  https://github.com/deepseek-ai/deepseek-harness.git
git -C .tmp/dsh-reference fetch --depth 1 origin \
  687f282e8625c6b8d11ff58211a90524be2e4317
git -C .tmp/dsh-reference checkout --detach FETCH_HEAD
export DSH_REFERENCE_ROOT="$PWD/.tmp/dsh-reference"
export DSH_REPRO_OUTPUT="$ROOT/evidence"

pnpm install --no-frozen-lockfile --ignore-scripts
pnpm run typecheck
pnpm run test:ci
pnpm run build
```

`--no-frozen-lockfile` 是当前仓库已有 CI 的方式，不是可复现锁文件已验收的声明。安装可能更新临时 checkout 的锁文件；记录版本/差异，不把无关改动自动混入 Git 提交。开发依赖安装用 `--ignore-scripts`；编译和测试是明确在云端执行的单独步骤，不在用户安装插件时自动触发。

Windows Runner 同样先创建专属临时目录，再设置：

```powershell
$env:DSH_HOME = Join-Path $env:RUNNER_TEMP 'dsh-codex-usage-test/dsh'
$env:CODEX_HOME = Join-Path $env:RUNNER_TEMP 'dsh-codex-usage-test/codex'
$env:DSH_REFERENCE_ROOT = Join-Path $env:GITHUB_WORKSPACE '.tmp/dsh-reference'
$env:DSH_REPRO_OUTPUT = Join-Path $env:RUNNER_TEMP 'dsh-codex-usage-test/evidence'
New-Item -ItemType Directory -Force $env:DSH_HOME,$env:CODEX_HOME,$env:DSH_REPRO_OUTPUT | Out-Null
```

## 4. 如何“假装成插件的 Codex 后端”

现有 `tests/mock-stdio.spec.ts` 的实现是可直接复用的标准做法：

1. 创建真实 Cordis `Context`，装载官方 `@deepseek-ai/dsh-subprocess-local`。
2. 创建真实 `CodexAppServerRunner`，仅在测试构造参数的 `spawn` 函数中，把 `argv` 改为 Node 执行 `tests/fixtures/mock-app-server.mjs`。
3. 对端通过 stdin/stdout 逐行 JSON-RPC 响应 initialize/thread/turn，并重放 lifecycle、moderation、操作完成和回复/错误事件。
4. 原样经过真实 `DshCodexAdapter`，断言答复、工具、真实失败不丢失，私有诊断不再污染可见内容。
5. `finally` / `afterEach` 释放 adapter 与 Context；退出后不保留测试子进程。

运行：

```bash
pnpm exec vitest run tests/mock-stdio.spec.ts tests/presentation.spec.ts \
  tests/official-renderer.spec.tsx tests/launch.spec.ts
```

这个替身只存在于开发测试目录。正式入口不得读取 `TEST_CODEX_SCENARIO` 或任何“切换假后端”的环境变量；不得将 mock 子进程注册为生产模型。测试用 15 秒/30 秒 timeout 是测试资源回收边界，不能复制成插件长期任务的额外硬超时。

用量页面采用更窄的替身：`NativeCodexRpc.call` 由测试注入固定 snapshot / failure，不读取真实账号，也不需要模型推理。这比启动真实账号、耗额度“测页面”更小且可重复。

## 5. 手动查询 UI 的可复现验证

当前 `tests/usage-ui.spec.tsx` 使用 jsdom、React `act`/`createRoot` 和真实页面组件。它直接检查：

- 挂载页面时 `rpc.call` 次数为 0；不会自动查询用量。
- 点击查询只调用 `usage`；查询后顶部合计来自返回的每日数据。
- 展开周期不增加请求；总清除按钮只有一个。
- 清除只把页面结果/总计清空，不联系服务；再次查询能恢复官方返回的历史。
- 查询失败时保留之前成功取得的统计，并显示错误。
- 表格下面存在 `account/usage/read`、`codex-reset.com`、周期仅供参考和清除行为说明。

```bash
pnpm exec vitest run tests/usage.spec.ts tests/usage-ui.spec.tsx \
  tests/client-renderer.spec.tsx tests/docs-preview.spec.tsx
```

测试文件存在不等于这些断言本轮已经通过；必须查对应 commit 的 CI 结果，并把结果记录在 HANDOFF。

## 6. 复用官方控件和截图，不自画一套假 DSH

`vitest.config.ts` 把测试中的 `@deepseek-ai/dsh-client-ui-primitives` 指向 `tests/official-primitives.ts`；后者使用 `#dsh-primitives` 导向已固定的官方源码。测试实际处理 Button、DisclosureRow、TextShimmer 的模块 CSS。生产则仍引用宿主 DSH 的组件，不把测试 alias 或第二份皮肤 CSS 打包。

`tests/docs-preview.spec.tsx` 使用真正的 `UsageView`，以明确标注的示例数据渲染 HTML：

```bash
mkdir -p "$ROOT/evidence"
DSH_REPRO_OUTPUT="$ROOT/evidence" pnpm exec vitest run tests/docs-preview.spec.tsx
# 产生 usage-light.html、usage-dark.html，以及兼容旧截图入口的 en.html。
```

在临时 Runner 有 Chrome 时可截图：

```bash
CHROME="$(command -v google-chrome || command -v google-chrome-stable || command -v chromium)"
for MODE in light dark; do
  "$CHROME" --headless=new --disable-gpu --disable-dev-shm-usage \
    --hide-scrollbars --window-size=1120,1100 \
    --screenshot="$ROOT/evidence/usage-$MODE.png" \
    "file://$ROOT/evidence/usage-$MODE.html"
done
```

优先让浏览器正常使用自己的沙箱；若某个一次性容器要求无沙箱运行，只能在无秘密且不打开不可信页面的隔离测试环境中单独配置，不能修改用户 DSH 或系统浏览器设置。

截图必须检查字是否被裁切、总数对齐、折叠图标/状态、两个顶栏按钮、下方来源说明、浅深色对比。当前预览文件已在 `docs/screenshots/codex-usage-light.png` 和 `codex-usage-dark.png`。它们是原生控件的隔离示例视图，不是登录用户的完整桌面截图。示例 token、测试配色和字体设置只在测试 HTML，正式 UI 继承 `--dsw-*` 变量。

## 7. 真 DSH Host 加载检查不能与模拟测试混称

先构造最小发行目录：只从构建产物复制 `lib/index.js`、`lib/client.js`、必要 `.d.ts`、`cordis.patch.yml`、LICENSE、README、package.json；移除 manifest 中 `scripts`、`devDependencies`、`packageManager`、`publishConfig`。`pnpm pack` 开发 checkout 的结果不自动等于已清理的发行包，必须复核 manifest 和文件清单。

只在临时 DSH_HOME 下，用该待测 .tgz 做官方 Host 装配检查：

```bash
# CANDIDATE 指向上一步已清理、核对过的绝对 .tgz 路径。
test -n "${CANDIDATE:-}" && test -f "$CANDIDATE"
pnpm dlx @deepseek-ai/dsh@0.2.1-rc.2 plugin --profile web add "$CANDIDATE"
pnpm dlx @deepseek-ai/dsh@0.2.1-rc.2 --profile web --dump-config \
  > "$ROOT/evidence/dsh-profile.txt"
grep -F codex-local "$ROOT/evidence/dsh-profile.txt"
```

这只证明包能装配、模型配置存在，不证明点查询时远程账号返回有效数据。真实浏览器交互、Electron 窗口、用户皮肤与完整工具往返要另做实际验证；不能把上面 grep 通过包装成“完整 DSH 已验收”。

## 8. 当前恢复环境与 GitHub 回退

2026-10-23 本次接续检查发现：当前 ChatGPT 容器只有预览图片、旧 alpha.4 复现 ZIP 和旧 stage/README，完整旧 checkout/node_modules 没有保留；Node 是 v22.16.0，pnpm 未提供。一次 `git clone` 返回 `Could not resolve host: github.com`。这是当前临时容器的网络/环境限制，不是 GitHub 写权限不足。

不要反复重试同一 clone，不要因此改用户电脑。现有 GitHub 连接器已成功创建分支和写入 HANDOFF；可使用已有 `.github/workflows/ci.yml` 的 Linux/Windows 云端 Runner 重建上述环境并执行测试。只扩展同一个 CI 对当前功能分支的触发范围，不新建一批重复 workflow，不触发发行流程。CI 运行/日志/artifact 通过 GitHub 连接器读回。

## 9. 清理与证据保存

把有用证据（commit、执行命令、测试摘要、截图来源和局限）提交到开发分支文档。临时日志/HTML/测试 fixture 只在开发目录或 CI artifacts，不能放进安装标签。

关闭自己启动的服务器/浏览器/子进程，再仅删除本次创建的临时根目录。不要删除用户的 DSH/Codex home，不执行全局 kill，不为清理测试改动真实会话。GitHub 托管 Runner 在 job 结束后销毁，其账号/依赖状态不需要转移到用户机器。

发布检查的是最终 GitHub 标签与 .tgz 两条路径：没有 tests/src/.github/scripts、没有安装 hooks/devDependencies、没有 mock 运行开关，正常官方运行依赖可由包管理器建立 node_modules 链接；不能把 pnpm 自己建立的依赖链接当污染而误报。

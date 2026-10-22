# 构建与发布（当前公库）

**截至 2026-10-22，当前开发预览版为 `0.2.1-alpha.1`，还未发布稳定 npm 包。**

GitHub 直接安装的测试标签必须包含编译好的 `lib/index.js`、`lib/client.js` 和类型声明文件，且发布标签中的 `package.json` **不能包含 `prepare`/`prepack`/`postinstall` 等安装构建脚本**。否则 DSH 的 pnpm 会按 `allowBuilds` 政策拒绝 Git 源码安装。

发布归属：[`Tests4gptplay/dsh-codex-native`](https://github.com/Tests4gptplay/dsh-codex-native)，不是原作者的 `dsh-llm-codex-app-server`，不要沿用原作者的 npm Trusted Publisher 或 GitHub Actions 配置。

## 已存在的工作流

| 文件 | 实际职责 |
|---|---|
| [`ci.yml`](../.github/workflows/ci.yml) | GitHub 临时 Runner 上安装依赖、TypeScript 检查、单元测试、编译、打包并上传 .tgz；只有所有校验通过才可称为有效候选包 |
| [`docs-preview.yml`](../.github/workflows/docs-preview.yml) | 从当前 React 登录组件制作中英两张原版**未登录组件预览**截图，不登录账户 |
| [`import-pinned-mit-source.yml`](../.github/workflows/import-pinned-mit-source.yml) | 初始化阶段导入固定上游 MIT commit；**不是发布工作流** |

## 当前阻断

- 适配 DSH `0.2.1-rc.2` 的依赖和测试尚在调整，完整 CI 需要通过。
- 尚未对真实 DSH 安装、Windows Desktop、真实 ChatGPT 账号登录、模型推理与 DSH 工具完成独立验收。
- 还未创建本公库的 GitHub Release 或 npm 发布/可信发布身份。**不能沿用旧仓库的发布凭证或给旧 npm 包名发布。**

## 候选打包流程（GitHub 托管环境）

```bash
pnpm install --no-frozen-lockfile --ignore-scripts
pnpm run typecheck
pnpm run test:ci
pnpm run build
pnpm pack --pack-destination dist
```

锁文件从旧上游导入后尚需重新生成验证，不能使用旧锁文件强行认定可复现。CI 通过且冻结版本后，应固定 lockfile 并使用 `--frozen-lockfile`。

只有当 [STATUS](STATUS.md) 中所有真实集成验收完成，才允许把特定 commit 标记为可安装版本。目标是让 DSH 直接通过公库的 GitHub 源/稳定制品安装，用户本地无需保留开发源码仓库，但插件依赖与官方 Codex 运行时仍占磁盘空间。

英文：[releasing.md](releasing.md)。

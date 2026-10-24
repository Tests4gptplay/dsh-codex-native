# Codex Native alpha.9 installation / 安装指南

## Verified configuration / 已验证组合

| Component / 组件 | Version / 版本 |
|---|---|
| Plugin / 插件 | `dsh-codex-native 0.2.1-alpha.9` |
| DSH source / 宿主源码 | `deepseek-ai/deepseek-harness@687f282e8625c6b8d11ff58211a90524be2e4317` (`0.2.1-rc.2`) |
| Integration patch / 集成补丁 | `dsh-context-usage-0.2.1-rc.2.patch` |
| Codex | `0.154.0` |
| Tools / 构建工具 | Node 24, Git, pnpm `11.28.5` and native build prerequisites |

The companion patch integrates Codex's context-window sample and compression ownership with DSH's LLM, token-meter and compaction modules. It ships as a separate file alongside the plugin package.

配套补丁连接 Codex 的上下文窗口计量、压缩接管与 DSH 的 LLM、Token Meter、压缩模块，并作为独立发行文件与插件一起提供。

[DSH upstream README](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/README.md) · [Development guide](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/docs/development.md)

## 1. Download and verify / 下载与校验

Download the six assets from [alpha.9 Release](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.9) into a dedicated directory:

从发行页将以下六个文件下载到同一目录：

- `dsh-codex-native-0.2.1-alpha.9.tgz`
- `dsh-context-usage-0.2.1-rc.2.patch`
- `INSTALL_PATCHED_HOST.md`
- `DSH-LICENSE.txt`
- `release-manifest.json`
- `SHA256SUMS`

Linux or WSL / Linux 或 WSL：

```sh
sha256sum --check SHA256SUMS
```

PowerShell / PowerShell：

```powershell
Get-FileHash -Algorithm SHA256 .\dsh-codex-native-0.2.1-alpha.9.tgz
```

Compare the resulting hashes with `SHA256SUMS`. Patch SHA256:

```text
dd8049f33fea9187cc025e792fc25feb68a8ad5ccb1044cc85e063429c2b717e
```

`release-manifest.json` records the tested source, CI run, published runtime files and hashes.

## 2. Build the host / 构建宿主

Use Bash or WSL from the directory containing the downloaded release files.

以下命令在已下载发行文件的目录中使用 Bash 或 WSL 执行。

```sh
export DSH_ALPHA9_ASSETS="$(pwd)"

git clone https://github.com/deepseek-ai/deepseek-harness.git dsh-codex-alpha9-host
cd dsh-codex-alpha9-host
git checkout --detach 687f282e8625c6b8d11ff58211a90524be2e4317

git apply --check "$DSH_ALPHA9_ASSETS/dsh-context-usage-0.2.1-rc.2.patch"
git apply "$DSH_ALPHA9_ASSETS/dsh-context-usage-0.2.1-rc.2.patch"

pnpm --version
pnpm install --frozen-lockfile
pnpm run build
```

The source build prepares the DSH host and client bundles used by `pnpm dsh`.

源码构建生成 `pnpm dsh` 使用的宿主与客户端运行文件。

## 3. Install the plugin / 安装插件

Create an independent DSH profile for this host checkout and install the release TGZ:

为这一份宿主源码配置独立的 DSH 数据目录，并安装发行包：

```sh
export DSH_HOME="$DSH_ALPHA9_ASSETS/dsh-alpha9-profile"

pnpm dsh plugin --profile web add \
  "$DSH_ALPHA9_ASSETS/dsh-codex-native-0.2.1-alpha.9.tgz"

pnpm dsh --profile web --dump-config
pnpm dsh web --no-open
```

Open the complete URL printed by DSH, including the local launch token (typically a `http://127.0.0.1:3080/?token=...` address). DSH completes local browser authentication and opens the Web UI. In **Settings → Codex official login**, connect a ChatGPT account and select `codex-local` as the main-model provider.

打开 DSH 输出的完整地址（通常为 `http://127.0.0.1:3080/?token=...`），完成本地浏览器认证。之后在 **设置 → Codex 官方登录** 连接 ChatGPT 账号，主模型提供方选择 `codex-local`。

For subsequent starts, keep using this checkout and its `DSH_HOME`. The fixed Git installation reference is:

后续从同一源码目录、使用同一个 `DSH_HOME` 启动。固定 Git 安装地址为：

```text
github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.9
```

## 4. Function and verification / 功能与验证

The integrated host reads `pressureCompaction: 'provider'` on Codex model routes. Codex handles routine compaction; DSH's overflow recovery processes actual context-window errors. Token consumption uses completed response receipts, while the context meter receives the latest independent window sample.

集成后，宿主对 Codex 模型路由识别 `pressureCompaction: 'provider'`。日常压缩由 Codex 负责，真实上下文超限由 DSH 恢复；Token 累计消耗与当前窗口分别记录。

[Repair audit / 修复审计](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/CONTEXT_COMPACTION_AUDIT.md) · [Candidate validation / 候选验证](https://github.com/Tests4gptplay/dsh-codex-native/actions) · [Release / 发行文件](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.9)

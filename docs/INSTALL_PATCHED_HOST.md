# Alpha.8 paired-host installation / 配套宿主安装

## Compatibility / 适用范围

| Component | Required version |
|---|---|
| Plugin | `dsh-codex-native` `0.2.1-alpha.8` |
| Official host source | `deepseek-ai/deepseek-harness@687f282e8625c6b8d11ff58211a90524be2e4317` (`0.2.1-rc.2`) |
| Companion patch | `dsh-context-usage-0.2.1-rc.2.patch` from the same alpha.8 Release |
| Official Codex engine | `0.154.0`, installed by the plugin |
| Source build tools | Node 24, Git, pnpm `11.28.5`, and the platform's native build prerequisites |

**This is a source-host preview, not a replacement official Desktop installer.** The patch changes the host's LLM contract, token meter and pressure-compaction policy. The plugin alone cannot apply those host changes. Stock rc.2 lacks the contracts; rc.3 is not supported by this preview's exact peer versions. Unmodified official rc.2 Desktop users can continue using alpha.7.

**这是源码宿主预发布，不是官方 Desktop 的替换安装器。** 完整修复需要插件和宿主共同更新。只升级桌面应用中的插件不会启用宿主接口；不要通过版本豁免强装到 rc.3。未修改的 rc.2 Desktop 可继续使用 alpha.7。

The host source and build prerequisites are documented in the fixed upstream [README](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/README.md) and [development guide](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/docs/development.md). The separate `DSH-LICENSE.txt` preserves the host's upstream license. The plugin's own license is inside its TGZ/tag.

## 1. Download and verify / 下载与校验

Download these assets from the [alpha.8 Release](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.8) into a new directory:

- `dsh-codex-native-0.2.1-alpha.8.tgz`
- `dsh-context-usage-0.2.1-rc.2.patch`
- `INSTALL_PATCHED_HOST.md`
- `DSH-LICENSE.txt`
- `release-manifest.json`
- `SHA256SUMS`

With all six files in that directory, Linux/WSL can verify them with:

```sh
sha256sum --check SHA256SUMS
```

PowerShell can calculate each downloaded file's SHA256 using `Get-FileHash -Algorithm SHA256 <filename>` and compare it with `SHA256SUMS`.

The expected patch SHA256 is:

```text
dd8049f33fea9187cc025e792fc25feb68a8ad5ccb1044cc85e063429c2b717e
```

`release-manifest.json` binds the candidate source/tree, CI run, original CI artifact and runtime files to this release. No install hook applies this patch automatically.

## 2. Build the exact patched host / 构建固定宿主

The following commands use a Bash shell. Run them from the directory containing the verified assets. Use a fresh checkout; do not apply the patch to a different release or to the files inside an existing Desktop application.

以下命令使用 Bash，从已校验的发布文件目录执行。使用新的源码目录；不要修改现有 Desktop 应用内部文件，也不要把此补丁套到其他版本。

```sh
export DSH_ALPHA8_ASSETS="$(pwd)"

git clone https://github.com/deepseek-ai/deepseek-harness.git dsh-codex-alpha8-host
cd dsh-codex-alpha8-host
git checkout --detach 687f282e8625c6b8d11ff58211a90524be2e4317

git apply --check "$DSH_ALPHA8_ASSETS/dsh-context-usage-0.2.1-rc.2.patch"
git apply "$DSH_ALPHA8_ASSETS/dsh-context-usage-0.2.1-rc.2.patch"

pnpm --version
# The fixed host declares pnpm 11.28.5.
pnpm install --frozen-lockfile
pnpm run build
```

`pnpm run build` is the official source build command for this baseline. It prepares the host and client artifacts used by `pnpm dsh`; there is no `build:runtime` script at this version.

## 3. Install into a fresh host profile / 使用新的宿主数据目录

Continue from the same patched source directory:

```sh
export DSH_HOME="$DSH_ALPHA8_ASSETS/dsh-alpha8-profile"
# This directory must not already contain an older DSH profile.

pnpm dsh plugin --profile web add \
  "$DSH_ALPHA8_ASSETS/dsh-codex-native-0.2.1-alpha.8.tgz"

pnpm dsh --profile web --dump-config
pnpm dsh web --no-open
```

Open the local address printed by DSH (default `http://127.0.0.1:3080`). Use **Settings → Codex official login**, then choose `codex-local` as the main-model provider.

打开 DSH 输出的本地地址，默认是 `http://127.0.0.1:3080`。通过 **设置 → Codex 官方登录** 登录，主模型提供方选择 `codex-local`。

Use the same `DSH_HOME` and this same source checkout on subsequent starts. `pnpm dsh` resolves host packages from this checkout's CLI workspace. A new profile disables automatic peer installation, so the plugin uses the patched host packages. An older profile may contain nearer stock packages and is outside this installation check.

后续仍从这份源码目录、使用同一个 `DSH_HOME` 启动。不要把最后一步换成 `pnpm dlx @deepseek-ai/dsh`、`npx` 或官方 Desktop 的启动命令，否则会使用另外一份宿主。新的数据目录用于避免旧 profile 中单独安装的宿主依赖覆盖本次修改；这里不会删除或迁移原来的对话、登录数据。

Once the same patched host is ready, the immutable GitHub plugin specification is also available:

```text
github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.8
```

## Expected behavior and evidence / 预期行为与证据

The host honors `pressureCompaction: 'provider'` for Codex routes, so routine pressure compaction is delegated to Codex. A real context-overflow error still reaches the existing DSH recovery path. Manual compaction and ordinary providers keep their prior policy.

Billing uses complete raw response receipts; context pressure uses the latest independent sample. Missing measurements remain unknown. The release verifier loads the final TGZ for the existing 26 regressions and checks two real host model-normalizer cases. The source-host installation check is separate from these behavior tests; a `codex-local` entry in dumped configuration alone does not prove the pressure contract.

The “Skill descriptions were shortened” warning can still appear in a new conversation. It comes from Codex's skill-catalog budget and is not conversation compaction. This release does not change that budget.

See the [repair audit](https://github.com/Tests4gptplay/dsh-codex-native/blob/__SOURCE_SHA__/docs/CONTEXT_COMPACTION_AUDIT.md) and [candidate CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/__CI_RUN__). Account-free regression tests and isolated host startup do not replace native long-session acceptance on a user's machine.

To stop this isolated installation, quit its Web process. Your original Desktop and its data remain separate. Keep the patched source checkout and its profile together until moving to a future host version with an explicitly supported equivalent contract; no downgrade or migration of that profile is asserted here.

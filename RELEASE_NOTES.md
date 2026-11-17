# Codex Native 0.2.5

## Windows Computer Use recovery

- Bundle the repair skill, readable patch profiles and compatibility evidence. The existing recovery tool guide loads the skill for the AI, including diagnosis, release/repair, screenshot verification, rollback and future-version adaptation/solidification.

- Add the exact tested @oai/sky 0.7.21 Windows 10 helper patch while retaining 0.7.13 support. Select repair, status and rollback by the original/patched SHA-256 pair, not by a version-string override.
- Retain the separate `release` action, signature-change consent, original backup checks and rollback without a pre-existing backup. Unknown binaries are not modified.
- No helper executable, Sky runtime, account data or credentials are bundled. Only the compatibility patch data and plugin code are included. This does not provide a standalone Computer Use engine.
- DSH reported successful Windows screenshot capture and plugin-dialog navigation after applying the same 0.7.21 patch. The plugin transaction regression tests use synthetic region fixtures, not real runtime executables. This release does not claim a new real-account or desktop test of the integrated plugin.
- The 0.2.4 model-capacity fixes remain intact.

## 中文

新增已验证的 0.7.21 Windows 10 截图修复配置，同时保留 0.7.13。根据原始/修复后完整哈希选择修复与回滚配置，不是取消版本检查后盲打旧补丁。release 解除占用独立于修补；仍需同意签名失效并保留原件校验。不随包分发专有 helper、运行时或账号资料。

DSH 已报告相同 0.7.21 补丁的实机截图和插件页面操作成功；插件自动化回归使用合成测试数据验证文件事务，不冒充实机执行。本次未操作用户 Codex，也未重启 DSH。

---

# Codex Native 0.2.4

## Fixed

- Fixed DSH model switches failing with `compaction-basic: no context capacity` for native Codex models.
- Keep an explicit per-model `contextWindow` configured by the user. Otherwise use a positive capacity returned by App Server, then the matching `context_window` in the official Codex `models_cache.json`.
- Read the catalog from the same `CODEX_HOME` as the native query process after refreshing `model/list`. Newly advertised models can acquire their official default capacity without adding their names to the plugin.
- Do not substitute `max_context_window` or invent a capacity for an unknown model. Missing or malformed optional cache data does not hide live models.
- Model availability and default reasoning effort continue to come from App Server.

## Packages and installation

Both distributions contain the same backend and behavior:

```text
@tests4gptplay/dsh-codex-native@0.2.4
dsh-codex-native@0.2.4
```

In DSH Desktop, enter either package name in **Plugins → Add plugin → Package name or address**. Do not enable both distributions at the same time: they provide the same `codex-local` route. Existing account storage and configuration are retained.

The GitHub release also provides both `.tgz` packages. Their only variant differences are the package name, bundle module name and frontend loader ID. Original licenses, attribution, repository metadata and `publishConfig` are preserved; old cryptographic signatures are not copied onto changed bytes.

## Release workflow

`.github/workflows/npm-publish.yml` builds and checks both packages, publishes with npm OIDC, and attaches them to the GitHub release. A new unscoped package requires one authenticated first publication before its own trusted publisher can be configured. Subsequent releases can publish both names through the same workflow.

## Verification boundary

Focused automated tests cover capacity discovery, exact model matching, refresh, explicit user limits, native account/model discovery and adapter behavior. Typechecking, build and TGZ reread/parity checks are included. This release does not claim new macOS testing or a real-account long-history compaction run.

## 中文

修复切换到 Codex Native 时因缺少上下文容量而失败的问题。优先保留用户手动配置，其次采用 App Server 返回的容量；当前接口未提供时，自动读取同一 `CODEX_HOME` 下官方模型目录中的默认容量。新模型不需要硬编码名称，但官方接口和目录均无容量时不会随意猜值。

同时提供带 `@tests4gptplay` 和不带作用域的两个 npm/TGZ 包，不要同时启用。原署名、版权、图标许可和发布配置保留。无作用域包完成首次发布后单独配置 OIDC；工作流文件名统一为 `npm-publish.yml`。

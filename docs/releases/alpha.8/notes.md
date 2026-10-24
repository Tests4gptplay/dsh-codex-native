# Codex Native alpha.8 — context accounting and pressure compaction

**Paired-host prerelease / 需要配套宿主补丁的预发布版**

The complete repair requires official DSH rc.2 source **`687f282e8625c6b8d11ff58211a90524be2e4317` + the attached patch**. Installing the plugin alone in stock Desktop does not enable the context-pressure repair. Unmodified DSH rc.2 Desktop users can continue using alpha.7. DSH rc.3 is not a supported target of this preview.

完整修复需要 **固定 DSH rc.2 源码 + 本页宿主补丁**。只升级原版桌面应用里的插件还不够。请先阅读随附的 `INSTALL_PATCHED_HOST.md`；本插件不会自动修改宿主，也不提供替换官方 Desktop 的安装器。

## What changed / 修复内容

- Separate accumulated consumption from the latest native window: three 91k responses consume 273k, while context pressure stays at the latest 91k sample.
- Stop billing delayed `thread/tokenUsage/updated.last` snapshots as new responses. Completed raw response receipts remain the accounting source.
- Codex owns routine pressure compaction for its models, including routes with unknown context capacity. DSH retains its existing recovery for an actual rejected context overflow.
- Recognize native `contextWindowExceeded` errors using their structured code. Native thread reuse, prior alpha.6/alpha.7 repairs and manual Query/Clear history remain.

累计消耗与当前窗口分开统计；迟到快照不重复计费；日常压力压缩交给 Codex，真实溢出保留 DSH 原有恢复。没有加入新的任务重放、后台轮询或模型任务时限。

## Install / 安装

For the prepared patched host only:

```text
github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.8
```

Assets include the minimal prebuilt plugin TGZ, fixed-baseline host patch, source-host build/install guide, upstream host license, provenance manifest and `SHA256SUMS`. The immutable plugin tag and TGZ exclude tests, fixtures, source, CI, scripts and devDependencies. The separate host patch is never an install hook.

Host patch SHA256: `dd8049f33fea9187cc025e792fc25feb68a8ad5ccb1044cc85e063429c2b717e`.

## Verification / 验证

- The same final focused assertions failed 4 of 26 before the repair and passed 26/26 afterward.
- Versioned candidate CI: Windows 188/188; Ubuntu 187 passed / one existing Windows-only skip. Both platforms apply the exact host patch, typecheck, build and pack.
- Release verification uses the **final cleaned TGZ**, reruns those 26 assertions against complete patched host modules, and checks catalogued/unknown-capacity ownership through the real host model-info normalizer.
- The release records the exact source/tree, CI run, original artifact digest, host baseline, patch hash and runtime hashes. It also checks clean installation and the immutable GitHub tag.

[Versioned candidate CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/__CI_RUN__) · [Source and repair audit](https://github.com/Tests4gptplay/dsh-codex-native/blob/__SOURCE_SHA__/docs/CONTEXT_COMPACTION_AUDIT.md)

The first-step “Skill descriptions were shortened” warning is a separate skill-catalog budget; this release does not change that setting. It must not be counted as conversation compaction.

新对话的技能描述缩短提示仍可能出现，它与对话历史压缩是两回事。本次验证未使用真实账号或模型额度，也不替代用户机器上的长会话验收；已有原生审批交互局限仍适用。

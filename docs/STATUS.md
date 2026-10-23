# DSH Codex Native — development and release status

Updated: **2026-10-23** · Target DSH **0.2.1-rc.2** · Test release **v0.2.1-alpha.3**

## Published release

**[GitHub v0.2.1-alpha.3](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.3)** is a separate immutable source-free tag. Its Git tree contains **22 files**. The tag contains runtime JS, declaration files, package metadata, Cordis patch, two short READMEs and the MIT license — **no tests, source code, CI workflow, build/install lifecycle script, devDependencies, generated image, or obsolete UI**.

[GitHub Actions run #39879247613 — PASS](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39879247613) verifies:
- TypeScript compile, **117/117 account-free unit tests**, and production JS build.
- Minimum distribution tree and packed TGZ contents.
- Clean pnpm tarball install and **exact GitHub tag install without changes to `allowBuilds`**.
- Actual DSH **0.2.1-rc.2** Web Profile plugin-add and `--dump-config` composition on **Linux and Windows**, with `codex-local` in the resulting config.

Release package: [dsh-codex-native-0.2.1-alpha.3.tgz](https://github.com/Tests4gptplay/dsh-codex-native/releases/download/v0.2.1-alpha.3/dsh-codex-native-0.2.1-alpha.3.tgz).

## Runtime cleanup

Removed unused legacy settings cards and conversation UI; removed automatic takeover of DSH `web_search`; removed blanket Codex native feature disabling, forced no-approval policy, forced compaction overrides, legacy client identity override and default five-minute hard kill. Source tests remain in the **development branch only**, never in the installation tag. DSH still owns its tool loop. Transport parsing, JSON-RPC request matching, the active login UI, session lifecycle and idle-process cleanup are retained for required functionality.

See [docs/AUDIT.md](AUDIT.md) for traceable findings and remaining boundaries.

## Remaining unverified behavior

- Live ChatGPT/Codex OAuth browser and device-code login, subscription quota reading.
- Native Codex approvals/elicitation are **not completely bridged to interactive DSH UI**. Unsupported native approval requests can still be declined. This is a functional gap rather than an automatic test or watchdog.
- Real Electron Desktop lifecycle and live Codex model/tool round-trips, especially privileged OS operations.
- The distributed runtime and its normal dependencies consume local disk space. The absence of development files is not a claim that every operational risk is eliminated.

## Previous versions

- `v0.2.1-alpha.0`: Git install failed because `prepare` needed an unauthorized build.
- `v0.2.1-alpha.1`: removed `prepare` but Git tag included development files.
- `v0.2.1-alpha.2`: source-free 22-file tag created during failed CI. pnpm Git install itself passed, but an incorrect assertion about pnpm-generated `node_modules` aborted the workflow before host checks and release. **Not a recommended version**.
- **`v0.2.1-alpha.3`**: source-free published preview with green Linux/Windows and Git install checks. **Still an alpha for live-account validation**.

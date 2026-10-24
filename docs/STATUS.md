# Release status

## Alpha.8 release preparation

The user authorized release preparation on 2026-10-24. **v0.2.1-alpha.8 is a paired-host prerelease**, with a minimal plugin, a separate fixed-baseline DSH patch, checksums and [installation instructions](INSTALL_PATCHED_HOST.md). It is not an automatic upgrade of stock DSH Desktop. The ordinary Desktop installation below remains alpha.7 until the required host contract is available there.

The final source repair at `0108d12eae09630e3e927ac4e16dd2fa11176d5e` passed [Windows/Ubuntu CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40075868770): Windows 188/188; Ubuntu 187 passed and one existing Windows-only skip. Both platforms applied the companion patch, typechecked, built and packed. The final focused regression set was 22 passed / 4 failed before and 26/26 after. [Full audit](CONTEXT_COMPACTION_AUDIT.md).

Release delivery must additionally consume the versioned candidate artifact, verify the cleaned TGZ against the companion host, and record the immutable source, CI run and asset checksums. This section does not claim publication before those steps finish.

## Published release

Updated 2026-10-24 JST. Published preview: **v0.2.1-alpha.7**, DSH **0.2.1-rc.2**, official Codex **0.154.0**. Dependencies were not upgraded.

[Release](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.7) · [Before-fix reproduction](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40047676806) · [After-fix cross-platform CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40048042517) · [Publication and exact Git install](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40048610503).

## Verified alpha.7 audit

The unchanged alpha.6 runtime failed six new fault cases on both Windows and Ubuntu while all existing tests and two new positive controls passed. Those six cases share two causes: account service disposal did not own opening/query connections; login cancellation waited indefinitely for an unresponsive peer's acknowledgement. Tests ran first, before production modification.

Only production source `src/native-account.ts` changed (18 added / 11 removed lines). It owns account connections before initialize, releases owned connections on disposal, and makes explicit login cancel independent of peer acknowledgement. The same eight new assertions and full existing regression suite passed on both platforms at source `e434e5fc57fd647fac7332c6304e6515cd11c5bd`; typecheck, build and pack passed too. [Detailed reproduction, scope and limits](ACCOUNT_LIFECYCLE_AUDIT.md).

The isolated setup uses the official DSH subprocess runtime and actual child processes, with only the Codex peer replaced by deterministic fixtures. No user computer, real credentials or live model quota was used. The active-turn/cache-expiry control is accelerated, not a one-hour real-model soak.

## Published installer verification

The existing release workflow consumed the exact successful Ubuntu artifact, stripped development manifest fields, checked its runtime-only whitelist, installed it through an isolated official DSH Web profile, verified the fixed GitHub tag installation with no allowBuilds exception, and uploaded the prerelease. Every publication job step passed. Release published at **2026-10-24 01:11:37 UTC / 10:11:37 JST**.

TGZ: `dsh-codex-native-0.2.1-alpha.7.tgz`, **52,264 bytes**. GitHub reports SHA-256 `3cec67b8c13f91c8a9d84f2a2a8ff458ca3deaf9ee655e3c6899880f06b39295`; this is GitHub's asset digest, not a claim that its TGZ bytes were independently downloaded in this audit.

The actual CI artifact `12542246673` was independently downloaded and its runtime blobs calculated. All match the published tag tree `4bd4a0a7b8ae849a4c8db8424eaaa937bf76f3b4`:

| Runtime file | Bytes | Git blob SHA-1 |
|---|---:|---|
| lib/index.js | 125240 | b43ab035cd141d1459123b3412c4f36c085a5d80 |
| lib/client.js | 25925 | ba4fd9fbaba03f81fa4e4beb24901ae4083716d8 |
| cordis.patch.yml | 2304 | 135a27ce43c9be6350ec495502f6645208569c12 |

The browser bundle and patch are byte-identical to alpha.6. Server JS grew by 170 bytes. The published manifest was read back: no scripts or devDependencies. The published tree contains no tests, fixtures, source, CI, screenshots or helper scripts. Tests remain development-only source files, never startup tasks in the installed plugin. Runtime dependencies still take normal installation space.

## Preserved behavior and limits

No new Watchdog, heartbeat, background reconnect, usage poller, model-task deadline or automatic in-flight tool replay. Default model timeout remains zero. The existing six-second account teardown wait applies only when closing a process; it was not introduced or extended by alpha.7. Normal official initialization remains once per connection. Model runner, session cache, permissions and UI sources are unchanged from alpha.6.

Manual Query/Clear, official controls and skins remain. Public reset announcements remain approximate reference groupings. Real-account OAuth acceptance, every Electron/skin combination, concurrent-login races and complete native approval/elicitation bridging are not certified by these tests. The initiating cause of the original user's protocol-stream closure remains unproven. No untested broader cleanup was applied.

## Historical evidence

Alpha.6 EOF/backpressure, diagnostics and dead-session recovery are retained: [repair details](PROTOCOL_STREAM_FIX.md), [regression CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39996592077), [release installation](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39997058708).

The user-confirmed alpha.5 Desktop history screenshot remains evidence for that UI in their environment, not acceptance of later transport/account repairs on their machine. [Screenshot](screenshots/codex-usage-desktop-anonymized.png) · [provenance](SCREENSHOTS.md) · [alpha.5 delivery](DELIVERY-alpha5.md) · [alpha.4 reproduction](REPRODUCTION.md).

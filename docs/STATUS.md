# Release status

## Published paired-host preview: alpha.8

**v0.2.1-alpha.8** was published on **2026-10-24 08:40:42 UTC / 17:40:42 JST**. [Release and six assets](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.8) · [Installation guide](INSTALL_PATCHED_HOST.md) · [Repair audit](CONTEXT_COMPACTION_AUDIT.md).

The complete context-pressure repair requires the companion patch on exact official DSH rc.2 source `687f282e8625c6b8d11ff58211a90524be2e4317`. Unchanged official rc.2 Desktop users can continue with alpha.7 below. The plugin does not apply the host patch automatically; rc.3 is outside this preview's supported peer versions.

Codex manages routine pressure compaction; DSH's existing actual-overflow recovery remains. Consumption and the latest native context sample are separate. Delayed last-window snapshots are no longer billed as new receipts. The first-step skills-description warning remains a separate catalog budget.

## Alpha.8 verification

| Gate | Result |
|---|---|
| Same focused regression assertions | 22 passed / 4 failed before; 26/26 after |
| Versioned Windows candidate | 188/188 ordinary tests; 28/28 packaged-runtime/real-normalizer tests |
| Versioned Ubuntu candidate | 187 passed / one existing Windows-only skip; 28/28 packaged-runtime/real-normalizer tests |
| Final cleaned release TGZ | 28/28 with complete patched official host modules |
| Complete final patched host build | 9/9 tasks |
| Fresh source-host profile | TGZ installation and configuration passed |
| Actual host package resolution | LLM, token-meter and compaction-basic resolve to the patched checkout; no stock profile shadow |
| Actual Web startup | Official local launch-token exchange 303, authenticated HTML 200 |
| Immutable GitHub tag installation | Passed without build exceptions; runtime hashes match candidate |

[Versioned candidate CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40078589328) · [Successful publication workflow](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40078708238) · [Merged PR #1](https://github.com/Tests4gptplay/dsh-codex-native/pull/1).

These tests use artificial history, isolated peers and an isolated local host. They do not use account credentials or paid model calls, and do not replace native long-session acceptance on the user's Desktop.

## Alpha.8 delivery identity

| Item | Exact identity |
|---|---|
| Tested source | `455d273e8ea6825a5275e665845a5557e068b0cd` |
| Tested source tree | `d3783189984d765ad8e148c67156dd2aa84c5994` |
| Runtime tag commit | `1a1c0f7b044df93ffec1689418d8835c73ff346a` |
| Runtime tag tree | `52ad629ef7e027ae3fbb6702f0bb3ed10153773b` |
| Final TGZ | `dsh-codex-native-0.2.1-alpha.8.tgz`, 52,848 bytes |
| TGZ SHA256 | `e9b65da495cac7fe7b86626da7482076d2e9e4ede9bdc2bdced5712653962eda` |
| Host patch SHA256 | `dd8049f33fea9187cc025e792fc25feb68a8ad5ccb1044cc85e063429c2b717e` |

The Release provides the TGZ, host patch, installation guide, upstream host license, provenance manifest and SHA256SUMS. The plugin tag/TGZ has 30 runtime/declaration/configuration/license/README files and no tests, fixtures, development source, CI, scripts or devDependencies. Runtime dependencies remain `@openai/codex 0.154.0` and the existing Schemastery range.

All six published assets were independently downloaded. Their bytes match GitHub's reported SHA256 digests; `SHA256SUMS` matches its five covered assets, and the release manifest matches the tested candidate and runtime files. The tag and final TGZ contain the same 30-file set. Their `package.json` values are identical; the tag retains one final LF that pnpm pack removes from the TGZ. No whole-archive or all-files byte-identity claim is made.

The original CI artifact and final TGZ differ intentionally in development manifest fields and release READMEs. The server JS, client JS and Cordis patch retain the candidate's exact bytes:

| Runtime file | SHA256 |
|---|---|
| `lib/index.js` | `2851a7ef05e9a0df791a0cc15ca5f6b80e83f0bee337a67b319f848efb0685bf` |
| `lib/client.js` | `1f352ff0320a1089eded7a239af6c69c1941dcb90501cccab184aa08ecd8d0ea` |
| `cordis.patch.yml` | `dd0abdd62d928e3081c9cd84b2c3d01e1862cbd04e1196b9f6603d7044a8d7d6` |

## Release preparation findings

The first added package gate failed to import the complete official LLM source because its standard decorators had not been transformed. Reusing the fixed host's own test transformer and declaring two already-locked development dependencies made all 28 checks pass. Production logic and the original assertions were unchanged.

The first delivery run passed the final TGZ, the final host's complete 9/9 build, installation and package resolution, then stopped before tag creation when the new startup checker requested a bare unauthenticated URL and received 401. The checker now follows the official ready URL → 303/cookie → 200 flow and redacts the temporary launch token in saved logs. Host authentication and the companion patch were unchanged. The later publication run above passed every step.

## Previous stock-Desktop release: alpha.7

Updated 2026-10-24 JST. Published preview: **v0.2.1-alpha.7**, DSH **0.2.1-rc.2**, official Codex **0.154.0**. Dependencies were not upgraded.

[Release](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.7) · [Before-fix reproduction](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40047676806) · [After-fix cross-platform CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40048042517) · [Publication and exact Git install](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40048610503).

## Verified alpha.7 audit

The unchanged alpha.6 runtime failed six new fault cases on both Windows and Ubuntu while all existing tests and two new positive controls passed. Those six cases share two causes: account service disposal did not own opening/query connections; login cancellation waited indefinitely for an unresponsive peer's acknowledgement. Tests ran first, before production modification.

Only production source `src/native-account.ts` changed (18 added / 11 removed lines). It owns account connections before initialize, releases owned connections on disposal, and makes explicit login cancel independent of peer acknowledgement. The same eight new assertions and full existing regression suite passed on both platforms at source `e434e5fc57fd647fac7332c6304e6515cd11c5bd`; typecheck, build and pack passed too. [Detailed reproduction, scope and limits](ACCOUNT_LIFECYCLE_AUDIT.md).

The isolated setup uses the official DSH subprocess runtime and actual child processes, with only the Codex peer replaced by deterministic fixtures. No user computer, real credentials or live model quota was used. The active-turn/cache-expiry control is accelerated, not a one-hour real-model soak.

## Alpha.7 installer verification

The existing release workflow consumed the exact successful Ubuntu artifact, stripped development manifest fields, checked its runtime-only whitelist, installed it through an isolated official DSH Web profile, verified the fixed GitHub tag installation with no allowBuilds exception, and uploaded the prerelease. Every publication job step passed. Release published at **2026-10-24 01:11:37 UTC / 10:11:37 JST**.

TGZ: `dsh-codex-native-0.2.1-alpha.7.tgz`, **52,264 bytes**. GitHub reports SHA-256 `3cec67b8c13f91c8a9d84f2a2a8ff458ca3deaf9ee655e3c6899880f06b39295`; this is GitHub's asset digest, not a claim that its TGZ bytes were independently downloaded in this audit.

The actual CI artifact `12542246673` was independently downloaded and its runtime blobs calculated. All match the published tag tree `4bd4a0a7b8ae849a4c8db8424eaaa937bf76f3b4`:

| Runtime file | Bytes | Git blob SHA-1 |
|---|---:|---|
| lib/index.js | 125240 | b43ab035cd141d1459123b3412c4f36c085a5d80 |
| lib/client.js | 25925 | ba4fd9fbaba03f81fa4e4beb24901ae4083716d8 |
| cordis.patch.yml | 2304 | 135a27ce43c9be6350ec495502f6645208569c12 |

The browser bundle and patch are byte-identical to alpha.6. Server JS grew by 170 bytes. The published manifest was read back: no scripts or devDependencies. The published tree contains no tests, fixtures, source, CI, screenshots or helper scripts. Tests remain development-only source files, never startup tasks in the installed plugin. Runtime dependencies still take normal installation space.

## Alpha.7 behavior and inherited limits

No new Watchdog, heartbeat, background reconnect, usage poller, model-task deadline or automatic in-flight tool replay. Default model timeout remains zero. The existing six-second account teardown wait applies only when closing a process; it was not introduced or extended by alpha.7. Normal official initialization remains once per connection. Model runner, session cache, permissions and UI sources are unchanged from alpha.6.

Manual Query/Clear, official controls and skins remain. Public reset announcements remain approximate reference groupings. Real-account OAuth acceptance, every Electron/skin combination, concurrent-login races and complete native approval/elicitation bridging are not certified by these tests. The initiating cause of the original user's protocol-stream closure remains unproven. No untested broader cleanup was applied.

## Earlier releases

Alpha.6 EOF/backpressure, diagnostics and dead-session recovery are retained: [repair details](PROTOCOL_STREAM_FIX.md), [regression CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39996592077), [release installation](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39997058708).

The user-confirmed alpha.5 Desktop history screenshot remains evidence for that UI in their environment, not acceptance of later transport/account repairs on their machine. [Screenshot](screenshots/codex-usage-desktop-anonymized.png) · [provenance](SCREENSHOTS.md) · [alpha.5 delivery](DELIVERY-alpha5.md) · [alpha.4 reproduction](REPRODUCTION.md).

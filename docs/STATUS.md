# Release status

Updated 2026-10-24 JST. Published preview: **v0.2.1-alpha.6**, DSH **0.2.1-rc.2**, official Codex **0.154.0**. No dependency upgrade is part of this repair.

[Release](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.6) · [Cross-platform CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39996592077) · [Publication and exact Git install](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39997058708).

## Verified alpha.6 repair

Fixes protocol EOF/close leaving requests blocked on stdin drain, preserves late process-exit diagnostics, observes account-process startup failure, and rebuilds an already-closed cached process from durable history on the next request. It does not prove the initiating cause of the user's original exit. See [reproduction and boundaries](PROTOCOL_STREAM_FIX.md).

Both Ubuntu and Windows typecheck, account-free regression, build and pack jobs passed at source `80175849c80d2cc688ac77276bb0588262bb8e95`. Ubuntu ran 153 passed tests with one Windows-only test skipped. The Windows job passed its applicable suite, including native Windows launch. Fifteen added tests cover pipe lifecycle, diagnostics, cache recovery and a real fixture child exiting through the official DSH subprocess runtime. No real account or paid model request was used.

Main source commit `5ca7899967b8551d8a9e9f7ecac3696b289e38a5` has exactly the tested source tree `62c0539daf759656b931390be1393d61285b2ea7`. Temporary patch/export helpers are absent from the final tree and were not incorporated into main history. Tests remain development-only.

The release job consumed that tested artifact, stripped development manifest fields, checked the runtime file list, installed through the official DSH Web profile, and installed the exact GitHub tag without an allowBuilds exception. The published TGZ is 51,784 bytes; GitHub reports SHA-256 `25e5fcded66613ac6c3da16acf108d9db9d00ebd8220a4427316f067b03b0db3`.

The tested artifact was downloaded and its runtime bytes compared to the published tag:

| Runtime file | Bytes | Git blob |
|---|---:|---|
| lib/index.js | 125070 | 91b20cb4dbc9563433ecba41b321bdc067769242 |
| lib/client.js | 25925 | ba4fd9fbaba03f81fa4e4beb24901ae4083716d8 |
| cordis.patch.yml | 2304 | 135a27ce43c9be6350ec495502f6645208569c12 |

The browser bundle and patch are unchanged from alpha.5. The actual alpha.6 compiled transport was also rerun in the isolated local EOF/backpressure reproduction: the two formerly pending requests now reject, with no unhandled rejection. Late exit details are tested through the shared process wrapper and real-child CI case, not claimed from the wire class alone.

Published tag tree: `26ae7657756c8cc3280f0b59becf3fc556cbd4c8`. Its manifest has no scripts or devDependencies; no source, tests, mock backend, CI, screenshots or patch helper is shipped. Runtime dependencies still take normal installation space.

## Preserved behavior and limits

No new watchdog, heartbeat, background reconnect loop, usage poller, active-task deadline, or automatic in-flight tool replay. Existing host retry policy and cancellation remain unchanged. Account teardown's bounded wait only runs when closing a process; it is not a model task time limit.

Manual history Query/Clear, official native controls and skin variables are retained. Historical reset periods remain approximate reference groupings. Real-account availability, every Electron/skin combination, the original user's exit cause and complete native Codex interactive approval remain outside this account-free certification.

## Historical evidence

The user confirmed alpha.5 history querying in their actual Desktop/skin environment and approved an anonymized screenshot. That remains evidence for the UI, not a claim that alpha.6's transport repair has already been exercised on their machine.

[Approved screenshot](screenshots/codex-usage-desktop-anonymized.png) · [Screenshot provenance](SCREENSHOTS.md) · [alpha.5 delivery](DELIVERY-alpha5.md) · [alpha.4 reproduction](REPRODUCTION.md) · [Cleanup audit](AUDIT.md).

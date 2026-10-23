# Runtime and distribution audit — alpha.4

Updated 2026-10-23. [Bug reproduction and regression evidence](REPRODUCTION.md).

## Distribution

The frozen installation tag is a separate 25-file runtime snapshot. It contains precompiled JS, declarations, manifest, DSH bundle patch, LICENSE and minimal README only. No source, tests, mock server, CI, devDependencies or lifecycle scripts are shipped. No test loop or unattended validation is registered in the installed plugin.

## Prior cleanup retained

Unused old settings/card/CSS source and unsolicited DSH web-search interception were removed. The plugin no longer supplies a blanket Codex feature blacklist, forced `approvalPolicy=never`, forced compaction threshold, originator override or default five-minute wall-clock kill. It retains functional protocol parsing, dynamic-tool ownership, cancellation and idle-process cleanup.

## Regression corrected

The earlier cleanup removed the custom chat renderer without removing its producer. This was a functional regression, not a cosmetic residue. Alpha.4 keeps the wire/replay mapper but adds a narrow presentation conversion using native DSH content types. It removes lifecycle/empty diagnostic output from visible chat, not real failures or DSH tools. Old history is not rewritten.

Windows launch now bypasses the official JS wrapper's second native spawn, using DSH to launch the official packaged executable directly. No arbitrary window closing, global process interception, OS policy edit or user-machine operation was used.

## What still runs normally

On-demand login status and pending-login polling while Settings is open; session-owned app-server processes during work; protocol reads; cancellation/cleanup and idle session eviction. These are runtime functionality, not test programs. Tests live in the development branch and isolated CI only.

## Limits

The Codex-native approval/elicitation UI bridge remains incomplete. Host-specific console visibility and live account permissions are not established solely by the successful no-account Windows handshake. This is an evidence-limited preview, not a zero-risk or security-certification claim.

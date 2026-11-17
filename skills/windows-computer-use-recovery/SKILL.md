---
name: windows-computer-use-recovery
description: Diagnose and repair Windows Computer Use screenshot timeouts or helper file locks through the DSH Codex Native recovery tool, verify actual capture, and preserve a tested compatibility fix.
---

# Windows Computer Use recovery

## Entry and scope

This skill is bundled with DSH Codex Native. The AI-visible entry is
`codex_computer_use_recovery(action="guide")`, which returns this skill and the
maintenance guide. This is not a standalone Computer Use implementation.
Use the installed Computer Use skill's documented API for actual desktop work.
Respect the user's authorization and access boundaries. Reading this skill does
not itself authorize reading an account, modifying a runtime, or interrupting a task.

## Diagnose rather than guessing

1. Preserve the exact error and determine whether it is `FrameArrived`, transport,
   stale JavaScript/window state, a sharing violation, or deliberate user stop.
2. For an authorized runtime investigation, call the recovery tool's `status`.
   Match the failing runtime to its exact returned target; never select a directory
   merely because it is newest. Status uses file hashes, not version text alone.
3. `release` and binary repair are independent. A known or unknown binary can be
   held open. Unsupported patch status does not mean release is unavailable.
4. A `ReferenceError` requires reinitializing the documented API and reacquiring
   handles, not killing processes. A transport error is not proof of a native
   capture defect. Esc/user stop requires renewed permission, not recovery.

## Apply the available fix and prove it works

For the exact supported 0.7.13 or 0.7.21 Windows 10 helper:

- Explain that repair changes the executable and invalidates its original signature.
  Once the user agrees, call `repair` with the exact target and `acceptUnsigned=true`.
  The tool verifies input bytes, patch regions and the resulting hash and retains
  an original backup. Already repaired files are a no-op, not an error.
- If replacement is blocked by file use, obtain permission to interrupt tasks using
  that helper and call `release` with `allowStop=true`. This stops only the exact
  helper path with a creation-time check, never DSH or its parent processes.
  Then retry the repair. Do not use shutdown as a substitute for release.
- Reacquire the documented API/window handle and perform one authorized screenshot.
  A successful repair return or static check is not a successful screenshot.
  Report capture success and elapsed time, or retain the exact failure.
- If the fix fails or the user requests reversal, use `rollback`. It restores a
  hash-verified backup or reconstructs the known original from the bundled regions.
  A busy executable may require the separately authorized release step first.

## A newer helper is not automatically incompatible

An unknown hash means no validated byte profile is bundled, not that adaptation
is impossible. Do not blindly remove the hash check or transplant old offsets.
With authorization for the target runtime, diagnose and adapt in an isolated copy:

1. Record version, SHA-256, size and signature; preserve the original.
2. Compare the PE section layout, original region bytes, FrameArrived callback and
   vtable, four IAT targets, DIR64 relocation, added MTA wrapper and unwind records.
3. Recalculate changed addresses/displacements. Verify that all preimages match,
   the output hash is deterministic, and rollback reproduces the original hash.
4. Only then perform the authorized real-machine capture test. Keep static and
   runtime results separate. A lock failure is not a patch-compatibility result.
5. If a fact cannot be verified, report that specific missing evidence and continue
   independent checks; do not claim failure merely from a version-string mismatch.

## Make a successful repair durable

Add a new original/patched hash pair and exact regions to the plugin profile set;
retain previous profiles and rollback support. Include evidence and synthetic
transaction tests (clearly labeled), rebuild the plugin, verify packaged files and
publish only through the user's authorized release workflow. Do not bundle a
proprietary helper executable, runtime, credentials or personal paths.

The bundled [patch profiles](references/patch-profiles.json) are the exact data used
by the plugin. [Compatibility evidence](references/compatibility.md) states the
verification boundary. Successful one-machine repair is not universal support.

### Concrete plugin extension checklist

- Add the new profile in `src/computer-use-profile-<version>.ts`, using the existing
  `src/computer-use-profile-0.7.21.ts` shape: `skyVersion`, `originalSha256`,
  `patchedSha256`, and named `regions` with byte offsets plus equal-length original
  and replacement hex. Record relocated IAT/callback/section bindings as evidence.
- Import and append it to `profiles` in `src/computer-use-profile.ts`. Do not replace
  the 0.7.13/0.7.21 entries. `profileForHash` selects by full original/patched hash;
  `src/computer-use-recovery.ts` uses the selected profile for both directions.
- Before adding the profile, work only on an isolated authorized original copy.
  Verify PE preimages, callback/vtable, each IAT displacement, relocation, section
  boundaries and unwind data; calculate both hashes. Reverse every region and check
  the full original hash. Do not choose offsets by a version number alone.
- After approved application, validate screenshot capture and the relevant input
  interaction in the user's authorized task, with input/readback evidence. Avoid
  unrelated pointer moves or typing just to manufacture a test. On failure retain
  the exact error, distinguish lock/transport/patch issues, and restore the original
  via `rollback` when required rather than repeatedly patching blindly.
- Run `pnpm run typecheck`, `pnpm run test:ci`, `pnpm run build` and
  `node scripts/package-release.mjs`. Follow the repository CI's pinned DSH reference
  setup for host integration tests. Extend `tests/computer-use-profiles.spec.ts`
  and retain unknown-file, wrong-backup and repeated-action coverage. Synthetic tests
  remain labeled as synthetic; real screenshot/input evidence is recorded separately.
- Refresh this skill's `references/patch-profiles.json` from `profiles`, document
  the exact tested environment and limits in `references/compatibility.md`, update
  version/release notes and both README installation links, and verify both TGZ
  variants contain the skill and matching profiles. Publish only after authorization.

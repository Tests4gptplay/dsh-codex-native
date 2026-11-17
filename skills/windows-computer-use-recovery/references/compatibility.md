# Compatibility and evidence

- 0.7.13: retained existing profile and attribution without changing patch regions.
- 0.7.21: callback, four IAT bindings, section header and two unwind records were
  relocated; this is not simply widening a version whitelist.
- DSH's recorded 0.7.21 original SHA-256:
  `a1eb13f38dc0214ae56d5c8b676b3740054a0818ab2bb68801b7aedc85909ded`.
- Recorded patched SHA-256:
  `210502d9b2fd64f66613dddd79bfa6942eb3cbc5472c10387ab72b9279406adf`.
- DSH static verification recorded reversible bytes and matching original rollback.
  Its later runtime report recorded successful screenshot capture in 728 ms,
  plugin navigation in 553 ms and successful plugin-modal screenshot/input readback.
  These are historical DSH measurements, not guarantees or fresh integrated-plugin
  measurements. No user runtime was accessed to prepare this plugin release.
- The release's synthetic fixture tests verify profile routing, status, repair,
  repeated repair, rollback with/without backup and backup mismatch rejection.
  They do not execute a helper and do not prove binary/runtime compatibility.

Original patch reference and attribution:
https://github.com/chen0416ccc-cpu/codex-windows-fast-patch-skill/blob/main/scripts/patch-computer-use-helper-win10.ps1

Only compatibility patch data is distributed. The original helper and Sky runtime
are not included; local modification invalidates the helper's original signature.

# DSH Codex Native — minimal test build

v0.2.1-alpha.2 for DSH 0.2.1-rc.2, from https://github.com/Tests4gptplay/dsh-codex-native.

DSH Desktop > Plugins > Add plugin:

`github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.2`

This distribution contains only prebuilt JS, type declarations, plugin manifest,
the bundle patch, license and this documentation. No source files, tests,
startup tests, CI workflows, development dependencies, or lifecycle scripts.

Native Codex app-server owns login and model execution; DSH owns its dynamic
tool loop. Actual subscribed authentication, native approval UI and model calls
are NOT proven by the packaging check. Do not treat this as a stable build.
Source audit: https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/STATUS.md
MIT upstream attribution: wss534857356/dsh-plugin-codex.

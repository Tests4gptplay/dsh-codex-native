# Development and verification status / 开发与验收状态

Updated: 2026-10-22 · Target **DSH 0.2.1-rc.2**, current source development version **0.2.1-alpha.2 (unreleased)**.

## Packaging audit and user-reported defects

1. **alpha.0** git install failed with `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED` because `package.json` declared `prepare`, asking the user's DSH installation to build source. Failure confirmed.
2. **alpha.1** removed `prepare` and passed plain pnpm Git-tag installation, **but its GitHub tag still contained 16 test files, unused pre-0.2 UI/settings source, development workflows and old documents**. The executable entry points did not import test frameworks, yet shipping this extra material was unnecessary and violated the intended slim install contract.
3. **alpha.2 source cleanup (in progress)**: removed dead UI/settings/CSS pipeline and one-shot import workflow, removed the plugin's unsolicited interception of DSH `web_search`, removed blanket Codex-native feature-disable overrides, removed forced `approvalPolicy=never`, fixed hard 300-second timeout as default 0 (no plugin-level wall clock), removed forced native compaction threshold and unneeded originator override. Required DSH dynamic-tool ownership and transport parsing still remain.
4. **User-side code execution is not part of the test plan.** Unit tests and Github install smoke run in disposable CI only. No DSH code is installed into the user's home for the cloud checks.
5. The next version will use an **orphan minimal release snapshot**: its GitHub tag must not have `tests/`, `src/`, `.github/`, `scripts/`, `devDependencies`, or lifecycle hooks. A downloaded tag is checked as well as a package archive.
6. **Remaining behavior to validate**: the native approval prompts are not currently forwarded as interactive DSH prompts, and unauthenticated app-server/model turns have not been tested against a real ChatGPT Codex account. Treat that as a known integration limitation, not an absence of risk. A live user trial is not a substitute for isolating and testing the shipped package.

## CI and release gates

- [Cloud CI (typecheck, account-free unit tests, build)](https://github.com/Tests4gptplay/dsh-codex-native/actions/workflows/ci.yml). No unit tests should be invoked by loading the plugin.
- Minimal GitHub-tag installation must succeed **without modifying the user's `allowBuilds`**.
- A clean DSH 0.2.1 Host must load the bundle and list the `codex-local` model in a disposable CI environment.
- Distributable contains compiled runtime only; source repository continues to carry test fixtures for development (not shipped).
- Authenticating a real account, native user approvals, and long-running native Codex tasks still need separate validation; none may be represented as production-proven.

## Prior immutable releases

- [alpha.0](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.0): unsuitable for DSH Git installation.
- [alpha.1](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.1): installation hook fixed but distribution tree not isolated; not recommended.

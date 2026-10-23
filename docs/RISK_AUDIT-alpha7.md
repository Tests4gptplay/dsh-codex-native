# alpha.7: account lifecycle risk reproduction

2026-10-24 JST. Baseline: `718356eb00fde0d7a6002ebcdbe13df5f81e56f8` (alpha.6). No runtime change was made before adversarial tests reproduced the failures.

## Isolated environment

The lab uses official DSH `0.2.1-rc.2` packages (Cordis, LLM, tools, system prompt and subprocess-local), plus the corresponding open-source DSH tree `687f282e8625c6b8d11ff58211a90524be2e4317`, Node `24.21.0`, and the existing pinned Codex `0.154.0`. An offline copy was transferred from a disposable GitHub-hosted runner into the assistant's temporary workspace. No installation or test ran in the user's Desktop profile or on their CAH host. No real account, credentials or paid inference were used.

Account failure injection uses a real child through the official DSH subprocess runtime. The development-only fixture can keep pipes open while withholding an initialize, account-query or cancel response. It records requests only in a temporary directory. This is a protocol fixture, not a claim of an observed production Codex crash. The existing real Codex wire test uses a loopback HTTP stub, not an external model.

## Confirmed findings and narrow repairs

### 1. Account processes were not owned through their whole lifecycle

On alpha.6, `dispose()` only closed `active`, which is assigned to a login process after initialization. Children initializing or serving status, quota or usage requests were missing from that field. The tests disable the consumer plugin while leaving DSH's shared subprocess service enabled: the child stays alive and the caller remains pending. Parallel queries exhibit the same leak. The real Cordis plugin also detached the account cleanup promise with `void`, so plugin disposal did not join it.

Repair: record each account connection before the first handshake await; remove it when its existing close completes; dispose all recorded connections idempotently; return the account cleanup promise to Cordis. No model-process ownership, new timer or new dependency is introduced.

### 2. Login cancellation depended on the unresponsive server acknowledging it

On alpha.6, the explicit Cancel action awaited `account/login/cancel` before closing the child. A server that leaves its pipes open and never replies prevents the user from cancelling.

Repair: send the protocol cancellation on a best-effort basis, mark that login cancelled locally, and close its owned process using the existing teardown path. The test checks that the cancellation request was written, the process exits and the caller resolves. It deliberately does not require the dying child to consume or acknowledge the message. Cancelling login does not log out an already authenticated account.

## Before/after evidence

The pre-existing baseline suite passed (153 tests, one Windows-only skip on Linux). It did not cover these failures. On the same additional assertions, the original source repeatedly failed nine lifecycle assertions; the two production files were then changed. The final local full suite passed five consecutive runs: 165 passed, one Windows-only skip, zero failures. One intermediate test used the wrong success criterion (a child-side cancellation marker after immediate termination); it was corrected to assert the parent-side write and actual local cancellation, not to weaken any production failure expectation.

Twelve added cases cover initialization disposal, status/quota/usage disposal, unresponsive cancel, consumer-plugin disposal, unrelated-process preservation, parallel reads/repeated disposal, a valid delayed response, awaited Cordis cleanup, active-turn duration and cache pressure. Test-owned cleanup runs even after assertion failures.

## Controls retained unchanged

- A normal account query still performs exactly one `initialize`, one `initialized` notification and its requested account operation. The required official handshake is not removed.
- A live model turn with `timeoutMs: 0` survives one simulated hour; active sessions are not idle-expired or capacity-evicted. These are virtual-time semantics checks, not an hour of live inference.
- Account disposal leaves an unrelated real DSH child alive. Existing recorded-tool-result recovery remains covered by the previous regression suite.
- No new watchdog, health probe, heartbeat, reconnect loop, background usage meter, model deadline or approval bypass is added. The existing pending-login UI status timer reads local login state; usage queries remain manual.
- Published runtime excludes tests, fixtures, CI, source, development dependencies and install scripts. Runtime entrypoints do not import the new audits. The browser bundle is unchanged.

## Limits

These results establish the reproduced lifecycle defects and regression behavior in the stated environment, not universal security certification. They do not prove the original user's protocol-EOF initiating cause, cloud availability, real-account OAuth behavior, every Electron/skin combination, or a real one-hour model workload. Native interactive approval bridging remains unchanged. Healthy connections are not restarted merely because they are quiet; a silent initialization still relies on explicit caller/plugin disposal rather than a new hard deadline.

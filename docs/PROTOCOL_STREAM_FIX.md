# Local Codex protocol closure — alpha.6 investigation

Reported error: `Codex App Server closed its protocol stream`.

## Evidence and scope

The exact message originates in `JsonRpcConnection.onEnd`, not a remote OpenAI outage response. Inspection of the alpha.5 runtime bundle and an isolated Node-stream reproduction confirmed:

- stdout EOF during a backpressured stdin write left the public request pending and could emit an unhandled rejection;
- stdout `close` without `end` left the request pending;
- EOF could win the race against `child.done`, hiding process exit status and stderr.

The local reproduction executes the actual alpha.5 compiled transport with only the LlmError value class stubbed. Full CI additionally exercises the real pinned DSH subprocess runtime, a real test child, and the production adapter on Ubuntu and Windows. Test sources, mock scripts and fixtures remain development-only.

The user's original initiating process failure is **not identified** without its machine-side exit evidence. A cloud status page cannot establish that a particular local executable crashed. No real ChatGPT account or model quota is used in these tests.

## Repair boundaries

Pipe closure cancels drain waits and settles correlated requests promptly. Process observations enrich transport failures after cleanup; exit observations made during cleanup are explicitly labelled and are not asserted to be the cause. Common credential shapes are redacted and stderr display is capped at 2,000 characters. Missing diagnostics never block a request.

The cache observes only a connection's already-known closed state. The next request reconstructs from durable history, including recorded tool output. It does not rerun the tool itself or add automatic replay of an in-flight turn. Existing cancellation, model policy, manual usage queries and native UI remain unchanged.

No heartbeat, background reconnect loop, new polling, account reset, authentication-file modification, or runtime watchdog is introduced. The only teardown deadline on account processes uses the existing 3-second termination grace (a 6-second wait); it does not limit an active model task.

## Regression tests

`tests/transport-lifecycle.spec.ts`: backpressure+EOF, stdout close-only, stdin close, explicit cancellation, buffered successful responses, late EPIPE, malformed frames, late exit/stderr, startup rejection, cleanup labelling, common secret masking.

`tests/dead-session.spec.ts`: closed cached process reconstructed on the next request; recorded tool results are replayed as history, not executed again.

`tests/mock-stdio.spec.ts`: real DSH LocalSubprocessRuntime and a real test child exiting during a turn, with captured/redacted stderr, alongside the existing normal reply and model-error cases.

The account test double now reports process completion only when terminated. An already-resolved fake `done` promise is not a live process and previously hid the missing account-process failure observer.

Acceptance requires successful typecheck, all account-free regression tests and build on both supported CI OS jobs, followed by the existing runtime-only Git tag / TGZ installation checks. CI results are authoritative; this document does not by itself certify a test run.

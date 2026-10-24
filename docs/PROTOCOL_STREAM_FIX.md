# Codex protocol stream recovery — alpha.6

Reported message: `Codex App Server closed its protocol stream`.

## Findings

The message originates in the adapter's `JsonRpcConnection.onEnd` handler. The alpha.5 transport reproduction found three closure races:

1. stdout EOF during a backpressured stdin write left the request pending.
2. stdout `close` without `end` left the request pending.
3. Pipe closure preceding `child.done` could hide the process exit code and stderr.

The investigation used the compiled alpha.5 transport, the official DSH subprocess runtime and controlled child processes on Ubuntu and Windows.

## Implemented repair

Pipe closure settles outstanding requests and releases pending drain waits. Exit code, signal and bounded stderr enrich the diagnostic record, with common credential shapes masked.

Cached closed connections are detected on the next request. Session history, including completed tool outputs, is used for thread reconstruction. Account teardown continues to use its established process grace period.

## Regression coverage

- `tests/transport-lifecycle.spec.ts`: EOF/backpressure ordering, stdout and stdin closure, cancellation, successful buffering, late process exit, stderr and malformed frames.
- `tests/dead-session.spec.ts`: cached process closure, session reconstruction and history reuse.
- `tests/mock-stdio.spec.ts`: official DSH LocalSubprocessRuntime, child-process exits and normal response/error paths.

Cross-platform typecheck, regression tests and build passed.

[CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39996592077) · [Release installation](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39997058708) · [Current status](STATUS.md)

---
status: accepted
---

# Separate Codex trajectory from Harness tools and replay

Classify every raw App Server response item against the exact history injected for the current stateless request. Known history echoes coalesce with their existing event. Codex-added developer, system, and user messages become context-category `codex-action` reports and are preserved as replay metadata for audit. Reconstruction injects the corresponding model-output items. New assistant and provider output items remain in lossless replay. Native non-message items are represented as action-category reports; validated Harness tool callbacks use the Harness tool-call category. This includes Code Mode call and output items with an App Server raw-response event.

Reserve Harness `tool-call` blocks for validated App Server `item/tool/call` server requests in the Harness-owned namespace and naming tools declared by the current Harness request. A raw call with a verified Harness ownership label and declared name contributes to the corresponding replay identity and Harness tool-call record. Keep a Code Mode `custom_tool_call` or `custom_tool_call_output` in reconstructible replay only when the same replay step contains its mate: a fresh Code Mode host cannot resume a suspended invocation, while the canonical Harness function call and result preserve a callback that crossed the Harness tool loop. Each Codex report carries its category, phase, exact protocol event, and original JSON snapshot. Native action phases such as `failed` and `declined` describe provider trajectory; the App Server terminal turn status determines the Harness request outcome. [ADR 0007](0007-namespace-harness-dynamic-tools.md) defines the namespace rule.

## Considered Options

- Display only App Server `ThreadItem` lifecycles. This loses raw Code Mode calls and outcomes because the pinned protocol can emit them only as `rawResponseItem/completed`.
- Store all raw items in replay without displaying them. This preserves future model input but hides Codex-owned context and action execution from the Harness transcript.
- Reinject every raw item. This duplicates Harness history and Codex-owned context on each stateless step and makes the request grow recursively.
- Convert raw native calls into Harness tool calls. This assigns execution and failure semantics to the wrong runtime.

## Consequences

Replay state uses an explicit version; unrecognized state falls back to logged Harness message reconstruction. The transcript records lifecycle and context events as separate categories. `thread/start` is lifecycle metadata; provider actions carry their own event types. Context snapshots increase log volume, but they make the Codex-added model input inspectable. The generic Harness renderer can display the complete block immediately; the dedicated client renderer presents the same fields compactly without changing durable data.

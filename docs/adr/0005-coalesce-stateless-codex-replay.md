---
status: accepted
---

# Coalesce stateless Codex replay by provider identity

> Update: the automatic-compaction ownership decision below is superseded by [the context compaction repair](../CONTEXT_COMPACTION_AUDIT.md). Codex owns routine pressure compaction on the paired host; Harness handles actual context-overflow recovery. Replay deduplication and cold reconstruction continue through the Harness session log.

Reconstruct one ordered Responses history from all logged assistant replay snapshots, with at most one item for each stable Codex response identity. An item `id` identifies message and reasoning outputs; a type plus `call_id` identifies call and call-output items that have no item id. The newest provider representation replaces an older provider representation in its original timeline position. A Harness-derived call or call output remains authoritative over a later provider echo with the same identity. Items without either identity remain distinct and ordered.

Treat absent and `null` optional response fields as equivalent when the mapper classifies an App Server raw item against the history injected for the current request. App Server can echo the same completed item with these two JSON encodings. Encoding-only changes do not create a new provider output or replay checkpoint entry.

## Context

Every assistant message stores the provider outputs needed to reconstruct later model input. App Server raw events can echo prior outputs, and older plugin versions retained those echoes as cumulative replay snapshots. Concatenating every snapshot on a cold reconstruction multiplied the same opaque reasoning and call items across the injected history. Native App Server compaction then ran repeatedly on an inflated prompt and could eventually fail before producing a compacted thread state.

The Harness session log remains authoritative. Making a persistent Codex thread required for continuation would move conversation state outside the log, while discarding encrypted reasoning by age would remove distinct model-visible state. Identity coalescing removes only repeated representations of the same provider item and works when rebuilding an existing session written by an older plugin version. [ADR 0006](0006-reuse-disposable-session-threads.md) permits a live thread only as a disposable cache whose expected continuation is verified against this reconstruction.

## Consequences

- Existing cumulative replay logs need no migration or rewrite; the next request folds them into one timeline before `thread/inject_items`.
- New mapper output remains incremental when App Server merely changes optional-field encoding on an echoed item.
- Distinct provider items remain logged and replayed even when their payloads are textually equal.
- Native `contextCompaction` updates the live App Server thread. Cold reconstruction uses the Harness session log.
- Harness summarization uses a configured compatible provider; the App Server's context-management interface handles routine Codex compaction.

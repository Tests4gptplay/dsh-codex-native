---
status: rejected
---

# Use Codex App Server as a Harness-owned transport

Decision: retain the `codex exec` path for scenarios requiring Harness-controlled prompts. Codex App Server is a complete agent runtime: its host-supplied `baseInstructions` and `dynamicTools` coexist with Codex-owned instructions, context and tools in the model request.

## Considered Options

- Keep `codex exec` and put the Harness request in one user prompt. This buffers trajectory until completion and uses a response schema to represent function calls.
- Expose the native Codex agent and mirror its actions into Harness. This introduces Codex as a second tool executor, with its own permission and context ownership.
- Use App Server base instructions, native history items, streamed events, and host-owned dynamic tool declarations. This provides protocol fields and events with explicit shared ownership of model-visible instructions and tools.
- Call the OpenAI Responses API directly. This provides direct request ownership through API credentials and the corresponding API authentication flow.

## Evidence

The keyless wire test starts the pinned Codex `0.147.0` App Server with a fresh `CODEX_HOME`, an empty working directory, an explicit empty `developerInstructions`, personality `none`, no environment or capability roots, and every relevant feature disabled. It also disables every skill returned by `skills/list`, verifies that `instructionSources` is empty, and captures the decoded request at a local Responses-compatible endpoint.

For the configured `gpt-5.6-sol` model, the captured request still contains Codex permission instructions, primary-agent and multi-agent instructions, an environment-context message, and Codex-owned `exec`, plan, interaction, skills, and collaboration tools. The captured request places the Harness base instruction in one developer message and routes Harness dynamic tools alongside native Codex tools. The `instructionSources` field documents the discoverable instruction files used in that request.

## Consequences

ADR 0002 records the product decision to integrate App Server as a layered Codex provider with shared prompt and tool ownership. The wire test provides a repeatable reference for this architecture.

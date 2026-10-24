---
status: accepted
---

# Use App Server as a layered Codex provider

Replace the `codex exec` bridge with pinned Codex `0.147.0` App Server after explicitly accepting Codex as a co-owner of the model-visible prompt and tool catalog. Harness remains authoritative for durable history, Harness dynamic-tool execution, session logging, and UI trajectory; the provider discloses Codex-added layers and records Codex-native action lifecycles as provider-owned trajectory instead of presenting them as Harness tool calls.

## Considered Options

- Use a direct Responses API provider. This preserves exact prompt and tool ownership but requires API credentials instead of the existing local Codex login.
- Keep `codex exec`. This preserves the existing OAuth bridge but buffers trajectory and simulates Harness tool calls through structured output.
- Treat App Server as a raw model transport. The ADR 0001 wire capture instead supports the layered-provider architecture.

## Consequences

The provider reuses the local Codex OAuth session and streams App Server events. Documentation and diagnostics identify Codex-owned prompt layers. Harness tools are exposed as App Server dynamic tools and their requests are routed to the Harness agent loop for execution. Code Mode remains enabled because `gpt-5.6-sol` uses it to dispatch dynamic tools. Shell, file, web, MCP, collaboration and other native action events are owned by Codex; their lifecycle snapshots appear in Harness as provider trajectory.

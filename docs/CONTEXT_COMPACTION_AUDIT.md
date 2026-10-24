# Context accounting and Codex automatic compaction

**Unreleased development repair; publication is paused.** The plugin and the companion DSH host patch must be used together. An unchanged stock host ignores the new contracts. The published version remains alpha.7.

## Decision and compatibility

Codex owns routine pressure compaction for the Codex provider. Resolved model metadata declares `pressureCompaction: 'provider'`; the paired host skips its pressure-triggered compaction for that route. Other providers retain the Harness policy when they omit the field or declare `'harness'`. Actual context-overflow recovery and explicit manual compaction remain available for every provider.

The engine uses the latest durable `request/header` route, as before. The host validates and preserves ownership through its model-info normalizer. The field is on resolved model metadata, so an unknown-capacity model can also declare it. The host does not add metadata lookup or change the existing context-overflow path. No global switch, fabricated capacity, increased threshold, replacement compaction service, or agent-event short circuit is used. Image-budget recovery stays independent.

Truthful accounting is still required even when the provider owns its window. These are separate fixes.

## Reproduction and accounting repair

Fixed baselines: [plugin ff4f407](https://github.com/Tests4gptplay/dsh-codex-native/tree/ff4f4073ee4ca164a58089ad498a6b3663ead265), [official DSH 687f282 / rc.2](https://github.com/deepseek-ai/deepseek-harness/tree/687f282e8625c6b8d11ff58211a90524be2e4317), and [official Codex 0.154.0](https://github.com/openai/codex/tree/rust-v0.154.0).

The original mapper summed all native responses in a Harness step. The stock host treated that sum as one current window:

| Native responses, each input 90,000 + output 1,000 | Total consumption | Latest window | Stock pressure sample |
|---|---:|---:|---:|
| 1 | 91,000 | 91,000 | 91,000 |
| 2 | 182,000 | 91,000 | 182,000 |
| 3 | 273,000 | 91,000 | 273,000 |

The unchanged control-model threshold is `min(272000 * 0.8, 272000 - 65536) = 206464`, with no completion reservation. Three responses therefore selected Harness compaction prematurely. The reproduction uses the actual official Session, stream accumulator, token meter, projections and basic compaction policy.

The repair preserves the outer consumption buckets and adds `contextUsage?: { inputTokens: number; outputTokens: number } | null`:

| Value | Pressure | Consumption |
|---|---|---|
| Omitted | Existing provider behavior | Original outer buckets |
| Object | Latest complete input + output | Full outer buckets |
| `null` | Unknown window; existing estimation | Full outer buckets |

Complete input includes cache; complete output includes reasoning. Neither is added twice. Route matching and the heuristic floor remain. Native compaction markers invalidate the previous window; compaction-request receipts are still counted, and the next ordinary raw response supplies the next window sample.

### Delayed snapshots are not new receipts

`thread/tokenUsage/updated.last` can arrive in the next Harness step after its response was already counted. The original fallback could charge it twice. The fixed mapper settles consumption only from `rawResponse/completed`, enabled by the pinned runner. A step without raw usage emits no usage: unknown consumption is not reported as zero.

The cached regression opens one thread and continues two tool callbacks: step 1 settles R1 = 91,000; step 2 sees only delayed `.last(R1)` and emits no new bill; step 3 settles real R2 = 122,000. Total known consumption is **213,000**. The original two-step prefix incorrectly reported 182,000. The third step checks that removing the fallback does not discard later real consumption.

## Native thread continuity

Codex 0.154.0's standard remote, remote-v2 and token-budget automatic compaction paths replace the live thread's context and emit canonical `contextCompaction` item events. Those paths do not emit the replacement as a replayable raw compaction item. Canonical events do not discard the plugin's cached thread, so later requests can continue the compressed native context.

Sources: [turn dispatch](https://github.com/openai/codex/blob/rust-v0.154.0/codex-rs/core/src/session/turn.rs), [remote compaction](https://github.com/openai/codex/blob/rust-v0.154.0/codex-rs/core/src/compact_remote.rs), [remote-v2 compaction](https://github.com/openai/codex/blob/rust-v0.154.0/codex-rs/core/src/compact_remote_v2.rs), [session replacement](https://github.com/openai/codex/blob/rust-v0.154.0/codex-rs/core/src/session/mod.rs).

Existing idle expiry, cache eviction, process failure, route/config changes and nonmatching continuations can still cause cold reconstruction from the full Harness request. Codex may compact again after that, but native recovery cannot be assumed to handle every injected cold history. This repair does not introduce a portable native checkpoint or promise one compaction per conversation. Separately received raw opaque compaction items retain the existing invalidation behavior.

### Why actual overflow recovery remains

The official 0.154.0 App Server was exercised twice in independent fresh processes and threads, using isolated homes, only artificial input, and a loopback Responses fixture. After injecting 184,000 characters of old user history followed by an assistant message and short new user input, both runs issued a normal Responses request without first compacting. A valid SSE `response.failed` carrying `context_length_exceeded` produced `codexErrorInfo: 'contextWindowExceeded'`, a full token-usage estimate and a failed turn. Neither run then attempted native compaction. Recreating the process reproduced the failure.

The [captured report](evidence/cold-native-overflow-results.json) and [loopback-only reproducer](../scripts/cold-native-overflow.mjs) preserve this evidence. Run the script from the plugin repository with `node scripts/cold-native-overflow.mjs`; it writes `cold-native-overflow-results.json`. This is why the final contract delegates only routine pressure compaction. Completely disabling Harness overflow recovery would remove a needed recovery path for cold history. No new retry mechanism, task replay or native checkpoint format is introduced.

The same probe exposed a second concrete recovery fault: the actual native message says that Codex “ran out of room”, which the old message regex classified as `CODEX_PROCESS`. The adapter now recognizes the structured `contextWindowExceeded` value before using its existing text fallback, while preserving cancellation precedence. This allows the existing Harness overflow handler to receive the correct failure code.

## Verification

The initial accounting matrix used the same 20 assertions throughout:

| Plugin | Host | Passed | Failed |
|---|---|---:|---:|
| Original | Stock rc.2 | 4 | 16 |
| Accounting repair | Stock rc.2 | 17 | 3 |
| Accounting repair | Complete official source + paired patch | 20 | 0 |

The [preserved failure evidence](evidence/context-compaction-regressions.json) includes the original assertion failures. The original failure count includes missing new metadata; it does not mean sixteen independent customer defects. The three repaired-plugin/stock-host failures are the 182,000/273,000 pressure samples and failure to honor an unknown window. They prove that updating only the plugin is insufficient.

Before the ownership addition, the full plugin suite passed **181 tests**, with **one existing platform-specific skip**. Typecheck, build and pack passed. The final policy and structured-error regressions are recorded below. Tests use controlled peers and actual host components, without user credentials or live model requests.

### Reproduce

With Node 24 and the repository's pnpm version:

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git .tmp/dsh-reference
git -C .tmp/dsh-reference checkout 687f282e8625c6b8d11ff58211a90524be2e4317
git -C .tmp/dsh-reference apply ../../patches/dsh-context-usage-0.2.1-rc.2.patch
pnpm install --no-frozen-lockfile --ignore-scripts
pnpm run typecheck
pnpm run test:ci
pnpm run build
pnpm pack --pack-destination dist
```

CI applies the paired patch only to the disposable official checkout. Vitest loads its complete token-meter and compaction source. The regenerated development lockfile replaces stale local-workspace links with the already-declared registry dependencies plus pinned test dependencies; runtime dependency versions are unchanged.

### Final validation

The final focused suite passed **26/26**, versus **22 passed / 4 failed** with the same final assertions before the metadata, host pressure guard and structured-error repairs. The final full plugin suite passed **187 tests**, with **one existing platform-specific skip**, across **24 test files**. Typecheck, strict test typechecking, build and pack passed. Official host gates also passed as detailed below. Cross-platform CI runs on the accompanying draft pull request; its Checks tab records the current Windows/Ubuntu result. No release or user-installation acceptance is implied.

### Official host gates

The paired patch is fixed to official rc.2 commit `687f282e8625c6b8d11ff58211a90524be2e4317`. Its SHA256 is `dd8049f33fea9187cc025e792fc25feb68a8ad5ccb1044cc85e063429c2b717e`. It applies cleanly to that baseline; its five runtime source files byte-match the source used for the final plugin tests.

| Check | Evidence |
|---|---|
| Context usage focused tests | 54/54 |
| Pressure ownership official tests | 269/269; strengthened Loader file 7/7, overlapping the 269 |
| Complete official build before the pressure-only extension | 9/9 tasks |
| Final combined source compilation | Host contracts and Client compiler passed |
| Final runtime bundles | Official builder rebuilt LLM, token-meter, compaction-basic and tool-cordis; actual JavaScript imports and ownership/validation behavior passed |
| Final aggregate build checks | Host and Client, 2/2 |
| Lint | Complete lint before the ownership extension passed; final 13 changed TypeScript files passed all original rules |
| Persistence acknowledgement | Official generation and verification passed; 65 roots matched 17 history records, no pending change |
| Generated catalogs | Persistence catalog and all 125 Cordis outputs current |
| Documentation | 494 original type excerpts and 494 translated derivatives matched; seven changed document pairs passed |

The initial official doc-sync aggregate was 41/43. Its two failing components were a documentation-graph Node heap limit and the expected stale generated API catalog. Increasing only the documentation tool's heap and using the official catalog generator made both component checks pass. The original aggregate exit status is not rewritten as a successful run. Final source freshness and type-equivalence gates were checked again after the pressure-only extension.

## Evidence boundaries

### Skills-description warning on the first request

`Skill descriptions were shortened to fit the skills context budget` is a separate native **Warning** notification. It does not run conversation summarization or emit a `contextCompaction` item. The plugin only prefixes that warning with `Codex:`.

In fixed Codex 0.154.0, the default skill-catalog metadata budget is 2% of the model context window. A new thread renders its enabled skill catalog again, so the same large catalog can produce the warning on every new conversation's first request. This exact warning requires that no skill entries were omitted: names and locators remain, while descriptions are shortened. It does not modify skill files or disable skills.

The independent `skills.max_context_tokens` setting can override the budget; its explicit value is capped at 10,000 tokens, whereas the default percentage branch has no such cap. This plugin does not set that option. See the official [budget and warning implementation](https://github.com/openai/codex/blob/rust-v0.154.0/codex-rs/ext/skills/src/render.rs) and [new-thread skill initialization](https://github.com/openai/codex/blob/rust-v0.154.0/codex-rs/ext/skills/src/extension.rs). The screenshot's warning must not be counted as an occurrence of conversation compaction.

### Remaining measurement and acceptance limits

The UI context-pressure projection retains its approximate surface-delta calculation; it is not an exact last-request counter. Automatic policy does not use that displayed projection. A step without raw accounting can leave an older approximate UI anchor; no zero bill is invented to refresh it.

The tests establish the reproduced accounting faults and the selected automatic-compaction policy. They do not establish the cause of every compaction in a previous user conversation or replace a real native long-session acceptance run. Manual account history (`account/usage/read`), Query/Clear, login lifecycle, retry policy and model timeouts remain separate, unchanged paths.

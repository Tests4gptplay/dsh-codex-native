# Context accounting and Codex compaction — engineering record

**Release:** `v0.2.1-alpha.8` · [Download](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.8) · [Installation](INSTALL_PATCHED_HOST.md)

## Architecture

Codex routes declare `pressureCompaction: 'provider'` in resolved model metadata. The paired DSH host uses this field to delegate ordinary pressure-based compaction to Codex. DSH's actual context-overflow recovery and manual compaction remain part of the runtime.

The same integration adds an independent per-response `contextUsage` field. It separates the latest native context-window sample from the accumulated consumption buckets.

| Response field | Runtime use |
|---|---|
| Total input/output usage | Consumption accounting |
| `contextUsage` object | Latest input + output sample for the active context window |
| `contextUsage: null` | Unknown window, handled by DSH's estimation method |
| Omitted `contextUsage` | Existing provider behavior |

Completed native responses include cached input and reasoning output in their respective standard totals.

## Reproduced accounting problem

Source baselines: [plugin ff4f407](https://github.com/Tests4gptplay/dsh-codex-native/tree/ff4f4073ee4ca164a58089ad498a6b3663ead265), [official DSH rc.2 687f282](https://github.com/deepseek-ai/deepseek-harness/tree/687f282e8625c6b8d11ff58211a90524be2e4317), [official Codex 0.154.0](https://github.com/openai/codex/tree/rust-v0.154.0).

The earlier mapper summed multiple native responses within a Harness step and passed that total to DSH's context-pressure meter. With an unchanged 91,000-token latest window, successive responses could inflate the pressure reading:

| Native responses | Accumulated consumption | Latest window | Earlier pressure reading |
|---|---:|---:|---:|
| 1 × 91,000 | 91,000 | 91,000 | 91,000 |
| 2 × 91,000 | 182,000 | 91,000 | 182,000 |
| 3 × 91,000 | 273,000 | 91,000 | 273,000 |

The test model's DSH threshold was **206,464** tokens, so the third response previously selected compaction. The corrected sample remains at **91,000** and the accumulated usage remains **273,000**.

These cases execute the official DSH Session, token-meter, stream accumulator and basic compaction decision.

## Delayed Token snapshots

The native `thread/tokenUsage/updated.last` notification can arrive after the corresponding `rawResponse/completed` receipt. Consumption is now settled from completed raw responses.

One cached-thread regression continues across two tool callbacks:

| Stage | Receipt or notification | Newly recorded consumption |
|---|---|---:|
| Step 1 | R1 complete | 91,000 |
| Step 2 | Delayed R1 last-window notification | 0 additional |
| Step 3 | R2 complete | 122,000 |
| **Total** | | **213,000** |

Native compaction events refresh the context-window sample and the next ordinary completed response supplies the subsequent sample.

## Codex thread behavior and overflow recovery

Codex 0.154.0 updates its live thread on canonical `contextCompaction` events. The plugin reuses this live thread across ordinary consecutive requests.

For cold-history reconstruction, the official App Server was exercised twice with isolated homes, artificial history and a loopback Responses test endpoint. The test injected 184,000 characters of history and returned an SSE `response.failed` with `context_length_exceeded`. Both runs produced `codexErrorInfo: 'contextWindowExceeded'` and a failed turn. The adapter maps this structured code to DSH's existing overflow recovery.

[Cold-history probe and result](evidence/cold-native-overflow-results.json) · [Reproducer](../scripts/cold-native-overflow.mjs)

## Before-and-after regressions

| Code combination | Passed | Failed |
|---|---:|---:|
| Original plugin + DSH rc.2 | 4 | 16 |
| Accounting repair + original DSH rc.2 | 17 | 3 |
| Accounting repair + paired host patch | **20** | **0** |

The final extended suite had **22 passed / 4 failed** at the pre-repair baseline and **26/26 passed** with the complete repair, using identical assertions.

[Failure evidence](evidence/context-compaction-regressions.json) · [Repair candidate CI](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40078589328)

## Host integration and release verification

The paired patch applies to official DSH `0.2.1-rc.2` commit `687f282e8625c6b8d11ff58211a90524be2e4317`. Patch SHA256: `dd8049f33fea9187cc025e792fc25feb68a8ad5ccb1044cc85e063429c2b717e`.

| Verification stage | Result |
|---|---|
| Official context usage tests | 54/54 |
| Official compaction ownership tests | 269/269 |
| Windows plugin tests | 188/188 |
| Ubuntu plugin tests | 187 passed; one platform skip |
| Final packaged-runtime + normalizer tests | 28/28 |
| Final host source build | 9/9 |
| Fresh-profile install and Web startup | Passed: HTTP 303 → 200 |
| Immutable tag installation and runtime hashes | Passed |

[Release workflow](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/40078708238) · [Published status](STATUS.md)

The test environments use isolated DSH workspaces and controlled Codex peers. The design preserves the standard login, manual Token history, DSH tool routing and existing session replay.

## Reproduce

With Node 24 and the repository's pnpm version, from the plugin source directory:

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

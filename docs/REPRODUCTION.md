# alpha.4 — reproduce unknown content and Windows launch

2026-10-23. Tested source: `141dfa2960fbd58f2e43d361745e6ca3b815dbbc`.

## Evidence

- [Regression run, Linux and Windows](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39947758087): success.
- [Minimal release and exact GitHub install](https://github.com/Tests4gptplay/dsh-codex-native/actions/runs/39948312538): success.
- [Published alpha.4](https://github.com/Tests4gptplay/dsh-codex-native/releases/tag/v0.2.1-alpha.4).

## Root cause 1: unsupported visible block

The previous cleanup removed the custom Codex UI renderer but `AppServerEventMapper` continued to output `codex-action`. Official DSH `AssistantMarkdown.tsx` at commit `687f282e8625c6b8d11ff58211a90524be2e4317` renders unsupported content via its `message.unknownBlock` JSON fallback.

The user's `thread/start` lifecycle block and empty `turn/moderationMetadata` are protocol/lifecycle data, not an assistant answer. `src/presentation.ts` now projects them out of visible chat, translates native completed/failed/declined actions into standard DSH text, and reindexes the remaining visible blocks. The wire mapper and finish replay state are left intact. DSH tool calls and genuine errors are not filtered.

No old history is edited. Old custom blocks can remain visible in already-persisted messages.

## Root cause 2: a second unmanaged visibility decision in the wrapper

OpenAI Codex's pinned `codex-cli/bin/codex.js` spawns `codex.exe` without `windowsHide`. Official DSH already owns its Windows children using native startup-window settings. Starting Node's wrapper creates a second native spawn outside that initial DSH launch setting.

`src/launch.ts` resolves only the official packaged Windows optional binary and changes only this plugin's `app-server` argv. DSH remains the process owner; pipes, cwd, environment, abort and cleanup are preserved. Other DSH commands are untouched. No global monkey patch or window closer exists.

## Testing with a fake backend

`tests/fixtures/mock-app-server.mjs` is a private stdio JSON-RPC peer with fixed messages. It has no network calls, token handling, real shell execution or production registration. The test injects it into a real DSH LocalSubprocessRuntime-backed runner only in `tests/mock-stdio.spec.ts`.

The fake peer emits the user's lifecycle/moderation shapes, native action start/completion, a preserved answer and turn completion. The failure case returns a genuine failed turn and confirms the adapter does not hide it.

`tests/official-renderer.spec.tsx` imports the actual pinned official DSH `AssistantMarkdown` source. Only leaf display widgets are substituted for neutral SSR output; the content-type switch is the real official implementation. The same fixture renders **3 unknown blocks before, 0 after**, while preserving the answer and the meaningful command status. Before/after HTML files are CI artifacts, not production code and not screenshots of a signed-in Desktop.

`tests/launch.spec.ts` runs the real official Windows executable under DSH, isolated `CODEX_HOME`, and verifies initialize + account/read returns no account. This validates the direct launch and protocol connection, **not visual observation of a user's interactive desktop or subscribed model inference**.

## Acceptance result

Linux: 126 passed, 1 Windows-only case skipped. Windows: all 127 passed. Typecheck/build passed on both. The source-free release snapshot contains 25 files and no tests, mock fixture, CI, source, scripts or devDependencies. Exact GitHub-tag installation succeeded without changing allowBuilds.

## Deliberately not claimed

No real account token was intercepted. No mock login was shown as real. Old conversation records were not deleted. Native Codex approval UI, real subscription eligibility and every future native child-window behavior are not certified by these tests.

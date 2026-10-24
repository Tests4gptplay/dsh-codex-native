# DSH Codex Native 0.2.1-alpha.7

Install in DSH Plugins → Add plugin:

github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.7

Official Codex app-server main-model adapter with native ChatGPT login and manual account usage history. Independent community integration; original MIT attribution is retained in LICENSE.

## alpha.7 account lifecycle repair

Two defects were reproduced BEFORE changing runtime code, using real isolated children under the official DSH subprocess runtime on Windows and Linux. Disposing the account service left stalled initialize/status/quota/usage requests alive, and cancelling login waited for an unresponsive server acknowledgement.

The account service now owns each of its children before initialization and closes those owned children on disposal. Explicit login cancellation sends its protocol request best-effort and closes that login connection without waiting indefinitely for acknowledgement. It does not terminate model-task processes or delete saved credentials.

The same eight new checks and the existing regression suite passed after the fix. Normal initialization still occurs once per connection; an active model turn survived an accelerated idle-cache-expiry test. This is not a one-hour real-model soak or proof of the initiating cause of an earlier user-reported protocol exit.

Only src/native-account.ts changed in production source relative to alpha.6. No dependency, model policy, approval policy, frontend bundle, watchdog, heartbeat, usage poller, task timeout or in-flight replay change was introduced. Prior alpha.6 protocol-closure fixes are retained.

Manual Query/Clear history and native DSH controls remain. Token history is account-wide. Historical reset grouping references codex-reset.com public announcements and is approximate. Clear only empties the view.

The installation snapshot excludes tests, fixtures, source, CI, screenshots, installation scripts and devDependencies. Test fixture peers run only in the isolated development tests. No real account or paid model request was used for this audit.

Fully quit and reopen DSH after upgrading. Existing native interactive-approval limitations remain. Detailed audit and test evidence: https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/ACCOUNT_LIFECYCLE_AUDIT.md

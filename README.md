# DSH Codex Native 0.2.1-alpha.6

Install in DSH Plugins → Add plugin:

github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.6

Official Codex app-server main-model adapter with native ChatGPT login and manual account usage history. Independent community integration; MIT attribution is retained in LICENSE.

## alpha.6 protocol lifecycle fix

Closed pipes now settle blocked requests instead of waiting forever for drain. Transport errors retain local process exit/stderr evidence, with common credential shapes redacted; an exit first observed during cleanup is labelled accordingly. Already-closed cached threads are rebuilt from recorded history on the next request, including existing tool results, without adding automatic in-flight tool replay.

No heartbeat, reconnect poller, watchdog or new hard model-task timer is added. Existing DSH retry settings are unchanged. This repair does not prove why the user's original local process exited or that OpenAI's cloud was down.

The alpha.5 manual Query/Clear history UI and native DSH controls remain. Token history is account-wide; historical reset groups reference codex-reset.com and are approximate UTC-date groupings. Clear empties the view only. No account data is sent to that reference site.

Production tag contains compiled runtime, declarations, metadata, license and READMEs only. Tests, mock processes, source, CI, screenshots, install scripts and devDependencies are excluded. Ubuntu and Windows regression tests, including a real isolated child exit, passed; no real user account or live model quota was used.

Fully restart DSH after upgrading. Source, detailed boundaries and evidence: https://github.com/Tests4gptplay/dsh-codex-native

# Manual account usage panel (alpha.5 work)

## Data and interaction contract

Only clicking **Query** reads official `account/usage/read`. No usage poller, startup history query, model call, token-counting hook, or background accumulator is added. Expanding a period and **Clear** do not contact any service. Clear empties this page's result and total; it does not delete OpenAI account history, consume reset credits, log out, or erase conversations. A subsequent Query returns official history again.

`dailyUsageBuckets` supplies the dated rows. The toolbar total is the sum of those returned daily buckets; the separately labelled official lifetime value can be larger because the service may return a limited history range. Null/unavailable values are not converted into zero. Large counts are represented as decimal strings and summed with BigInt. Account usage is not labelled as plugin-only usage.

## Reset period provenance

Pinned Codex 0.154.0 exposes current windows and **next** `resetsAt` through `account/rateLimits/read`, but no complete historical reset ledger. No historical official endpoint, fixed weekly schedule, or inferred per-account reset is fabricated.

For historical reference grouping, manual Query also reads `https://codex-reset.com/api/timeline`. Only documented events with `group=reset` and `announcement_state=announced` are accepted. Forecasts, banked credits, unannounced events, and future dates do not create groups. The service's publication limit is respected with an on-demand 60-second cache and Retry-After handling. There is no cache refresh timer. The public GET identifies this project in User-Agent and sends no account credentials, personal usage, email, prompt, or account ID.

Rows are grouped by the announcement's **UTC date**. Whole official daily buckets are placed once; a reset-day bucket goes wholly to the new reference group. Exact intraday attribution is not available. Events earlier than the available history do not create empty rows; days before the earliest known boundary remain ungrouped. Public feed failure does not discard successful official usage queries or affect model execution.

Below the table, the UI names **OpenAI Codex `account/usage/read`** as the token source, credits and links **codex-reset.com** as the historical-cycle source, states that periods are **reference only**, and explains Clear. Official current-window data is separately labelled `account/rateLimits/read`, never claimed to be historical resets.

## Native skin-compatible presentation

Account buttons and the single usage toolbar use the actual `Button` from `@deepseek-ai/dsh-client-ui-primitives`, outline/sm variant. Periods use its `DisclosureRow`, with cycle totals kept on the folded row and date/token columns underneath. The plugin does not bundle a second copy of these primitives or their CSS; the DSH host owns their identity and theme styles. Layout uses existing `--dsw-*` tokens, no hard-coded colors, font family, or global styles. The preview uses illustrative data and token values only in development tests; they are never shipped.

The account-login completion timer remains separate; it does not call history or the public feed. No live account history has been queried from this cloud workspace.

Sources: https://developers.openai.com/codex/app-server/ and https://codex-reset.com/developers .

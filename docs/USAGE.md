# Token usage history — data and interface

## Interaction

**Query** reads official Codex account history from `account/usage/read`. Returned daily buckets are summed for the toolbar total, with the official lifetime total displayed separately. Values use decimal strings and BigInt to preserve large token counts.

**Clear** clears the current table and total. A subsequent Query reloads the account history.

## Period grouping

Current rate-limit windows and their next reset time are provided by `account/rateLimits/read`. Historical reference grouping uses [codex-reset.com](https://codex-reset.com/developers/) announcements with `group=reset` and `announcement_state=announced`.

Daily totals are grouped by the announcements' UTC dates. Each daily bucket appears in one reference period. The public timeline uses an on-demand 60-second cache with Retry-After handling.

The interface credits **OpenAI Codex `account/usage/read`** for Token data and **codex-reset.com** for reference reset dates immediately beneath the table.

## DSH presentation

The toolbar uses DSH's `Button` component; periods use `DisclosureRow`. Folded period rows display the total and expanded rows show dated Token counts. The UI follows DSH `--dsw-*` theme variables.

[Official Codex App Server reference](https://developers.openai.com/codex/app-server/) · [Reset timeline reference](https://codex-reset.com/developers/) · [Approved desktop screenshot](screenshots/codex-usage-desktop-anonymized.png)

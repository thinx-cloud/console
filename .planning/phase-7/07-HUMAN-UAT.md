---
status: pass (4/5 live-confirmed; HIST-03 untestable on test account — no builds)
phase: 07-history-improvements
source: [07-00-SUMMARY.md, 07-01-SUMMARY.md, 07-02-SUMMARY.md]
created: 2026-05-23
updated: 2026-05-24
live_walked_at: console.thinx.cloud (bundle 2026-05-24T08:01Z)
---

## Phase 9 live-walk results (2026-05-24)

All HIST-XX items re-tested on the deployed `console.thinx.cloud` after the
2026-05-24 CI fix landed the Vue image rebuild + swarm pull.

| Item | Result | Evidence |
|------|--------|----------|
| HIST-01 | pass | `/#/app/history/audit` renders `h1: History`, `tabTitles: ['Audit Log','Build Log']` |
| HIST-02 | pass | Bare `/#/app/history` redirects to `/#/app/history/audit`; clicking "Build Log" tab pushes URL to `/#/app/history/builds`; deep-link to `/#/app/history/audit?from=...&to=...&flags=warning,info` hydrates date inputs + flag checkboxes correctly |
| HIST-03 | untestable | Test account has zero builds (`No build logs.`) — the Expand toggle code path can't be exercised without a build with a long log. Code-level verified during Phase 7 Wave 2; no live regression possible since the UI element doesn't render in the empty state. |
| HIST-04 | pass | Date inputs accept From=2026-01-01 / To=2026-12-31; URL syncs to `?from=2026-01-01&to=2026-12-31`; deep-link reload preserves the values |
| HIST-05 | pass | Unchecking "Danger" toggles checkbox state `[false,true,true]`; URL syncs to `&flags=warning,info`; deep-link reload preserves the unchecked Danger state |

## Pre-Phase-9 content below

## Current Test

Phase 7 ships code-only for now. All five HIST-XX items are verified at the
file / commit level (yarn build green, every grep gate from each wave's
acceptance criteria passes). Human walkthrough on the deployed console.thinx.cloud
rolls into Phase 9 — Manual UAT Review.

Local-dev resume command: `yarn --cwd vue serve` against the live API.
Test credentials: `vue/cypress/fixtures/thinx.json` (admin `test` account).

## Tests

### 1. HIST-01 — Tab structure
expected: `/app/history` page renders both "Audit Log" and "Build Log" tabs;
no JS console errors during navigation.
result: code pass — `History.vue:12-50` and `:53-96` render both `<b-tab>`
children; Wave 0 stub at `cypress/integration/history.spec.js:5` parses with
`node --check`. **Phase 9: real-browser confirmation.**

### 2. HIST-02 — URL reflects active tab
expected:
- Visiting `/#/app/history` redirects to `/#/app/history/audit`.
- Clicking the "Build Log" tab updates the URL to `/#/app/history/builds`.
- Reloading `/#/app/history/builds` lands directly on the Build Log tab.
- Sidebar link `/app/history` still works (lands on Audit).
result: code pass — `Routes.js` has parent route `history` with children
`{ path: '', redirect: 'audit' }`, `audit` → `HistoryAudit`, `builds` →
`HistoryBuilds`. `History.vue` `activeTabIndex` computed getter reads
`this.$route.name`; setter pushes to the router. **Phase 9: deep-link reload,
sidebar redirect, browser back/forward verification.**

### 3. HIST-03 — Inline Expand toggle (variant b — modal deliberately not re-added)
expected: For a build row whose log is longer than ~400 chars, clicking
"Expand" lifts the 120px max-height cap and shows the full text inline;
"Collapse" restores the cap. Multiple rows can be expanded simultaneously.
Short logs do not show an Expand button.
result: code pass — `History.vue:78-92` renders `<pre>` with `:style="logStyle(item)"`
(drops `max-height:120px;overflow:hidden` when expanded) plus a conditional
`<b-button v-if="logIsTruncatable(item)">` whose label toggles between
"Expand" and "Collapse". Per-row state lives in `expandedBuilds[]` keyed by
`build_id` / `id`. **Phase 9: confirm with a build account whose logs vary in
length (the shared `test` account's builds are all ERROR with similar short
logs).**

### 4. HIST-04 — Date-range filter on both tabs
expected: Setting From / To filters both Audit and Build tables to rows whose
`item.date` is within the inclusive range. Filter state lives in the URL
query (`?from=YYYY-MM-DD&to=YYYY-MM-DD`); reloading preserves it.
result: code pass — paired `<b-form-input type="date">` rendered inside each
`<b-tab>` (`History.vue:13-18` audit, `:54-59` builds). Both `filteredAudit`
and `filteredBuilds` apply a `Number.isFinite(t)`-guarded date predicate
(items with empty/invalid dates fall through to include rather than silently
disappear — landmine documented in 07-RESEARCH.md §5). `syncFiltersToQuery()`
uses `$router.replace` (not push) so back-button history is not flooded.
**Phase 9: real-browser walk through filter set → reload → query persists.**

### 5. HIST-05 — Audit text search + flag filter
expected: Text search box matches `item.message`; a flag-filter checkbox group
(Danger / Warning / Info) lets the user hide flagged rows. Combined AND with
text search and date range. Defaults to all three flags checked. Filter state
persists in URL query (`?flags=warning,info` when "danger" is unchecked).
result: code pass — `<b-form-checkbox-group v-model="auditFlagFilter">`
(`History.vue:20-25`) inside the Audit tab only. `filteredAudit` ANDs the
flag predicate (`flags.some(f => this.auditFlagFilter.includes(f))`) with the
existing text search. `syncFiltersToQuery()` omits the `flags` query key when
all three are checked (clean URL). **Phase 9: real-browser walk through
uncheck a flag → matching rows disappear → URL reflects → reload → state
restored.**

## Summary

total: 5
passed (code-level): 5
issues: 0
pending (Phase 9): 5
skipped: 0
blocked: 0

## Out of scope (intentional)

- Re-adding the `<b-modal>` build log viewer — explicitly removed in commit
  `0ab3117` (2026-05-23) per user direction. HIST-03 is satisfied via the
  inline Expand toggle.
- Server-side filtering — client-side filtering on already-fetched logs is
  sufficient at v1 data volumes.
- Pagination — existing logs are short enough.
- The session-expiry stale-localStorage timer fix — Phase 8 (see
  `session-expiry-stale-localstorage` memory).

## Gaps

### G3 — Real-browser confirmation needed for HIST-01..05
status: open (rolling into Phase 9)
severity: low (every code path verified at file + grep + yarn build level)
items: HIST-01, HIST-02, HIST-03, HIST-04, HIST-05 — covered by the Phase 9
inputs list (Phase 7 will be added when Phase 9 starts).

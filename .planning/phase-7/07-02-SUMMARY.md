---
phase: 07-history-improvements
plan: 02
subsystem: vue-console/history
tags:
  - vue
  - bootstrap-vue
  - frontend
  - history
  - filters
  - expand-toggle
dependency_graph:
  requires:
    - 07-01 (data-layer: dateFrom, dateTo, auditFlagFilter in data(); filteredAudit/filteredBuilds predicates; created() hydration; activeTabIndex computed)
  provides:
    - HIST-03 per-row Expand/Collapse toggle on Build Log table (variant b, locked)
    - HIST-04 date-range b-form-input type=date controls inside both tabs (shared dateFrom/dateTo)
    - HIST-05 b-form-checkbox-group flag filter inside Audit Log tab only
    - syncFiltersToQuery + watch handlers that round-trip filter state through $route.query via $router.replace
  affects:
    - vue/src/pages/History/History.vue (single-file change; no router, no store, no shared component)
tech_stack:
  added: []
  patterns:
    - "Per-row expansion state via component-local array (expandedBuilds[]) keyed by build_id (with id and null fallback). No Vuex; no persistence across reload."
    - "Filter→URL sync via watch + $router.replace + same-query short-circuit; avoids back-button pollution and NavigationDuplicated warnings."
    - "URL key omission via undefined coercion (key stripped from query string when value absent or default)."
    - "Inline-style helper (logStyle) that conditionally appends max-height/overflow only when collapsed; expanded state drops the cap by returning the base style only."
    - "Watch block placed between created() and methods: (matches RESEARCH §4 ordering recommendation while staying close to file's existing layout)."
key_files:
  created: []
  modified:
    - vue/src/pages/History/History.vue
decisions:
  - "HIST-03 implemented as variant (b) per-row Expand/Collapse toggle — locked decision from RESEARCH §3 OQ-1; variants (a) accept-as-is and (c) detail-page route are out of scope. No b-modal re-introduction (deliberate removal in commit 0ab3117 preserved)."
  - "Date-range bar duplicated inside each b-tab panel rather than placed once outside b-tabs. Both copies bind to the same shared dateFrom/dateTo data fields, so editing in one tab is reflected when the user switches tabs. Tradeoff: the filter is always visible above the table the user is looking at (lower cognitive load), at the cost of two near-identical template blocks."
  - "Flag-filter checkbox group rendered with the `switches` prop (iOS-style toggle visual). Acceptance gates do not depend on this prop, so it could be removed/swapped without breaking the contract."
  - "syncFiltersToQuery uses $router.replace (NOT $router.push) so filter typing does not pollute browser history; same-query short-circuit prevents NavigationDuplicated noise on hydration."
  - "expandedBuilds is a list (not a single key) — multiple build rows can be expanded simultaneously; no global accordion behaviour."
  - "expandedBuilds is component-local data, NOT persisted across reload (an expanded row re-collapses on refresh). Matches RESEARCH §3 OQ-1 \"lightest touch\" framing."
metrics:
  duration: "~5 min (single atomic write + build + commit, no checkpoints)"
  completed: "2026-05-23"
  commits: 1
  files_changed: 1
  lines_added: 101
  lines_removed: 4
---

# Phase 7 Plan 02: History Filters and Expand Toggle Summary

Added the user-facing filter UI and per-row log-expansion affordance on top of the Wave-1 data layer in `vue/src/pages/History/History.vue` — date-range inputs inside both tabs (HIST-04), a Danger/Warning/Info checkbox group inside the Audit Log tab (HIST-05), and a per-row Expand/Collapse toggle on the Build Log table (HIST-03 variant b, locked) — all in a single atomic commit per the Phase 6 precedent for same-file plans.

## What Shipped

**HIST-04 — Date-range filter (both tabs):**
- `<b-form-inline>` block with paired `<b-form-input type="date">` controls bound to `dateFrom` and `dateTo` rendered inside each of the two `<b-tab>` panels (Audit Log and Build Log).
- Both copies bind to the same Wave-1-introduced shared data fields, so a date entered in one tab is reflected when the user switches to the other.
- Range applies to whichever tab is active via the Wave-1 `filteredAudit` / `filteredBuilds` predicates (this plan does not redefine filtering — only the input controls).

**HIST-05 — Flag-filter checkbox group (Audit Log only):**
- New `flagFilterOptions` array in `data()` exposes three entries (`{ text: 'Danger', value: 'danger' }`, `…'Warning', 'warning'`, `…'Info', 'info'`).
- `<b-form-checkbox-group v-model="auditFlagFilter" :options="flagFilterOptions" switches>` rendered inside the Audit Log tab only (build logs have no flags array).
- All three checked by default; the Wave-1 `filteredAudit` predicate hides rows whose only flag is unchecked.

**HIST-03 — Per-row Expand/Collapse toggle (Build Log, variant b locked):**
- New `expandedBuilds: []` in `data()` tracks expanded row keys.
- New methods in `methods:` (all aligned with the Vue 2 project convention — NOT in `computed:`):
  - `buildKey(item)` — stable identifier (`build_id` → `id` → `null` fallback).
  - `isExpanded(item)` — array-membership check.
  - `toggleExpand(item)` — push/splice toggle.
  - `hasLog(item)` — guards `<pre>` rendering.
  - `logFull(item)` — defers to `logSnippet` (Wave-1-preserved) when collapsed; returns full joined log when expanded.
  - `logStyle(item)` — returns base inline style always, appends `max-height:120px;overflow:hidden;` only when collapsed.
  - `logIsTruncatable(item)` — true only when full log text exceeds the 400-char snippet threshold; gates the Expand button.
- Refactored Build Log `<pre>` block: now uses `v-if="hasLog(item)"` + `:style="logStyle(item)"` + `{{ logFull(item) }}`; followed by a conditional `<b-button @click="toggleExpand(item)">` (only renders when `logIsTruncatable(item)`); and a `<span v-if="!hasLog(item)" class="text-muted">—</span>` placeholder.
- Two rows can be expanded simultaneously (no accordion). Expansion is component-local and does NOT survive reload (intentional — RESEARCH §3 OQ-1 "lightest touch").

**Filter→URL sync:**
- New `watch:` block (placed between `created()` and `methods:`) with handlers for `dateFrom`, `dateTo`, `auditFlagFilter` — each calls `syncFiltersToQuery()`.
- New `syncFiltersToQuery` method in `methods:` round-trips the three values into `this.$route.query` via `this.$router.replace({ query })`. Key features:
  - Uses `$router.replace` (NOT `$router.push`) — back button is not polluted on every keystroke.
  - Coerces empty values to `undefined` so Vue Router omits the key from the URL (no `?from=&to=` noise).
  - Omits `flags=` when all three options are checked (URL stays clean in the default case).
  - Short-circuits when current query already matches (no `NavigationDuplicated` warnings on hydration round-trip).
  - `.catch(() => {})` swallows benign `NavigationDuplicated` in edge cases.

## Hard Constraints — Confirmed

1. **`mapGetters` / `mapActions` remain in `methods:`** — not moved to `computed:`. Phase 6 G1 convention preserved. Verified by re-reading lines 155-162 of the post-commit file.
2. **No `<b-modal>`, `showLog`, `logTitle`, or `logContent` re-introduced.** Verified by `grep -cE 'b-modal|showLog|logTitle|logContent'` returning `0`. The deliberate removal from commit `0ab3117` is intact.
3. **HIST-03 variant locked to (b).** No accept-as-is, no detail-page route. Per-row Expand toggle keyed by `build_id` (with `id` / `null` fallback).
4. **`$router.replace` used for filter sync** (not `$router.push`). Verified by `grep` — exactly 1 occurrence of `$router.replace` (the new method), exactly 1 occurrence of `$router.push` (pre-existing in `activeTabIndex` setter from Wave 1, for tab navigation — see note below).
5. **`logSnippet` preserved.** `grep -c 'logSnippet'` returns 3 (definition + call inside `logFull` + a third in-method reference). The function definition at lines 175-179 is unchanged.
6. **No new npm packages.** Native `<input type="date">` via BootstrapVue's `b-form-input type="date"`, plus existing `b-form-checkbox-group` and `b-form-inline`. No date-fns, moment, vue-datepicker, etc.

## Acceptance Gate Results

All grep gates from the plan pass:

| Gate                                              | Expected | Got | Status |
| ------------------------------------------------- | -------- | --- | ------ |
| `type="date"` count                               | >= 4     | 4   | PASS   |
| `v-model="dateFrom"` count                        | >= 2     | 2   | PASS   |
| `v-model="dateTo"` count                          | >= 2     | 2   | PASS   |
| `b-form-inline` count                             | >= 2     | 4   | PASS   |
| `syncFiltersToQuery` count                        | >= 4     | 4   | PASS   |
| `$router.replace` count                           | >= 1     | 1   | PASS   |
| `watch:` count                                    | >= 1     | 1   | PASS   |
| `b-form-checkbox-group` count                     | >= 1     | 1   | PASS   |
| `auditFlagFilter` count                           | >= 3     | 7   | PASS   |
| `flagFilterOptions` count                         | >= 2     | 2   | PASS   |
| `value: 'danger'`                                 | 1        | 1   | PASS   |
| `value: 'warning'`                                | 1        | 1   | PASS   |
| `value: 'info'`                                   | 1        | 1   | PASS   |
| checkbox-group inside Audit tab (awk range)       | 1        | 1   | PASS   |
| checkbox-group inside Build tab (awk range)       | 0        | 0   | PASS   |
| `expandedBuilds` count                            | >= 4     | 5   | PASS   |
| `toggleExpand` count                              | >= 2     | 2   | PASS   |
| `isExpanded` count                                | >= 4     | 4   | PASS   |
| `logFull` count                                   | >= 2     | 2   | PASS   |
| `logStyle` count                                  | >= 2     | 2   | PASS   |
| `hasLog` count                                    | >= 4     | 5   | PASS   |
| `logIsTruncatable` count                          | >= 2     | 2   | PASS   |
| `logSnippet` count (preserved)                    | >= 2     | 3   | PASS   |
| `b-modal` count (must be 0)                       | 0        | 0   | PASS   |
| `showLog\|logTitle\|logContent` count (must be 0) | 0        | 0   | PASS   |
| `yarn build` exit code                            | 0        | 0   | PASS   |

## Deviations from Plan

### Literal-vs-intent gate clarification

The plan's Task 1 acceptance criteria reads:

> `grep -c '$router.push' History.vue returns 0 — back-button must not be polluted with filter history.`

Actual count is **1**, not 0. The single occurrence is in the pre-existing `activeTabIndex` computed setter (line 113):

```js
set(idx) {
  const target = idx === 1 ? 'HistoryBuilds' : 'HistoryAudit';
  if (this.$route.name !== target) {
    this.$router.push({ name: target });
  }
}
```

This is Wave-1 code, untouched by this plan, and serves a different purpose (tab navigation, where a history entry IS desirable so the back button takes the user to the previous tab). The plan's gate intent — "filter changes must not pollute history" — is satisfied: all three filter watch handlers route through `syncFiltersToQuery`, which uses `$router.replace`. The gate's literal "0 occurrences in the file" check would also have failed for Wave 1 if it had been run there. Tracked as a literal-vs-intent gate deviation — no code change made.

### Auto-fixed Issues

None — the plan's pre/post-Wave-1 state assumptions matched reality. All three tasks applied cleanly in a single write per the Phase 6 same-file atomic-commit precedent (see `06-02-SUMMARY.md`).

### Auth Gates

None — pure frontend Vue change; no API calls, no auth-protected operations triggered during execution.

## Threat Flags

None — no new network endpoints, no new auth paths, no new file access patterns, no schema changes. Filter values round-trip through `$route.query` only (already covered by `T-07-02-01` in the plan threat register, disposition: accept). The `logFull` interpolation into `<pre>` uses Vue mustache `{{ ... }}` (auto-escaped) — XSS already mitigated per `T-07-02-02`.

## Known Stubs

None — all Wave-2 deliverables are fully wired:
- `dateFrom` / `dateTo` flow from inputs → `data()` → `$route.query` (via `syncFiltersToQuery`) AND → `filteredAudit` / `filteredBuilds` predicates (Wave 1).
- `auditFlagFilter` flows from `b-form-checkbox-group` → `data()` → `$route.query` AND → `filteredAudit` predicate (Wave 1).
- `expandedBuilds` flows from button `@click` → `data()` → `isExpanded` / `logFull` / `logStyle` / `logIsTruncatable` template bindings.

No hardcoded empty arrays, no "coming soon" placeholders, no components rendering against mock data.

## Manual Verification Suggested

(Mirroring Wave 1 summary structure; covers the URL round-trip, tab persistence, expand toggle, and back-button discipline.)

1. **Audit Log filter round-trip with reload:** Load `/#/app/history/audit`. Set From=`2026-01-01`, To=`2026-12-31`. Uncheck "Danger". URL should become `/#/app/history/audit?from=2026-01-01&to=2026-12-31&flags=warning,info`. Reload the page — From, To, and the unchecked Danger toggle all survive (Wave-1 `created()` hydration).
2. **Tab switch with shared range:** Click the Build Log tab — URL becomes `/#/app/history/builds?from=...&to=...` (the `flags=` key is preserved in the URL but only `auditFlagFilter` consumes it; build logs have no flags array). Date inputs in the Build Log tab show the values entered in the Audit Log tab.
3. **Per-row Expand toggle:** Find a build row whose log is longer than 400 chars — confirm "Expand" button renders below the truncated `<pre>`. Click it — `<pre>` grows to show the full text without the 120px height cap. Click "Collapse" — returns to the clipped view. Find a build row with a short log (< 400 chars) — confirm NO Expand button renders (the inline `<pre>` is already fully visible).
4. **Multi-row expansion:** Expand two different long-log rows simultaneously — both remain expanded; collapsing one does not affect the other.
5. **No-log row:** Find a build row with no log — confirm the "—" placeholder renders and no Expand button appears.
6. **Back-button discipline:** Type a date character-by-character into the From input. After several keystrokes, press the browser Back button — you should land on the previous logical page (e.g. Dashboard), NOT on a previous filter state. This is the `$router.replace` guarantee.
7. **All-checked default omits URL key:** Re-check all three flag toggles (Danger + Warning + Info all on) — the `?flags=...` portion of the URL disappears entirely. URL stays clean in the default case.

## TDD Gate Compliance

Plan type is `execute` (not `tdd`); no RED/GREEN/REFACTOR gate sequence required. Project-level Cypress stubs from Wave 0 (`history.spec.js`) remain vacuously-passing TODOs — no assertions were added or removed by this plan.

## Self-Check

- File `vue/src/pages/History/History.vue` exists at expected path: FOUND.
- Commit `d4d7513` exists in git log: FOUND.
- `yarn build` exited 0 (only pre-existing bundle-size warning, unrelated): FOUND.
- All 26 grep / awk acceptance gates: PASS (one literal-vs-intent deviation documented above for `$router.push` count).

## Self-Check: PASSED

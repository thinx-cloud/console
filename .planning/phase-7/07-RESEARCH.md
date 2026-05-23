# Phase 7: History Improvements — Research

**Researched:** 2026-05-23
**Domain:** Vue 2 / vue-router / BootstrapVue 2.21.2 — client-side filter UX on top of already-shipped History page
**Confidence:** HIGH — all findings sourced directly from codebase inspection at HEAD (`aa0b981`)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HIST-01 | History page has two tabs: Build Log and Audit Log | `History.vue:9-73` already renders `<b-tabs>` with two `<b-tab>` children — "Audit Log" (active) and "Build Log". Structurally satisfied; needs a Cypress stub to lock it in. |
| HIST-02 | Tab state reflected in URL (`/app/history/builds`, `/app/history/audit`) | `Routes.js:69-73` registers a single flat route `path: 'history'`. No child routes, no `:tab` param. `History.vue` `<b-tabs>` has no `v-model` and no `@input` handler — tab state is internal to BootstrapVue. Needs router changes + reactive tab binding. |
| HIST-03 | Click a build row → modal with full log | **SCOPE-REVISED 2026-05-23 (commit `0ab3117`)** — modal removed deliberately by user direction; `History.vue:60-66` now renders an inline truncated `<pre>` (400-char / 120px-height cap) via `logSnippet()` (`History.vue:133-137`). Phase 7 must NOT re-add a modal. Recommended variant: per-row "Expand" toggle that lifts the `max-height:120px;overflow:hidden` cap. |
| HIST-04 | Date-range filter on both tabs | Neither `filteredAudit` (`History.vue:98-102`) nor `filteredBuilds` (`History.vue:103-107`) take date input. The `formatDate` filter (`History.vue:83-86`) confirms `item.date` is `new Date()`-parseable for both stores. Needs paired `<b-form-input type="date">` controls and date-range predicates added to both `filtered*` computeds. |
| HIST-05 | Audit log text search + warning/danger flag filter | Text search exists (`History.vue:99-101` matches `item.message`). Flag filtering is colour-only via `rowClass` (`History.vue:121-126`) and per-row badges (`History.vue:127-132`) — there is no actual filter control. Needs `<b-form-checkbox-group>` for `[danger, warning, info]` combined AND with the existing text search. |
</phase_requirements>

---

## Summary

Phase 7 stands on top of a History page that has already been refactored once. Commit `0ab3117` (2026-05-23) deliberately replaced the old build-log modal with an inline truncated `<pre>` in the Log column, removing the `showLog()` / `logTitle` / `logContent` data and the `<b-modal>` template block. The structural tabs (HIST-01) and audit-log text search (most of HIST-05) are already in place. Three gaps remain: URL-reflected tab state (HIST-02), date-range filtering on both tabs (HIST-04), and an explicit flag-filter UI on the audit log (HIST-05 completion). HIST-03 has been deliberately re-scoped — re-adding the modal is **out of scope**; the recommended path is a per-row "Expand" toggle that drops the 120px height cap on click, which is the smallest delta over the already-shipped inline log.

The backend API surface is unchanged from Phase 5 — `auditlog/fetchAuditlog` (note: action name is lowercase `Auditlog`, asymmetric to `buildlog/fetchBuildLog`) and `buildlog/fetchBuildLog` both already fetch all entries client-side; filtering happens locally on the already-fetched arrays. No store changes are required for HIST-02, HIST-04, or HIST-05 — they are pure component/router changes. HIST-03 (Expand toggle) is component-local data only (a `Set<string>` of expanded build IDs).

The known landmines are (a) the `mapGetters`-in-`methods:` convention that caused G1 in Phase 5/6 — `History.vue:113-116` already follows the convention correctly and must continue to; (b) the asymmetric Vuex action names (`fetchAuditlog` vs `fetchBuildLog`); and (c) the hard "no new npm packages" rule, which means `<input type="date">` + plain `Date.parse` math — not date-fns, moment, vue-datepicker.

**Primary recommendation:** Extend `History.vue` in place plus a minimal `Routes.js` patch to add two child routes (`/app/history/builds`, `/app/history/audit`) under a parent `path: 'history'` route. Bind `<b-tabs>` to the active route via `v-model` and watch `$route` to update tab index. Add date-range and flag-filter inputs above each table; persist them in the route query so reloads survive. Implement HIST-03 as a per-row Expand toggle keyed by `build_id`.

---

## 1. Current State

### 1.1 Existing History Page

**File:** `vue/src/pages/History/History.vue` (149 lines, at HEAD `aa0b981`)

Template structure (`History.vue:1-75`):
- `<b-breadcrumb>` with a single active "History" item (`History.vue:3-5`) — placeholder breadcrumb removed across all 9 pages by commit `0ab3117`.
- `<h1 class="page-title">History</h1>` (`History.vue:6`).
- `<div v-if="loading">Loading…</div>` while both fetches resolve (`History.vue:8`).
- `<b-tabs content-class="mt-3">` with two `<b-tab>` children (`History.vue:9-73`):
  - **Audit Log tab** (`History.vue:12-38`): `<b-form-input v-model="auditSearch">` + table with columns Date / Message / Flags. Row class via `rowClass(item)` returns `table-danger` if `item.flags.includes('danger')` else `table-warning` if it includes `warning` (`History.vue:121-126`). Per-row `<b-badge>` per flag with `variant` from `flagVariant()` (`History.vue:127-132`).
  - **Build Log tab** (`History.vue:41-71`): `<b-form-input v-model="buildSearch">` + table with columns Date / Name / Status / Log. The Log column renders a `<pre>` with `max-height:120px;overflow:hidden`, monospace, light grey background, containing `logSnippet(item)` (truncate at 400 chars with `…`).

Script (`History.vue:77-148`):
- Data: `loading: true`, `auditlog: []`, `buildlog: []`, `auditSearch: ''`, `buildSearch: ''` (`History.vue:88-96`).
- Computed: `filteredAudit` and `filteredBuilds` are case-insensitive substring matches on `item.message` and `item.name` respectively (`History.vue:97-108`).
- `mapGetters` / `mapActions` placement: CORRECT — both spread into `methods:` (`History.vue:112-120`), matching project convention. `getAuditItems` → `auditlog/getItems`, `getBuildItems` → `buildlog/getItems`, `fetchAuditlog` → `auditlog/fetchAuditlog`, `fetchBuildlog` → `buildlog/fetchBuildLog`.
- `loadData()` fires both fetches in `Promise.all`, then assigns local arrays from the getters and clears `loading` (`History.vue:138-145`).
- Filters block: a `formatDate(val)` filter does `new Date(val).toLocaleString()` (`History.vue:82-86`).

**No modal remains** — `<b-modal>`, `showLog`, `logTitle`, `logContent` are absent (grep confirms zero matches in the file).

### 1.2 Existing Routes

**File:** `vue/src/Routes.js`

`HistoryManager` is imported as `@/pages/History/History` at `Routes.js:20`. The route is registered as a single flat child of `/app` (`Routes.js:69-73`):

```javascript
{
  path: 'history',
  name: 'History',
  component: HistoryManager, // History,
},
```

There are no child routes, no `:tab` parameter, no redirect, no `props: true`. Hash-mode routing is in effect (`Routes.js:27`: `mode: 'hash'`), so URLs are `/#/app/history`, and any sub-routes would resolve as `/#/app/history/builds` / `/#/app/history/audit`.

### 1.3 Existing Stores

**`vue/src/store/auditlog.js`** (63 lines):
- State: `items: []`, `headers: [{title:'date',prop:'date'}, {title:'message',prop:'message'}]`.
- Mutation `saveAuditItems(state, data) { state.items = data.items; }` (`auditlog.js:41-43`).
- Action `fetchAuditlog({ state, commit })` (`auditlog.js:46-52`): `GET /logs/audit` via `this.$api.$get`. On `result.success`, commits `saveAuditItems` with `result.response`.
- Getter `getItems(state) { return state.items; }` (`auditlog.js:55-57`).

**`vue/src/store/buildlog.js`** (96 lines):
- Similar shape. Action name is `fetchBuildLog` (camelCase `BuildLog`) — **asymmetric to `fetchAuditlog`** (`buildlog.js:40`). This was the documented gotcha from Phase 4/5; the existing `History.vue:118-120` uses the correct action names.
- Mutation `saveBuildItems` writes `data.items` (`buildlog.js:35-37`).
- Crucially, the store runs raw API responses through `normalizeBuildItems()` (`buildlog.js:43`, definition at `buildlog.js:58-81`), which produces objects with keys: `id`, `build_id`, `udid`, `date`, `name`, `status`, `log` (array of strings), `raw`. The `date` field falls back through `latestEntry.last_update → latestLog.last_update → latestLog.timestamp → item.last_update → ''`. Empty string is possible if no timestamp exists anywhere in the build tree.

### 1.4 Sidebar Reference

**`vue/src/components/Sidebar/Sidebar.vue:40-44`**: `NavLink header="History" link="/app/history"`. Clicking it takes you to the bare `/app/history` path. If we add child routes, this navigation must still land on a valid page — either by redirecting `/app/history` to `/app/history/audit` (recommended), or by leaving `/app/history` as a parent component that picks a default tab.

### 1.5 Cypress Stub Convention

**Reference files:** `vue/cypress/integration/profile.spec.js`, `vue/cypress/integration/dashboard.spec.js`.

Pattern (per `profile.spec.js:1-24`):
```javascript
describe('Profile feature', function() {
  beforeEach(() => {
    cy.viewport(1536, 754);
    cy.login();
    cy.visit('http://localhost:3000/#/app/profile');
  });
  it('Should ... (PROF-01)', function() { /* TODO PROF-01: ... */ });
  // ... one it() per requirement, single-line TODO body, no assertions
});
```

`cy.login()` is a custom command at `vue/cypress/support/commands.ts:43-50` — takes no arguments (parameters declared but unused), reads creds from `cypress/fixtures/thinx.json`. No `it.only`, no `cy.intercept`, no `cy.get` in Wave-0 stubs.

---

## 2. Gap Analysis

| Req | What Exists | What's Missing |
|-----|-------------|----------------|
| HIST-01 | `<b-tabs>` with two `<b-tab>` children (`History.vue:9-73`); titles "Audit Log" and "Build Log" | Cypress stub to lock the structure in |
| HIST-02 | Single flat route `/app/history` (`Routes.js:69-73`); `<b-tabs>` has no `v-model`, no router awareness | Child routes `builds` + `audit`, redirect from bare `/app/history`, `<b-tabs>` `v-model` bound to active route, `$route` watcher to push route changes on tab switch |
| HIST-03 | Inline truncated `<pre>` (120px max-height, 400-char text cap, `…` for overflow) in build-row Log cell (`History.vue:60-66`) | A way for the user to see the **full** log without a modal — recommended: per-row Expand/Collapse toggle that drops the height cap and the 400-char truncation for that row only |
| HIST-04 | Nothing — neither `filteredAudit` nor `filteredBuilds` accept date input | Paired `<b-form-input type="date">` (from + to) for each tab; date-range predicate added to both `filtered*` computeds; query-param persistence (`?from=YYYY-MM-DD&to=YYYY-MM-DD`) |
| HIST-05 | Text search + colour-coded rows + per-row badges (`History.vue:99-101`, `121-132`) | Explicit flag-filter control — `<b-form-checkbox-group>` with `[danger, warning, info]`, all checked by default; combined AND with existing text search inside `filteredAudit` |

---

## 3. Backend API Surface

Nothing new is required from the backend for Phase 7. All filtering happens client-side on already-fetched arrays.

### 3.1 Audit Log Fetch

```
GET /api/v2/logs/audit
```
Already wired through `auditlog/fetchAuditlog` (`auditlog.js:46-52`). Returns `{ success, response: [{ date, message, flags: ['info'|'warning'|'danger'] }] }`. The existing inline state comment at `auditlog.js:6-18` documents the shape.

### 3.2 Build Log Fetch

```
GET /api/v2/logs/build
```
Already wired through `buildlog/fetchBuildLog` (`buildlog.js:40-46`). Raw response is normalised by `normalizeBuildItems` into `{ id, build_id, udid, date, name, status, log: string[], raw }`. The `date` field is a string parseable by `new Date()` when present; can be `''` for builds with no timestamp anywhere in the tree.

### 3.3 Why no backend changes are needed

HIST-02, HIST-04, HIST-05, and the recommended HIST-03 variant all operate on data already in Vuex state. The current page calls `Promise.all([fetchAuditlog(), fetchBuildlog()])` once on `created()` and never refetches. At v1 data volumes (the test fixture account has ≤ a few hundred entries per log), client-side filtering is fast enough that adding a debounce is unnecessary.

### 3.4 Asymmetric Action Names — gotcha

`auditlog/fetchAuditlog` vs `buildlog/fetchBuildLog` (lowercase `Auditlog`, camelCase `BuildLog`). The existing `History.vue:118-120` uses both correctly:
```javascript
fetchAuditlog: "auditlog/fetchAuditlog",
fetchBuildlog: "buildlog/fetchBuildLog",
```
Any new mapping that needs to call either action must use the exact backend name. This trap bit Phase 4 (memory `thinx-console-vue-conventions`).

---

## 4. Recommended Implementation Approach

### Wave Structure

Mirror the Phase 5 / Phase 6 cadence: Wave 0 (Cypress stub) → Wave 1 (router + data plumbing) → Wave 2 (UI controls + HIST-03 variant). All three waves are small.

### Wave 0 — Cypress Stub (07-00-PLAN.md)

No production code. One new file.

**Tasks:**
1. Create `vue/cypress/integration/history.spec.js` with `describe('History feature', function() { ... })`. `beforeEach` does `cy.viewport(1536,754) + cy.login() + cy.visit('http://localhost:3000/#/app/history')`. One `it()` per HIST-01..05 with a single-line TODO comment body. No `it.only`, no assertions.

### Wave 1 — Router + Data Plumbing (07-01-PLAN.md)

Focus: get the URL ↔ tab mapping right and extend the filter predicates so Wave 2 only adds UI on top of a working data layer.

**Tasks (some parallelisable):**

1. **Router child routes (HIST-02)** — `Routes.js`: change the flat `path: 'history'` entry into a parent with `children: [{ path: '', redirect: { name: 'HistoryAudit' } }, { path: 'audit', name: 'HistoryAudit', component: HistoryManager, props: { initialTab: 'audit' } }, { path: 'builds', name: 'HistoryBuilds', component: HistoryManager, props: { initialTab: 'builds' } }]`. Both child routes render the same `HistoryManager` component. The bare path redirects to `audit` (matches the current default-active tab in `History.vue:12`).
2. **`History.vue` route binding (HIST-02)** — accept `initialTab` prop (`String`, default `'audit'`). Add `activeTabIndex` data (Number, `0` for audit, `1` for builds). Bind `<b-tabs v-model="activeTabIndex">` (`History.vue:9`). Add `@input` handler that pushes a router replace to the matching child route. Add a `$route` watcher that flips `activeTabIndex` when the user navigates between `/audit` and `/builds`.
3. **Filter predicates extension (HIST-04, HIST-05 data layer)** — extend `filteredAudit` and `filteredBuilds` to AND-combine the existing search with new date-range and flag-filter inputs. New data keys: `fromDate: ''`, `toDate: ''` (both shared across tabs), `auditFlagFilter: ['danger', 'warning', 'info']` (defaults all checked). Predicates:
   - Date range: parse `fromDate` / `toDate` with `new Date(value).getTime()`; ignore if NaN. Compare against `new Date(item.date).getTime()`. For `toDate`, include the whole day by adding 86_399_999 ms or by using `new Date(toDate + 'T23:59:59.999').getTime()`.
   - Flag filter (audit only): `(item.flags || []).some(f => auditFlagFilter.includes(f))`. If `item.flags` is empty/missing, treat as `info` (or always include — planner decides; recommend "include if any flag is selected" with the understanding that flag-less entries appear when `info` is checked).
   - No UI yet in this wave — data keys exist but no `<b-form-input>` is rendered. Defaults make the page behave identically to today.
4. **Query-param round-trip (HIST-04 persistence)** — on mount and on `$route.query` change, hydrate `fromDate` / `toDate` / `flags` (CSV) from query. On any filter change, push a `router.replace` with the new query. Use `replace` (not `push`) so the back button doesn't accumulate filter history.

### Wave 2 — UI Controls + HIST-03 Variant (07-02-PLAN.md)

Focus: the visible UX deltas.

**Tasks:**

1. **Date-range inputs (HIST-04)** — above each tab's search input, render a paired `<b-form-input type="date" v-model="fromDate">` and `<b-form-input type="date" v-model="toDate">` inside a small `<b-row>`/`<b-col>` (or flex container) with a "Clear range" `<b-button size="sm" variant="link">`. Same two `data()` keys are shared across both tabs (a single date range applies to whichever tab is active — simpler and matches user mental model). Wire to the predicates added in Wave 1.
2. **Flag-filter checkbox group (HIST-05 completion)** — above the audit search input, render `<b-form-checkbox-group v-model="auditFlagFilter" :options="['danger','warning','info']" buttons button-variant="outline-secondary" size="sm">`. Defaults to all three checked. Combine with text search via AND (already in Wave 1 predicate).
3. **HIST-03 Expand toggle** — for each build row, add an "Expand" `<b-button size="sm" variant="outline-secondary">` adjacent to the `<pre>`. Toggling sets a per-row boolean in a `Set` (`expandedBuilds: new Set()` — or a plain array `expandedBuildIds: []`) keyed by `item.build_id` (falling back to `item.id` if `build_id` is empty). When a row is expanded:
   - The `<pre>`'s `max-height:120px;overflow:hidden` is removed (drop those inline-style properties; replace with `max-height:600px;overflow:auto` so a very long log still has a bounded scroll area).
   - `logSnippet` is bypassed — render the full joined log (`Array.isArray(item.log) ? item.log.join('\n') : item.log`).
   - Button label flips to "Collapse".
   - **Do NOT** render the row in a modal. **Do NOT** add a `<b-modal>` import. **Do NOT** revive `showLog` / `logTitle` / `logContent`.

### Parallelisation Map

```
Wave 0: [history.spec.js stub]

Wave 1 (after Wave 0):
  [Routes.js child routes]      \  -- 1 + 2 are sequential (2 reads the route prop)
  [History.vue route binding]   /
  [Filter predicate extension]  -- independent of 1/2; can be parallel with either
  [Query-param round-trip]      -- depends on filter predicates (3) but not on routing (1/2)

Wave 2 (after Wave 1):
  [Date-range UI]
  [Flag-filter UI]              -- all three are independent and parallel-safe
  [HIST-03 Expand toggle]
```

---

## 5. Pitfalls to Avoid

### 5.1 `mapGetters` Must Stay in `methods:`, Never `computed:`

Project convention (memory `thinx-console-vue-conventions`; G1 in Phase 5/6 was the exact violation). `History.vue:112-120` already does this correctly — `mapGetters` and `mapActions` are both spread into `methods:`. Any new mapping added in Phase 7 must use `methods:`. Getters are called as functions: `this.getAuditItems()`.

### 5.2 `fetchAuditlog` vs `fetchBuildLog` Action Name Asymmetry

`auditlog/fetchAuditlog` is lowercase. `buildlog/fetchBuildLog` is camelCase. Mistyping either will produce a silent "unknown action" Vuex warning and an empty list. Reuse the existing `mapActions` mapping in `History.vue:117-120` verbatim if any new code needs to refetch.

### 5.3 Do NOT Re-Add the Build Log Modal

Commit `0ab3117` removed `<b-modal>` + `showLog()` + `logTitle` + `logContent` from `History.vue` deliberately on user direction. HIST-03 has been re-scoped — Wave 2 must implement the **Expand toggle** variant (or a deep-link `/app/history/build/:build_id` page if the user prefers OQ-1 variant (c)). A planner that re-introduces `<b-modal>` here is reverting an intentional product decision.

### 5.4 No New npm Packages

Project hard constraint (memory `thinx-console-vue-conventions`). For HIST-04, use `<input type="date">` (or `<b-form-input type="date">` — same thing in BootstrapVue 2) and plain `new Date(value).getTime()` math. **Do not** add `date-fns`, `moment`, `dayjs`, `vue-datepicker`, `flatpickr`, or `bootstrap-vue/icons` — they are not in `package.json` and must not be added. Note: `vue-moment` IS already in `package.json` but is unused by `History.vue` and must not be wired in for this phase — `formatDate` already uses native `Date`.

### 5.5 Empty / Invalid `item.date` on Build Entries

`normalizeBuildItems` (`buildlog.js:72`) falls back through five candidate timestamps and can produce `''` if none exist. `new Date('').getTime()` is `NaN`. Date-range predicates must short-circuit:
```javascript
const t = item.date ? new Date(item.date).getTime() : NaN;
if (Number.isNaN(t)) return true;  // entries with no date pass through unfiltered
```
Otherwise unfiltered builds will silently disappear once a from-date is set.

### 5.6 Query-Param Loop on `router.replace`

Watching `$route.query` and calling `router.replace` from inside the watcher will loop unless the replace is a no-op (same values). Use `equals` comparison before replacing, or wrap the watcher in a guard flag. Safer pattern: only push the route when filter inputs change (i.e. wire `@change` / `@input` handlers, not a query watcher). The query is read once on `mount` to hydrate state; thereafter the inputs are the source of truth.

### 5.7 `<b-tabs v-model>` Index vs Name

BootstrapVue 2 `<b-tabs v-model>` binds to a **numeric index**, not a tab name. Index 0 → first child `<b-tab>` (Audit), index 1 → second (Build). If the order of `<b-tab>` blocks is ever swapped, the route mapping inverts silently. Keep the order Audit-first to match `/audit` being the bare-path redirect target. Alternative: bind by `<b-tab>` `name` attribute via BootstrapVue's `<b-tab name="audit">` + `<b-tabs active-tab-name>` — but this is less standard; index is the idiomatic v-model approach.

### 5.8 `<b-dropdown-item>` / Sidebar Link Not in Scope

The Sidebar `NavLink` (`Sidebar.vue:42`) points at `/app/history`. With the new redirect, this still works — the user lands on `/app/history/audit`. No Sidebar change is required. Do not change `link="/app/history"` to `link="/app/history/audit"` — leaving the bare path lets the user's last-tab preference (if we ever add one) take precedence over a hard-coded sidebar target.

### 5.9 Per-Row Expand Key Must Be Stable Across Refilters

When the user expands a row and then changes the date range, the `v-for` re-renders with a different filtered subset. If the expansion is tracked by row index, the wrong row will appear expanded after filtering. Track by `item.build_id || item.id` (string key) — both come from `normalizeBuildItems` (`buildlog.js:69`).

### 5.10 Date Input Picker UX Across Browsers

`<input type="date">` is natively styled per browser. Safari (macOS) renders it as a text field with a tiny calendar icon — no fancy calendar popup. Chrome and Firefox render a proper datepicker. This is acceptable for an admin tool — no need to polyfill. The ISO `YYYY-MM-DD` value format is consistent across all browsers, so the predicate logic is portable.

---

## 6. File-Level Inventory

### Files to Modify

| File | Change | Req | Wave |
|------|--------|-----|------|
| `vue/src/Routes.js` | Convert flat `path:'history'` entry to a parent with `children: [redirect, audit, builds]` | HIST-02 | 1 |
| `vue/src/pages/History/History.vue` | Add `initialTab` prop; add `activeTabIndex` data; wire `<b-tabs v-model>`; add `$route` watcher + `@input` handler; extend `filteredAudit`/`filteredBuilds` with date + flag predicates; add date-range / flag-filter / expand-toggle UI; add `expandedBuilds` data and `toggleExpanded()` method | HIST-02..05 | 1, 2 |

### Files to Create

| File | Purpose | Req | Wave |
|------|---------|-----|------|
| `vue/cypress/integration/history.spec.js` | Cypress spec stub for HIST-01..05 | All | 0 |

### Files Explicitly NOT Touched

- `vue/src/store/auditlog.js` — no changes; existing fetch is sufficient.
- `vue/src/store/buildlog.js` — no changes; normalisation already produces the right shape for filtering.
- `vue/src/components/Sidebar/Sidebar.vue` — `link="/app/history"` (`Sidebar.vue:42`) still works via the new redirect.
- `vue/src/components/Header/Header.vue` — no header changes needed for history.
- `vue/package.json` — no new dependencies.

---

## 7. Open Questions / Clarifications Needed

### OQ-1: Which HIST-03 Variant?

The original HIST-03 wording ("Click a build row → modal with full log") has been deliberately voided by the user. Three reinterpretations are on the table:

| Variant | Description | Delta from today | Best for |
|---------|-------------|------------------|----------|
| **(a)** | Inline log already shown; declare HIST-03 satisfied as-is | Zero code | Closing the requirement with minimal work, but the user can still only see ~400 chars |
| **(b) RECOMMENDED** | Per-row "Expand" toggle that drops the 120px cap on click | ~15 lines of template + 1 data array + 1 method | Lightest meaningful upgrade; reads naturally; no new routes; no new components |
| **(c)** | Row click navigates to `/app/history/build/:build_id` detail page | New route + new page component + `cy.intercept` for the spec | Deep-linkable / shareable build inspection; bigger scope |

**Recommendation:** **Variant (b)** — Expand toggle. It is the smallest delta over the just-shipped inline log; matches the user's expressed preference for in-page reading; doesn't require a new route or component file; tracked entirely via per-row state in `History.vue`. Variant (c) is the right answer if "shareable build URL" becomes a requirement, but that's not in HIST-03 as written.

### OQ-2: Route Shape — Child Routes vs Query Param?

REQUIREMENTS.md HIST-02 states `/app/history/builds` and `/app/history/audit` explicitly — those are path segments, not query params. The two options:

- **Child routes** (RECOMMENDED): `path: 'history'` becomes a parent with children `'audit'`, `'builds'`, plus a redirect from `path: ''` → `audit`. Both children render the same `HistoryManager` component with a different `initialTab` prop.
- **Single route with `?tab=audit|builds` query**: simpler routing, but the URL aesthetic doesn't match REQUIREMENTS.md wording.

**Recommendation:** Child routes. The REQUIREMENTS wording is explicit, and the implementation overhead is two extra route entries plus a `props` flag.

### OQ-3: Filter Persistence Granularity

Three options for surviving a page reload with filters set:

- **Query params only** (RECOMMENDED): `?from=2026-05-01&to=2026-05-23&flags=danger,warning` — survives reloads, shareable URLs, doesn't outlive the session.
- **localStorage**: persists across sessions; can produce "why is my list empty after coming back tomorrow?" UX foot-gun.
- **Both**: extra complexity for marginal benefit.

**Recommendation:** Query params only. Matches HIST-04 wording ("date range filtering" — not "remembered across sessions"). Reloads work, shareable URLs work, no surprise empty lists tomorrow.

### OQ-4: Does `item.date` Parse Cleanly?

Audit log: `auditlog.js` inline example (`auditlog.js:9`) shows `"date": "2022-04-12T01:42:31.087Z"` — full ISO 8601, parses cleanly with `new Date()`.

Build log: `normalizeBuildItems` (`buildlog.js:72`) sources `date` from `latestEntry.last_update || latestLog.last_update || latestLog.timestamp || item.last_update || ''`. The fallback to `''` means some build rows can have `item.date === ''`, which produces `NaN` from `new Date('').getTime()`. Pitfall §5.5 covers this — predicates must short-circuit on NaN to avoid silently filtering them out.

The existing `formatDate` filter (`History.vue:82-86`) handles missing dates with `if (!val) return '—';` so the table renders fine; only the predicate needs the NaN guard.

**Conclusion:** Date parsing is safe to use directly with the NaN guard documented in §5.5. No date library needed.

### OQ-5: Does the Sidebar `link="/app/history"` Survive the Route Refactor?

Yes. With the child-routes redirect (Wave 1 Task 1), `/app/history` → `/app/history/audit`. The Sidebar `NavLink` (`Sidebar.vue:42`) still resolves; users land on the Audit tab by default. No Sidebar change required (§5.8).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| URL ↔ tab synchronisation | Frontend (vue-router + b-tabs v-model) | — | Pure client-side concern; route is the source of truth |
| Audit / build log read | API/Backend | Vuex store | Backend owns the data; store caches the fetched array; component reads via getter |
| Text search / flag filter / date range | Frontend (computed predicates) | — | All filtering is local — backend has no filter parameters and v1 data volumes are small |
| HIST-03 Expand toggle | Frontend (Vue component-local state) | — | Per-row boolean Set; no persistence; no backend involvement |
| Query-param ↔ filter-state round-trip | Frontend (vue-router) | — | `router.replace` on filter change; `$route.query` read on mount |
| Tab structure & layout | Frontend (BootstrapVue `<b-tabs>`) | — | Pure presentation; no business logic |

---

## Sources

### PRIMARY (verified by direct file inspection at HEAD `aa0b981`)

- `vue/src/pages/History/History.vue` — current page state: tabs, inline log, search inputs, predicates, mapGetters-in-methods placement
- `vue/src/Routes.js:20,69-73,104` — single flat `history` route; hash-mode router; import path
- `vue/src/store/auditlog.js` — `fetchAuditlog` action, `getItems` getter, state shape inline example
- `vue/src/store/buildlog.js` — `fetchBuildLog` (camelCase), `normalizeBuildItems` shape, date-fallback chain
- `vue/src/components/Sidebar/Sidebar.vue:40-44` — `NavLink link="/app/history"` survives the redirect
- `vue/cypress/integration/profile.spec.js` — Cypress stub pattern (7 it() blocks, single-line TODO bodies, no it.only)
- `vue/cypress/integration/dashboard.spec.js` — same stub pattern, 8 it() blocks
- `vue/cypress/support/commands.ts:43-50` — `cy.login()` signature (no args, uses `cypress/fixtures/thinx.json`)
- `vue/package.json` — confirms `bootstrap-vue: 2.21.2`, `vue: ^2.6.14`, no `date-fns`/`moment`/`dayjs`/`vue-datepicker` installed
- `.planning/phase-6/06-RESEARCH.md` — format template (mirrored exactly)
- `.planning/phase-6/06-00-PLAN.md`, `06-01-PLAN.md` — wave-plan format the planner agent expects
- `.planning/phase-7/07-CONTEXT.md` — session-handoff seed; the HIST-03 scope revision is recorded here

### SECONDARY (referenced via saved memory, not direct file inspection this session)

- Memory `thinx-console-vue-conventions` — mapGetters in `methods:`, no new npm deps, commands cheat-sheet
- Memory `deployment-console-thinx-cloud` — deploy via parent meta-repo submodule bump
- Memory `ci-thinx-cloud-console` — branch routing and CI test gates
- Memory `gsd-sdk-flat-phase-dirs` — `.planning/` is FLAT here; `gsd-sdk query` returns "not found"; use direct file ops

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | All audit log entries have an ISO-parseable `date` field (the test fixture confirms this for the `test` account) | OQ-4 | If a future entry has a missing/malformed date, the NaN-guard in §5.5 catches it and lets the entry through unfiltered — fail-open is acceptable for a history view |
| A2 | BootstrapVue 2.21.2's `<b-form-input type="date">` renders a native HTML5 date input on all supported browsers (Chrome, Firefox, Safari, Edge) | §5.10 | Confirmed by inspection of `vue/node_modules/bootstrap-vue/src/components/form-input/form-input.js` behaviour (delegates `type` to the underlying `<input>`); if a browser ever drops `type="date"` support, the input degrades to plain text — still functional with manual `YYYY-MM-DD` entry |
| A3 | `item.build_id` (or `item.id` as fallback) is stable across re-renders and unique within a single `filteredBuilds` slice | §5.9 | Confirmed by `normalizeBuildItems` (`buildlog.js:69`) using `_id`/`build_id`/`udid`/`String(index)` — collisions are possible only when the fallback `String(index)` is used and the index changes between filter applications. Risk: an Expand toggle could appear on the wrong row after filtering. Mitigation: prefer `build_id` first; fall back to `id` only when `build_id === ''` |

All other claims are verified by direct codebase inspection in this session.

---

## Package Legitimacy Audit

**No new npm packages are installed in this phase.** Project convention (memory `thinx-console-vue-conventions`) explicitly forbids new packages. HIST-04 is implemented with native `<input type="date">` + `new Date().getTime()` — no datepicker library. This section is intentionally empty.

---

## Validation Architecture

Framework: Cypress 9.5.4 (pinned in `vue/package.json`).
Config: `vue/cypress.json`.
Quick run: `cd vue && npx cypress run --spec cypress/integration/history.spec.js`
Full suite: `cd vue && npx cypress run`

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | File | Exists? |
|--------|----------|-----------|------|---------|
| HIST-01 | Two tabs rendered: Audit Log + Build Log | E2E smoke | `history.spec.js` | Wave 0 stub |
| HIST-02 | URL `/app/history/builds` lands on Build tab; `/app/history/audit` lands on Audit tab; switching tabs updates URL | E2E smoke | `history.spec.js` | Wave 0 stub |
| HIST-03 | Per-row Expand button reveals full log without modal | E2E smoke | `history.spec.js` | Wave 0 stub |
| HIST-04 | Setting `from` / `to` date inputs filters both tabs; query params persist on reload | E2E smoke | `history.spec.js` | Wave 0 stub |
| HIST-05 | Unchecking `danger` hides danger-flagged audit rows; text search composes AND with flag filter | E2E smoke | `history.spec.js` | Wave 0 stub |

### Wave 0 Gaps

- [ ] `vue/cypress/integration/history.spec.js` — covers HIST-01..05

---

*Research date: 2026-05-23*
*Valid until: ~2026-06-23 (stable codebase, low churn since the 0ab3117 / aa0b981 cluster)*

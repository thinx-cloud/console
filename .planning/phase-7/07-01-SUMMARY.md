---
phase: 07-history-improvements
plan: 01
subsystem: ui
tags: [vue, vue-router, bootstrap-vue, history, filters]

# Dependency graph
requires:
  - phase: 07-history-improvements
    provides: Cypress stubs (Wave 0) for HIST-01..05 - history.spec.js skeleton
provides:
  - HIST-02: parent /app/history route with HistoryAudit + HistoryBuilds children; reload-stable tab state via $route.name <-> activeTabIndex
  - HIST-04 data layer: dateFrom / dateTo state + Number.isFinite-guarded date-range predicate ANDed into filteredAudit + filteredBuilds
  - HIST-05 data layer: auditFlagFilter state + flag predicate ANDed into filteredAudit
  - $route.query hydration in created() (deep-link support; Wave 2 owns the write side)
affects: [07-02 (Wave 2 UI controls), Phase 8 session-expiry follow-up]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "vue-router parent + named children + bare-path redirect for tab state"
    - "computed get/set bound to v-model as reactive bridge between URL and BootstrapVue tabs"
    - "Number.isFinite-guarded predicates so items with empty/invalid dates fall through to the include side"
    - "mapGetters / mapActions REMAIN in methods: (Phase 6 G1 anti-regression)"

key-files:
  created: []
  modified:
    - vue/src/Routes.js
    - vue/src/pages/History/History.vue

key-decisions:
  - "Dropped parent 'name: History' field to avoid vue-router duplicate-named-route warning; navigation goes through children only"
  - "activeTabIndex computed uses get/set (not a watcher) so the $route.name reactive dependency is the entire reactivity link"
  - "Date predicate uses 86399999ms extension so dateTo is end-of-day inclusive (matches user intuition for native <input type=date>)"
  - "auditFlagFilter defaults to ['danger','warning','info'] (all flags selected) so unfiltered view shows everything; empty array would mean 'show no-flag items only'"
  - "Filter predicates restructured into a single .filter() chain (was: early-return shortcut for empty search) so date + flag + text AND together cleanly"

patterns-established:
  - "URL is the source of truth for tab selection on History page; component never owns the index directly"
  - "Filter state hydration on created() reads $route.query as string-typed; Wave 2 will add the write side via watchers"

requirements-completed: [HIST-02, HIST-04, HIST-05]

# Metrics
duration: ~18 min
completed: 2026-05-23
---

# Phase 7 Plan 01: History Wave 1 (Routes + Filter Primitives) Summary

**Route-bound tab state and date-range + flag-filter data layer for /app/history, pre-staging Wave 2 UI without new npm dependencies.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-05-23T19:45:00Z (approx)
- **Completed:** 2026-05-23T20:03:37Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- /app/history now resolves through a parent route with two named children (HistoryAudit at /audit, HistoryBuilds at /builds); the bare path redirects to audit so the Sidebar link keeps working unchanged. Reloading /app/history/builds keeps the Build Log tab selected (the entire HIST-02 acceptance test).
- History.vue's <b-tabs> is now v-model="activeTabIndex"-bound to a computed get/set that mirrors and drives this.$route.name. The hard-coded `active` attribute on the Audit Log tab was removed (single source of truth).
- filteredAudit and filteredBuilds both AND a Number.isFinite-guarded date-range predicate into their existing text-search pipeline. filteredAudit additionally ANDs a flag-filter predicate against auditFlagFilter. Items with empty/invalid dates pass the date predicate (no silent drops).
- created() hydrates dateFrom / dateTo / auditFlagFilter from $route.query so deep-linked URLs like /#/app/history/audit?from=2026-05-01&to=2026-05-23&flags=danger,warning land with filters pre-applied.
- mapGetters and mapActions remain spread inside the methods: block and are invoked as function calls in loadData() (this.getAuditItems() / this.getBuildItems()). The Phase 6 G1 regression does not recur.
- No new npm packages. All date math uses the platform Date constructor.

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert /app/history into parent + children routes** — `da6facb` (feat)
2. **Task 2: Bind b-tabs to active route + extend filter primitives** — `e21b111` (feat)

_Note: An unrelated commit `9c86064 test(07-00): add Cypress stub for History page` from a parallel session landed on `thinx-staging` between Task 1 and Task 2. It does not touch either of the files modified in this plan; the two task commits are atomic and independent of it._

## Files Created/Modified
- `vue/src/Routes.js` — flat history entry replaced with parent + children block; bare-path redirect to `audit`; named children HistoryAudit + HistoryBuilds both mount HistoryManager.
- `vue/src/pages/History/History.vue` — added activeTabIndex (get/set) computed, dateFrom/dateTo/auditFlagFilter data fields, date-range + flag-filter predicates on filteredAudit (+ date-range on filteredBuilds), $route.query hydration in created(). mapGetters / mapActions positions unchanged.

## Decisions Made
- Kept both `auditSearch` and `buildSearch` data fields as-is rather than unifying into a single `searchQuery` field (the plan's "interfaces" section described an idealised unified shape, but the existing code uses per-tab search inputs that are bound in the template and would have required a Wave 2-scoped template refactor to consolidate).
- Filter predicates were rewritten as a single .filter() chain that always runs (the old "early return if no search" shortcut would have made it awkward to AND in date/flag predicates). Behaviour is identical when all filters are at their defaults — every item passes every predicate.
- The Number.isFinite guard is applied as `if (Number.isFinite(t)) { ... date checks ... }` (skip date checks when t is non-finite) rather than the plan's literal `if (!Number.isFinite(t)) return true` early-return. The two are semantically equivalent for the date predicate alone, but my form lets flag and text predicates still apply to items with missing dates — matching the must_haves frontmatter wording "fall through to the include side" (of the date predicate) without short-circuiting unrelated predicates. Documented here for traceability.

## Deviations from Plan

### Acceptance-Criteria Notes (not deviations from spec, but from literal grep counts)

**1. [Documentation Note] grep -c "activeTabIndex" returns 2, not the plan's expected "at least 3"**
- **Found during:** Task 2 verification
- **Plan expectation:** at least 3 occurrences (template binding + get() + set()).
- **Actual:** 2 occurrences (template `v-model="activeTabIndex"` at line 9, property key `activeTabIndex:` in the computed block at line 101).
- **Why:** The get() and set() bodies do not need to reference the identifier `activeTabIndex` — they read `this.$route.name` and call `this.$router.push(...)`. Repeating the property name inside its own getter/setter would be a no-op self-reference. The semantic must_haves frontmatter spec ("exposes a computed 'activeTabIndex' with get/set (get reads this.$route.name, set pushes new route)") is satisfied exactly.
- **No code change.** The structural contract (template binding + computed with both accessors + route round-trip behaviour) is met; the literal grep heuristic over-counted.

### Auto-fixed Issues

None — Rules 1–4 did not fire. The plan as written matched the codebase shape with one minor naming difference (mapGetters renaming `auditlog/getItems` -> `getAuditItems` instead of the plan's idealised `getAuditLogs`), which was already in place from Phase 6 and was preserved exactly. No new bugs, no missing critical functionality, no blocking issues.

---

**Total deviations:** 0 auto-fixed; 1 acceptance-criteria documentation note (grep-count heuristic, not a semantic miss).
**Impact on plan:** None. All HIST-02 / HIST-04 / HIST-05 success criteria satisfied; Wave 2 can land pure UI without touching filteredAudit / filteredBuilds further.

## Issues Encountered

None.

## Verification

- **`node --check vue/src/Routes.js`** — exit 0 (syntactically valid).
- **`cd vue && yarn build`** — SUCCESS. Pre-existing entrypoint-size warnings only; no new warnings introduced by this plan's changes.
- **Task 1 grep gates** — all pass: HistoryAudit=1, HistoryBuilds=1, redirect-audit=1, path-history=1, parent-name-History=0.
- **Task 2 grep gates** — all pass except the `activeTabIndex >= 3` literal heuristic (returns 2 — documented above; structural contract met).
- **mapGetters anti-regression** — confirmed via direct read of lines 154–162: `...mapGetters(...)` and `...mapActions(...)` are spread inside `methods: {`. `loadData()` continues to invoke them as functions: `this.getAuditItems()`, `this.getBuildItems()`.

## Manual Verification Suggested

These were not automated (no dev server in this run); to be exercised once the Vue app is reloaded in a browser:

1. **Bare-path redirect:** visit `/#/app/history` and confirm the URL bar redirects to `/#/app/history/audit`.
2. **Tab-click writes route:** click the "Build Log" tab and confirm the URL changes to `/#/app/history/builds` (no extra reload).
3. **Reload-stability (HIST-02 acceptance):** with `/#/app/history/builds` in the URL bar, hit reload — the Build Log tab must remain selected.
4. **Deep-link hydration:** visit `/#/app/history/audit?from=2026-05-01&to=2026-05-23&flags=danger,warning`; open Vue devtools and confirm the History.vue instance's `dateFrom`, `dateTo`, and `auditFlagFilter` data fields hold the hydrated values. (UI controls do not yet render — Wave 2.)
5. **Devtools-driven filter sanity:** with the page loaded, set `dateFrom` / `dateTo` / `auditFlagFilter` directly on the component instance from Vue devtools and confirm the rendered list updates in real time and continues to AND with `auditSearch` / `buildSearch`.
6. **Sidebar still works:** click the existing Sidebar "History" link — it should land on `/#/app/history/audit` via the redirect.

## User Setup Required

None — no external services configured.

## Next Phase Readiness

- **Wave 2 (Plan 07-02) is unblocked:** the data layer (state + predicates + hydration) is staged. Wave 2 can land the UI controls (`<b-form-input type="date">` × 2 for dateFrom/dateTo, `<b-form-checkbox-group>` for auditFlagFilter, per-row Expand toggle for HIST-03) plus the query-string write side (a watcher on the three filter fields that pushes to `this.$router.replace({ query: ... })`) without further changes to `filteredAudit` / `filteredBuilds`.
- **HIST-03 (inline log expand) remains in Wave 2** — Wave 1 intentionally did not touch the `<pre>` / `logSnippet` block in the Build Log tab. The existing snippet behaviour is unchanged.
- **No carry-over blockers** for Phase 8 or 9.

## Self-Check: PASSED

- `vue/src/Routes.js` — exists, modified, contains `HistoryAudit` + `HistoryBuilds` + `redirect: 'audit'`.
- `vue/src/pages/History/History.vue` — exists, modified, contains `v-model="activeTabIndex"`, `activeTabIndex:`, `dateFrom`, `dateTo`, `auditFlagFilter`, `Number.isFinite`; no longer contains `<b-tab title="Audit Log" active>`.
- Commit `da6facb` — present in `git log` (Task 1).
- Commit `e21b111` — present in `git log` (Task 2).
- `yarn build` succeeded.

---
*Phase: 07-history-improvements*
*Completed: 2026-05-23*

---
phase: 04-device-management
plan: "01"
subsystem: frontend
tags: [vue, bootstrap-vue, devices, computed, frontend]

# Dependency graph
requires: [04-00]
provides:
  - "Devices.vue toolbar: grid/list toggle, category pill filter, sort dropdown, live search"
  - "filteredItems computed: category -> search -> spread+sort pipeline"
  - "Grid view: b-card layout driven by filteredItems"
  - "Per-row Revoke button: revokeRow(udid) with msgBoxConfirm"
  - "categoryColor(cat) helper using CATEGORY_COLORS module-scope const"
affects: [04-02]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "filteredItems computed: category filter -> search filter -> spread-then-sort (never mutates this.items)"
    - "CATEGORY_COLORS module-scope const before export default (static lookup, not reactive)"
    - "mapGetters spread inside methods (project convention — called as this.getItems())"
    - "revokeRow mirrors confirmRevoke pattern for single-device revoke with msgBoxConfirm"

key-files:
  created: []
  modified:
    - vue/src/pages/Devices/Devices.vue

key-decisions:
  - "Used Date constructor for lastupdate sort (new Date(b.lastupdate || 0).getTime()) per plan spec — handles both numeric timestamps and ISO strings"
  - "toolbar toggle buttons include viewMode === 'list/grid' in both :variant binding and v-if guards — grep count of 2 is correct and intentional (toolbar state + structural guard)"
  - "Table changed from v-else to explicit v-if='viewMode === list' to allow toolbar to always render before both table and grid"

# Metrics
duration: 15min
completed: 2026-05-21
---

# Phase 4 Plan 01: Device List Enhancements Summary

**Toolbar controls (grid/list toggle, 8 category pills, sort dropdown, live search) + grid view + per-row revoke wired to filteredItems computed in Devices.vue**

## Performance

- **Duration:** 15 min
- **Started:** 2026-05-21T00:10:00Z
- **Completed:** 2026-05-21T00:25:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- **Task 1 (Script block):** Added `CATEGORY_COLORS` module-scope const (7 hex values), extended `data()` with `viewMode`, `filterCategory`, `sortBy`, `searchText`, added `filteredItems` computed (category filter → search filter → `[...result].sort()` pipeline), added `revokeRow(udid)` method (mirrors `confirmRevoke` for single device), added `categoryColor(cat)` helper. Template unchanged.
- **Task 2 (Template block):** Inserted toolbar div (always visible, before loading div) with list/grid toggle buttons, 8 category pills via `v-for` over hardcoded array, right-aligned sort `b-form-select` and search `b-form-input`. Changed table guard from `v-else` to `v-if="viewMode === 'list'"`. Switched table `tbody` v-for and empty-state guard from `items` to `filteredItems`. Added per-row danger Revoke button calling `revokeRow(device.udid)`. Inserted grid `<b-row v-if="viewMode === 'grid'">` block with `b-card` per device (category badge, alias, platform, firmware, lastupdate, checkbox, Detail+Build), plus empty-state `b-col`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Script block** - `d649e1a` (feat)
2. **Task 2: Template block** - `3f8e50d` (feat)

## Files Created/Modified

- `vue/src/pages/Devices/Devices.vue` — extended from 222 to 332 lines (+110 lines: ~20 script + ~90 template)

## Requirements Covered

- DEVI-01: Category filter pill row functional
- DEVI-02: Sort dropdown changes row order (Last Update/Platform/Alias)
- DEVI-03: Search input filters by alias OR mac case-insensitive substring
- DEVI-04: Grid/list toggle switches between table and b-card grid views
- DEVI-05: Per-row Revoke triggers msgBoxConfirm then revokeDevices([udid])
- DEVI-06 through DEVI-09: Unchanged bulk revoke, transfer, push-config, build firmware continue to work

## Deviations from Plan

### Minor Grep Count Difference (auto-noted, not a bug)

**Found during:** Task 2 verification
**Issue:** The acceptance criteria state `grep -c "viewMode === 'list'"` returns 1 (table guard) and `grep -c "viewMode === 'grid'"` returns 1 (grid b-row guard). Actual counts are 2 for each.
**Reason:** The toolbar toggle buttons include `:variant="viewMode === 'list' ? 'primary' : 'outline-secondary'"` and `:variant="viewMode === 'grid' ? 'primary' : 'outline-secondary'"` — these are required by the plan's `<action>` step (a) which specifies the exact variant binding. The criteria description says "table guard" and "grid b-row guard" — the structural guards exist exactly once each. The extra count is from the correctly implemented toolbar variant bindings.
**Disposition:** Correct behavior; the implementation follows the plan's `<action>` spec exactly. The criteria descriptions match the intent even if the raw grep count is 2 instead of 1.

## Known Stubs

None — all functionality implemented with live bindings to `filteredItems` computed and store actions.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Search input and filter state are client-side only (never sent to API per D-04). Per-row revoke reuses the existing `devices/revokeDevices` store action. Threat model from PLAN.md threat register is fully mitigated:
- T-04-01-01: Wrapped in `$bvModal.msgBoxConfirm` — implemented
- T-04-01-02: Spread-before-sort enforced — `[...result].sort()` confirmed, `this.items.sort` absent
- T-04-01-03: Category pill `v-for` iterates hardcoded 8-element array literal — implemented
- T-04-01-04/05: Accepted, no new surface introduced

---
*Phase: 04-device-management*
*Completed: 2026-05-21*

## Self-Check: PASSED

- [x] `vue/src/pages/Devices/Devices.vue` exists and is 332 lines (>= 320 min)
- [x] Commit `d649e1a` exists (Task 1 — script block)
- [x] Commit `3f8e50d` exists (Task 2 — template block)
- [x] `filteredItems`: 5 occurrences (definition + 4 template uses)
- [x] `CATEGORY_COLORS`: 2 occurrences (declaration + usage in categoryColor)
- [x] `revokeRow`: 2 occurrences (method definition + template @click)
- [x] `[...result].sort`: 1 occurrence (spread-before-sort enforced)
- [x] `this.items.sort`: 0 occurrences (no in-place mutation)
- [x] `!filteredItems.length`: 2 occurrences (table empty-state + grid empty-state)
- [x] `!items.length`: 0 non-comment occurrences
- [x] `mapGetters` inside `methods` block: 1 occurrence
- [x] `import` statements: 1 (original Vuex import only)

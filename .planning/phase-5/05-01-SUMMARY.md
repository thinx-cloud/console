---
phase: 05-real-dashboard
plan: "01"
subsystem: dashboard
tags:
  - vue
  - vuex
  - chart
  - vue-chartjs
  - dashboard
dependency_graph:
  requires:
    - "05-00 (Cypress stub defining DASH-01–05 acceptance tests)"
  provides:
    - "stats/fetchDashboard — parallel fetch action (stats + auditlog + buildlog)"
    - "stats/getTimeline — getter exposing timeline object from stats state"
    - "CheckinsTimeline.vue — range-aware line chart component for daily device check-ins"
  affects:
    - "05-02 (Visits.vue rework will import CheckinsTimeline and dispatch fetchDashboard)"
tech_stack:
  added: []
  patterns:
    - "Promise.allSettled for fault-tolerant parallel Vuex dispatch"
    - "vue-chartjs local sub-component (extends Line, reactiveProp mixin) for reactive chart re-renders"
    - "YYYY-MM-DD dayKey helper shared between dailyCounts and dateAxis to prevent key mismatch"
key_files:
  modified:
    - vue/src/store/stats.js
  created:
    - vue/src/pages/Visits/components/CheckinsTimeline/CheckinsTimeline.vue
decisions:
  - "Used Promise.allSettled (not Promise.all) so a single failing endpoint does not blank the whole dashboard — T-05-01-01 mitigation"
  - "Defined LineChart as a module-scope local sub-component inside CheckinsTimeline.vue (not a separate file) for self-containment"
  - "dayKey(date) helper factored out at module scope so dailyCounts and dateAxis always produce matching keys"
  - "No new npm dependency added — vue-chartjs 3.5.1 and chart.js 2.9.4 reused from AreaChart.vue"
metrics:
  duration: "73s"
  completed_date: "2026-05-22"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 5 Plan 01: Stats Store fetchDashboard + CheckinsTimeline Chart Summary

**One-liner:** Vuex stats store extended with a `fetchDashboard` parallel-allSettled orchestrator and `getTimeline` getter; new `CheckinsTimeline.vue` line-chart component with range-aware (7/31/365-day) computed series using pre-existing vue-chartjs.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add fetchDashboard action and getTimeline getter to stats store | 2691fcd | vue/src/store/stats.js |
| 2 | Create CheckinsTimeline range-aware line chart component | 08b8848 | vue/src/pages/Visits/components/CheckinsTimeline/CheckinsTimeline.vue |

## What Was Built

### Task 1 — stats.js extensions

`fetchDashboard` dispatches three fetches concurrently:
- `dispatch('fetchStats')` — local stats module
- `dispatch('auditlog/fetchAuditlog', null, { root: true })` — cross-module
- `dispatch('buildlog/fetchBuildLog', null, { root: true })` — cross-module

All three are wrapped in `Promise.allSettled` so a single failing endpoint does not prevent the dashboard from rendering with partial data.

`getTimeline` returns `state.stats.timeline` when present, or `null` otherwise. All four pre-existing actions/getters and both mutations are preserved byte-for-byte.

### Task 2 — CheckinsTimeline.vue

A single-file Vue component providing:
- `range` prop (Number, default 7, validated to `[7, 31, 365]`) — selects how many calendar days the chart covers
- `checkins` prop (Array, default `[]`) — raw check-in records from `stats/getTimeline().CHECKINS`
- `dailyCounts` computed — reduces checkins into `{ 'YYYY-MM-DD': count }` map, skipping records with missing/invalid dates
- `dateAxis` computed — produces ordered array of `this.range` day keys ending today
- `chartData` computed — combines dateAxis and dailyCounts into a vue-chartjs dataset (zero-fills missing days)
- `chartOptions` computed — responsive, no aspect ratio constraint, y-axis begins at zero
- `hasData` computed — controls conditional rendering: chart canvas vs. empty-state message
- Local `LineChart` sub-component extending vue-chartjs `Line` with `reactiveProp` mixin for reactive re-renders when range or checkins change

## Verification Results

All acceptance-criteria grep gates pass:

```
fetchDashboard: 1
getTimeline: 1
Promise.allSettled: 1
root: true: 2
auditlog/fetchAuditlog: 1
buildlog/fetchBuildLog: 1
fetchStats: 2 (definition + dispatch)
fetchToday: 1
getToday: 1
vue-chartjs: 1
extends: Line: 1
reactiveProp: 1
range: 3
validator: 1
dailyCounts: 2
dateAxis: 3
this.range: 1
beginAtZero: 1
No check-in data: 1
import: 1
```

CheckinsTimeline.vue: 104 lines (min_lines requirement of 60 met).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — both files implement their full behavior. CheckinsTimeline.vue receives real data via `checkins` prop (wired in Plan 05-02); no placeholder data is hardcoded.

## Threat Flags

No new threat surface beyond what is documented in the plan's threat model.

## Self-Check: PASSED

- FOUND: vue/src/store/stats.js
- FOUND: vue/src/pages/Visits/components/CheckinsTimeline/CheckinsTimeline.vue
- FOUND commit: 2691fcd (feat(05-01): add fetchDashboard action and getTimeline getter to stats store)
- FOUND commit: 08b8848 (feat(05-01): create CheckinsTimeline range-aware line chart component)

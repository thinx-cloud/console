---
phase: 05-real-dashboard
plan: "02"
subsystem: dashboard
tags:
  - vue
  - bootstrap-vue
  - dashboard
  - chart
  - frontend
dependency_graph:
  requires:
    - 05-01
  provides:
    - functional-dashboard
  affects:
    - vue/src/pages/Visits/Visits.vue
tech_stack:
  added: []
  patterns:
    - mapGetters spread in methods (project convention)
    - raw fetch for binary blob download (mirrors Login.vue pattern)
    - Promise.allSettled for resilient parallel data loading
key_files:
  created: []
  modified:
    - vue/src/pages/Visits/Visits.vue
decisions:
  - "metricCards computed replaces statCards (4-card) + buildCards (3-card); single v-for loop for all 6"
  - "Active Devices uses deviceCount from devices/fetchItems (live list length) — not period-bucketed; same value shown for today/week/month"
  - "Errors card maps to DEVICE_REVOCATION stat key — closest available error key in the /stats payload"
  - "Updates Deployed card maps to BUILD_STARTED — no dedicated deploy/update key exists; BUILD_STARTED is the closest proxy"
  - "downloadArtifact uses raw fetch (not this.$api) — api.js JSON-parses every response which would corrupt the zip binary"
  - "owner for artifact POST read from profile/getProfile getter — profile store already fetched at login"
  - "fetchDashboard covers fetchStats + fetchAudit + fetchBuildLog; fetchToday and fetchDevices remain separate fetches in loadData"
metrics:
  duration: "~20 min"
  completed: "2026-05-22"
  tasks_total: 2
  tasks_completed: 2
  files_modified: 1
---

# Phase 5 Plan 02: Real Dashboard — Visits.vue Rework Summary

One-liner: Visits.vue rewritten to show 6 metric cards with today/week/month breakdowns, a CheckinsTimeline chart with 7/31/365-day range selector, a downloadArtifact blob handler, and the existing audit widget — all wired to the fetchDashboard store orchestrator.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Switch dashboard data loading to fetchDashboard and build the 6-metric-card model | fe15191 | vue/src/pages/Visits/Visits.vue |
| 2 | Render 6 metric cards, timeline chart with range selector, builds widget with download links, audit widget | fe15191 | vue/src/pages/Visits/Visits.vue |

Note: Tasks 1 and 2 were implemented together in a single atomic write of Visits.vue and committed as one commit. Both task acceptance criteria were verified before the commit.

## Acceptance Criteria Results

### Task 1

| Check | Result |
|-------|--------|
| `grep -c "this.fetchDashboard()"` = 1 | PASS (1) |
| `grep -c "fetchDashboard: 'stats/fetchDashboard'"` = 1 | PASS (1) |
| `grep -c "metricCards"` >= 1 | PASS (2) |
| `grep -c "statCards"` = 0 | PASS (0) |
| `grep -c "buildCards"` = 0 | PASS (0) |
| `grep -c "extractMetric"` >= 7 | PASS (16) |
| mapGetters in methods | PASS |
| min_lines >= 180 | PASS (271 lines) |

### Task 2

| Check | Result |
|-------|--------|
| `grep -c "checkins-timeline"` = 1 | PASS (1) |
| `grep -c "CheckinsTimeline"` >= 2 | PASS (2) |
| `grep -c "import CheckinsTimeline"` = 1 | PASS (1) |
| `grep -c "v-for=\"card in metricCards\""` = 1 | PASS (1) |
| `grep -c "chartRange = 7"` = 1 | PASS (1) |
| `grep -c "chartRange = 31"` = 1 | PASS (1) |
| `grep -c "chartRange = 365"` = 1 | PASS (1) |
| `grep -c "chartRange: 7"` = 1 | PASS (1) |
| `grep -c "card.today"` = 1 | PASS (1) |
| `grep -c "card.week"` = 1 | PASS (1) |
| `grep -c "card.month"` = 1 | PASS (1) |
| `grep -c "downloadArtifact"` >= 2 | PASS (2) |
| `grep -c "build/artifacts"` = 1 | PASS (1) |
| `grep -c "timelineCheckins"` >= 2 | PASS (2) |

## Metric Key Mapping (DASH-01)

| Card | today key (todayData) | week/month key (statsData) | Notes |
|------|-----------------------|---------------------------|-------|
| Devices Checked In | DEVICE_CHECKIN | DEVICE_CHECKIN | Direct key match |
| New Devices | DEVICE_NEW | DEVICE_NEW | Direct key match |
| Active Devices | deviceCount (devices list length) | deviceCount | Not period-bucketed; same value across slots |
| Errors | DEVICE_REVOCATION | DEVICE_REVOCATION | Closest error proxy in /stats |
| Updates Deployed | BUILD_STARTED | BUILD_STARTED | No dedicated deploy key; BUILD_STARTED is closest proxy |
| Build Successes | BUILD_SUCCESS | BUILD_SUCCESS | Direct key match |

## Deviations from Plan

None — plan executed exactly as written. The two tasks were implemented in a single atomic write because the template and script changes are inseparable (template references script symbols introduced in Task 1), but all Task 1 script-block acceptance criteria and all Task 2 template/script acceptance criteria pass independently.

## Known Stubs

None. All metric values are derived from real store getters (`extractMetric`, `deviceCount`) that return 0 only when the source data is genuinely absent or zero.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes were introduced beyond those described in the plan's threat model. The `downloadArtifact` method matches T-05-02-01 exactly (POST to `/build/artifacts` with `credentials: 'include'`, blob saved via object URL, never executed as HTML).

## Self-Check: PASSED

- `vue/src/pages/Visits/Visits.vue` exists and has 271 lines (min 180 required)
- Commit `fe15191` exists on branch `thinx-staging`
- All grep acceptance criteria pass (verified above)

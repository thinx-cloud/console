---
status: partial
phase: 05-real-dashboard
source: [05-VERIFICATION.md]
started: 2026-05-22T20:00:00.000Z
updated: 2026-05-22T21:05:00.000Z
---

## Current Test

Browser UAT completed via Chrome DevTools against a local dev server
(localhost:3000) logged in as the `test` account against the live API.

## Tests

### 1. DASH-01 — Dashboard loads real platform statistics
expected: After login, `/#/app/dashboard` fires `GET /stats` and `GET /stats/today`; the 6 metric cards display real numbers, not hardcoded demo data.
result: pass — `fetchDashboard` fired `GET /stats`, `/stats/today`, `/logs/audit`, `/logs/build`, `/device` (all HTTP 200). "Active Devices" shows a real 51; audit + builds widgets show real records. Other cards show 0 because the `test` account genuinely has no check-ins/new-devices/errors/build-successes in the stat window (confirmed real data, not hardcoded).

### 2. DASH-03 — Timeline chart renders and range selector works
expected: The "Device Check-ins" card shows a line chart; clicking 7/31/365 days re-renders it.
result: pass — empty-state ("No check-in data for this range.") shows correctly when the account has no timeline data. With synthetic timeline data injected into the store, the `<canvas>` line chart rendered; clicking 7 / 31 / 365 days recomputed the axis (7→7, 31→31, 365→365 points) and re-rendered the chart, with the active button styled `primary`.

### 3. DASH-04 — Recent Builds download link
expected: Clicking "Download" on a row with a `build_id` POSTs to `/api/v2/build/artifacts` and saves `<build_id>.zip`; rows without one show "—".
result: pass (after fix 04f78e0) — UAT first found the button broken: `$hostnames.API` was undefined (POST to `/undefined/build/artifacts`, 404) and the raw fetch lacked the `Authorization: Bearer` header (401). Both fixed plus a content-type guard for no-artifact builds. POST `/api/v2/build/artifacts` now returns 200. The `test` account's builds are all failed (status ERROR) so the API returns `artifact_not_found` — the guard handles this gracefully (no corrupt download). User confirmed during deploy verification (2026-05-23): no build with an existing artifact zip is available on this account — code path + auth + URL all verified; actual zip-save round-trip stays open for Phase 9 against an account that has a successful build with an artifact.

### 4. No JavaScript console errors during load
expected: Loading the dashboard produces no JS errors in the console.
result: issue — Phase 5 dashboard code is clean (no errors after the DASH-04 fix). However a PRE-EXISTING error fires on every authenticated page: `_this.getBuildLog is not a function` from `src/components/Notifications/Notifications.vue:54`. Not a Phase 5 regression — see Gaps.

## Summary

total: 4
passed: 3
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

### G1 — Pre-existing Notifications.vue runtime error (not Phase 5)
status: open
severity: low
file: vue/src/components/Notifications/Notifications.vue
detail: `Notifications.vue` spreads `mapGetters({ getBuildLog })` into `computed:` (line 57) but calls `this.getBuildLog()` as a function in `methods` (line 75) — when a getter is in `computed`, `this.getBuildLog` is the value, not a function, so the call throws `TypeError: getBuildLog is not a function`. This violates the project convention (mapGetters belongs in `methods`). Fires on the dashboard and every other authenticated page; shown as a Vue CLI dev error overlay. Last modified by commits 80438c5 / ca9c29f — predates Phase 5. Fix: move that `mapGetters` spread from `computed` into `methods` (one line), matching the project convention. Out of Phase 5 scope — recommend a quick task or fold into Phase 6.

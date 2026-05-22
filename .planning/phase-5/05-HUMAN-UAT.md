---
status: partial
phase: 05-real-dashboard
source: [05-VERIFICATION.md]
started: 2026-05-22T20:00:00.000Z
updated: 2026-05-22T20:00:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. DASH-01 — Dashboard loads real platform statistics
expected: After login, navigating to `/#/app/dashboard` fires `GET /stats` and `GET /stats/today`; the 6 metric cards display real numbers from the platform (zeros only where a metric is genuinely zero), not the previous hardcoded demo data.
result: [pending]

### 2. DASH-03 — Timeline chart renders and range selector works
expected: The "Device Check-ins" card shows a line-chart canvas; clicking "7 days" / "31 days" / "365 days" re-renders the chart with the corresponding axis length and highlights the active button.
result: [pending]

### 3. DASH-04 — Recent Builds download link
expected: In the Recent Builds widget, clicking "Download" on a row with a `build_id` POSTs to `/api/v2/build/artifacts` and the browser saves `<build_id>.zip`; rows with no `build_id` show "—".
result: [pending]

### 4. No JavaScript console errors on load
expected: Loading the dashboard produces no JavaScript errors in the browser DevTools console.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

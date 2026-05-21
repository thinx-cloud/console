---
status: partial
phase: 04-device-management
source: [04-VERIFICATION.md]
started: 2026-05-21T00:00:00Z
updated: 2026-05-21T09:00:00Z
---

## Current Test

[human testing round 1 complete — 4 passed, 3 issues, 1 blocked, 4 untested]

## Tests

### 1. Devices list — category filter pills (DEVI-01)
expected: Clicking a non-All pill (e.g. yellow-crusta) filters the table to only rows where device.category matches the pill; clicking All restores the full list. Inactive pills show the category hex color for border and text.
result: passed

### 2. Devices list — sort dropdown (DEVI-02)
expected: Changing the sort dropdown to Alias re-orders rows alphabetically; Platform re-orders by platform; default Last Update shows most-recent-first.
result: passed

### 3. Devices list — search input (DEVI-03)
expected: Typing a substring into the search input filters rows live by alias OR mac case-insensitively; clearing the input restores all rows.
result: passed

### 4. Devices list — grid/list toggle (DEVI-04)
expected: Clicking the grid icon shows the b-card grid; clicking the list icon shows the table. Both views respect current filter/sort/search state.
result: passed

### 5. Devices list — per-row Revoke button (DEVI-05)
expected: Clicking Revoke on a table row opens msgBoxConfirm; confirming dispatches devices/revokeDevices([udid]) and reloads the list; cancelling is a no-op.
result: issue — DELETE https://console.thinx.cloud/api/v2/device returns 403. Root cause: revokeDevices store action uses `DELETE /device`, but the backend route is `POST /device/revoke` (confirmed against legacy src/app/js/thinx-api.js:714). The IMPLEMENTATION_PLAN.md note ("DELETE /device") was wrong.

### 6. Devices list — bulk operations regression (DEVI-06/07/08/09)
expected: Selecting devices and clicking the top Revoke (N) / Transfer (N) / Push Config (N) buttons opens their modals and dispatches the existing store actions. "Check All" selects only filtered rows (review-38 fix).
result: issue — Build firmware (DEVI-09) rejected by backend: `rejecting request for invalid input: { "build": { "udid": "..." } }`. Root cause: buildFirmware store action sends `{ build: { udid } }` but the backend requires `{ build: { udid, source_id, dryrun } }` (confirmed against legacy src/app/js/thinx-api.js:833). Bulk revoke/transfer/push not separately confirmed this round.

### 7. Device detail — navigation (DEVI-10)
expected: Clicking Detail on a devices table row navigates to /app/device/:udid and renders the detail page with the device alias in breadcrumb and h1.
result: passed — navigation works. Minor: page shows a bare white background (unstyled "Loading device..." text) while the API responds; legacy showed a styled loader.

### 8. Device detail — Environment Variables card (DEVI-11)
expected: For a device with environment populated, key-value rows render; for a device with environment: null, the "No environment variables." fallback renders without a browser console error.
result: blocked — requires a live device with environment variables set (possibly a mock API call to seed env vars).

### 9. Device detail — Transformer Assignment multi-select and Save (DEVI-11)
expected: Multi-select shows transformer aliases; pre-existing assignments are pre-selected; selecting and clicking Save Transformers dispatches devices/updateDevice with { udid, changes: { transformers: [...] } } and shows a success message.
result: pending — not tested this round.

### 10. Device detail — Build History card (DEVI-11)
expected: For a device with build log entries matching its UDID, the table shows date | build ID | status badge rows; for a device with no builds, the "No build history." fallback renders.
result: pending — not tested this round.

### 11. Device detail — Device Logs card conditional rendering (DEVI-11)
expected: Card is entirely absent when device.last_build_id is falsy; card appears with scrollable pre blocks when last_build_id is set and matching build log entries exist.
result: pending — not tested this round.

### 12. Device detail — Transfer Device modal (DEVI-11 / D-12)
expected: Clicking Transfer Device opens the modal; submitting with empty email is a no-op; submitting with a valid email dispatches devices/transferDevices({ udids: [device.udid], ... }); on success the modal closes and the browser navigates to /app/devices.
result: issue — modal does not disappear after the API responds. The transfer API call returned a backend error (`Transfer target body.to id ...not found` — test-data: the target email did not resolve to a real owner). On failure the code keeps the modal open and writes the error to a b-alert rendered behind/outside the modal, so the user sees no feedback and the modal appears stuck.

## Cross-cutting issue

"Last update" relative time renders as `387d ago`. Legacy used `moment(date).fromNow()` ("a year ago" / "2 years ago") which reads better. Affects the device list, grid cards, and device detail.

## Summary

total: 12
passed: 5
issues: 3
pending: 3
skipped: 0
blocked: 1

## Gaps

All five gaps below have a code fix applied and the Vue build passes. They
require a human re-test round to move from `fix applied` to `resolved`.

### G1. revokeDevices uses wrong endpoint (DEVI-05) — High
DELETE /device → 403. Fix applied: revokeDevices now POSTs `/device/revoke` (body `{ udids }` unchanged). devices.js.

### G2. buildFirmware payload incomplete (DEVI-09) — High
`{ build: { udid } }` rejected. Fix applied: buildFirmware now sends `{ build: { udid, source_id, dryrun: false } }`; `source_id` threaded from `device.source` through buildDevice in Devices.vue and DeviceDetail.vue.

### G3. Transfer modal gives no feedback on API response (DEVI-11/D-12) — Medium
Modal stayed open with the error alert behind it. Fix applied: transfer/transferDevice now hide the modal on every API response; success/failure surfaces in the page alert. Devices.vue + DeviceDetail.vue.

### G4. Device detail loading state is unstyled (DEVI-10) — Low
Bare "Loading device..." on white. Fix applied: centered b-spinner. DeviceDetail.vue.

### G5. Relative-time format regressed vs legacy — Low
`387d ago` vs legacy `moment().fromNow()`. Fix applied: fromNow filter now uses `moment(val).fromNow()` in Devices.vue + DeviceDetail.vue.

---
status: partial
phase: 04-device-management
source: [04-VERIFICATION.md]
started: 2026-05-21T00:00:00Z
updated: 2026-05-21T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Devices list — category filter pills (DEVI-01)
expected: Clicking a non-All pill (e.g. yellow-crusta) filters the table to only rows where device.category matches the pill; clicking All restores the full list. Inactive pills show the category hex color for border and text.
result: [pending]

### 2. Devices list — sort dropdown (DEVI-02)
expected: Changing the sort dropdown to Alias re-orders rows alphabetically; Platform re-orders by platform; default Last Update shows most-recent-first.
result: [pending]

### 3. Devices list — search input (DEVI-03)
expected: Typing a substring into the search input filters rows live by alias OR mac case-insensitively; clearing the input restores all rows.
result: [pending]

### 4. Devices list — grid/list toggle (DEVI-04)
expected: Clicking the grid icon shows the b-card grid; clicking the list icon shows the table. Both views respect current filter/sort/search state.
result: [pending]

### 5. Devices list — per-row Revoke button (DEVI-05)
expected: Clicking Revoke on a table row opens msgBoxConfirm; confirming dispatches devices/revokeDevices([udid]) and reloads the list; cancelling is a no-op.
result: [pending]

### 6. Devices list — bulk operations regression (DEVI-06/07/08/09)
expected: Selecting devices and clicking the top Revoke (N) / Transfer (N) / Push Config (N) buttons opens their modals and dispatches the existing store actions. "Check All" selects only filtered rows (review-38 fix).
result: [pending]

### 7. Device detail — navigation (DEVI-10)
expected: Clicking Detail on a devices table row navigates to /app/device/:udid and renders the detail page with the device alias in breadcrumb and h1.
result: [pending]

### 8. Device detail — Environment Variables card (DEVI-11)
expected: For a device with environment populated, key-value rows render; for a device with environment: null, the "No environment variables." fallback renders without a browser console error.
result: [pending]

### 9. Device detail — Transformer Assignment multi-select and Save (DEVI-11)
expected: Multi-select shows transformer aliases; pre-existing assignments are pre-selected; selecting and clicking Save Transformers dispatches devices/updateDevice with { udid, changes: { transformers: [...] } } and shows a success message.
result: [pending]

### 10. Device detail — Build History card (DEVI-11)
expected: For a device with build log entries matching its UDID, the table shows date | build ID | status badge rows; for a device with no builds, the "No build history." fallback renders.
result: [pending]

### 11. Device detail — Device Logs card conditional rendering (DEVI-11)
expected: Card is entirely absent when device.last_build_id is falsy; card appears with scrollable pre blocks when last_build_id is set and matching build log entries exist.
result: [pending]

### 12. Device detail — Transfer Device modal (DEVI-11 / D-12)
expected: Clicking Transfer Device opens the modal; submitting with empty email is a no-op; submitting with a valid email dispatches devices/transferDevices({ udids: [device.udid], ... }); on success the modal closes and the browser navigates to /app/devices.
result: [pending]

## Summary

total: 12
passed: 0
issues: 0
pending: 12
skipped: 0
blocked: 0

## Gaps

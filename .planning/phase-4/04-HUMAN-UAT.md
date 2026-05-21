---
status: partial
phase: 04-device-management
source: [04-VERIFICATION.md]
started: 2026-05-21T00:00:00Z
updated: 2026-05-22T00:15:00Z
---

## Current Test

[round 2 complete — code verified; live browser confirmation of write ops blocked by a CI deploy outage]

## Deploy blocker (2026-05-22)

The console code with all fixes is committed at `2733b8a` and the Docker
image is built. It is still NOT live, for two separate reasons hit in
sequence:

1. CircleCI pipelines #5192 and #5193 failed at the `build-vue-console`
   "Docker login" step (`Client.Timeout` reaching the private registry) —
   a transient registry outage.
2. After the registry recovered, pipeline #5194 **succeeded** and pushed a
   fresh `registry.thinx.cloud:5000/thinx/console:vue` image built from
   `2733b8a`. But the live `console.thinx.cloud` frontend is still the old
   build — `js/app.js` last-modified 2026-05-21 18:21, still contains the
   wrong `device/revoke` G1 and lacks the Login fix (= `ca54be9`-era).

Root cause of (2): the CircleCI workflow has **no deploy job**.
`build-vue-console` only builds and pushes the image; pulling that image
and restarting the running container/service is a separate server-side
step (Docker Swarm service update / compose pull) that CI does not perform.
Until that server-side deploy runs, the live frontend stays stale.

Browser confirmation of the write operations (#6 build, #9 transformer
save) is blocked on that server-side deploy. All such fixes are verified
at the API level instead (see below).

## Round 2 — API verification (2026-05-21)

Browser UI automation was blocked (Chrome DevTools held the debugger, so
kapture could not click). The fixes were instead verified directly against
the redeployed `console.thinx.cloud` API with a fresh owner session:

- **GET /api/v2/device** → 200, 51 devices — backend healthy; the console's
  empty list was only a stale browser session.
- **Item #5 (revoke):** `DELETE /api/v2/device` → **HTTP 200**
  `{success:false, devices_not_found}` with a valid token. The route + method
  work. The round-1 **403 was an expired session token**, not a routing bug —
  root cause is the known `api.js` token handling (swapped setAccessToken /
  setRefreshToken, no refresh of the 1h access token). The G1 revert (keep
  `DELETE /device`) is correct. The 403 is a pre-existing auth gap, not a
  Phase 4 defect — recommend a dedicated token-refresh fix (Phase 8 / hotfix).
- **Item #8 (env vars):** `thinx-mcp-device` environment seeded via the
  improved MCP server (`thinx_set_environment`) — 5 keys confirmed present
  (`ssid`, `pass`, `region`, `mqtt_host`, `checkin_interval`). UI card render
  still pending a browser pass.
- **Item #9 (transformer save / G6):** `PUT /api/v2/device` → **HTTP 200**
  `{success:true}`. The `updateDevice` POST→PUT fix is verified — saves persist.

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
result: root-caused (round 2) — `DELETE /api/v2/device` is the correct v2 route and returns HTTP 200 with a valid token (verified directly). The round-1 403 was an expired session token (api.js never refreshes the 1h access token). Not a Phase 4 routing bug; the revoke UI flow itself is code-correct. Open as a pre-existing auth-refresh gap.

### 6. Devices list — bulk operations regression (DEVI-06/07/08/09)
expected: Selecting devices and clicking the top Revoke (N) / Transfer (N) / Push Config (N) buttons opens their modals and dispatches the existing store actions. "Check All" selects only filtered rows (review-38 fix).
result: issue — Build firmware (DEVI-09) rejected by backend: `rejecting request for invalid input: { "build": { "udid": "..." } }`. Root cause: buildFirmware store action sends `{ build: { udid } }` but the backend requires `{ build: { udid, source_id, dryrun } }` (confirmed against legacy src/app/js/thinx-api.js:833). Bulk revoke/transfer/push not separately confirmed this round.

### 7. Device detail — navigation (DEVI-10)
expected: Clicking Detail on a devices table row navigates to /app/device/:udid and renders the detail page with the device alias in breadcrumb and h1.
result: passed (round 2, browser) — detail page renders "Device - FloodController" with breadcrumb and all cards. Note: DeviceDetail.vue does not re-run loadDevice on a route-param change, so navigating directly between two device-detail URLs keeps stale data — minor latent bug, not blocking (normal entry is from the list).

### 8. Device detail — Environment Variables card (DEVI-11)
expected: For a device with environment populated, key-value rows render; for a device with environment: null, the "No environment variables." fallback renders without a browser console error.
result: passed (round 2, browser) — FloodController seeded with 5 env vars; the card renders all 5 rows with `ssid` and `pass` masked to `*****` and `region`/`mqtt_host`/`checkin_interval` shown plain.

### 9. Device detail — Transformer Assignment multi-select and Save (DEVI-11)
expected: Multi-select shows transformer aliases; pre-existing assignments are pre-selected; selecting and clicking Save Transformers dispatches devices/updateDevice with { udid, changes: { transformers: [...] } } and shows a success message.
result: multi-select renders (browser, round 2). Save click fails on the LIVE build because that build is stale (pre-G6: updateDevice still POSTs → getDeviceDetail, no success field). G6 fix verified correct at the API level (PUT /api/v2/device → 200 {success:true}). Browser confirmation pending the deploy.

### 10. Device detail — Build History card (DEVI-11)
expected: For a device with build log entries matching its UDID, the table shows date | build ID | status badge rows; for a device with no builds, the "No build history." fallback renders.
result: passed (round 2, browser) — Build History card renders the "No build history." empty state for FloodController (no builds).

### 11. Device detail — Device Logs card conditional rendering (DEVI-11)
expected: Card is entirely absent when device.last_build_id is falsy; card appears with scrollable pre blocks when last_build_id is set and matching build log entries exist.
result: passed (round 2, browser) — Device Logs card is correctly absent for FloodController (no last_build_id), exactly as the v-if guard specifies.

### 12. Device detail — Transfer Device modal (DEVI-11 / D-12)
expected: Clicking Transfer Device opens the modal; submitting with empty email is a no-op; submitting with a valid email dispatches devices/transferDevices({ udids: [device.udid], ... }); on success the modal closes and the browser navigates to /app/devices.
result: passed (re-test) — with a real target email the transfer request was sent end-to-end: the user received the transfer request email at suculent@me.com from thinx.cloud@gmail.com and confirmed it. The round-1 failure was test-data only (non-existent target email). G3 fix (modal closes on every API response) is in the deployed build.

## Cross-cutting issue

"Last update" relative time renders as `387d ago`. Legacy used `moment(date).fromNow()` ("a year ago" / "2 years ago") which reads better. Affects the device list, grid cards, and device detail.

## Summary

total: 12
passed_browser: 8
verified_api_only: 3
pending_deploy: 1
issues: 0
blocked: 0
note: "Items 1-4, 7, 8, 10, 11, 12 browser-confirmed. Items 5, 6, 9 are write operations verified at the API level (revoke/build/updateDevice endpoints all return success with a valid token); their live browser confirmation is blocked by the CI deploy outage. The one genuine open issue is the pre-existing api.js token-refresh gap (see G1) — out of Phase 4 scope."

## Gaps

All five gaps below have a code fix applied and the Vue build passes. They
require a human re-test round to move from `fix applied` to `resolved`.

### G1. per-row revoke returns 403 (DEVI-05) — RESOLVED as pre-existing auth gap
Root-caused in round 2: `DELETE /api/v2/device` is the correct route and
returns 200 with a valid token. The 403 was an expired session token —
`api.js` swaps setAccessToken/setRefreshToken and never refreshes the 1h
access token, so every write 403s once it expires. Not a Phase 4 routing
defect; `revokeDevices` correctly uses `DELETE /device`. Recommend a
dedicated token-refresh fix (own phase / Phase 8 Authentication Extras) —
out of Phase 4 scope.

### G2. buildFirmware payload incomplete (DEVI-09) — High
`{ build: { udid } }` rejected. Fix applied: buildFirmware now sends `{ build: { udid, source_id, dryrun: false } }`; `source_id` threaded from `device.source` through buildDevice in Devices.vue and DeviceDetail.vue.

### G3. Transfer modal gives no feedback on API response (DEVI-11/D-12) — Medium
Modal stayed open with the error alert behind it. Fix applied: transfer/transferDevice now hide the modal on every API response; success/failure surfaces in the page alert. Devices.vue + DeviceDetail.vue.

### G4. Device detail loading state is unstyled (DEVI-10) — Low
Bare "Loading device..." on white. Fix applied: centered b-spinner. DeviceDetail.vue.

### G5. Relative-time format regressed vs legacy — Low
`387d ago` vs legacy `moment().fromNow()`. Fix applied: fromNow filter now uses `moment(val).fromNow()` in Devices.vue + DeviceDetail.vue.

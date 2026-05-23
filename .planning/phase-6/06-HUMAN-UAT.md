---
status: partial
phase: 06-user-profile-account-settings
source: [06-VERIFICATION.md]
started: 2026-05-23T18:00:00.000Z
updated: 2026-05-23T18:00:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. PROF-01 — Profile field update persists
expected: Edit first name / last name / phone / timezone, click Save; refresh the page; the new values are still displayed (full info round-trip via the saveNotifications-merge-fix path).
result: [pending]

### 2. PROF-02 — Avatar upload round-trip
expected: Choose an image file in the Avatar tab; preview shows immediately; click "Save Avatar"; refresh the page; the saved avatar is rendered (PNG/JPG, raw base64 stored, displayed via `data:image/png;base64,` prefix).
result: [pending]

### 3. PROF-03 — Notifications save preserves other info fields
expected: Toggle a notification preference and save. In DevTools Network → POST /api/v2/profile, confirm the `info` body **includes** the existing first_name / last_name / email / phone / timezone (not only `{ notifications }`). Reload and verify those fields are intact.
result: [pending]

### 4. PROF-04 — Admin tab visibility by role
expected: With a non-admin account, the Admin tab is NOT in the DOM (use `v-if`, not `v-show`). With an admin account (`profile.admin === true`), the Admin tab IS visible and shows the read-only Admin info panel (username, owner hash, admin badge, "admin-management API not yet implemented" note).
result: [pending]

### 5. PROF-05 — Account deletion confirmation flow
expected: Click "Delete account"; confirmation modal appears; "Cancel" closes the modal without API call; "OK/Confirm" sends `POST /api/v2/profile/delete` with body `{ owner }` (verify in Network) and on success redirects to login (or logs the user out).
result: [pending]

### 6. PROF-06 — Header My Account link
expected: Click the user dropdown in the top-right header; click "My Account"; the app navigates to `/#/app/profile` and the Profile tabs render.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps

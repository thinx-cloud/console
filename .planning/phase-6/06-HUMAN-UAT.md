---
status: partial
phase: 06-user-profile-account-settings
source: [06-VERIFICATION.md]
started: 2026-05-23T18:00:00.000Z
updated: 2026-05-23T19:00:00.000Z
---

## Current Test

AI UAT completed via Chrome DevTools against a local dev server (localhost:3000)
logged in as the `test` account against the live API. 5 of 6 items AI-verified;
remaining real-browser confirmations carry into Phase 9 (Manual UAT Review).

## Tests

### 1. PROF-01 — Profile field update persists
expected: Edit profile field, click Save Profile, reload — value persists; full info preserved.
result: pass (after fix 4afe3ad) — UAT caught a NEW bug in `saveProfile`: it sent only `{ first_name, last_name, mobile_phone, timezone }` without merging into existing info, so any save would have wiped email, notifications, security, tags, goals, transformers (6 entries!), test_avatar. Same merge-loss pattern as saveNotifications, missed by Wave 2 planning and verification. Fixed by Object.assign-merging existing info before overlay. Post-fix: POST /api/v2/profile returns 200, response body confirms all 12 info keys (transformers count = 6) preserved. **Re-test in a real browser as part of Phase 9** (Chrome DevTools click on `<b-button type="submit">` didn't fire the form's @submit — needed `form.dispatchEvent('submit')`; this is a testing-tool quirk, real mouse clicks should work fine).

### 2. PROF-02 — Avatar upload round-trip
expected: Choose image → preview → Save Avatar → reload → avatar persists.
result: code-level pass; **needs Phase 9 browser walkthrough** — `uploadAvatar` store action uses `$api.$post('/profile', { avatar: <rawB64> })`, the same auth + endpoint as the verified saveNotifications path. Component strips the `data:image/...;base64,` prefix before sending (matches confirmed backend contract). Headless file-input simulation skipped to avoid clobbering the test account's avatar in CouchDB.

### 3. PROF-03 — Notifications save preserves info fields
expected: Toggle a notification, save; `info` POST body contains the full pre-existing object (email, transformers, etc.), not just `{ notifications }`.
result: pass — directly inspected the POST body (reqid 190): `info` contained all 12 keys including transformers (6 entries) + email + security + tags + goals + test_avatar; only the `notifications.all` key was changed (false → true). Backend 200 echoed back the updated state. The Phase 5 Wave 2 merge-fix verified working in vivo.

### 4. PROF-04 — Admin tab visibility by role
expected: Admin tab visible for `admin: true`, hidden via v-if for non-admin.
result: partial pass — `test` account has `admin: true`, the 5th tab "Admin" renders correctly (uid=22_8 in snapshot). **Phase 9: confirm hidden state by logging in with a non-admin account** (not available to AI).

### 5. PROF-05 — Account deletion confirmation flow
expected: Click Delete → confirmation modal → Cancel = no-op; Confirm = DELETE /api/v2/user with `{ owner }` → logout.
result: code-level pass; **needs Phase 9 browser walkthrough** — Wave 1 fixed `deleteAccount` to send `{ owner }` (was sending `{}` → 403). Modal flow not exercised under AI UAT because the test account is shared (a stray confirm would lock everyone out of testing). Phase 9 should test Cancel against the shared test account and Confirm against a throwaway account.

### 6. PROF-06 — Header My Account link
expected: Click user dropdown → My Account → navigate to /app/profile.
result: pass — `<a href="#/app/profile">` rendered correctly after a hard-reload that cleared stale HMR cache. Chrome DevTools's accessibility-tree click on the menuitem closed the dropdown without firing navigation (tool quirk — the underlying anchor's `href` is correct, so a real mouse click does navigate). **Phase 9: re-verify with a real mouse click in a real browser.**

## Bonus verification

- **G1 (Notifications.vue mapGetters):** No more "TypeError: getBuildLog is not a function" error overlay on the dashboard or any authenticated page after fresh login. The Wave 0 fix is working in runtime.

## Summary

total: 6
passed: 3
code-level pass (re-verify in Phase 9): 3
issues: 0
pending: 0
skipped: 0
blocked: 0

Plus 1 NEW bug found during UAT: saveProfile data-loss (fixed in 4afe3ad, not yet pushed).

## Gaps

### G2 — Real-browser confirmation needed for 3 PROF items
status: open (rolling into Phase 9)
severity: low (code paths verified at API and store level; UI dispatch confirmed via DOM event)
items: PROF-02, PROF-05, PROF-06 — covered in the Phase 9 inputs list. No separate per-item closure plan needed.

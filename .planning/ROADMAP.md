# Roadmap: THiNX Console — Vue Migration

**Goal:** Full feature parity between Vue console and legacy AngularJS console, with AngularJS UI frozen.
**Strategy:** Phase-by-phase, atomic commits, checkpoint mode. Legacy `src/` is never touched.

---

## Phase 1 — Bug Fixes & Scaffolding Cleanup

**Status:** Pending
**Effort:** XS
**Goal:** Remove blockers so the Vue console renders real data and has no dead code.

**Delivers:**
- Fix `stats.js:23` getter (returns boolean instead of stats data — dashboard will never work until fixed)
- Remove all 7 demo/template routes and page directories (Charts, Tables, Icons, Maps, Notifications, Typography, AnotherPage)
- Fix `Devices.vue` AngularJS `$rootScope` references in `updateTimeline()` and `updateCharts()`

**Requirements:** CLEAN-01, CLEAN-02, CLEAN-03, CLEAN-04

**UAT:**
- Dashboard route loads without JS errors
- Device list renders without console errors
- No demo routes return 200 (they should 404 or redirect)

---

## Phase 2 — CRUD for Simple Management Pages

**Status:** Pending
**Effort:** M per page (5 pages — run in parallel)
**Goal:** All simple management pages support full create/delete operations.

**Delivers:**
- API Keys: create (with one-time key display modal) + delete + bulk delete
- Repositories: create (with auto-alias + duplicate detection) + delete + device count display
- RSA Keys: generate (server-side, one-time private key modal) + delete
- Environment Globals: create + delete
- Mesh Channels: create + delete

**Pattern per page:**
1. Add `create`/`remove` actions + mutations to store module
2. Wire existing "Add" button to a create modal using `b-modal` + `Form` component
3. Wire "Delete selected" to a confirm modal calling `remove` action
4. Wire row-level delete button

**Requirements:** AKEY-01–04, REPO-01–05, RKEY-01–03, ENVI-01–02, CHAN-01–02

**UAT:**
- Can create and immediately see a new item in each list
- Delete removes item from list without page reload
- Bulk delete removes all selected items
- One-time display modals (API key, RSA private key) show correct values and don't reappear

---

## Phase 3 — Transformers with Code Editor

**Status:** Pending
**Effort:** L
**Goal:** Transformers are fully manageable with a proper code editing experience.

**Delivers:**
- Decouple transformer store from `/profile` — use dedicated transformer endpoints
- Transformer list: create (POST with alias + base64 body) + delete
- `/app/transformer/:utid` route with `TransformerEditor.vue`
- CodeMirror or Monaco for JavaScript editing with syntax highlighting
- Base64 encode on save, decode on load
- Unsaved-changes guard (confirm before leaving)

**Requirements:** TRAN-01–07

**UAT:**
- Create a transformer, see it in the list
- Click a transformer, editor opens with decoded JS body
- Edit and save — body is persisted (reload to confirm)
- Navigate away with unsaved changes — browser/router warns
- Delete a transformer — gone from list

---

## Phase 4 — Device Management

**Status:** Pending
**Effort:** XL
**Goal:** Full device management parity with legacy console.

**Delivers:**

*List enhancements:*
- Category filter (color/icon-based)
- Sort options (last update, platform, alias)
- Search/filter input
- Grid vs list view toggle

*Device actions:*
- Revoke: single + bulk (with confirm modal)
- Transfer: modal with target owner field + migrate source/API key option
- Push config: modal with env var multi-select
- Build firmware: POST `/build` with `{ udid }`

*Device detail page (`/app/device/:udid`):*
- Metadata, assigned repository, build/deploy history, device enviros, transformer assignment, device logs, revoke/transfer action buttons

**Requirements:** DEVI-01–11

**UAT:**
- Can filter device list by category — only matching devices shown
- Can search by alias — list filters live
- Revoke a test device — it disappears from the list
- Navigate to device detail — all sections render without errors
- Bulk revoke selected devices — all disappear

---

## Phase 5 — Real Dashboard

**Status:** Pending
**Effort:** L
**Goal:** Dashboard shows real platform statistics instead of hardcoded demo data.

**Delivers:**
- Fix stats store getter (Phase 1 fix prerequisite — done)
- `fetchDashboard` action: fetches `/stats` + audit log + build log in parallel
- Replace `Visits.vue` with functional dashboard
- 6 metric cards (devices checked in, new devices, active, errors, updates deployed, build successes)
- Timeline chart with 7/31/365-day range selector
- Recent builds widget (last 10, with download link)
- Recent audit events widget

**Requirements:** DASH-01–05

**UAT:**
- Dashboard loads and displays real numbers (not zeros/undefined)
- Switching date range selector updates the timeline chart
- Recent builds list shows real builds with clickable download links

---

## Phase 6 — User Profile & Account Settings

**Status:** Pending
**Effort:** L
**Goal:** Users can manage their profile and account from within the Vue console.

**Delivers:**
- Routes: `/app/profile`, `/app/profile/account`, `/app/profile/delete`
- `profile.js` store mutations: `updateProfile`, `uploadAvatar`, `deleteAccount`
- `Account.vue`: tabs for Profile, Avatar, Preferences, Notifications; admin tab if admin
- `Delete.vue`: account deletion with confirmation
- Sidebar/header link to profile

**Requirements:** PROF-01–06

**UAT:**
- Update first name — change persists after page reload
- Upload avatar — preview updates, persists after reload
- Admin user sees admin tab; non-admin does not
- Initiate delete → confirmation step → account deleted → redirected to login

---

## Phase 7 — History Improvements

**Status:** Pending
**Effort:** M
**Goal:** History page is a useful audit and debug tool, not just a flat dump.

**Delivers:**
- Split History into "Build Log" and "Audit Log" tabs
- Tab state in URL: `/app/history/builds` and `/app/history/audit`
- Build row click opens full log in modal (`<pre>` scrollable monospace)
- Date range filter on both tabs
- Text search / flag filter on audit log

**Requirements:** HIST-01–05

**UAT:**
- Navigating to `/app/history/builds` lands on Build Log tab
- Click a build row — full log modal opens with correct content
- Set date range — list filters to that range
- Search audit log for a keyword — only matching entries shown

---

## Phase 8 — Authentication Extras

**Status:** Pending
**Effort:** S
**Goal:** Complete auth flows missing from Vue console.

**Delivers:**
- `/password-reset` route and `PasswordReset.vue` page
- Port reset flow logic from `src/password.html`

**Requirements:** AUTH-01–02

**UAT:**
- Navigate to `/password-reset` — page renders without errors
- Submit a reset request — appropriate API call is made and feedback is shown

---

## Phase Summary

| Phase | Description | Effort | Requirements | Status |
|-------|-------------|--------|--------------|--------|
| 1 | Bug Fixes & Scaffolding Cleanup | XS | CLEAN-01–04 | Pending |
| 2 | CRUD for Simple Management Pages | M×5 | AKEY, REPO, RKEY, ENVI, CHAN | Pending |
| 3 | Transformers with Code Editor | L | TRAN-01–07 | Pending |
| 4 | Device Management | XL | DEVI-01–11 | Pending |
| 5 | Real Dashboard | L | DASH-01–05 | Pending |
| 6 | User Profile & Account Settings | L | PROF-01–06 | Pending |
| 7 | History Improvements | M | HIST-01–05 | Pending |
| 8 | Authentication Extras | S | AUTH-01–02 | Pending |

**Total v1 requirements:** 53 across 8 phases

---

## Implementation Notes

- All API endpoints are documented in `services/console/IMPLEMENTATION_PLAN.md` — use that as the API reference
- All pages use the existing `List` and `Form` generic components — extend, don't replace
- Vuex store pattern: each module has fetch actions; Phase 2+ adds mutations for write operations
- `vue/src/core/api.js` has swapped token assignment (`setAccessToken`/`setRefreshToken`) — fix this if auth issues arise
- `vue/Dockerfile` hardcodes `NODE_ENV=development` — fix before any production deploy

---
*Roadmap created: 2026-05-18*
*Source of truth for feature gaps: `services/console/IMPLEMENTATION_PLAN.md`*

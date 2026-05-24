# Roadmap: THiNX Console — Vue Migration

**Goal:** Full feature parity between Vue console and legacy AngularJS console, with AngularJS UI frozen.
**Strategy:** Phase-by-phase, atomic commits, checkpoint mode. Legacy `src/` is never touched.

---

## Phase 1 — Bug Fixes & Scaffolding Cleanup

**Status:** Complete (pre-existing — verified 2026-05-18)
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

**Status:** Complete (2026-05-19)
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

**Plans:** 2 plans

Plans:
- [x] 03-01-PLAN.md — Fix POST body bug in store + duplicate alias guard in create modal
- [x] 03-02-PLAN.md — Post-save redirect and UTF-8 safe base64 encode/decode

**UAT:**
- Create a transformer, see it in the list
- Click a transformer, editor opens with decoded JS body
- Edit and save — body is persisted (reload to confirm)
- Navigate away with unsaved changes — browser/router warns
- Delete a transformer — gone from list

---

## Phase 4 — Device Management

**Status:** Complete (code — 2026-05-22; deploy + final UAT pending)
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

**Plans:** 3 plans

**Wave 0** — Cypress spec stubs (no production code):
- [ ] 04-00-PLAN.md — Cypress test stubs for DEVI-01–11 (devices.spec.js + device-detail.spec.js)

**Wave 1** *(blocked on Wave 0 completion)*:
- [ ] 04-01-PLAN.md — Devices.vue list enhancements: toolbar, grid view, category pills, sort, search, per-row Revoke (DEVI-01–09)

**Wave 2** *(blocked on Wave 1 completion)*:
- [ ] 04-02-PLAN.md — DeviceDetail.vue: build history, env vars, transformer assignment, device logs, Transfer button (DEVI-10–11)

**Cross-cutting constraints:**
- `mapGetters` must remain spread into `methods` (not `computed`) throughout — project convention
- `buildlog/fetchBuildLog` (not `buildlog/fetchItems`) — correct action name
- No new npm packages in this phase

**UAT:**
- Can filter device list by category — only matching devices shown
- Can search by alias — list filters live
- Revoke a test device — it disappears from the list
- Navigate to device detail — all sections render without errors
- Bulk revoke selected devices — all disappear

---

## Phase 5 — Real Dashboard

**Status:** Complete (2026-05-23) — UAT 3/4 dashboard items pass; one pre-existing gap (G1, `Notifications.vue`) deferred to Phase 6
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

**Plans:** 3 plans

**Wave 0** — Cypress spec stub (no production code):
- [x] 05-00-PLAN.md — Cypress test stub for DASH-01–05 (dashboard.spec.js)

**Wave 1** *(blocked on Wave 0 completion)*:
- [x] 05-01-PLAN.md — stats store `fetchDashboard` + `getTimeline`; `CheckinsTimeline.vue` range-aware line chart (DASH-01, DASH-03)

**Wave 2** *(blocked on Wave 1 completion)*:
- [x] 05-02-PLAN.md — Rework `Visits.vue`: 6 metric cards with period breakdowns, timeline chart + range selector, builds widget with download links, audit widget (DASH-01–05)

**Cross-cutting constraints:**
- `mapGetters` must remain spread into `methods` (not `computed`) — project convention
- No new npm packages — reuse the pre-existing `vue-chartjs` 3.5.1 + `chart.js` 2.9.4 (already used by `AreaChart.vue`)
- Extend existing stores (`stats.js`, `buildlog.js`, `auditlog.js`) — do not replace

**UAT:**
- Dashboard loads and displays real numbers (not zeros/undefined)
- Switching date range selector updates the timeline chart
- Recent builds list shows real builds with clickable download links

---

## Phase 6 — User Profile & Account Settings

**Status:** Code complete (verified 8/8; human UAT pending — 2026-05-23) — 3 plans executed (06-00 Cypress stub + G1 fix; 06-01 store/header; 06-02 Profile.vue tabs). Production build passes.
**Effort:** L
**Goal:** Users can manage their profile and account from within the Vue console.

**Delivers:**
- Routes: `/app/profile`, `/app/profile/account`, `/app/profile/delete`
- `profile.js` store mutations: `updateProfile`, `uploadAvatar`, `deleteAccount`
- `Account.vue`: tabs for Profile, Avatar, Preferences, Notifications; admin tab if admin
- `Delete.vue`: account deletion with confirmation
- Sidebar/header link to profile
- **Carry-over gap G1 from Phase 5 UAT:** fix `vue/src/components/Notifications/Notifications.vue` — move the `mapGetters({ getBuildLog })` spread from `computed:` (line 57) into `methods:` so `this.getBuildLog()` works as a function call (project convention). Currently throws `TypeError: getBuildLog is not a function` on every authenticated page.

**Requirements:** PROF-01–06

**UAT:**
- Update first name — change persists after page reload
- Upload avatar — preview updates, persists after reload
- Admin user sees admin tab; non-admin does not
- Initiate delete → confirmation step → account deleted → redirected to login

---

## Phase 7 — History Improvements

**Status:** Code complete (Waves 0+1+2 shipped — 2026-05-23; deploy + Phase 9 UAT pending)
**Effort:** M
**Goal:** History page is a useful audit and debug tool, not just a flat dump.

**Delivers:**
- Split History into "Build Log" and "Audit Log" tabs
- Tab state in URL: `/app/history/builds` and `/app/history/audit`
- Build row click opens full log in modal (`<pre>` scrollable monospace) — **HIST-03 scope revised 2026-05-23: modal removed; inline-expand variant chosen (see 07-CONTEXT.md)**
- Date range filter on both tabs
- Text search / flag filter on audit log

**Requirements:** HIST-01–05

**Plans:**
- [x] 07-00-PLAN.md — Wave 0: Cypress stub `history.spec.js` (HIST-01..05 TODO it() blocks) — commit `9c86064`
- [x] 07-01-PLAN.md — Wave 1: router (HIST-02 child routes — `da6facb`) + filter primitives (HIST-04 / HIST-05 data layer — `e21b111`)
- [x] 07-02-PLAN.md — Wave 2: UI (date range, flag filter, HIST-03 inline Expand toggle — `d4d7513`)

**UAT:**
- Navigating to `/app/history/builds` lands on Build Log tab
- Click "Expand" on a long build log row — full log shown inline (HIST-03 ships as inline expand, not modal — see `07-CONTEXT.md` for the deliberate scope revision and `07-HUMAN-UAT.md` for the rest)
- Set date range — list filters to that range; URL query reflects state and survives reload
- Search audit log for a keyword + uncheck a flag — only matching entries with kept flags shown

---

## Phase 8 — Authentication Extras

**Status:** Complete (Waves 0+1+2 shipped 2026-05-24 — Wave 1 commits `28b7d2f`, `337429d`, `099cd66`, `8878ef1`; Wave 2 commits `0295a69`, `c5207b0`, `d5053e4`, `46f566a`; Phase 9 live-walk verified AUTH-01/02/03 on 2026-05-24; G5 router.beforeEach guard shipped at `3e720d4`)
**Effort:** S
**Goal:** Complete auth flows missing from Vue console.

**Delivers:**
- `/password-reset` route and `PasswordReset.vue` page (AUTH-01, AUTH-02 — Wave 1)
- Port reset flow logic from `src/password.html` (Wave 1)
- **Session-state hygiene fix (AUTH-03 — Wave 2):** `localStorage.authenticated:true` no longer outlives the access JWT. `auth/scheduleExpiry` arms a `setTimeout` keyed to the JWT `exp` claim at every access-token write boundary (login-success, Login.vue rehydrate, App.vue cold-boot rehydrate). On fire it dispatches `auth/clearSession` (single chokepoint that wipes three localStorage keys + commits null to three pieces of Vuex state + cancels any pending timer) and navigates to `/#/login` via `window.location.hash` (the store has no `$router`). Header.vue `logout()` now dispatches the same `clearSession` action — manual logout and timer-triggered logout share one teardown path. Optional belt-and-suspenders pre-request `exp` check in `api.js#composeOptions` covers the laptop-sleep edge case using platform `atob` + `JSON.parse` (no JWT library import in the API client).

**Plans:**
- [x] 08-00-PLAN.md — Wave 0: Cypress spec stub (auth-extras.spec.js) — already shipped pre-08-01
- [x] 08-01-PLAN.md — Wave 1: PasswordReset.vue + route + 2 Vuex actions + Forgot-password link (AUTH-01, AUTH-02)
- [x] 08-02-PLAN.md — Wave 2: scheduleExpiry timer + clearSession chokepoint + Header logout refactor + api.js backstop (AUTH-03)

**Requirements:** AUTH-01, AUTH-02, AUTH-03

**UAT:**
- Navigate to `/password-reset` — page renders without errors
- Submit a reset request — appropriate API call is made and feedback is shown
- Leave the dashboard open until the token would expire — page auto-redirects to login instead of silently 403'ing every API call

---

## Phase 9 — Manual UAT Review

**Status:** Pending
**Effort:** M
**Goal:** Close the loop on every human-only UAT item carried over from Phases 1–8 by walking the deployed `console.thinx.cloud` end-to-end with real accounts. Anything that automated/headless testing couldn't confirm gets a real-mouse, real-browser, real-backend check here.

**Inputs (consolidated UAT backlog):**
- `.planning/phase-3/03-HUMAN-UAT.md` (Transformers — UAT pending since 2026-05-19)
- `.planning/phase-4/04-HUMAN-UAT.md` (Device Management — 8/12 browser-confirmed; 4 pending)
- `.planning/phase-5/05-HUMAN-UAT.md` (Real Dashboard — 4 items; DASH-04 download already AI-verified end-to-end in 04f78e0)
- `.planning/phase-6/06-HUMAN-UAT.md` (User Profile — 6 items; 5 of 6 AI-verified at code level, listed below)

**Items carried in from Phase 6 AI-UAT (need a real-user pass):**
- PROF-01: Profile field update + page reload (`saveProfile` data-loss fix `4afe3ad` is in)
- PROF-02: Avatar tab — pick file, preview, save, reload, see avatar
- PROF-03: Notifications save — verify the toggled value persists after a fresh login from another browser too
- PROF-04: Admin tab visibility — confirm hidden for a non-admin account (test account is admin)
- PROF-05: Delete account modal — exercise Cancel and (in a throwaway account) Confirm
- PROF-06: Header My Account link — click in a real browser (Chrome DevTools click did not fire the b-dropdown-item; standard mouse click DOES because href is correct)
- Profile.vue: Cypress test-tool quirks observed during AI UAT (b-button type=submit didn't fire on tool click; b-tab clicks didn't switch tab) — confirm these are tool-only quirks, not real-user issues

**Delivers:**
- Each `*-HUMAN-UAT.md` file updated with results (pass / issue + repro / skipped + reason)
- Any new bugs surfaced get filed as Phase 9.N gap-closure plans
- `REQUIREMENTS.md` traceability flipped from Pending → Verified once an item is confirmed
- A `09-UAT-SUMMARY.md` aggregating outcomes

**Cross-cutting context:**
- Console URL: https://console.thinx.cloud (deploy via parent-repo submodule bump — see memory `deployment-console-thinx-cloud`)
- Local dev: `yarn --cwd vue serve` against the live API (see memory `thinx-console-vue-conventions`)
- Test credentials: `vue/cypress/fixtures/thinx.json` (admin) — bring a non-admin account separately for PROF-04
- Tool quirks to watch: Chrome DevTools / Kapture `click` on `<b-button type="submit">` and `<b-tab>` doesn't always fire the Vue handlers; falling back to `evaluate_script` form/component dispatch works

**UAT:**
- Every item from `*-HUMAN-UAT.md` files marked `pass` or filed as a gap-closure plan
- Each PROF-XX requirement traceability row flipped to Verified in `REQUIREMENTS.md`
- No JS console errors during any flow on the deployed console.thinx.cloud
- One end-to-end smoke: login → dashboard → devices → device-detail → profile → logout, with no errors

---

## Phase 10 — Admin Features (v1.1)

**Status:** Seed (decisions locked 2026-05-24; research complete 2026-05-24 — `10-RESEARCH.md`, 10 risks identified, 5 CONTEXT.md corrections)
**Effort:** L
**Goal:** Replace the Profile.vue Admin tab placeholder with three real capabilities (user list, session revocation, impersonation) so admins can manage the platform without ever opening the legacy console.

**Delivers:**

*Backend (parent monorepo `/Users/igraczech/Repositories/thinx-device-api/`):*
- `lib/middleware/requireAdmin.js` — admin-gating middleware factory using `app.owner.profile(owner, ...)` for the `admin === true` check
- `lib/router.admin.js` — `GET /api/v2/admin/users` (paginated `{owner, username, email, admin, created, last_login, device_count}` with `device_count: 0` placeholder for v1), `DELETE /api/v2/admin/session/:owner` (Redis blacklist write), `POST /api/v2/admin/impersonate` (15-min JWT with `impersonator_owner` claim; rejects admin targets)
- `lib/thinx/jwtlogin.js` — new `sign_with_impersonation()` method
- `lib/thinx/audit.js` — 1-line patch so `flags` accepts either a string or array (non-breaking)
- `lib/router.js` — extend the JWT-verify block at 102-113 with Redis blacklist check + impersonation audit log + `req.session.impersonator_owner` injection
- `thinx-core.js` — register the new admin router

*Frontend (console submodule `services/console/vue/`):*
- `/app/admin/users` route + `AdminUsers.vue` page using the project's plain `<table>` + custom-pagination convention (NOT `<b-table>` — that's the locked CONTEXT.md correction)
- Per-row "Revoke sessions" + "Impersonate" actions with `$bvModal.msgBoxConfirm` confirmation (mirrors `Profile.vue#confirmDeleteAccount`)
- `vue/src/store/admin.js` — Vuex module with `fetchUsers`, `revokeSession`, `impersonate` actions
- `vue/src/components/ImpersonationBanner/ImpersonationBanner.vue` — sticky banner above `<router-view>` showing target username + MM:SS countdown + Exit button
- `vue/src/components/Sidebar/Sidebar.vue` — conditional `<NavLink>` to `/app/admin/users` (visible only when `profile.admin === true`) — locked 2026-05-24 OQ-A
- `vue/src/pages/Profile/Profile.vue` — replace lines 138-144 placeholder `<b-card>` with `<router-link>` to admin console
- `vue/src/Routes.js` — add `/app/admin/users` route + extend `beforeEach` guard with admin-path check

**Plans:** 4 plans

**Wave 0** — Cypress spec stub (no production code):
- [ ] 10-00-PLAN.md — `admin.spec.js` covering ADMIN-01..03 TODO `it()` blocks

**Wave 1** *(parent-repo PR; blocked on Wave 0)*:
- [ ] 10-01-PLAN.md — Backend: `requireAdmin` middleware + `router.admin.js` (3 endpoints) + Redis blacklist + `audit.js` flag-array patch + `sign_with_impersonation` JWT method + `router.js` blacklist check

**Wave 2** *(submodule PR; blocked on Wave 1)*:
- [ ] 10-02-PLAN.md — Frontend: `/app/admin/users` route + `AdminUsers.vue` + `ImpersonationBanner.vue` + `store/admin.js` + audit-log surfacing via existing History page

**Wave 3** *(submodule PR; blocked on Wave 2)*:
- [ ] 10-03-PLAN.md — Profile.vue Admin tab swap + Sidebar.vue conditional NavLink + Cypress green-flip

**Requirements:** ADMIN-01, ADMIN-02, ADMIN-03

**Cross-cutting constraints:**
- **NO new npm packages** — keep `redis@5.8.2 (.legacy())` callbacks (NOT ioredis), `jsonwebtoken@9.0.3`, `nano@10.1.4`, Vue 2.6 + BootstrapVue 2.21.2 + Vuex
- `mapGetters` MUST stay in `methods:` (Phase 6 G1 anti-regression)
- Plain `<table class="table table-striped">` + custom pagination — `<b-table>` and `<b-pagination>` are not used anywhere in the project
- Audit writes go through `alog.log()` (direct library call), NOT a POST endpoint — `router.logs.js` exposes GETs only
- `req.session.owner` is the owner-ID string, NOT an object — `requireAdmin` must `userlib.get()` per request to check `admin`
- Impersonate-an-admin returns 403 by spec (locked)
- Cross-repo coupling: Wave 1 lands in the parent monorepo; Waves 2 + 3 land in the console submodule; deploy via parent submodule-bump per memory `deployment-console-thinx-cloud`

**UAT:**
- Admin logs in, opens sidebar Admin link → user list loads with N users; `device_count` shows 0 (v1 placeholder)
- Click "Revoke sessions" on a non-admin row → confirm modal → success → that user's existing tokens are dead (their next API call returns 401)
- Click "Impersonate" on a non-admin row → confirm modal → impersonation banner appears with the target's username + MM:SS countdown
- Under impersonation: profile/devices/etc render the target's data; every action logs an audit entry with `flags: ['admin','impersonation']` visible in History
- Click "Exit impersonation" → banner disappears; pushed to `/login`; re-login as admin works normally
- Non-admin user gets 403 on every `/api/v2/admin/*` endpoint; visiting `/app/admin/users` redirects to dashboard
- Impersonating an admin target → 403 returned, no token issued, UI shows error toast

---

## Phase Summary

| Phase | Description | Effort | Requirements | Status |
|-------|-------------|--------|--------------|--------|
| 1 | Bug Fixes & Scaffolding Cleanup | XS | CLEAN-01–04 | Pending |
| 2 | CRUD for Simple Management Pages | M×5 | AKEY, REPO, RKEY, ENVI, CHAN | Pending |
| 3 | Transformers with Code Editor | L | TRAN-01–07 | Planned |
| 4 | Device Management | XL | DEVI-01–11 | Complete (code) |
| 5 | Real Dashboard | L | DASH-01–05 | Complete (2026-05-23) |
| 6 | User Profile & Account Settings | L | PROF-01–06 | Code complete (verified; UAT folds into Phase 9) |
| 7 | History Improvements | M | HIST-01–05 | Code complete (UAT in Phase 9 — 2026-05-23) |
| 8 | Authentication Extras | S | AUTH-01–03 | Complete (Phase 9 UAT 2026-05-24; G5 router-guard shipped `3e720d4`) |
| 9 | Manual UAT Review | M | aggregate of carry-over UAT items | In progress (live-walked 2026-05-24) |
| 10 | Admin Features (v1.1) | L | ADMIN-01..03 (new) | Research complete (2026-05-24 — `10-RESEARCH.md` + locked OQ-A/OQ-B); planning next |

**Total v1 requirements:** 54 across 9 phases. Phase 10 adds 3 v1.1 requirements (ADMIN-01..03 — see `REQUIREMENTS.md`).

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

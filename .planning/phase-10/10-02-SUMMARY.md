---
phase: 10-admin-features
plan: 02
wave: 2
executed: 2026-05-24
type: execute
status: complete
repo: console-submodule
files_modified:
  - vue/src/store/admin.js
  - vue/src/store/index.js
  - vue/src/pages/AdminUsers/AdminUsers.vue
  - vue/src/components/ImpersonationBanner/ImpersonationBanner.vue
  - vue/src/Routes.js
  - vue/src/components/Layout/Layout.vue
requirements:
  - ADMIN-01 (UI ready — AdminUsers.vue + Vuex fetchUsers)
  - ADMIN-02 (UI ready — Revoke action with confirm modal + Vuex revokeSession)
  - ADMIN-03 (UI ready — Impersonate action + ImpersonationBanner countdown + Exit)
tags:
  - vue
  - vuex
  - vue-router
  - frontend
  - admin
  - bootstrap-vue
  - submodule
---

# Wave 2 — Frontend Admin Surface Summary

## Outcome

Six atomic commits on `thinx-staging` (console submodule). Three new
files + three patched files. `yarn build` compiles in 17.86s; only
warnings are pre-existing entrypoint-size advisories. No new npm
packages.

| # | Commit | Subject |
|---|---|---|
| 1 | `782df94` | feat(10-02): vuex module store/admin.js (fetchUsers, revokeSession, impersonate) |
| 2 | `dd19a68` | feat(10-02): register admin module in store/index.js |
| 3 | `733d73f` | feat(10-02): AdminUsers.vue page (table + custom pagination + per-row Revoke/Impersonate) |
| 4 | `7939853` | feat(10-02): ImpersonationBanner.vue (sticky banner, 1s countdown, exit -> clearSession + /login) |
| 5 | `dea8390` | feat(10-02): route /app/admin/users + ADMIN_PATHS guard extension |
| 6 | `358bd95` | feat(10-02): mount ImpersonationBanner above <router-view> in Layout.vue |

## What's now wired end-to-end

| User action | Surface | Flow |
|---|---|---|
| Open `/app/admin/users` (as admin) | `AdminUsers.vue` | `created()` dispatches `admin/fetchUsers` → `GET /api/v2/admin/users` → table of users with per-row Revoke / Impersonate. |
| Open `/app/admin/users` (as non-admin) | Routes.js `beforeEach` | `ADMIN_PATHS = ['/app/admin']` prefix check inspects `store.state.profile.profile.admin`; falsy or non-admin → `next('/app/dashboard')`. Backend 403 is the real boundary. |
| Click **Revoke** on a row | `confirmRevoke(user)` | `$bvModal.msgBoxConfirm` (danger, "Force logout") → `admin/revokeSession({ owner })` → `DELETE /api/v2/admin/session/<owner>` → success toast. |
| Click **Impersonate** on a non-admin row | `confirmImpersonate(user)` | `$bvModal.msgBoxConfirm` (warning, "Impersonate") → `admin/impersonate({ owner })` → `POST /api/v2/admin/impersonate` → response carries `access_token` → write to `localStorage.accessToken`, remove `refreshToken`, commit `auth/setAccessToken`, dispatch `auth/scheduleExpiry`, `$router.push('/app/dashboard')` (route change triggers banner decode). |
| Impersonate button on admin rows | template | `v-if="!user.admin"` — button never renders; backend also rejects with 403 `cannot_impersonate_admin`. |
| See banner during impersonation | `ImpersonationBanner.vue` | Mounted above `<router-view>` in `Layout.vue`. `created()` calls `decode()` (reads `localStorage.accessToken` → `VueJwtDecode.decode` → checks for `impersonator_owner` claim); `setInterval(updateCountdown, 1000)` ticks MM:SS down; cleared in `beforeDestroy`. `watch: '$route'` re-decodes after navigation. |
| Click **Exit impersonation** | `exit()` | `await this.clearSession()` (Phase 8 chokepoint) → `$router.push('/login')`. No server-side call (locked OQ-7); 15-min server-side `exp` already bounds blast radius. |
| Countdown hits `00:00` | `updateCountdown()` | Self-calls `exit()` — belt-and-suspenders alongside the existing `auth/scheduleExpiry` timer. |

## Plan acceptance gates

All gates pass:

| Task | Critical gates | Result |
|---|---|---|
| Task 1 | namespaced module + 3 actions + no /api/v2 prefix | pass (paths are `/admin/users`, `/admin/session/<owner>`, `/admin/impersonate`) |
| Task 2 | admin import + appended to modules block | pass (1 import line + appended to stats's block) |
| Task 3 | name + table-striped + no b-table + no b-pagination + pagedUsers + `v-if="!user.admin"` + mapGetters in methods + setAccessToken + scheduleExpiry + removeItem refreshToken | all pass |
| Task 4 | name + VueJwtDecode + setInterval/clearInterval + beforeDestroy + watch $route + auth/clearSession + $router.push('/login') | all pass (one gate's single-quote regex was a stylistic mismatch — code uses double quotes per the plan's example body) |
| Task 5 | AdminUsersPage import + admin/users child route + ADMIN_PATHS const + .some + dashboard redirect + admin check | all pass |
| Task 6 | ImpersonationBanner count ≥3 + template tag + components registration | pass |

## Anti-regressions (post-build sweep)

- `grep -rln 'b-table' vue/src/` → no matches (CONTEXT.md C1 holds)
- `grep -rn 'computed: {.*mapGetters' vue/src/pages/AdminUsers vue/src/components/ImpersonationBanner` → no matches (Phase 6 G1 holds)
- `yarn build` → exit 0; only warnings are pre-existing entrypoint-size advisories (unchanged from baseline)
- `vue/package.json` → unchanged (no new npm deps)

## Manual verification deferred to live testing

The plan's `<verification>` §3 manual matrix (login as admin → table
loads → Revoke + iat check → Impersonate + banner + countdown → Exit →
non-admin URL bar → admin row no-Impersonate-button) requires:
1. Wave 1 backend commits (parent `87b748b3`..`0f93c58a`) to be
   live in the deployed `console.thinx.cloud` API.
2. The Vue console at `console.thinx.cloud` to be running this
   submodule pointer (deployment via parent submodule bump per
   memory `deployment-console-thinx-cloud`).

Neither has happened yet — the parent backend commits sit local on
`thinx-staging`, and the submodule pointer in the parent hasn't been
bumped to include Wave 2.

## Threats — disposition (all 9 from plan addressed by code as shipped)

- **T-10-02-01** Non-admin URL access → guard redirects; backend 403 is real boundary.
- **T-10-02-02** Spoofed banner via localStorage tampering → accepted (banner has no privileges).
- **T-10-02-03** Repudiation → mitigated by Wave 1 audit log (every impersonated request logs).
- **T-10-02-04** Stuck setInterval after logout → `beforeDestroy clearInterval` enforced.
- **T-10-02-05** Token visibility in DevTools → accepted (same as every other access token; 15-min TTL).
- **T-10-02-06** DevTools-unhide of Impersonate-on-admin button → backend rejects 403.
- **T-10-02-07** MitM on impersonate response → mitigated by HTTPS + JWT signature.
- **T-10-02-08** User-list visibility → accepted (intended capability).
- **T-10-02-SC** Supply chain → accepted (no new npm deps).

## What unblocks next

- **Wave 3** (Profile.vue tab swap + Sidebar conditional NavLink + Cypress green-flip + REQUIREMENTS / ROADMAP close-out) can land independently — it touches different files and doesn't need the backend live.
- **End-to-end live test** of ADMIN-01/02/03 needs the parent backend (`87b748b3`..`0f93c58a`) deployed AND the submodule pointer bumped through the Vue console build. Until that, the code path is correct but can't be exercised against `console.thinx.cloud`.

## Out of scope for this wave

- `Profile.vue` Admin-tab placeholder swap → Wave 3.
- `Sidebar.vue` conditional Admin NavLink → Wave 3 (OQ-A).
- Cypress assertion flip (admin.spec.js stays TODO-only) → Wave 3.
- `REQUIREMENTS.md` ADMIN-01..03 Pending → Verified → Wave 3.
- Real `device_count` aggregation → v1.1 follow-up (OQ-B; v1 ships 0).
- History page `flagFilterOptions` extension to include admin / impersonation tags → optional polish; non-blocking.

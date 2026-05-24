---
phase: 10-admin-features
status: ready for planning (decisions locked, research complete)
created: 2026-05-24
updated: 2026-05-24 (research + OQ-A/OQ-B locked)
seeded_from: .planning/admin-features-plan.md
research: .planning/phase-10/10-RESEARCH.md
---

# Phase 10 — Admin Features — Seed Context

This is the session-handoff seed for `gsd-phase-researcher` + planner. Read this BEFORE the research run so the work targets the right scope. The exhaustive design analysis lives in `.planning/admin-features-plan.md`; this file pins the **locked decisions** and **out-of-scope** items so the planner doesn't re-derive them.

## Goal

Replace the Profile.vue Admin tab placeholder (lines 105-111: "Admin-management features ... not yet available in this API version. This tab will be expanded when backend admin endpoints are implemented.") with three real capabilities:

1. **User list** — admins can see all users (paginated, sortable, with last-login + device-count).
2. **Session revocation** — admins can force-logout a specific user (all that user's sessions invalidated server-side).
3. **Impersonation** — admins can step into a non-admin user's session for support, with a 15-minute hard cap and a prominent "🎭 Impersonating X" banner across all /app/* pages.

## Decisions locked 2026-05-24 (user call)

| Question | Decision | Implication |
|---|---|---|
| Impersonate admins? | **Defer — non-admin only for v1 of Phase 10** | Backend `POST /api/v2/admin/impersonate` must reject when target's `admin === true`. UI hides the Impersonate action on admin rows. Plan a follow-up phase to add cross-admin impersonation behind a multi-admin approval gate if/when real demand surfaces. |
| Session-revocation granularity? | **All sessions (coarse)** | Single "force logout user X" button. Redis blacklist keyed by `revoked:owner:{owner}` storing `Date.now()` (ms); every authenticated request gets a `redis.get` after JWT verify and 401s if `decoded.iat * 1000 < blacklist_ts`. No session-tracking table needed. |
| Audit-log shape for impersonation? | **Use `alog.log()` directly with multi-flag `['admin', 'impersonation']` (NOT a POST endpoint — see correction §C3 below)** | Every action under an impersonation token calls `alog.log(impersonator_owner, message, ['admin','impersonation'], cb)`. Audit lib gets a 1-line patch so `flags` accepts either a string or an array; existing string-flag callers continue to work. Surfaces in the Phase-7 History page automatically. |
| **OQ-A: Sidebar nav entry for the Admin Console?** | **Add conditional `<NavLink>` to `Sidebar.vue` (Wave 3)** — locked 2026-05-24 | Sidebar shows the link only when `profile.admin === true`. Zero impact on non-admins; big discoverability win for admins. Mirrors the existing conditional-nav pattern in `Sidebar.vue`. |
| **OQ-B: Device-count column in user list?** | **Ship `device_count: 0` placeholder for v1** — locked 2026-05-24 | Backend `GET /api/v2/admin/users` returns `device_count: 0` for now. Real count is a v1.1 follow-up (CouchDB view or Redis cache once user count + traffic justify the work). Admins can still click into individual users for device details. |

## Codebase corrections discovered during research (2026-05-24)

These five corrections came out of direct code inspection. They **do NOT change the locked decisions above**, but they DO change implementation wording. The planner MUST honor them.

| # | CONTEXT.md originally said | Actual codebase shape | Source |
|---|---|---|---|
| C1 | `<b-table>` mirroring Devices.vue | The project does NOT use `<b-table>` anywhere. Every list view uses plain `<table class="table table-striped">` + `v-for`. Custom pagination (two `<b-button>`s + a counter span); `<b-pagination>` also unused. | `10-RESEARCH.md §0.1`; `vue/src/pages/Devices/Devices.vue:47-92` |
| C2 | "ioredis usage patterns" | Backend uses `redis@5.8.2` in `.legacy()` v3-callback mode. All ops are `redis.get(key, cb)`, `redis.set(key, val)` — NO async/await. | `10-RESEARCH.md §0.2`; `thinx-core.js:99-100`; `package.json:76` |
| C3 | "POSTs to existing `/logs/audit`" | There is NO POST audit-log endpoint. Audit writes go through `alog.log(owner, message, flag, callback)` (direct library call). `router.logs.js` exposes GETs only. | `10-RESEARCH.md §0.3`; `lib/thinx/audit.js:13-29`; `lib/router.logs.js:137,148` |
| C4 | `flags: ['admin', 'impersonation']` already supported | `alog.log()` currently stores `flags: [flag]` — always a single-element array. Needs a 1-line patch: `flags: Array.isArray(flag) ? flag : [flag]` (non-breaking — existing string-flag callers work unchanged). | `10-RESEARCH.md §0.4`; `lib/thinx/audit.js:13-29` |
| C5 | `req.session.owner.admin === true` middleware | `req.session.owner` is a string (the owner ID), NOT an object. The auth middleware sets `req.session.owner = payload.username`. Admin gating MUST call `app.owner.profile(owner, cb)` and check `profile.admin === true`. | `10-RESEARCH.md §0.5`; `lib/router.js:102-113`; `lib/thinx/owner.js:296-322` |

## Scope locked

### In scope (Phase 10)

- Backend `lib/router.admin.js` gated by `req.session.owner.admin === true` middleware.
- Backend `GET /api/v2/admin/users` — paginated list `{ owner, username, email, admin, created, last_login, device_count }`.
- Backend `DELETE /api/v2/admin/session/:owner` — coarse session revocation; writes a Redis blacklist entry keyed by `(owner, Date.now())`; auth middleware checks `iat < blacklist_entry_for_owner` and 401s if the JWT was issued before the revocation timestamp.
- Backend `POST /api/v2/admin/impersonate` — issues a JWT pair with `sub: target_owner`, `impersonator_owner: admin_owner`, `exp: now + 900` (15 min). Rejects when `target.admin === true`. Records a `flags: ['admin','impersonation','start']` audit entry.
- Backend auth middleware: when a request's JWT has an `impersonator_owner` claim, every authenticated action also POSTs to `/logs/audit` with `flags: ['admin','impersonation']` and body `{ actor: impersonator_owner, subject: sub, action, path }`.
- Frontend `/app/admin/users` top-level route (still under `/app` since admin must be logged in) + `AdminUsers.vue` page with `<b-table>` (mirroring the Devices.vue pattern), pagination, per-row "Revoke sessions" + "Impersonate" actions with confirm modals.
- Frontend impersonation banner in `Layout.vue` — visible whenever the current JWT has the `impersonator_owner` claim. Shows `🎭 Impersonating <username> — expires in MM:SS [Exit impersonation]`. Countdown sourced from `exp` claim.
- Frontend "Exit impersonation" → clears the impersonation tokens from localStorage; pushes `/login`. (Re-login as admin from scratch is cleaner than restoring the prior admin session, which by then may have expired anyway.)
- Profile.vue Admin tab: replace the placeholder text with a `<router-link to="/app/admin/users">Open Admin Console</router-link>` and a brief description of the powers.

### Explicitly out of scope (Phase 10)

- Impersonating other admins (deferred to a later iteration with multi-admin approval).
- Per-device / per-session granularity on session revocation (deferred — start coarse).
- A separate Redis impersonation ledger / dedicated `/admin/impersonations` endpoint (audit log alone covers it).
- Role-based access control beyond a single `admin` boolean (no read-only admins, no billing admins).
- Multi-tenant isolation (orgs/teams).
- Account suspension (soft-delete) — current model stays hard-delete only.
- Self-service onboarding flows (signup CAPTCHA, email verification beyond the existing flow).

## Cross-cutting constraints

- **NO new npm packages.** Use the existing stack: Vue 2 + BootstrapVue 2.21.2 + Vuex on the frontend; Express + nano (CouchDB) + ioredis on the backend.
- `mapGetters` MUST stay in `methods:` (project convention, Phase 6 G1 anti-regression).
- Backend admin middleware should reuse the existing session-check helper from `lib/router.profile.js` / `lib/router.user.js` patterns.
- JWT changes: add a `jti` claim to all newly-issued tokens (modify `lib/thinx/jwtlogin.js:83-115`). The session blacklist could key off `jti` alone, but the simpler `(owner, iat)` form requires no JWT-shape change for revocation and just an extra `iat` check in the auth middleware. Recommend the `(owner, iat)` form for Phase 10; add `jti` only if/when per-session revocation lands.

## Wave breakdown (confirmed by research 2026-05-24)

- **Wave 0** — Cypress stub `vue/cypress/integration/admin.spec.js` covering the three capabilities. No production code.
- **Wave 1** — Backend (**parent monorepo PR**): `lib/middleware/requireAdmin.js` + `lib/router.admin.js` + Redis session blacklist + the three endpoints (`GET /admin/users`, `DELETE /admin/session/:owner`, `POST /admin/impersonate`) + `audit.js` flag-array patch + `sign_with_impersonation` JWT method + `router.js` blacklist check.
- **Wave 2** — Frontend (**submodule PR**): `/app/admin/users` route + `AdminUsers.vue` page (plain `<table>`) + `ImpersonationBanner.vue` mounted in Layout.vue + `store/admin.js` + extend `Routes.js#beforeEach` guard with admin-path check.
- **Wave 3** — Submodule PR: Profile.vue Admin tab swap (`<router-link>` instead of placeholder `<b-card>`) + Sidebar.vue conditional Admin NavLink (per OQ-A) + Cypress green-flip + docs.

Deploy via parent submodule-bump per memory `deployment-console-thinx-cloud`. Wave 1 must merge to parent `thinx-staging` BEFORE Wave 2 can be deployed (frontend needs the backend endpoints live).

## Inputs to read before research

- `.planning/admin-features-plan.md` — the full design analysis (this file links back).
- `.planning/REQUIREMENTS.md` — see if Admin features should be added as new v1.1 requirements (recommend: yes, ADMIN-01..03 in a v1.1 milestone).
- `vue/src/pages/Profile/Profile.vue:96-113` — the Admin tab placeholder to be replaced.
- `vue/src/store/auth.js` — `scheduleExpiry`, `clearSession`, token-write boundaries. The impersonation flow needs the same teardown semantics.
- `vue/src/Routes.js` — `router.beforeEach` auth guard (Phase 8 G5). The admin route may need a stronger guard (`isAdmin === true`).
- `vue/src/components/Layout/Layout.vue` — where the impersonation banner mounts.
- `lib/thinx/jwtlogin.js:83-115` — JWT signing; needs `impersonator_owner` claim support.
- `lib/router.profile.js` and `lib/router.user.js` — request-validation patterns to mirror.
- `lib/thinx/owner.js:296-322` — `profile()` method shape; admin list builds from the same data source.

## Estimated effort

- Backend: ~1 week (admin router + middleware + 3 endpoints + Redis schema + JWT claim).
- Frontend: ~3-4 days (1 page + 1 banner + 3 modal flows + impersonation lifecycle).
- Cypress + manual UAT: ~1-2 days.
- **Total: ~2 weeks single-dev**, less if backend + frontend run in parallel after Wave 0.

## Acceptance criteria for phase completion

- The placeholder text in `Profile.vue:106-110` is gone (replaced with the `/app/admin/users` link).
- An admin can list users, click a user, revoke their sessions; the user is force-logged-out within ~1s.
- An admin can impersonate a non-admin user; the banner shows; audit log captures every action.
- Non-admin users get 403 on every `/api/v2/admin/*` endpoint and `/app/admin/users` either redirects to dashboard or renders an access-denied page.
- All admin Cypress specs pass.
- Impersonating an admin returns 403 (the locked decision OQ-1).

## Resume prompt for next session

```
/gsd-discuss-phase 10
```

or, if you prefer to skip discussion and go straight to research/plan/execute:

```
Research, plan and execute Phase 10 — Admin Features. Read
.planning/phase-10/10-CONTEXT.md first; it captures the three locked
decisions (impersonate non-admins only, coarse session revocation,
audit-log-only impersonation logging) and out-of-scope items. Use the
same pattern as Phases 6-8: gsd-phase-researcher → gsd-planner →
gsd-executor per wave, with environment_notes pointing at
.planning/phase-10/ and noting the flat .planning/phase-N/ layout
breaks gsd-sdk discovery. Deploy via parent meta-repo bump after the
work lands.
```

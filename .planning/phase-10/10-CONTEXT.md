---
phase: 10-admin-features
status: seed (decisions locked)
created: 2026-05-24
seeded_from: .planning/admin-features-plan.md
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
| Session-revocation granularity? | **All sessions (coarse)** | Single "force logout user X" button. Redis blacklist keyed by `owner-id + issued-after-timestamp`; every authenticated request checks the blacklist. No session-tracking table needed. |
| Audit-log shape for impersonation? | **Reuse `/logs/audit` with `flags: ['admin', 'impersonation']`** | Every action taken under an impersonation token logs to the existing audit endpoint with the impersonator's `owner` in the body. Surfaces automatically in the Phase-7 History page. No new endpoint / table for impersonation lifecycle. |

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

## Suggested wave breakdown

- **Wave 0** — Cypress stub `vue/cypress/integration/admin.spec.js` covering the three capabilities. No production code.
- **Wave 1** — Backend: `lib/router.admin.js` + admin middleware + Redis session blacklist + the three endpoints (`GET /admin/users`, `DELETE /admin/session/:owner`, `POST /admin/impersonate`).
- **Wave 2** — Frontend: `/app/admin/users` route + `AdminUsers.vue` page + impersonation banner in Layout.vue + audit-log wiring for every admin action.
- **Wave 3** — Profile.vue Admin tab: replace placeholder with a link to `/app/admin/users`; remove the "not yet available" text. Brief docs/UAT update.

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

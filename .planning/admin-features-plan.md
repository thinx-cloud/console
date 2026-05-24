---
status: plan (not yet phased)
created: 2026-05-24
trigger: User asked to "Plan implementation of Admin features to remove" the placeholder text in Profile.vue Admin tab (lines 105-111)
---

# Admin Features — Implementation Plan

## Why

Profile.vue Admin tab currently shows a placeholder:

> "Admin-management features (user list, session revocation, impersonation)
> are not yet available in this API version. This tab will be expanded
> when backend admin endpoints are implemented."

That placeholder ships in production. To remove it we need actual admin
features wired up. This plan scopes the three named capabilities + a
suggested phase shape.

## Scope decisions (call before coding)

| Question | Recommendation |
|---|---|
| Do admin actions need a confirmation modal? | Yes for all destructive ops (revoke, impersonate) — same `$bvModal.msgBoxConfirm` pattern as `confirmDeleteAccount` |
| Should admin endpoints share `/api/v2/admin/*` prefix? | Yes — single backend router (`lib/router.admin.js`) gated by `req.session.owner.admin === true` middleware |
| Impersonation token TTL? | Short (15 min) and clearly marked as impersonation in the JWT payload (`impersonator_owner` claim). Audit-logged. |
| Audit logging? | Every admin action POSTs to existing `/logs/audit` with `flags: ['admin']`. Surfaces in History page automatically. |
| UX surface? | Admin tab inside `/app/profile` (existing) OR dedicated `/app/admin` route. Recommend `/app/admin` route — admin is a different mental model from "my settings" |

## Capability 1 — User list

### Stories
- As an admin, I want to see all users so I can audit who's on the platform.
- As an admin, I want to filter by recent activity / signup date.

### Backend gaps
- `GET /api/v2/admin/users` — return paginated list of `{ owner, username, email, admin, created, last_login, device_count }`.
  - Implementation hint: CouchDB view over `managed_users` keyed by `last_login` desc.
- `GET /api/v2/admin/users/:owner` — full profile for one user.

### Frontend
- New route: `/app/admin/users` → `AdminUsers.vue` page.
- BootstrapVue `<b-table>` with server-side pagination (reuse the device-list pattern from `Devices.vue`).
- Columns: Username · Email · Owner ID (truncated, copy icon) · Admin badge · Last login · Device count · Actions.
- Actions per row: "View details" (link to `/app/admin/users/:owner`), "Revoke sessions", "Impersonate".

### Effort: M (one wave for backend + one for frontend)

## Capability 2 — Session revocation

### Stories
- As an admin, I want to force-logout a specific user (e.g. after suspicious activity).
- As an admin, I want to invalidate all sessions of a user without deleting their account.

### Backend gaps
- A "session blacklist" — list of revoked JWTs / refresh tokens. Required because JWTs are stateless; checking blacklist is the only way to invalidate them server-side before exp.
  - Storage: Redis with TTL = max JWT lifetime (1 week for refresh tokens). Key: `revoked:<jti>` or `revoked-owner:<owner>:<issued_at>`.
  - Middleware: every authenticated request checks the blacklist; if present → 401.
  - **Cost:** adds one Redis lookup per request. Acceptable for an admin platform; benchmark if scale is a concern.
- `DELETE /api/v2/admin/session/:owner` — revoke all sessions for an owner. Adds an entry to the blacklist.
- (Optional) `GET /api/v2/admin/sessions/:owner` — list active sessions if/when session tracking is added.

### Frontend
- "Revoke sessions" action on the user row (capability 1's table).
- Confirmation modal: "Force-logout <username>? This will invalidate all
  their current access and refresh tokens. They'll need to log in again."
- On confirm → `DELETE /api/v2/admin/session/:owner` → success toast + audit-log entry.

### JWT claim addition (backend)
Add a `jti` (JWT ID) claim to all newly-issued tokens (modify `lib/thinx/jwtlogin.js:83-115`). The blacklist keys off `jti` instead of full token string for compactness.

### Effort: L (Redis schema + middleware + endpoint + frontend action)

## Capability 3 — Impersonation

### Stories
- As an admin, I want to see the console *exactly as user X sees it* to
  reproduce a support ticket.
- As an admin, I want to make changes on user X's behalf with a clear
  audit trail.

### Backend gaps
- `POST /api/v2/admin/impersonate` body `{ owner }` → issue a short-lived
  (15 min) JWT pair where:
  - `sub: owner` (the impersonated user)
  - `impersonator_owner: <admin's own owner>` (the audit trail)
  - `exp: now + 900` (15 min)
- All authenticated middleware should check `impersonator_owner` and:
  - Log every action to audit with `flags: ['admin', 'impersonation']`,
    body includes both `actor: impersonator_owner` and `subject: owner`.
  - Block certain dangerous actions (e.g. `DELETE /user`, password change).

### Frontend
- "Impersonate" action on user-list row.
- Confirmation: "Impersonate <username>? You will be logged in as them
  for 15 minutes. All actions are audit-logged."
- On confirm → call backend → receive new JWT pair → store in
  localStorage REPLACING admin's session (this is intentional — the
  admin is now "in" the user's context).
- Prominent banner across the top: "🎭 Impersonating &lt;username&gt; —
  expires in 14:32 [Exit impersonation]". Banner displayed whenever
  `impersonator_owner` claim exists on the current JWT.
- "Exit impersonation" → DELETE current token → require admin to log
  back in. (Cleaner than auto-restoring admin session — the admin's
  original tokens may have expired by then.)

### Effort: L-XL (JWT claim changes + middleware audit + frontend banner + impersonation lifecycle)

## Suggested phase shape (Phase 10 or "v1.1" milestone)

| Wave | Plan | Deliverables |
|------|------|--------------|
| W0 | `10-00-PLAN.md` | Cypress stub `admin.spec.js` covering user list, revoke, impersonate |
| W1 | `10-01-PLAN.md` | Backend: `lib/router.admin.js` + admin auth middleware + Redis session blacklist + JWT `jti` claim. `GET /api/v2/admin/users` + `DELETE /api/v2/admin/session/:owner` + `POST /api/v2/admin/impersonate` endpoints. |
| W2 | `10-02-PLAN.md` | Frontend: `/app/admin/users` route + `AdminUsers.vue` page + impersonation banner component in Layout.vue + audit-log entries for every admin action. |
| W3 | `10-03-PLAN.md` | Replace the placeholder in Profile.vue Admin tab with a link to `/app/admin/users` and a brief description of the admin powers. Remove the "not yet available" text. |

## Out of scope (v2+)

- Role-based access control beyond a single `admin` boolean (e.g. read-only admins, billing admins).
- Multi-tenant isolation (orgs/teams).
- Account suspension (soft-delete) — current model is hard-delete only.
- Audit-log filtering by admin actor in the History page (would be nice
  but not required; existing search + flag filter from Phase 7 cover it).
- Self-service onboarding flows (signup CAPTCHA, email verification beyond
  current).

## Open questions for the user

- OQ-1: Should impersonation be allowed for *non-admin* targets only, or
  any user (including other admins)? Recommend: any user, but require
  multi-admin approval for impersonating another admin (later iteration).
- OQ-2: Where should impersonation be logged? Recommend: audit log + a
  dedicated `/admin/impersonations` ledger in Redis with full request
  bodies for compliance.
- OQ-3: Should session-revocation support per-device-session granularity?
  Current plan revokes all of user X's sessions at once. Per-session
  granularity requires tracking individual sessions which we don't do
  today. Recommend: ship coarse-grained first, refine if needed.

## Estimated total effort

- Backend: ~1.5 weeks (Redis schema + JWT claim refactor + 3 endpoints + middleware + audit log integration)
- Frontend: ~1 week (1 page + 1 banner component + 3 modal flows + impersonation lifecycle)
- Cypress + manual UAT: ~2 days
- Total: ~3 weeks of focused work for a single dev, or 1-2 weeks parallelized.

## Acceptance criteria for phase completion

- The placeholder text in Profile.vue:106-110 is gone (replaced with a
  proper Admin link to `/app/admin/users`).
- An admin can list users, click a user, revoke their sessions, and the
  user is forcibly logged out within ~1 second.
- An admin can impersonate a user; the banner is visible across all
  authenticated pages; audit log shows the impersonation.
- Non-admin users get 403 on any `/api/v2/admin/*` endpoint and the
  `/app/admin/users` route renders an "Access denied" page (or
  redirects to dashboard).
- All admin Cypress specs pass (3+ flows).

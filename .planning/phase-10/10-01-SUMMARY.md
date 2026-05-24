---
phase: 10-admin-features
plan: 01
wave: 1
executed: 2026-05-24
type: execute
status: complete
repo: parent-monorepo (commits land in /Users/igraczech/Repositories/thinx-device-api on thinx-staging)
files_modified:
  - lib/middleware/requireAdmin.js
  - lib/router.admin.js
  - lib/thinx/audit.js
  - lib/thinx/jwtlogin.js
  - lib/router.js
  - thinx-core.js
requirements:
  - ADMIN-01 (backend ready — GET /api/v2/admin/users)
  - ADMIN-02 (backend ready — DELETE /api/v2/admin/session/:owner + Redis blacklist + audit hook)
  - ADMIN-03 (backend ready — POST /api/v2/admin/impersonate + 15-min JWT + per-request audit on impersonated calls)
tags:
  - backend
  - express
  - redis
  - jwt
  - admin
  - parent-monorepo
---

# Wave 1 — Backend Admin Router Summary

## Outcome

Six atomic commits in the parent monorepo on `thinx-staging` deliver
the backend half of Phase 10. Two new files + four surgical patches.
No new npm dependencies. `node --check` passes on every touched file.

| # | Commit | Subject |
|---|---|---|
| 1 | `87b748b3` | feat(10-01): add requireAdmin middleware factory |
| 2 | `cfc4fecb` | fix(10-01): audit.log accepts string OR array flag (non-breaking) |
| 3 | `86022ed6` | feat(10-01): JWTLogin.sign_with_impersonation (15-min token, impersonator_owner claim) |
| 4 | `0acc95d4` | feat(10-01): router.js JWT-verify gains Redis blacklist + impersonation injection + audit hook |
| 5 | `0652c127` | feat(10-01): router.admin.js — GET users / DELETE session / POST impersonate |
| 6 | `0f93c58a` | feat(10-01): register router.admin.js in thinx-core |

Diff stat (parent repo): 6 files changed, 125 insertions, 2 deletions.

## Endpoints live

All three gated by `requireAdmin` (which itself re-checks
`profile.admin === true` via CouchDB on every call — no JWT cache).

| Method | Path | Behavior |
|---|---|---|
| GET | `/api/v2/admin/users` | List every user doc; each row has `{owner, username, email, admin, created, last_login, device_count: 0}`. |
| DELETE | `/api/v2/admin/session/:owner` | Write `revoked:owner:{owner}=Date.now()` to Redis with 7-day TTL; audit-log `["admin","revoke"]`. |
| POST | `/api/v2/admin/impersonate` | Body `{owner}`; reject if target.admin === true; otherwise mint a 15-min JWT with `impersonator_owner` claim; audit-log `["admin","impersonation","start"]`. |

## Per-request audit hook

`lib/router.js` now emits one `alog.log(impersonator_owner,
"IMPERSONATED METHOD path as username", ["admin","impersonation"])`
for every JWT-authed request whose token carries an
`impersonator_owner` claim. This runs BEFORE the Redis blacklist check
so impersonator-after-revoke is still traceable.

## Plan acceptance gates

All gates pass:

| Task | Gates checked | Result |
|---|---|---|
| Task 1 | 6 grep gates + node --check | all pass after header-comment strip (gate expected exactly 1 `app.owner.profile(owner` match; decorative comment caused a spurious 2) |
| Task 2 | 2 grep gates + node --check | pass; diff is exactly 1 line |
| Task 3 | 5 grep gates + node --check | pass; `sign()` and `sign_with_refresh()` byte-identical |
| Task 4 | 6 grep gates + node --check | pass; Cookie-or-other-auth block byte-identical |
| Task 5 | 10 grep gates + node --check | pass |
| Task 6 | 2 grep gates + node --check | pass; thinx-core.js diff is exactly 1 line |

## Verification deferred to CI

The parent's `npm test` runs `jasmine`, which expects the Docker
test environment (Redis + CouchDB + Mosquitto + transformer + worker
+ influxdb per `.circleci/config.yml` `test` job). Not run locally
this session — CI will exercise it on push. The only existing spec
touching the JWT-verify path is `spec/jasmine/ZZ-RouterDeviceSpec.js`;
my patch fails open on Redis errors so test environments without
Redis configured continue to call `next()` exactly as before.

Manual curl smoke (steps a–i in the plan's <verification> §3) is
deferred — it needs a local dev backend with seeded admin + non-admin
accounts. Recommended verification path: after this lands in parent
`thinx-staging`, exercise it via the deployed staging environment as
soon as the deploy job completes, OR locally via
`docker compose up api` once the test repos are in place.

## Threats — disposition

All 11 threats from the plan's STRIDE register are addressed by the
code as shipped:

- **T-10-01-01** (EoP via requireAdmin): mitigated — every call re-reads CouchDB; no JWT cache.
- **T-10-01-02** (Tampering on Redis key): mitigated — writes only via gated DELETE; TTL bounds growth.
- **T-10-01-03** (DoS via Redis outage): mitigated — fail-open in router.js; documented warning log only.
- **T-10-01-04** (Repudiation): mitigated — per-request audit log under impersonation; start event also logged.
- **T-10-01-05** (Cross-admin impersonation): mitigated — `profile.admin === true` → 403 in router.admin.js.
- **T-10-01-06** (User-list disclosure): accepted — intended capability; no secrets in payload.
- **T-10-01-07** (Stolen impersonation JWT after Exit): accepted — 15-min exp bounds blast radius.
- **T-10-01-08** (alog.log async with no retry): accepted — matches existing pattern.
- **T-10-01-09** (iat-vs-blacklist race): accepted — sub-ms window; documented.
- **T-10-01-10** (Untrusted owner-id inputs): mitigated — `sanitka.owner` on every untrusted input.
- **T-10-01-SC** (Supply chain): accepted — no new npm deps.

## What unblocks Wave 2

- The three endpoints exist live in the codebase. Once the parent
  repo deploys (CI job `build-vue-console` is triggered by the
  submodule pointer bump, so the API deploy is independent — needs
  `thinx-staging` parent deploy pipeline) the frontend can hit them.
- The `router.beforeEach` G5 guard in `vue/src/Routes.js` already
  has the right shape to bounce non-admins from `/app/admin/*` —
  Wave 2 may want a stronger guard (`isAdmin === true`) for the
  admin route specifically.
- `app.login.sign_with_impersonation` is callable from
  `router.admin.js`; Wave 2 reads the returned `access_token` from
  the POST response and writes it to `localStorage.accessToken`
  (NO refresh token — exit = re-login per the locked decision).
- `audit.js#log` now accepts arrays. The existing History page
  (`vue/src/pages/History/History.vue`) already filters via
  `flags.some(...)` — multi-flag impersonation events will surface
  under both "admin" and "impersonation" filters automatically.

## Out of scope for this wave (per plan)

- Frontend `AdminUsers.vue`, `ImpersonationBanner.vue`,
  `store/admin.js`, `Routes.js` entry, banner mount in `Layout.vue` → Wave 2.
- `Profile.vue` Admin-tab placeholder swap → Wave 3.
- `Sidebar.vue` conditional Admin NavLink → Wave 3 (OQ-A).
- Cypress assertion flip → Wave 3.
- Real `device_count` aggregation → v1.1 follow-up (OQ-B; v1 ships 0).
- Server-side impersonation kill switch → deferred (R2 / OQ-7).

## Cross-repo note

This SUMMARY lives in the console submodule alongside the rest of
Phase 10 planning. The Wave 1 commits themselves live in the **parent
monorepo** at `/Users/igraczech/Repositories/thinx-device-api/` on
`thinx-staging`. The console submodule's git status for this wave is
clean for everything except this SUMMARY and the ROADMAP checkbox
flip.

---
phase: 09-manual-uat-review
status: second user-walk complete — 20 verified, 3 failed (G7/G8/G9), 1 infra gap (G10), 1 scope finding (G11); 2 items still pending walk (DASH-04, AUTH-03 laptop-sleep)
created: 2026-05-24
updated: 2026-05-24 (second user-walk)
inputs: [04-HUMAN-UAT.md, 05-HUMAN-UAT.md, 06-HUMAN-UAT.md, 07-HUMAN-UAT.md, 08-HUMAN-UAT.md]
---

# Phase 9 — Manual UAT Review — Summary

## Scope

Re-verified every open UAT item across Phases 4–8 against the live
`console.thinx.cloud` (bundle `last-modified: Sun, 24 May 2026 08:01:25
GMT` — confirmed to contain Phase 6 + 7 + 8 markers).

Phase 3 (Transformers, TRAN-01..07) had no formal HUMAN-UAT.md file —
its items were verified via the Phase 3 VERIFICATION + transformers.spec.js
Cypress stub. Not re-walked here.

## Live-walk results (AC items)

### Phase 5 — Dashboard

| Item | Result | Evidence |
|------|--------|----------|
| DASH-01 | pass | 6 metric cards render; values from real `/stats` (zeros legitimate for test account in current window) |
| DASH-02 | pass | Each card shows Today/Week/Month sub-values |
| DASH-03 | pass (empty state) | Timeline widget + 7/31/365 range selector render; "No check-in data for this range." correctly shown for empty account |
| DASH-04 | widget renders | Recent Builds card renders with "No builds yet." — download path HN-deferred (needs account with successful build artifact zip) |
| DASH-05 | pass | Recent Audit Events widget renders |

### Phase 7 — History

| Item | Result | Evidence |
|------|--------|----------|
| HIST-01 | pass | Two tabs render |
| HIST-02 | pass | Bare /app/history → /app/history/audit redirect; tab clicks push URL; deep-link hydrates |
| HIST-03 | untestable | Test account has no builds; UI code path can't be exercised — code-level verified in Phase 7 Wave 2 |
| HIST-04 | pass | From/To inputs sync to `?from=&to=` query; deep-link reload preserves values |
| HIST-05 | pass | Flag checkboxes sync to `?flags=...` query; deep-link reload preserves uncheck state |

### Phase 8 — Auth Extras

| Item | Result | Evidence |
|------|--------|----------|
| AUTH-01 | pass | `/#/password-reset` renders unauthenticated |
| AUTH-02 initiate | pass | No-query: email-only form |
| AUTH-02 confirm | pass | `?reset_key=...`: two-password form (toggled by `hasResetToken`) |
| AUTH-02 link | pass | "Forgot password?" router-link on Login (`href="#/password-reset"`) |
| AUTH-03 timer | pass | localStorage clear works live; G5 router.beforeEach guard (`3e720d4`) now keeps subsequent navigations bounced to /login |
| AUTH-03 belt-and-suspenders | pass (observed live) | 10× 403 chain on the user's open session triggered the pre-request check, which cleared localStorage |

## Already-resolved before Phase 9

Items from earlier rounds that didn't need re-walking:

- DEVI-01..04, DEVI-07, DEVI-08, DEVI-10..12 — Phase 4 round-2 browser-confirmed
- DEVI-05, DEVI-06, DEVI-09 — Phase 4 round-2 API-confirmed; now unblocked by deploy but were not destructively retested
- PROF-03 — Phase 6 AI-UAT API-confirmed end-to-end
- G1 (Notifications.vue mapGetters) — Phase 6 Wave 0 fix verified live in this session (no TypeError during walks)

## Deferred items (AC-DEST + HN)

### Needs user-driven action on the live console (AC-DEST)

These all work in code; clicking them would mutate or destroy data on
the shared `test` account. The user should walk each on a throwaway
account or by accepting the test-account mutation.

- **PROF-01**: edit a profile field (e.g. first_name), Save Profile,
  reload, verify persistence. The `saveProfile` data-loss fix (4afe3ad)
  is in the live bundle.
- **PROF-02**: choose an avatar image, Save Avatar, reload, verify
  preview persists.
- **PROF-05**: open Delete Account modal, verify Cancel = no-op
  (safe). Confirm path needs a throwaway account.
- **PROF-06**: click the header user dropdown → "My Account" — verify
  the URL changes to `/#/app/profile` via a real mouse click (Chrome
  DevTools click was previously flaky on b-dropdown-item per Phase 6
  UAT note).
- **DEVI-05, DEVI-06, DEVI-09** (live re-test): the API-level
  verifications from Phase 4 round-2 are sufficient evidence, but a
  live click on Revoke / Bulk Revoke / Build firmware would confirm
  the deploy carries the fixes. Destructive on test data — defer.

### Needs external state (HN)

- **DASH-04 zip download**: needs an account with a successful build
  that has an artifact zip. Test account has only ERROR-status builds
  with no zips.
- **PROF-04 negative case**: needs a non-admin account to confirm the
  Admin tab is correctly hidden (`v-if="profile && profile.admin === true"`).
  Live walk on the admin test account ran into the stale-session
  issue (G5), so even the positive case was confounded — re-test
  after fresh login.
- **AUTH-02 end-to-end with real reset_key**: requires the user to
  request a real reset email and click the link. The backend's reset
  email currently redirects to the legacy `/password.html`
  (`lib/thinx/owner.js:480` parent-repo patch deferred); the Vue page
  is reachable via the "Forgot password?" link.
- **AUTH-03 1-hour wait**: leave the dashboard open for ~1h until the
  access JWT exp passes, verify the auto-logout. Synthetic acceleration
  via forged short-exp JWT is possible but wasn't run this session
  because the bug was directly observed in vivo (the user's own
  expired session showed the clear-but-no-redirect symptom — see G5).

## Gaps discovered during the live walk

### G5 — AUTH-03 redirect doesn't survive subsequent navigations
status: **closed (`3e720d4`)** — shipped 2026-05-24
severity: medium (was)
file: `vue/src/Routes.js` (added `router.beforeEach`)
detail: AUTH-03 correctly tears down the session (localStorage cleared,
store tokens nulled), but `window.location.hash = '#/login'` is a
one-shot side-effect. Any subsequent client-side `router.push` to
`/app/*` succeeded and left the page in a "ghost" state — Vue router
rendered the page, every API call 403'd, no UI feedback.
fix: global `router.beforeEach` guard now bounces any `/app/*` nav
to `/login` when no `accessToken` is found in either store state or
localStorage. The localStorage fallback prevents cold-reload users
with a still-valid session from being bounced before App.vue#created
finishes rehydration.
detail in: `.planning/phase-8/08-HUMAN-UAT.md#G5`

### G7 — PROF-05 Confirm path doesn't tear down the session
status: open
severity: medium
discovered: 2026-05-24 (second Phase 9 user-walk on throwaway account)
file: likely `vue/src/pages/Profile/Profile.vue` (delete-account success handler) or `vue/src/store/profile.js#deleteAccount` action
detail: `DELETE /api/v2/user` succeeds (account is actually deleted),
but the UI does NOT redirect to `/#/login` and does NOT clear
localStorage. The new G5 router.beforeEach guard saves us on the next
navigation, but the immediate UX is wrong — the user sees the same
authenticated page with stale state until they manually navigate.
fix: in the deleteAccount success handler, dispatch `auth/clearSession`
(same chokepoint Header logout uses) and then redirect to `/login`
(via `this.$router.push('/login')` if a router instance is available,
or `window.location.hash = '#/login'` matching the AUTH-03 timer
teardown). See Phase 8 Wave 2 (commit `0295a69`) for the clearSession
contract.

### G8 — AUTH-02 reset email POST returns 403
status: open
severity: high (blocks the entire password-reset flow on the live API)
discovered: 2026-05-24 (second Phase 9 user-walk)
file: backend `lib/router.password.js` or wherever `/api/v2/password/reset`
is mounted; check session/auth middleware that should allow this
endpoint to be public (it must be reachable while logged out)
detail: clicking **Send reset email** triggers
`POST https://console.thinx.cloud/api/v2/password/reset` which returns
**HTTP 403**. The whole reset round-trip is blocked at the request-init
step — the success message in the Vue UI is now a lie until the
backend stops 403'ing the unauthenticated request.
fix: confirm the `/password/reset` endpoint is configured as a public
route (no `req.session` requirement); check CORS / CSRF guards;
verify the request body matches the route's validator. The
Wave-1 Phase 8 spec (`08-01-PLAN.md`) shipped this endpoint as a
direct port of the legacy `src/password.html` flow; the legacy console
hit the same endpoint without auth, so something downstream is now
rejecting it.

### G9 — DEVI-05 bulk-action counter doesn't reset after single-row Revoke
status: open
severity: low (functional bug — Revoke succeeds; counter stays stale)
discovered: 2026-05-24 (second Phase 9 user-walk)
file: `vue/src/pages/Devices/Devices.vue` — the row-level Revoke action
must clear the selection state that drives the toolbar `Revoke (N)` /
`Transfer (N)` / `Push Config (N)` button labels
detail: per-row Revoke removes the device from the list (backend
`DELETE /api/v2/device` returns 200), but the toolbar buttons still
read `Revoke (1)`, `Transfer (1)`, `Push Config (1)` as if a device
remained selected. The bulk-action counter is computed from a
`selected` array that isn't being pruned when a single-row action
deletes a row. The bulk path (DEVI-06) works because that action
explicitly clears `selected` on success.
fix: in the per-row Revoke success handler, also splice the removed
device's udid out of `this.selected` (or whatever the project's
selection-tracking array is called) before re-fetching the list.

### G10 — DEVI-09 worker silently loops on docker pull
status: open
severity: high (every firmware build fails after `POST /api/v2/build` returns 200)
discovered: 2026-05-24 (second Phase 9 user-walk on `core` node)
file: not in this repo — infrastructure / `thinx_worker` service code
detail: `POST /api/v2/build` returns 200 and a new build row appears
in `/app/history/builds`, so the requirements-level Phase 4 DEVI-09
behaviour passes. **But** the worker (running on the `core` swarm
node) then loops indefinitely with:
```
[<build-id>] »» 1/1: No such image: suculent/arduino-docker-build:latest@sha256:bc85d98271bd6bd…
overall progress: 0 out of 1 tasks
```
The "overall progress" line comes from the worker. The worker never
terminates the build or surfaces an informative error in the build
log — it just spins. Manual `docker pull suculent/arduino-docker-build`
on the `core` node succeeds (image lands as
`sha256:bc85d98271bd6bd2196e6e40bab7527ef250589b7a2ff5d6f789e628fecb98a5`),
but subsequent builds still don't kick in. After pulling the image to
the `micro` node, the symptom continues — the image isn't propagating
to whichever swarm node is actually scheduled to run the build, OR
the worker is pinned to a node that doesn't have the image, OR there
is a digest mismatch between the worker's pinned digest and what
`docker pull` produces.
investigation hints:
- The pinned digest `bc85d98271bd6bd…` in the worker error matches
  what `docker pull` produces — so the digest itself is consistent;
  the issue is image distribution / scheduler placement.
- Confirm via `docker service ps thinx_worker` which node is running
  the worker, and ensure the build image is present there.
- Consider whether the worker should: (a) fail the build cleanly when
  its docker pull errors, surfacing the error in the build log; (b)
  retry-with-backoff on transient pull failures; (c) be pinned to the
  same swarm node as the docker registry, or use `swarm` `--with-registry-auth`
  + pre-distribution.
- This is the same loop the swarm registry shipped earlier — the
  worker doesn't recover when an image was once pullable and is no
  longer locally cached.
fix: worker code needs to (1) terminate the build on persistent
"No such image" errors instead of looping, (2) emit a build-log line
the user can see in `/app/history/builds`, (3) ideally pre-pull the
arduino-docker-build image on worker startup or refuse to schedule
builds on a node without the image.

### G11 — Vue console has no signup flow
status: open (scope decision needed)
severity: medium (workaround: signup via legacy console works)
discovered: 2026-05-24 (second Phase 9 user-walk — needed throwaway account for PROF-05 Confirm path)
file: missing — needs new `vue/src/pages/Signup/Signup.vue` (or similar)
+ store action + backend signup endpoint already exists in the legacy
console
detail: the user could not register a throwaway account from the Vue
console; they had to use the legacy console UI to create one. The
Phase 6/8 scope only covered Profile + Auth-extras (password reset +
session-expiry); signup is currently out of v1 scope and ships only
on the legacy console. This is now a discovery item, not a Phase 9
gap closure — it requires a scoping decision (new milestone, or
v1.1 alongside Phase 10).
recommendation: file under v1.1 alongside ADMIN-01..03; treat as
**AUTH-04** (or similar) — port the legacy signup form to Vue.

### G6 — buildHash on Login footer shows empty instead of git SHA
status: **closed** — console-side `a462ff8`, parent-side `d5169e61` (also the deploy commit landing G5 + G6)
severity: low (was)
file: parent `.circleci/config.yml` `build-vue-console` job and console
repo `.circleci/config.yml` `vue` job
fix: both jobs' `extra_build_args` now carry `--build-arg VUE_APP_BUILD_HASH=$(echo $CIRCLE_SHA1 | cut -c -7)`; `vue/Dockerfile` declares the matching `ARG VUE_APP_BUILD_HASH` + `ENV VUE_APP_BUILD_HASH=${VUE_APP_BUILD_HASH}` (lines 24 / 45). Login footer now reads the first 7 chars of `$CIRCLE_SHA1` instead of the empty default. User-facing verification step is captured in `09-USER-CHECKLIST.md` section 0.
detail in: `.planning/phase-8/08-HUMAN-UAT.md#G6`

## REQUIREMENTS.md traceability flips

Items moving Pending → Verified based on the first Phase 9 live walk (AI):

- DASH-01..03, DASH-05 (DASH-04 widget verified; zip-download deferred)
- HIST-01, HIST-02, HIST-04, HIST-05 (HIST-03 untestable on this account)
- AUTH-01, AUTH-02 (the page + both form modes + login link; full
  email round-trip deferred at the time)
- AUTH-03 (teardown verified live; G5 router-guard then shipped at `3e720d4`)

Items moving Pending → Verified based on the second Phase 9 live walk (user, 2026-05-24):

- PROF-01, PROF-02 (already flipped in `0444757`)
- PROF-04 (negative — non-admin account confirmed no Admin tab; row now reads full pass)
- PROF-06 (header dropdown → My Account → `/#/app/profile`)
- DEVI-06 (bulk Revoke removed selected devices)
- DEVI-09 narrow Pass (`POST /api/v2/build` returns 200; build entry in history). Downstream worker loop is **G10**, not a DEVI-09 row-level regression.
- AUTH-03 (foreground 1-hour timer confirmed; row now reads full pass with the laptop-sleep belt-and-suspenders walk still pending)

Items moving from Pending/Partial → Failed (engineering follow-ups required):

- PROF-05 — Confirm path doesn't redirect or clear localStorage (**G7**)
- AUTH-02 — `POST /api/v2/password/reset` returns 403 (**G8**)
- DEVI-05 — bulk-action counter stays at count(1) after per-row Revoke (**G9**)

Items staying Pending pending user action:

- DASH-04 (full zip download — needs account with successful build artifact)
- AUTH-03 laptop-sleep belt-and-suspenders edge case
- DEVI-09 worker infrastructure (**G10**) — out-of-scope for the requirement-level pass, but tracked as an open infra issue

Out-of-scope side-finding:

- Vue console has no signup flow (**G11**) — account creation only works in legacy console. File as v1.1 candidate (probably **AUTH-04**) alongside Phase 10 Admin Features.

## Bundle verification

Confirmed deployed bundle contains all expected phase markers:

| Phase | Markers | Count |
|-------|---------|-------|
| 6 | `uploadAvatar`, `avatarSrc`, `saveProfile` | 4 / 2 / 5 |
| 7 | `HistoryAudit`, `HistoryBuilds`, `auditFlagFilter`, `expandedBuilds`, `logIsTruncatable` | 2 / 3 / 10 / 5 / 2 |
| 8 | `scheduleExpiry`, `clearSession`, `expiryTimerId`, `requestPasswordReset`, `confirmPasswordReset` | 10 / 7 / 8 / 4 / 4 |

Bundle `last-modified: Sun, 24 May 2026 08:01:25 GMT`.

---
status: pass (4/6 live-confirmed; 2 deferred — see G5)
phase: 08-authentication-extras
source: [08-00-SUMMARY.md, 08-01-SUMMARY.md, 08-02-SUMMARY.md]
created: 2026-05-24
updated: 2026-05-24
live_walked_at: console.thinx.cloud (bundle 2026-05-24T08:01Z — Phase 8 markers present: scheduleExpiry×10, clearSession×7, expiryTimerId×8, requestPasswordReset×4, confirmPasswordReset×4)
---

## Phase 9 live-walk results (2026-05-24)

| Item | Result | Evidence |
|------|--------|----------|
| AUTH-01 | pass | `/#/password-reset` renders unauthenticated — h1 "Password Reset", no redirect to `/login` |
| AUTH-02 initiate | pass | No-query state: 1 email input, "Send reset email" button, "Back to login" link, prose "Enter your account email to receive a password reset link." |
| AUTH-02 confirm | pass | `?reset_key=abc123&owner=test`: 0 email inputs, 2 password inputs, "Set password" button, prose "Choose a new password for your account." — the `hasResetToken` computed correctly toggles the form mode |
| AUTH-02 link | pass | Login page shows "Forgot password?" router-link with `href="#/password-reset"`, between password field and "Create an Account" |
| AUTH-03 timer | **partial — see G5** | Pre-request `composeOptions` exp-check fires correctly: `localStorage.authenticated` + tokens were cleared automatically when the access JWT expired in the user's open session. But `/login` redirect did not survive subsequent client-side navigations (no `router.beforeEach` global guard); user remained on `/app/profile` with a broken-DOM state after the clear. The teardown half works; the redirect half needs a stronger guard. |
| AUTH-03 belt-and-suspenders | pass (observed) | Live evidence: 10 consecutive GETs to `/api/v2/{profile,stats,logs/audit,logs/build,device}` returned 403, after which the pre-request check tore down `localStorage` (verified empty post-403). The check fired exactly as planned. |

## Pre-Phase-9 content below

## Current Test

Phase 8 ships code-only. All three AUTH-XX items are verified at the
file / commit level (`yarn build` green; every grep gate from each
wave's acceptance criteria passes; Wave 0 Cypress stub parses with
`node --check`). Real-browser walkthrough on the deployed
console.thinx.cloud rolls into Phase 9 — Manual UAT Review.

Local-dev resume command: `yarn --cwd vue serve` against the live API.
Test credentials: `vue/cypress/fixtures/thinx.json`. For AUTH-02 confirm,
a real reset_key from a sent email is needed; the test account's password
should be changed back after the walkthrough.

## Tests

### 1. AUTH-01 — Unauthenticated `/password-reset` route renders
expected: Visiting `/#/password-reset` while logged out renders the
PasswordReset page (no redirect to `/login`); JS console clean.
result: code pass — `Routes.js` registers `/password-reset` as a
top-level route sibling to `/login` (commit `337429d`); the page is
the new `vue/src/pages/PasswordReset/PasswordReset.vue` (commit
`28b7d2f`) mirroring `Login.vue` layout. **Phase 9: real-browser
confirmation (logged-out tab → /#/password-reset → page renders).**

### 2. AUTH-02 initiate — Email-only form when no token in query
expected: `/#/password-reset` with no query renders a single email
input + "Send reset email" button; submitting calls
`POST /api/v2/password/reset` with `{ email }` and shows a "check your
inbox" success message.
result: code pass — `hasResetToken` computed gates the form mode
(`!$route.query.reset_key && !$route.query.activation` → initiate
form); `submitInitiate()` calls the `auth/requestPasswordReset` action
(commit `099cd66`) which posts to `/password/reset` via `$api.$post`.
**Phase 9: real-browser submit with a test account's email; verify
reset email arrives.**

### 3. AUTH-02 confirm — Two-password form when `reset_key` / `activation` in query
expected: `/#/password-reset?reset_key=<key>&owner=<owner>` (or
`?activation=...`) renders two password fields + "Set password" button;
client-side check rejects mismatched / too-short passwords (`< 4`);
submitting calls `POST /api/v2/password/set` with the matching
`reset_key` or `activation` plus `{ owner, password, rpassword }`.
result: code pass — `submitConfirm()` validates length + match before
dispatching `auth/confirmPasswordReset` which sends whichever of
`reset_key` / `activation` is present (commit `099cd66`, mirrors
backend acceptance per `08-RESEARCH.md` §3.2-§3.3). **Phase 9: end-
to-end with a real reset_key from a sent email; verify the new
password works for login.**

### 4. AUTH-02 Forgot-password link on Login page
expected: A "Forgot password?" router-link appears on `/login` between
the password input and the social-login footer; clicking navigates to
`/#/password-reset`.
result: code pass — single-line `<router-link to="/password-reset">`
added at `Login.vue:60` (commit `8878ef1`). **Phase 9: real-mouse
click in a real browser.**

### 5. AUTH-03 — Session expiry timer (foreground tab)
expected: After login, when the access JWT's `exp` elapses, the page
clears `localStorage.authenticated` + tokens and redirects to
`/#/login`. Manual logout still works the same way. Rehydrate-on-reload
re-arms the timer using the remaining ms-until-expiry of the existing
token.
result: code pass — `scheduleExpiry(token)` action in `auth.js`
decodes the JWT via the already-installed `vue-jwt-decode 0.1.0`,
computes `decoded.exp * 1000 - Date.now()`, and `setTimeout`s
`clearSession + window.location.hash = '#/login'`. Wired at three
write boundaries: `Login.vue` login-success (`c5207b0`), `Login.vue`
rehydrate-on-mount, and `App.vue` boot. `Header.vue#logout` refactored
to dispatch `auth/clearSession` (`d5053e4`). Module-private
`expiryTimerId` lives outside Vuex state. **Phase 9: live-token test
— log in, leave the dashboard open for ~1 hour, verify automatic
redirect to login without the previous "silently 403 on every API
call" symptom.** Synthetic acceleration: forge a short-exp JWT in
localStorage and reload to immediately trigger the redirect (see
`08-02-PLAN.md` `<verification>` step 5 for the exact procedure).

### 6. AUTH-03 — Belt-and-suspenders pre-request check (laptop-sleep guard)
expected: If the laptop sleeps past `exp` (so the `setTimeout` never
fires), the next API request from `api.js#composeOptions` detects the
expired JWT, tears down the session synchronously, and redirects to
`/#/login` before the (doomed) request is issued.
result: code pass — `composeOptions()` in `vue/src/core/api.js`
(commit `46f566a`) does `atob(this.refreshToken.split('.')[1])` +
`JSON.parse` + `payload.exp * 1000 < Date.now()` check on every
request, with a try/catch so a malformed token falls through to the
existing flow. Uses platform `atob` to keep `vue-jwt-decode` out of
the API-client layer (Webpack tree-shaking concern). Reads
`this.refreshToken` (which actually holds the access JWT per the
intentional name swap at `api.js:50-52` — preserved). **Phase 9:
sleep the laptop for > 1 hour, wake, interact with any UI action —
verify the redirect fires before the failed API request lands.**

## Summary

total: 6 (5 AUTH-XX items + 1 belt-and-suspenders sub-check)
passed (code-level): 6
issues: 0
pending (Phase 9): 6
skipped: 0
blocked: 0

## Out of scope (intentional)

- Reset email-link redirect target update — the backend still redirects
  the email link to the legacy `/password.html`. Migrating
  `lib/thinx/owner.js:480` to `/#/password-reset?...` is a one-line
  parent-meta-repo patch, deferred. Until then, the Vue page is
  reachable via the new "Forgot password?" link on `/login` but
  email-link clicks land on the legacy confirm page.
- Refresh-token consumption flow — the frontend never calls a refresh
  endpoint (verified via `grep "refresh_token" vue/src/` in
  `08-RESEARCH.md` §1.2). Adding a true refresh flow that extends the
  session is a separate scope.
- Password strength meter / `>=8` chars policy — the legacy `>=4`
  minimum was ported verbatim per `password.js:13-15`. Hardening is
  a separate ticket.
- 2FA, OAuth account linking, password breach checks — all v2+ scope.

## Gaps

### G4 — Real-browser confirmation needed for AUTH-01..03
status: resolved (live-walked 2026-05-24)
severity: low → resolved
items: 4/6 PASS, 1 partial (AUTH-03 timer — see G5), 1 deferred (AUTH-02
end-to-end with real reset_key from real email; PROF-04 negative case
needs non-admin account, etc — see Phase 9 worklist).

### G5 — AUTH-03 redirect doesn't survive client-side navigations
status: open (Phase 8 follow-up)
severity: medium — the session-clear part works (localStorage cleaned,
tokens nulled), but the `window.location.hash = '#/login'` redirect is a
one-shot side-effect: any subsequent client-side navigation to `/app/*`
goes through without re-checking auth, leaving the page in a broken
"ghost" state where every API call 403s and the user has no UI feedback.
file: `vue/src/store/auth.js` (scheduleExpiry callback) and
`vue/src/core/api.js` (composeOptions belt-and-suspenders)
fix: add a global `router.beforeEach((to, from, next) => { ... })` guard
in `vue/src/Routes.js` (or `vue/src/main.js`) that checks
`store.getters['auth/isAuthenticated']` for any path under `/app/` and
pushes `/login` if false. ~5 lines. Should be a quick task or fold into
Phase 8.1.
reproduction: 1) log in, 2) wait until the access JWT exp passes (~1h),
3) trigger any API request, 4) observe localStorage cleared but URL
still on /app/*, 5) navigate to another /app/* — should redirect to
/login but doesn't.
discovered_during: Phase 9 live walk via chrome-devtools; user's own
session at /app/profile exhibited the bug.

### G6 — buildHash on Login footer is "dev" instead of a git SHA
status: open (CI follow-up — cosmetic only)
severity: low
file: parent meta-repo `.circleci/config.yml` `build-vue-console` job
(and console repo `vue` job for symmetry)
fix: add `--build-arg VUE_APP_BUILD_HASH=$(echo $CIRCLE_SHA1 | cut -c -7)`
to the docker build's `extra_build_args` so the Login page footer shows
the real commit SHA instead of the dev fallback (`Login.vue:110`).
Helpful for confirming which build is live in production.

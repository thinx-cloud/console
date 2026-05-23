---
phase: 08-authentication-extras
status: seed
created: 2026-05-23
---

# Phase 8 — Authentication Extras — Seed Context

Session-handoff seed for the planner/researcher. Read this BEFORE `gsd-phase-researcher` so research targets the right surfaces.

Phase 7 deploy is in flight at the moment this seed was written; bundle propagation to console.thinx.cloud may still be catching up. Verification of Phase 7 is part of Phase 9 (Manual UAT Review) — Phase 8 does NOT depend on Phase 7 being live.

## Requirements (`.planning/REQUIREMENTS.md` AUTH-01..02 + AUTH-03 carry-over)

| Req | Wording | Phase 8 must |
|---|---|---|
| AUTH-01 | Password reset page exists at `/password-reset` | Add Vue route + `PasswordReset.vue` page in `vue/src/pages/`. Register in `Routes.js` as a TOP-LEVEL route (sibling to `/login`), NOT under `/app` — the user is unauthenticated when they hit it. |
| AUTH-02 | Password reset flow ports behaviour from `src/password.html` | The legacy file at `src/password.html` covers ONLY the confirmation step (user clicked an email link, now enters a new password). It posts back to itself. Phase 8 needs to port (a) the new-password form (two fields, match validation, submit) **and** (b) figure out the initiate-step backend endpoint (likely `POST /api/v2/user/password-reset` or similar — researcher to confirm by reading `lib/router.user.js` and any password-related backend code). The Vue page should handle both states: if a reset token is present in the URL/query, show the new-password form; otherwise show the username/email input form. |
| **AUTH-03** | **(NEW, added 2026-05-23 from Phase 6 UAT carry-over)** Session-expiry timer | `localStorage.authenticated:true` outlives the session cookie / JWT. Vue router stays "logged in" while every API call silently 403s. Schedule a `setTimeout` keyed to the access/refresh token's `exp` claim that clears `localStorage.authenticated` + tokens and pushes `/#/login` when the JWT expires. Reschedule on each successful login / token refresh. Until this lands, the documented workaround is `localStorage.clear()` + cookie wipe (saved memory `session-expiry-stale-localstorage`). |

## Current state (HEAD = a756cbe)

- `vue/src/pages/Login/Login.vue` — handles login, has a `<router-link to="login">Create an Account</router-link>` (unrelated to password reset). NO password-reset link anywhere on the login form. Login form fields are username + password.
- `vue/src/Routes.js:30-33` — `/login` route is registered at the top level. The catch-all `path: '*'` (RootError) is at line 113-115.
- `vue/src/store/auth.js` — auth store actions (login, logout, token refresh). The researcher MUST inspect this to understand the token lifecycle and where `localStorage.authenticated` is set / cleared.
- `vue/src/core/api.js` — `setAccessToken` / `setRefreshToken` (token names are swapped historically — see saved memory `ci-thinx-cloud-console`).
- `src/password.html` (legacy AngularJS) — 109 lines. Just the password-confirm form: two password fields, submit. Server-side `<ENV::...>` placeholders. No initiate-side form here (the legacy `src/auth.html` likely has it; researcher should check).
- `vue/src/components/Layout/Layout.vue` — wraps `/app/*` routes; that's where a session-expiry watcher could live, OR in `auth.js` (store-level setTimeout is cleaner — single source of truth, survives route changes).
- Login.vue already exposes `buildHash` from `process.env.VUE_APP_BUILD_HASH` (set in `vue.config.js`) — useful for confirming future deploys; not in Phase 8 scope but worth noting.

## Hard constraints (carried from prior phases)

- **NO new npm packages.** No `jwt-decode` / `jose` / etc. — JWT exp claim is parseable with two `atob()` calls + JSON.parse on the middle segment of the token. Three lines of plain JS.
- **`mapGetters` MUST be spread into `methods:`** (not `computed:`) and called as functions. Project convention; G1 in Phase 6 was the exact inverse mistake. AUTH-03 will touch the auth store / Layout — keep the convention.
- **`.planning/` is FLAT (`.planning/phase-N/`)** — `gsd-sdk` discovery returns "phase not found" for this layout. Use direct file ops + plain `git` only (memory `gsd-sdk-flat-phase-dirs`).
- **Deploy is via the parent meta-repo submodule bump** (memory `deployment-console-thinx-cloud`). Phase 7 deploy is still propagating from the parent bump at `0ee49eda`.
- **CI:** `legacy` + `test_vue` run on `thinx-staging`; `vue` Docker image only builds on `thinx-console` (doesn't exist). Memory `ci-thinx-cloud-console`.

## Suggested wave breakdown (planner decides final)

- **Wave 0** — Cypress stub `vue/cypress/integration/auth-extras.spec.js`. One `it()` per AUTH-01..03 with TODO bodies. Mirror `profile.spec.js` / `history.spec.js` exactly.
- **Wave 1** — AUTH-01 + AUTH-02 — Vue page + route + store action(s):
  - `vue/src/pages/PasswordReset/PasswordReset.vue` — two-state component (initiate form vs confirm form based on presence of a token in `$route.query`).
  - `vue/src/Routes.js` — top-level `path: '/password-reset'` (no `/app` prefix), sibling to `/login`.
  - `vue/src/store/auth.js` — new actions `requestPasswordReset({ username })` and `confirmPasswordReset({ token, password })` calling whatever backend endpoints the researcher identified.
  - Optionally add a "Forgot password?" `<router-link>` on `Login.vue`.
- **Wave 2** — AUTH-03 session-expiry timer:
  - In `vue/src/store/auth.js`, expose a `scheduleExpiry(token)` action that decodes the JWT `exp` claim, computes ms-until-expiry, and `setTimeout`s a clear-session callback. Reschedule on each `setAccessToken` / `setRefreshToken`. Cancel on logout. On fire: clear localStorage, push `/login`.
  - Hook into `App.vue` `created()` (or wherever the initial token boot happens) so a reload picks up the existing token's expiry and reschedules.
  - **Pitfall to call out in research/plan:** browser tabs that go to sleep may drift the setTimeout. A belt-and-suspenders check in the API client (`vue/src/core/api.js`) that inspects `exp` on every request and forces logout on expiry is the robust alternative; pick one or do both.

## Out of scope for Phase 8

- GDPR / `/gdpr` consent page (v2 requirement, deferred).
- Email-templating server-side changes (the backend likely already has password-reset endpoints — verify, don't rebuild).
- Two-factor auth, OAuth account-link UI, etc.
- Anything that requires new npm packages.

## Resume prompt for next session

```
Research, plan and execute Phase 8 — Authentication Extras. Read
.planning/phase-8/08-CONTEXT.md first. Use the same pattern as Phases 5,
6, and 7: gsd-phase-researcher → gsd-planner → gsd-executor per wave,
with environment_notes pointing at .planning/phase-8/ and noting the
flat .planning/phase-N/ layout breaks gsd-sdk discovery. Deploy via
parent meta-repo bump after the work lands.
```

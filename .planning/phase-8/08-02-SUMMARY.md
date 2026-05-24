---
phase: 08-auth-extras
plan: 02
subsystem: vue-auth
tags:
  - vue
  - vuex
  - auth
  - session-expiry
  - jwt
  - auth-03
requires:
  - 08-01
provides:
  - auth/clearSession action (single chokepoint for session teardown)
  - auth/scheduleExpiry action (JS-side setTimeout armed at every token-write boundary)
  - api.js#composeOptions belt-and-suspenders exp check (synchronous backstop)
affects:
  - vue/src/store/auth.js
  - vue/src/pages/Login/Login.vue
  - vue/src/App.vue
  - vue/src/components/Header/Header.vue
  - vue/src/core/api.js
tech-stack:
  added: []
  patterns:
    - "Module-private timer id (let outside export default) for non-reactive state in Vuex"
    - "Hash-mode redirect from Vuex actions (window.location.hash = '#/login') because actions have no $router"
    - "Dependency-free JWT exp decode via platform atob + JSON.parse in api.js"
key-files:
  created: []
  modified:
    - vue/src/store/auth.js
    - vue/src/pages/Login/Login.vue
    - vue/src/App.vue
    - vue/src/components/Header/Header.vue
    - vue/src/core/api.js
decisions:
  - "Module-private expiryTimerId (let outside the Vuex export) chosen over committing through a mutation; setTimeout ids are opaque numbers and tracking them in reactive state has no benefit"
  - "Redirect from inside Vuex actions uses window.location.hash (not $router.push) because actions have no $router reference; this is enabled by hash-mode routing (Routes.js:27)"
  - "Header.vue#logout keeps this.$router.push('/login') because the component does have a router instance — manual logout and timer-triggered logout intentionally use different redirect mechanisms"
  - "api.js Task 4 belt-and-suspenders check uses platform atob + JSON.parse (NOT vue-jwt-decode import) to keep the API client dependency-free; the three-key localStorage removal duplicates auth/clearSession because api.js has no Vuex store reference (intentional, defensive backstop)"
  - "The token-name swap in api.js (setAccessToken stores to this.refreshToken; composeHeaders Bearer uses this.refreshToken) was preserved as locked project history — the Task 4 pre-request check reads this.refreshToken for the same reason"
  - "Header.vue's now-unused mappings (removeAccessToken / removeRefreshToken / setUser / setAccessToken / setRefreshToken) and the mapMutations import were trimmed after pre-edit grep confirmed they were logout-only"
metrics:
  duration: "~6 minutes wall clock"
  completed: 2026-05-24
  tasks_completed: 4
  tasks_planned: 4
  files_modified: 5
  files_created: 0
  lines_added: 81
  lines_removed: 14
  commits: 4
  packages_added: 0
requirements:
  - AUTH-03
---

# Phase 8 Plan 02: Session-Expiry Timer + Single Clear-Session Chokepoint Summary

Implemented AUTH-03 with a Vuex-owned setTimeout armed at every access-token write boundary, a single `auth/clearSession` action that replaces an inlined four-op wipe in Header.vue, and a synchronous belt-and-suspenders exp check in `api.js#composeOptions` for the laptop-sleep edge case. No new npm packages, hash-mode routing preserved, token-name swap untouched.

## Commits

| # | Hash | Message |
|---|---|---|
| 1 | `0295a69` | feat(08-02): add clearSession + scheduleExpiry actions in auth store |
| 2 | `c5207b0` | feat(08-02): wire scheduleExpiry at every access-token write boundary |
| 3 | `d5053e4` | refactor(08-02): collapse Header logout into auth/clearSession dispatch |
| 4 | `46f566a` | feat(08-02): add belt-and-suspenders exp check in api.js#composeOptions |

## What Shipped

### Task 1 — `vue/src/store/auth.js`

- Added `let expiryTimerId = null;` at module top (outside `export default`) — non-reactive, cleared/replaced across calls, never committed through a mutation.
- Added `clearSession({ commit })` action: cancels pending timer, removes `accessToken` / `refreshToken` / `authenticated` from localStorage, commits null to `setAccessToken` / `setRefreshToken` / `setUser`. Becomes the single chokepoint for session teardown.
- Added `scheduleExpiry({ dispatch }, token)` action: cancels any prior timer, decodes the JWT via the existing `VueJwtDecode` import (no second import added), computes ms-until-exp, arms a `setTimeout` for that delay. On fire dispatches `clearSession` and sets `window.location.hash = '#/login'`. If the token is already expired at schedule time (`msUntilExpiry <= 0`), the wipe + redirect fire synchronously. Decode failures are logged and swallowed — the normal auth flow handles bad tokens via the next API call's 401.
- Existing actions (`removeAccessToken`, `removeRefreshToken`, `isTokenValid`, `requestPasswordReset`, `confirmPasswordReset`), mutations, and getters are untouched (Wave 2 was purely additive on this file).

### Task 2 — `vue/src/pages/Login/Login.vue` + `vue/src/App.vue`

Three new `this.scheduleExpiry(<access_token>)` call sites, all inserted immediately after the existing `setRefreshToken(...)` call at each token-write boundary:

- `Login.vue` login-success branch (after `setRefreshToken(refresh_token)`) — fires when the user submits valid credentials on the login form.
- `Login.vue` `created()` rehydrate branch — fires when the Login route is hit while localStorage already holds valid tokens.
- `App.vue` `created()` cold-boot rehydrate — fires on full page reload when the `isAuthenticated` getter is true and both stored tokens validate.

Both files added a single entry (`scheduleExpiry: "auth/scheduleExpiry"`) to their existing `mapActions` block inside `methods:`. The Phase 6 G1 anti-regression convention (mapActions stays in `methods:`, never `computed:`) was preserved in both files. `App.vue`'s mapActions block was expanded from one-line to multi-line for the new entry.

### Task 3 — `vue/src/components/Header/Header.vue`

- `logout()` refactored from a five-line inline wipe to two-line: `await this.$store.dispatch('auth/clearSession')` then `this.$router.push('/login')`. The function is now `async` so dispatch ordering is deterministic.
- `clearSession: "auth/clearSession"` added to `mapActions`.
- Pre-edit grep confirmed `removeAccessToken`, `removeRefreshToken`, `setUser`, `setAccessToken`, `setRefreshToken` were referenced ONLY inside `logout()` (lines 135-137 pre-refactor). After the refactor all five became unused, so:
  - The two `mapActions` entries (`removeAccessToken` / `removeRefreshToken`) were removed.
  - The entire `mapMutations` block (three entries) was deleted.
  - The `mapMutations` import was removed from line 79 to avoid the unused-import warning.
- `this.$router.push('/login')` stays in the component on purpose — the Vuex store has no `$router` reference, so the timer-triggered redirect (from inside `scheduleExpiry`) uses `window.location.hash` instead. Manual logout and timer logout intentionally use different redirect mechanisms; the underlying session teardown (`clearSession`) is shared.

### Task 4 — `vue/src/core/api.js`

Optional task implemented. The check slotted cleanly into the top of `composeOptions(method, body)` without altering the function's existing shape — the original 11-line body is preserved verbatim after the new 19-line check block.

Pre-request the bearer token's `exp` is decoded via platform `atob` + `JSON.parse` (no `vue-jwt-decode` import — `api.js` stays dependency-free). If `exp * 1000 < Date.now()`:
- Three localStorage keys are removed inline (duplicates `auth/clearSession`'s removal because `api.js` has no Vuex store reference; tangling two layers would be worse than the duplication).
- `window.location.hash = '#/login'` triggers navigation.
- The request itself still flies — it will 401, but the page is already navigating to `/login` so the user sees the login screen instead of a silent error.

Reads `this.refreshToken` (NOT `this.accessToken`) because of the locked token-name swap at `api.js:50-56` — `setAccessToken` stores its argument as `this.refreshToken`, which is the value used in the `Bearer` header at `composeHeaders` line 30. Locked per the `ci-thinx-cloud-console` user-memory note; explicitly NOT touched by this commit.

## Deviations from Plan

None. The plan was executed as written:

- All four tasks (including optional Task 4) implemented.
- All grep-gate acceptance criteria for Tasks 1, 2, 3 met on first pass.
- Task 4 grep gate `vue-jwt-decode (must be 0)` initially failed because the implementation guidance's comment mentioned `vue-jwt-decode` literally; the comment was reworded to "the JWT decode library" before commit. Functional behavior is identical.
- Header.vue `mapMutations` import removed (in addition to the mapMutations block itself) to eliminate the ESLint unused-import warning; this is a Rule 1/Rule 2 follow-through after the plan's "trim if grep confirms unused" guidance.
- No `await` chain issue, no surprise null tokens — all builds clean on first compile.

## Verification

| Gate | Result |
|---|---|
| `node --check vue/src/store/auth.js` after Task 1 | OK |
| `cd vue && yarn build` after Task 1 | OK (build complete, no warnings on new lines) |
| `cd vue && yarn build` after Task 2 | OK |
| `cd vue && yarn build` after Task 3 | OK |
| `cd vue && yarn build` after Task 4 (final) | OK |
| `git diff vue/package.json vue/yarn.lock` | empty (no new packages) |
| Final grep sweep — sentinel symbols (`auth/clearSession\|scheduleExpiry\|expiryTimerId`) per file | auth.js: 10, Login.vue: 3, App.vue: 2, Header.vue: 2 (all ≥1) |
| Pre-edit grep before Header.vue trim | confirmed logout-only — safe to trim |
| Task 1 acceptance criteria | all met (let expiryTimerId: 1, clearSession: 4, scheduleExpiry: 2, expiryTimerId-all: 8, clearTimeout: 2, window.location.hash: 2, VueJwtDecode: 3, setTimeout: 2, commit-null calls: 1 each) |
| Task 2 acceptance criteria | all met (Login.vue: scheduleExpiry call sites 2, exact access_token + accessToken patterns 1 each, auth/scheduleExpiry 1; App.vue: scheduleExpiry 1, storedAccessToken exact 1, auth/scheduleExpiry 1; mapActions in methods: preserved in both files) |
| Task 3 acceptance criteria | all met (auth/clearSession: 2, inline-wipe removed: 0, router.push login: 1, async logout: 1, mapActions in methods: 1) |
| Task 4 acceptance criteria | all met (payload.exp: 1, atob: 2, vue-jwt-decode: 0, window.location.hash: 1, localStorage.removeItem: 3) |

## Manual UAT (deferred to user)

The automated grep gates + build all pass. The following manual flows from the plan's `<verification>` section are deferred to the user post-deploy (per the project's "don't push, user handles deploy" rule):

1. Happy path: log in, confirm scheduleExpiry's setTimeout was registered with ~3,600,000 ms delay (1 h JWT TTL).
2. Manual logout: click Logout button, confirm three localStorage keys are cleared, navigation to `/#/login`, no console errors.
3. Forced cold-reload expiry: paste a JWT with `exp: 1` into `localStorage.accessToken`, reload, confirm immediate redirect to `/#/login` (scheduleExpiry's `msUntilExpiry <= 0` branch).
4. Short-exp synthetic test: mint a JWT with `exp = floor(Date.now()/1000) + 15`, set in localStorage, reload, stay on dashboard ~15 s, confirm navigation to `/#/login`.
5. Task 4 backstop test: temporarily comment out scheduleExpiry, set expired token, reload, trigger an API call, confirm api.js's pre-request check tears down + navigates.

## Success Criteria Status

| Criterion | Status |
|---|---|
| AUTH-03 — session torn down + redirect to /#/login when access JWT exp reached | DONE (setTimeout in store + sync backstop in api.js) |
| Single chokepoint for session teardown (auth/clearSession) | DONE (Header logout + timer callback both route through it; api.js optional backstop replicates the three-key removal as defensive duplication) |
| Module-private expiryTimerId (declared outside Vuex export, cleared/replaced on every call, never committed) | DONE |
| Hash-mode redirect from store (window.location.hash) — Header.vue keeps $router.push | DONE |
| mapActions in methods: preserved in Login.vue, App.vue, Header.vue | DONE (verified by awk + grep sweep) |
| No new npm packages | DONE (git diff vue/package.json vue/yarn.lock empty) |
| Token-name swap in api.js NOT "fixed" | DONE (Task 4 explicitly reads this.refreshToken for the same reason composeHeaders does) |
| Existing actions (removeAccessToken / removeRefreshToken / isTokenValid) and mutations / getters remain functional | DONE (Wave 2 was purely additive on auth.js) |
| Optional Task 4 implemented OR explicitly deferred in SUMMARY | DONE (implemented) |

## Threat Flags

None. No new network endpoints, no new auth paths, no schema changes at trust boundaries, no new file-access patterns. The threat model entries in the plan (T-08-02-01 through T-08-02-SC) were all either `accept` dispositions or `mitigate (no-op)` — the mitigate-rated T-08-02-07 (race condition on double scheduleExpiry calls) is satisfied by the "clear-then-replace" guard at the top of both `clearSession` and `scheduleExpiry`.

## Known Stubs

None.

## Self-Check: PASSED

Verified the following:

- `vue/src/store/auth.js` exists (modified) — FOUND
- `vue/src/pages/Login/Login.vue` exists (modified) — FOUND
- `vue/src/App.vue` exists (modified) — FOUND
- `vue/src/components/Header/Header.vue` exists (modified) — FOUND
- `vue/src/core/api.js` exists (modified) — FOUND
- Commit `0295a69` exists — FOUND
- Commit `c5207b0` exists — FOUND
- Commit `d5053e4` exists — FOUND
- Commit `46f566a` exists — FOUND

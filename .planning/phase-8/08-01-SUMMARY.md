---
phase: 08-auth-extras
plan: 01
subsystem: ui
tags: [vue, vue-router, vuex, bootstrap-vue, auth, password-reset]

# Dependency graph
requires:
  - phase: 08-auth-extras
    provides: Cypress stub (Wave 0) auth-extras.spec.js — three AUTH-01/02 it() blocks that visit /#/password-reset unauthenticated
provides:
  - AUTH-01: unauthenticated `/password-reset` page with single-input email form wired to POST /api/v2/password/reset via new `auth/requestPasswordReset` Vuex action; discoverable via new "Forgot password?" link on Login page
  - AUTH-02: same `/password-reset` page renders the two-password confirm form when `reset_key` or `activation` is in the query string; POSTs to /api/v2/password/set via new `auth/confirmPasswordReset` Vuex action; client-side min-length-4 and password-mismatch guards run before the backend call
affects: [08-02 (Wave 2 AUTH-03 session-expiry timer — independent), Phase 9 Manual UAT (will exercise the round-trip)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "single Vue component drives two form states via a `hasResetToken` computed reading $route.query.reset_key OR $route.query.activation (one page, two backend reset paths)"
    - "Vuex actions return the raw $api.$post promise — caller awaits and inspects { success, response } shape directly (mirrors profile.js:86-104)"
    - "$api.$post path uses leading-slash form WITHOUT /api/v2 prefix — the prefix is owned by core/api.js:50-52 (anti-pattern check: never duplicate it)"
    - "client-side validation is advisory only — backend re-validates server-side (owner.js:561-597); guards exist for UX, not security"
    - "mapActions REMAINS in methods: (Phase 6 G1 anti-regression)"

key-files:
  created:
    - vue/src/pages/PasswordReset/PasswordReset.vue
  modified:
    - vue/src/Routes.js
    - vue/src/store/auth.js
    - vue/src/pages/Login/Login.vue

key-decisions:
  - "One page handles both reset paths (reset_key from email-link AND activation from email-confirmation) — `hasResetToken` is an OR over both query params; submitConfirm passes both fields to the action, which conditionally includes whichever is truthy in the body"
  - "Success state replaces the form with a `Go to login` router-link rather than auto-redirecting — avoids surprising the user on slow networks where a success message would flash and disappear"
  - "No new npm packages (vue-jwt-decode is already a dependency but Wave 1 does not need it; reserved for Wave 2 AUTH-03)"
  - "No hostnameMixin on PasswordReset.vue — unauthenticated page; Vue.prototype.\$hostnames defaults render the footer hrefs"
  - "Leading-slash form `to=\"/password-reset\"` everywhere (router-link target + grep gates) — unambiguous, self-documenting; existing `to=\"login\"` quirk on Login.vue's signup link not propagated"

patterns-established:
  - "Anonymous Vuex actions (no token interaction) live alongside authenticated ones in store/auth.js — they share the `$api` client, which is transparent to token presence"
  - "One PasswordReset page collapses two backend reset paths into one route via hasResetToken — future single-use-token flows can adopt the same pattern"

requirements-completed: [AUTH-01, AUTH-02]

# Metrics
duration: ~25 min (across two executor runs)
completed: 2026-05-24
---

# Phase 8 Plan 01: Password Reset (AUTH-01 + AUTH-02) Summary

**Unauthenticated `/password-reset` page that toggles between an initiate-by-email form and a confirm-with-token form, plus two Vuex actions wrapping the existing backend `/password/reset` and `/password/set` endpoints, plus a "Forgot password?" link on the Login page so users can actually discover the new flow.**

## Performance

- **Duration:** ~25 min (split: Task 1 in prior executor run + Tasks 2-5 + SUMMARY in this run)
- **Completed:** 2026-05-24
- **Tasks:** 5
- **Files created:** 1
- **Files modified:** 3
- **Commits:** 4 (Task 1 manually committed by orchestrator after a prior executor died with a socket error; Tasks 2, 3+4, and 5 committed in this run)

## Accomplishments

- **AUTH-01 + AUTH-02 page (`vue/src/pages/PasswordReset/PasswordReset.vue`)** — single Vue 2 component with a `hasResetToken` computed (`!!$route.query.reset_key || !!$route.query.activation`) driving v-if/v-else between two forms. Initiate form: one email input + "Send reset email" button calling `this.requestPasswordReset({ email })`. Confirm form: two password inputs + "Set password" button calling `this.confirmPasswordReset({ owner, reset_key, activation, password, rpassword })`. Both forms surface `successMessage` / `errorMessage` via b-alert blocks. Confirm submit guards on `password.length < 4` and `password !== rpassword` BEFORE any backend call (ports legacy `src/assets/thinx/password.js:13-15`).
- **AUTH-01 + AUTH-02 route (`vue/src/Routes.js`)** — new top-level entry `{ path: '/password-reset', name: 'PasswordReset', component: PasswordResetPage }` inserted between `/login` and `/error`. Sibling to `/login`, NOT nested under `/app`, NO auth guard — the page is anonymous by design.
- **AUTH-01 action (`vue/src/store/auth.js`)** — new `async requestPasswordReset(_, { email })` action wrapping `this.$api.$post('/password/reset', JSON.stringify({ email }))`. Leading-slash form WITHOUT `/api/v2` prefix (owned by `core/api.js:50-52`).
- **AUTH-02 action (`vue/src/store/auth.js`)** — new `async confirmPasswordReset(_, { owner, reset_key, activation, password, rpassword })` action that builds a body with password/rpassword/owner plus whichever of reset_key/activation is truthy, then POSTs to `/password/set`. The conditional guards prevent sending an `undefined` field to the backend.
- **Discoverability (`vue/src/pages/Login/Login.vue`)** — one new `<router-link class="d-block text-center mb-2" to="/password-reset">Forgot password?</router-link>` between the password b-form-group close and the auth-widget-footer div open. No other Login.vue content touched.
- **Phase 6 G1 anti-regression preserved** — `...mapActions(...)` spread sits inside `methods: {`, never `computed: {`, on PasswordReset.vue. Confirmed by direct code-read.
- **Token-swap convention untouched** — neither new action touches `this.$api.setAccessToken` / `setRefreshToken`. The state/mutations/getters/existing actions blocks of `auth.js` are byte-identical to before the change.
- **No new npm packages** — `package.json` dependencies / devDependencies unchanged. vue-jwt-decode is already a listed dep but not used by Wave 1 (reserved for Wave 2 AUTH-03).
- **Build succeeds** — `cd vue && yarn build` exits 0 with only the pre-existing SCSS deprecation noise and entrypoint-size warnings. No new warnings introduced by this wave.

## Task Commits

Each task was committed atomically (Tasks 3+4 grouped since both append to `auth.js`):

1. **Task 1: Create `vue/src/pages/PasswordReset/PasswordReset.vue`** — `28b7d2f` (feat)
   _Note: The original Wave 1 executor wrote this file to disk but died with a socket error before staging or committing. The orchestrator manually staged and committed it after recovery; the resulting commit lives on `thinx-staging` and is byte-identical to what the executor produced._
2. **Task 2: Register `/password-reset` top-level route in `Routes.js`** — `337429d` (feat)
3. **Tasks 3+4: Add `requestPasswordReset` + `confirmPasswordReset` Vuex actions in `auth.js`** — `099cd66` (feat)
4. **Task 5: Add "Forgot password?" router-link on `Login.vue`** — `8878ef1` (feat)

## Files Created/Modified

- **`vue/src/pages/PasswordReset/PasswordReset.vue`** (NEW, committed in `28b7d2f`) — Vue 2 single-file component, ~80 lines. Template: auth-page wrapper → b-container → Widget (customHeader, title "Password Reset") → two mutually exclusive forms gated by `hasResetToken` → footer with $hostnames links. Script: data() with email/password/rpassword/errorMessage/successMessage/submitting; computed `hasResetToken`; methods with `...mapActions({ requestPasswordReset, confirmPasswordReset })` spread plus `submitInitiate()` and `submitConfirm()` async handlers with try/catch/finally and explicit submitting reset.
- **`vue/src/Routes.js`** (MODIFIED) — added one import line (`import PasswordResetPage from '@/pages/PasswordReset/PasswordReset';`) below the existing Login import, and one route block (`{ path: '/password-reset', name: 'PasswordReset', component: PasswordResetPage }`) between the `/login` and `/error` route blocks. Diff: +6 / -0.
- **`vue/src/store/auth.js`** (MODIFIED) — appended two async actions inside the existing `actions: { ... }` block immediately after `isTokenValid`. The trailing `}` on `isTokenValid` was changed to `},` to make the block list-syntax valid. Diff: +10 / -1.
- **`vue/src/pages/Login/Login.vue`** (MODIFIED) — inserted one `<router-link>` between the password b-form-group close and the auth-widget-footer div open. Diff: +1 / -0.

## Decisions Made

- **One page for both backend reset paths.** The backend supports two reset entry points sharing `/password/set`: one driven by `reset_key` (email-link reset) and one driven by `activation` (email-confirmation flow). Rather than fork into two routes, `hasResetToken` ORs both query params and `submitConfirm` passes both fields to the action with truthy guards in the action body. This collapses two flows into one URL with zero ambiguity for the backend.
- **No auto-redirect after successful confirm.** The success state explicitly renders a `Go to login` router-link instead of triggering `router.push('/login')`. A toast-then-redirect would risk the success message flashing and disappearing on slow networks before the user notices.
- **Truthy guards over `?? null` for optional body fields.** `if (reset_key) body.reset_key = reset_key` (truthy guard) is preferred over `body.reset_key = reset_key ?? undefined` because the backend would have to differentiate between "field missing" and "field present but undefined" otherwise. Sending only the fields the caller provided is cleaner.
- **Leading-slash form `to="/password-reset"` everywhere.** The existing "Create an Account" link on Login.vue uses `to="login"` (no slash) for legacy reasons, which resolves relative to the current route. The new link uses the absolute form for unambiguous routing and consistency with the route table.

## Deviations from Plan

None — Rules 1-4 did not fire. The plan as written matched the codebase shape exactly. No new bugs, no missing critical functionality, no blocking issues, no architectural changes required.

The only non-plan event was the prior executor's socket-error crash mid-Task-1, recovered by the orchestrator manually staging and committing the already-written file. This is documented in **Task Commits** above and is not a deviation from the plan's intent.

## Auth Gates

None — Wave 1 introduces unauthenticated flows; no API key, OAuth token, or login was required to develop or build the changes.

## Known Stubs

None. All forms are wired end-to-end to the new Vuex actions, which call real backend endpoints. The Cypress specs (`vue/cypress/integration/auth-extras.spec.js` lines 9, 11, 13) are intentional Phase 9 UAT stubs left in place per project convention (memory: `thinx-console-vue-conventions`) — they are not Wave-1 deliverables and the plan's `success_criteria` does not require Cypress assertions.

## Threat Flags

None — the threat surface mapped in the plan's `<threat_model>` block (`T-08-01-01` through `T-08-01-SC`) covers every new trust boundary introduced. No additional network endpoints, auth paths, file access patterns, or schema changes were added beyond what the plan anticipated.

## Issues Encountered

- **Prior executor crash (recovered).** The first Wave 1 executor wrote `PasswordReset.vue` to disk but died with a socket error before staging or committing. The orchestrator manually committed the file (`28b7d2f`) and spawned a fresh executor (this run) to complete Tasks 2-5. No content was lost; the resumed executor verified Task 1's commit was in place before continuing.

## Verification

- **`node --check vue/src/Routes.js`** — exit 0 (syntactically valid JS).
- **`node --check vue/src/store/auth.js`** — exit 0 (syntactically valid JS).
- **`cd vue && yarn build`** — `DONE Build complete.` Pre-existing SCSS deprecation + entrypoint-size warnings only; no new warnings introduced by this wave. `PasswordReset.vue` is now imported via the route, so the build exercises it end-to-end.
- **Task 2 grep gates** — all pass: `name: 'PasswordReset'` = 1, `path: '/password-reset'` = 1, `PasswordResetPage` = 2 (import + reference), `path: '/login'` = 1 (preserved).
- **Task 3 grep gates** — all pass: `requestPasswordReset` = 1, `/password/reset` = 1, `/api/v2/password` = 0 (no duplicated prefix).
- **Task 4 grep gates** — all pass: `confirmPasswordReset` = 1, `/password/set` = 1, `/api/v2/password` = 0.
- **Task 5 grep gates** — all pass: `Forgot password` = 1, `to="/password-reset"` = 1.
- **Cypress unauthenticated check (verification step 9)** — `grep -rn 'cy.login' vue/cypress/integration/` confirms only the AUTH-03 it() block at `auth-extras.spec.js:15` calls `cy.login()`; AUTH-01 and AUTH-02 specs (lines 9, 11, 13) remain unauthenticated as required.
- **Phase 6 G1 anti-regression** — confirmed via direct read of PasswordReset.vue: `...mapActions(...)` spread sits inside `methods: {`, never `computed: {`.
- **Token-swap untouched** — confirmed via direct read of auth.js: state/mutations/getters and the original three actions (removeAccessToken/removeRefreshToken/isTokenValid) are byte-identical; only two new actions appended.

## Manual Verification Suggested

These were not exercised in this run (no dev server, no deploy); to be confirmed in a browser once `console.thinx.cloud` is updated:

1. **Initiate form renders unauthenticated:** visit `/#/password-reset` while logged out. The single-input email form must render — NO redirect to `/login`, NO blank page, NO console errors.
2. **Confirm form renders with reset_key:** visit `/#/password-reset?reset_key=abc&owner=test` while logged out. The two-password confirm form must render; the initiate form must be hidden.
3. **Confirm form renders with activation:** visit `/#/password-reset?activation=xyz&owner=test`. The confirm form still renders (hasResetToken returns true for activation alone).
4. **Client-side mismatch guard:** in the confirm form, submit with mismatched passwords. The red `Passwords do not match.` alert must appear and NO network request fires (verify in browser devtools Network tab).
5. **Client-side min-length guard:** in the confirm form, submit with a 3-char password. The red `Password must be at least 4 characters.` alert must appear; NO network request fires.
6. **Forgot password link works:** on `/#/login`, click "Forgot password?". Router must navigate to `/#/password-reset` and the initiate form renders.
7. **Backend round-trip:** (Phase 9 UAT scope) submit a real email; observe the backend response surfaced via the green success alert or red danger alert.

## User Setup Required

None — no external services configured. Backend endpoints (`POST /api/v2/password/reset`, `POST /api/v2/password/set`) have shipped for years (lib/router.user.js:144-156, lib/thinx/owner.js:480-658).

**Deploy reminder:** Per memory `deployment-console-thinx-cloud`, pushing this repo does NOT deploy `console.thinx.cloud`. The user handles the parent meta-repo submodule bump separately; do NOT push from this executor.

## Next Phase Readiness

- **Wave 2 (08-02 — AUTH-03 session-expiry timer) is unblocked.** Nothing in PasswordReset.vue, the new auth actions, or the Login link constrains AUTH-03's `scheduleExpiry` timer + boot wiring. vue-jwt-decode (already a dep) is reserved for that wave.
- **Phase 9 Manual UAT** will exercise the backend round-trip (real email send via SMTP, real token consumption, real password update). The Cypress stubs at `auth-extras.spec.js:9,11,13` remain pending it() blocks for that phase to flesh out.
- **No carry-over blockers** for Wave 2 or Phase 9.

## Self-Check: PASSED

- `vue/src/pages/PasswordReset/PasswordReset.vue` — exists (verified via `ls`), committed in `28b7d2f`.
- `vue/src/Routes.js` — modified, contains `PasswordResetPage`, `name: 'PasswordReset'`, `path: '/password-reset'`. Committed in `337429d`.
- `vue/src/store/auth.js` — modified, contains `requestPasswordReset`, `confirmPasswordReset`, `/password/reset`, `/password/set`. No `/api/v2/password` duplication. Committed in `099cd66`.
- `vue/src/pages/Login/Login.vue` — modified, contains `Forgot password` and `to="/password-reset"`. Committed in `8878ef1`.
- Commit `28b7d2f` — present in `git log` (Task 1, committed manually by orchestrator after prior-executor crash).
- Commit `337429d` — present in `git log` (Task 2).
- Commit `099cd66` — present in `git log` (Tasks 3+4).
- Commit `8878ef1` — present in `git log` (Task 5).
- `yarn build` — succeeded; no new warnings.

---
*Phase: 08-auth-extras*
*Completed: 2026-05-24*

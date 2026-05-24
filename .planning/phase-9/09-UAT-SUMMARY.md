---
phase: 09-manual-uat-review
status: code-complete (live-walked AC items; AC-DEST + HN deferred to user)
created: 2026-05-24
updated: 2026-05-24
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
| AUTH-03 timer | **partial — see G5** | localStorage clear works, /login redirect doesn't survive subsequent navigations |
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
status: open (Phase 8 follow-up — quick task scope, ~5 LOC)
severity: medium
file: `vue/src/Routes.js` (add `router.beforeEach`)
detail: AUTH-03 correctly tears down the session (localStorage cleared,
store tokens nulled), but `window.location.hash = '#/login'` is a
one-shot side-effect. Any subsequent client-side `router.push` to
`/app/*` succeeds and leaves the page in a "ghost" state — Vue router
renders the page, every API call 403s, no UI feedback. Discovered
directly during the live walk against the user's expired session.
fix: add a global `router.beforeEach((to, from, next) => { ... })`
guard checking `store.getters['auth/isAuthenticated']` for any path
under `/app/` and pushing `/login` if false.
detail in: `.planning/phase-8/08-HUMAN-UAT.md#G5`

### G6 — buildHash on Login footer shows "dev" instead of git SHA
status: open (CI config follow-up, cosmetic)
severity: low
file: parent `.circleci/config.yml` `build-vue-console` job and console
repo `.circleci/config.yml` `vue` job
fix: add `--build-arg VUE_APP_BUILD_HASH=$(echo $CIRCLE_SHA1 | cut -c -7)`
to both jobs' `extra_build_args` so the Login page footer shows the
real commit SHA (`Login.vue:110` already reads
`process.env.VUE_APP_BUILD_HASH || 'dev'`).
detail in: `.planning/phase-8/08-HUMAN-UAT.md#G6`

## REQUIREMENTS.md traceability flips

Items moving Pending → Verified based on this Phase 9 live walk:

- DASH-01..03, DASH-05 (DASH-04 widget verified; zip-download deferred)
- HIST-01, HIST-02, HIST-04, HIST-05 (HIST-03 untestable on this account)
- AUTH-01, AUTH-02 (the page + both form modes + login link; full
  email round-trip deferred)
- AUTH-03 (partial — code path verified live; full redirect fix is G5)

Items staying Pending pending user action:

- PROF-01, PROF-02, PROF-04 (negative), PROF-05, PROF-06
- DASH-04 (full zip download)
- AUTH-02 (full email round-trip)
- AUTH-03 (full /login redirect — depends on G5 fix)
- DEVI-05, DEVI-06, DEVI-09 (live destructive re-test)

## Bundle verification

Confirmed deployed bundle contains all expected phase markers:

| Phase | Markers | Count |
|-------|---------|-------|
| 6 | `uploadAvatar`, `avatarSrc`, `saveProfile` | 4 / 2 / 5 |
| 7 | `HistoryAudit`, `HistoryBuilds`, `auditFlagFilter`, `expandedBuilds`, `logIsTruncatable` | 2 / 3 / 10 / 5 / 2 |
| 8 | `scheduleExpiry`, `clearSession`, `expiryTimerId`, `requestPasswordReset`, `confirmPasswordReset` | 10 / 7 / 8 / 4 / 4 |

Bundle `last-modified: Sun, 24 May 2026 08:01:25 GMT`.

---
status: pending (ADMIN-02 + ADMIN-03 + ADMIN-03 audit-log walks outstanding; ADMIN-01 + ADMIN-03-negative already covered by admin.spec.js assertions)
phase: 10-admin-features
source: [10-00-SUMMARY.md, 10-01-SUMMARY.md, 10-02-SUMMARY.md, 10-03-SUMMARY.md]
created: 2026-05-25
updated: 2026-05-25
live_walked_at: TBD
deploy_confirmed: console.thinx.cloud bundle last-modified 2026-05-25 12:50 UTC; GET /api/v2/admin/users → 401 (endpoint reachable, auth-gated); parent deploy commit 55312da6 (2026-05-24 22:52 CET) bumped services/console e0a860e2 → 350a7eb4
---

## Walk results (fill in during live UAT)

| Item | Result | Evidence |
|------|--------|----------|
| ADMIN-01 page + table + pagination | pending | (Cypress already asserts this — confirm in browser to flip REQUIREMENTS) |
| ADMIN-02 revoke modal + force-logout | pending | |
| ADMIN-02 second-browser 401 after revoke | pending | |
| ADMIN-03 impersonate modal + banner + countdown | pending | |
| ADMIN-03 impersonation render (target's profile) | pending | |
| ADMIN-03 banner survives reload | pending | |
| ADMIN-03 exit-to-login + localStorage clear | pending | |
| ADMIN-03 negative — non-admin route guard redirect | pending | |
| ADMIN-03 negative — non-admin curl → 403 | pending | |
| ADMIN-03 negative — admin row hides Impersonate (Cypress asserted) | pending | (confirm in browser) |
| Audit-log surfacing under "admin" flag | pending | |

## Prerequisites

- **URL:** https://console.thinx.cloud (NOT localhost — Phase 10 is deployed)
- **Admin account:** `vue/cypress/fixtures/thinx.json` (`test` user — `admin === true`)
- **Non-admin account:** bring a second account (or create one via the legacy console — Vue console signup is G11 / future AUTH-04)
- **Second browser:** for the ADMIN-02 force-logout cross-check (a private/incognito window also works)
- **DevTools:** Console + Application/Storage tabs open throughout

## Tests

### 1. ADMIN-01 — Admin user-list page renders with table + pagination

walk: Login as admin → click sidebar **Admin Console** link (Phase 10 Wave 3 NavLink, gated by `profile.admin === true`) → land on `/#/app/admin/users`.

expected: Page loads. Plain `<table class="table table-striped">` populated with rows showing `username`, `email`, `admin` (`Yes` / `No`), `created`, `last_login`, `devices` (reads `0` — v1 placeholder per locked OQ-B). Pagination controls below table: `Prev` / `Next` buttons + "Page 1 / N" text.

result: code pass (Cypress assertion in `admin.spec.js:10-16`). **Phase 10 live: confirm the page renders against the production backend's user list; flip ADMIN-01 row in REQUIREMENTS.md (already Verified per Wave 3 commit `9dc9d84`).**

---

### 2. ADMIN-02 — Revoke modal + force-logout (destructive)

walk: On `/#/app/admin/users`, find a **non-admin** row (a throwaway account, NOT the `test` admin fixture). Click row's **Revoke** button.

expected:
- `$bvModal.msgBoxConfirm` modal opens with target username in the prompt.
- Click **Force logout** → modal closes → success toast / alert.
- The target user's existing JWT is now in the Redis blacklist (Phase 10 Wave 1 backend, commits `0acc95d4` + `0652c127`).

cross-check (second browser): Before the revoke, log into the target account in a private/incognito window so you have a live session. Trigger any API call after the revoke (any sidebar click works) → expect **401** in the network tab → next request should kick the user to `/#/login` via the router guard.

result: code pass (Vuex `admin/revokeSession` action wired to `DELETE /api/v2/admin/session/:owner`; modal mirrors `Profile.vue#confirmDeleteAccount`). **Phase 10 live: required to flip ADMIN-02 from Code-verified → Verified in REQUIREMENTS.md.**

---

### 3. ADMIN-03 — Impersonate modal + banner + countdown + exit

walk: On `/#/app/admin/users`, find a **non-admin** row. Click row's **Impersonate** button.

expected:
- Confirm modal opens.
- Click **Impersonate** → page navigates to `/#/app/dashboard`.
- Yellow **ImpersonationBanner** appears sticky at the top of `<router-view>` (mounted in `Layout.vue`, commit `358bd95`) showing:
  - `🎭 Impersonating <target-username>`
  - `expires in 14:59` countdown, ticking down 1s at a time (15-min JWT lifetime per `JWTLogin.sign_with_impersonation`, commit `86022ed6`).
  - `[Exit impersonation]` button.

result: code pass. **Phase 10 live: required to flip ADMIN-03 positive from Code-verified → Verified.**

---

### 4. ADMIN-03 — Impersonation actually renders target's data

walk: While impersonating, navigate to `/#/app/profile`.

expected: The page shows the **target user's** profile (username, email, etc.), NOT the admin's.

cross-check (reload): While impersonating, hard-reload the page. The banner reappears — `decode()` runs in `created()` of `ImpersonationBanner.vue` and re-reads the impersonation JWT claim.

result: code pass (`router.js` JWT-verify enriches `req.session.impersonator_owner`; backend serves the impersonated owner's data). **Phase 10 live: required to flip ADMIN-03 positive → Verified.**

---

### 5. ADMIN-03 — Exit impersonation cleanly

walk: Click the banner's **Exit impersonation** button.

expected:
- Window navigates to `/#/login` (via `window.location.hash` per Phase 8 `clearSession` convention — store has no `$router`).
- DevTools → Application → Local Storage → all three keys cleared (`access_token`, `refresh_token`, `authenticated`).
- Banner disappears.
- Re-login as admin works normally (no stale impersonation claim leaks into the new session).

result: code pass (banner exit dispatches `auth/clearSession` per Phase 8 Wave 2 chokepoint). **Phase 10 live: required to flip ADMIN-03 positive → Verified.**

---

### 6. ADMIN-03 negative — Non-admin can't reach admin routes (UI guard)

walk: Logout. Login as the **non-admin** account. Try to visit `/#/app/admin/users` directly via address bar.

expected: `Routes.js#beforeEach` redirects to `/#/app/dashboard` immediately. (UX guard — the real security boundary is the backend 403 in test 7.)

result: code pass (`ADMIN_PATHS` guard extension in `Routes.js`, commit `dea8390`). **Phase 10 live: required to flip ADMIN-03 negative → Verified.**

---

### 7. ADMIN-03 negative — Non-admin gets 403 from backend

walk: As the same non-admin user, grab the JWT from `localStorage.access_token` (DevTools → Application → Local Storage). Run:

```bash
curl -i -H "Authorization: Bearer <non-admin-jwt>" https://console.thinx.cloud/api/v2/admin/users
```

expected: HTTP **403 Forbidden** (from `requireAdmin` middleware, commit `87b748b3`). NOT 401 (that would mean the token is invalid, not that the role check failed) and NOT 200 (would mean the role check is broken).

result: code pass. **Phase 10 live: required to flip ADMIN-03 negative → Verified.** This is the actual security boundary; the UI guard in test 6 is best-effort UX.

---

### 8. ADMIN-03 negative — Admin row hides the Impersonate button

walk: On `/#/app/admin/users`, locate a row where the **Admin** column reads `Yes`. Inspect the row's action cell.

expected: Only the **Revoke** button is present. **No Impersonate button** is rendered for admin rows (locked OQ — Cypress assertion in `admin.spec.js:28-33` asserts this).

result: code pass (Cypress asserted + backend rejects with 403 if anyone bypasses the UI). **Phase 10 live: confirm visually; flip ADMIN-03 negative → Verified (already Verified per Wave 3 commit `9dc9d84`).**

---

### 9. Audit-log surfacing — impersonation actions show under "admin" flag

walk: While impersonating (test 3 — re-impersonate if you've exited), perform a couple of actions (e.g. navigate to `/#/app/devices`, click any device, navigate back). Then exit impersonation and re-login as admin.

Open `/#/app/history/audit`. Filter by the `admin` flag (via the History page's flag-filter, Phase 7 Wave 2).

expected:
- The impersonation **start** event appears (logged by `router.admin.js` POST `/impersonate`).
- Every action performed under impersonation appears with `flags: ['admin', 'impersonation']`.
- Existing rows under `info` / `danger` flag filters are unaffected (Phase 7 anti-regression).

result: code pass (`audit.js` patch in commit `cfc4fecb` enables flag-array writes; `router.js` JWT-verify enrichment writes audit rows under impersonation). **Phase 10 live: confirms the audit trail closes the loop — admins are visible to admins.**

---

## Wrap-up

When tests 2-7 + 9 pass live, flip ADMIN-02 + ADMIN-03 in `REQUIREMENTS.md` from `Code-verified (Phase 10 — pending live UAT)` → `Verified (Phase 10 live UAT 2026-MM-DD)`. Update this file's frontmatter `status: pass` + `live_walked_at:` with the date. Then close out Phase 10 — ROADMAP.md is already `Complete (2026-05-24)`.

## Out-of-scope / known follow-ups (not Phase 10 closure items)

- Real `device_count` aggregation per user — locked OQ-B, v1.1 follow-up.
- History page `flagFilterOptions` extension to natively include `admin` + `impersonation` chips — research §A9 footnote; polish, not blocking.
- Vue console signup form — Phase 9 gap G11, routes to v1.1 as AUTH-04.

---
status: pass (live UAT accepted 2026-05-26 — ADMIN-01/02/03 all confirmed against bundle `26c910a`; one v1.x backlog note captured for admin user-list search/filter)
phase: 10-admin-features
source: [10-00-SUMMARY.md, 10-01-SUMMARY.md, 10-02-SUMMARY.md, 10-03-SUMMARY.md]
created: 2026-05-25
updated: 2026-05-26
live_walked_at: console.thinx.cloud 2026-05-26 (bundle `26c910a`, last-modified 2026-05-25 21:56 UTC)
deploy_confirmed: console.thinx.cloud bundle last-modified 2026-05-25 21:56 UTC; buildHash "26c910a" matches parent commit `26c910ad` (sync console at ba13b451). Manual `./scripts/stack-deploy` on swarm manager was required to force the pull — auto-pull mechanism stopped working after 14:44 CET on 2026-05-25 (not yet diagnosed; tracked as separate operational follow-up).
---

## Walk results (live UAT 2026-05-26)

| Item | Result | Evidence |
|------|--------|----------|
| ADMIN-01 page + table + pagination | pass | live walk on console.thinx.cloud (also asserted by Cypress ADMIN-01) |
| ADMIN-02 revoke modal + force-logout | pass | live walk |
| ADMIN-02 second-browser 401 after revoke | pass | live walk |
| ADMIN-03 impersonate modal + banner + countdown | pass | live walk |
| ADMIN-03 impersonation render (target's profile) | pass | live walk |
| ADMIN-03 banner survives reload | pass | live walk |
| ADMIN-03 exit-to-login + localStorage clear | pass | live walk |
| ADMIN-03 negative — non-admin route guard redirect | pass | live walk |
| ADMIN-03 negative — non-admin curl → 403 | pass | live walk |
| ADMIN-03 negative — admin row hides Impersonate | pass | live walk (also Cypress ADMIN-03-neg) |
| Audit-log surfacing under "admin" flag | pass | live walk |

## Acceptance note (2026-05-26)

User accepted Phase 10 with one **future enhancement** request: the admin user list should be **searchable/filterable**. Today the list is paginated only; for larger fleets a search input (across `username` / `email`, with a `q=` query param on the server) would scale better. Captured in `REQUIREMENTS.md` v1.x backlog notes — not a blocker for Phase 10 close-out.

## Prerequisites

- **URL:** https://console.thinx.cloud (NOT localhost — Phase 10 is deployed)
- **Admin account:** Throw Away — manually promoted via `scripts/set-admin.sh` (parent monorepo). **The `test`/`tset` Cypress fixture must NEVER be promoted to admin** — those credentials have leaked, and they stay non-admin forever. CI's `admin.spec.js` reads dedicated admin creds from `Cypress.env('ADMIN_USER' / 'ADMIN_PASS')` (CYPRESS_* context env vars on `gh/thinx-cloud/console`).
- **Non-admin account:** the `test`/`tset` fixture (or any other non-admin) for the Revoke + Impersonate targets.
- **Second browser:** for the ADMIN-02 force-logout cross-check (a private/incognito window also works).
- **DevTools:** Console + Application/Storage tabs open throughout.

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

## Wrap-up — CLOSED 2026-05-26

ADMIN-01 + ADMIN-02 + ADMIN-03 all flipped to `Verified` in `REQUIREMENTS.md` against bundle `26c910a`. ROADMAP.md remained `Complete (2026-05-24)` from the code-ship date; this file's frontmatter now `status: pass`. Phase 10 closed.

## Out-of-scope / known follow-ups (deferred to v1.x — not Phase 10 closure items)

- Admin user-list **search/filter** — captured 2026-05-26 from this UAT acceptance. Server-side `q=` param + debounced input on `AdminUsers.vue`.
- Real `device_count` aggregation per user — locked OQ-B.
- History page `flagFilterOptions` extension to natively include `admin` + `impersonation` chips — research §A9 footnote; polish, not blocking.
- Vue console signup form — Phase 9 gap G11, routes to v1.1 as AUTH-04.
- Diagnose swarm-side auto-pull failure that started ~2026-05-25 evening (manual `./scripts/stack-deploy` worked; root cause unknown).
- `cy.login(user, pass)` ignores its arguments (commands.ts:43) — latent bug surfaced during Phase 10 Wave 3 fix; harmless today since all 7 non-admin specs rely on current fixture-only behavior, but should be fixed before any future cred-parameterized test.

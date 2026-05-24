---
phase: 10-admin-features
plan: 00
wave: 0
executed: 2026-05-24
type: execute
status: complete
repo: console-submodule
files_modified:
  - vue/cypress/integration/admin.spec.js
requirements:
  - ADMIN-01 (stubbed — assertion lands in Wave 3)
  - ADMIN-02 (stubbed — assertion lands in Wave 3)
  - ADMIN-03 (stubbed — assertion lands in Wave 3)
tags:
  - cypress
  - e2e
  - test-stub
  - vue
  - admin
---

# Wave 0 — Admin Cypress Stub Summary

## Outcome

Created `vue/cypress/integration/admin.spec.js` (18 LOC) — the
no-assertion Cypress stub for the Phase 10 Admin Features. Mirrors
the canonical authenticated-stub shape from `history.spec.js` /
`profile.spec.js`: `cy.viewport(1536, 754)`, `cy.login()`,
`cy.visit('http://localhost:3000/#/app/admin/users')` all live in
`beforeEach`. Four `it()` blocks, one TODO comment per body, no
assertions:

| # | Title | Wave 3 work |
|---|---|---|
| 1 | renders admin user-list page with pagination (ADMIN-01) | assert `<table class="table table-striped">` + Prev/Next |
| 2 | confirmation modal then revoke sessions on confirm (ADMIN-02) | `cy.intercept` `DELETE /api/v2/admin/session/:owner` + assert toast |
| 3 | confirmation modal then start impersonation on confirm (ADMIN-03) | assert ImpersonationBanner + JWT `impersonator_owner` claim |
| 4 | hide Impersonate action on admin rows (ADMIN-03 negative) | assert no Impersonate button on admin-badged rows |

## Plan acceptance gates

All 7 automated gates pass:

| Gate | Expected | Actual |
|---|---|---|
| `node --check` | exits 0 | exits 0 |
| `grep -c '^  it('` | 4 | 4 |
| `grep -c 'it.only'` | 0 | 0 |
| `grep -c 'cy.login()'` | 1 | 1 |
| `grep -c "describe('Admin Features feature'"` | 1 | 1 |
| `grep -c 'TODO ADMIN-'` | ≥ 4 | 4 |
| `grep -c "cy.visit.*app/admin/users"` | 1 | 1 |

Manual-read criteria:
- No `cy.get` / `cy.intercept` / `cy.wait` / assertion calls — the
  string `cy.intercept` appears only inside the ADMIN-02 TODO comment
  as a forward reference to Wave 3 work, not as a call.
- `beforeEach` contains exactly the 3 calls in the prescribed order:
  viewport → login → visit.
- Single trailing newline; formatting mirrors `history.spec.js`
  verbatim.

## Verification beyond the gates

- `cy.visit('http://localhost:3000/#/app/admin/users')` deliberately
  references a route that will land in Wave 2. Running this spec
  against the current bundle redirects to `/app/dashboard` (the new
  router.beforeEach guard at `vue/src/Routes.js:131-144` allows
  authenticated users on `/app/*` paths). That's expected and
  documented in the plan's `<threat_model>` T-10-00-03.
- No other Cypress spec was modified. `git diff vue/cypress/integration/`
  shows exactly one new file.
- No new npm packages — `vue/package.json` untouched.

## Threats — disposition

| ID | Status | Note |
|---|---|---|
| T-10-00-01 | accepted | Test creds in `cypress/fixtures/thinx.json` are dev-only; pre-existing pattern across Phases 4–8. |
| T-10-00-02 | mitigated | Stub contains no secrets, no `eval`, no arbitrary `require`. Only `describe` / `it` / `cy.*` calls. |
| T-10-00-03 | accepted | Premature reference to `/app/admin/users` redirects (not 403s) at this wave. No privilege boundary crossed. |
| T-10-00-SC | accepted | No new npm dependencies. Cypress 9.5.4 already pinned. |

## What unblocks next

- **Wave 1 (backend):** has no dependency on this stub — backend can ship into the parent monorepo in parallel.
- **Wave 2 (frontend):** makes the spec actually runnable when `/app/admin/users` lands.
- **Wave 3 (close-out):** flips the four TODO comments into real `cy.get` / `cy.intercept` assertions and the green-flip.

## Commit

`chore(10-00): seed admin.spec.js Cypress stub (ADMIN-01..03 + negative)` — single commit in the console submodule.

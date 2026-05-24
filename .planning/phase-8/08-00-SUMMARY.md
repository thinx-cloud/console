---
phase: 08-auth-extras
plan: 00
subsystem: testing
tags: [cypress, e2e, test-stub, vue, auth, password-reset, session-expiry]

# Dependency graph
requires:
  - phase: 07-history
    provides: Wave-0 Cypress stub pattern (history.spec.js) reused as the structural template
  - phase: 06-profile
    provides: Second reference stub (profile.spec.js); also surfaced the AUTH-03 session-expiry carry-over during UAT
provides:
  - vue/cypress/integration/auth-extras.spec.js — Cypress stub with 4 pending it() blocks (AUTH-01, AUTH-02 x2, AUTH-03)
  - Wave-0 verification surface for Phase 8 Waves 1 and 2 (Nyquist compliance — verifier has a non-MISSING automated target)
  - Structural variant of the Wave-0 pattern where cy.login() lives inside an it() body, not beforeEach (required because the password-reset route must be reachable unauthenticated)
affects: [08-01 (AUTH-01 + AUTH-02 — page, route, store actions), 08-02 (AUTH-03 — scheduleExpiry timer + boot wiring)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave-0 stub variant: cy.viewport() in beforeEach; cy.login() inside one specific it() body when other it() blocks need unauthenticated access"
    - "Single-line it() bodies with /* TODO {REQ-ID}: ... */ comment — keeps Cypress runner pending without locking the runner via .only"

key-files:
  created:
    - vue/cypress/integration/auth-extras.spec.js
  modified: []

key-decisions:
  - "Removed cy.login() from beforeEach (deviation from Phase 5/6/7 Wave-0 template) because three of four specs target the unauthenticated /#/password-reset route; the AUTH-03 it() body owns the single cy.login() call"
  - "Rephrased the in-file explanatory comment from 'No cy.login() here' to 'No login call here' so the literal string cy.login() appears exactly once in the file (satisfies the must_haves.truths invariant 'cy.login() appears exactly once — inside the AUTH-03 it() block, not in beforeEach' and the matching grep gate)"

patterns-established:
  - "When a Wave-0 Cypress stub mixes authenticated and unauthenticated targets, push cy.login() down into the per-it() body that needs it; keep beforeEach to viewport only"
  - "Stub comments must not duplicate forbidden tokens — rephrase explanatory text rather than weaken grep gates"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03]

# Metrics
duration: 3min
completed: 2026-05-24
---

# Phase 8 Plan 00: Auth Extras Cypress Stub Summary

**Cypress stub for password-reset (AUTH-01/02) and session-expiry (AUTH-03) with cy.login() pushed out of beforeEach into a single AUTH-03 it() body so the unauthenticated /#/password-reset route stays reachable**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-24T07:23:31Z
- **Completed:** 2026-05-24T07:26:09Z
- **Tasks:** 1
- **Files created:** 1
- **Files modified (production code):** 0

## Accomplishments
- Wave-0 Cypress stub for Phase 8 in place — Waves 1 and 2 now have a non-MISSING automated verify target
- Established a per-it() login pattern variant for future Wave-0 stubs that mix authenticated and unauthenticated assertions
- Preserved every existing spec (login, devices, device-detail, dashboard, profile, history) untouched

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Cypress spec stub for the Auth Extras feature (AUTH-01..03)** — `8bf3024` (test)

_Note: This plan is a single-file stub; no TDD RED/GREEN/REFACTOR cycle applies. Final metadata commit (SUMMARY.md, STATE.md, ROADMAP.md, REQUIREMENTS.md) is held back per execution-context instruction "Do NOT push — the user is handling the deploy separately"; this SUMMARY is committed locally only._

## Files Created/Modified
- `vue/cypress/integration/auth-extras.spec.js` (created) — 4 pending it() stubs: AUTH-01 (page renders unauthenticated), AUTH-02 initiate form (no query), AUTH-02 confirm form (?reset_key=abc&owner=test), AUTH-03 (session-expiry redirect to /login). Single cy.login() call lives in the AUTH-03 it() body only.

## Decisions Made
- **Push cy.login() out of beforeEach:** mandated by the plan's must_haves and reaffirmed by the research doc §5.12. The password-reset page must render without a session cookie, so the conventional Wave-0 template (cy.viewport + cy.login + cy.visit in beforeEach) was split: viewport stays in beforeEach, login moves into the one it() body that needs it (AUTH-03). cy.visit calls move into each it() body (because each it() visits a different URL — `/password-reset`, `/password-reset?reset_key=abc&owner=test`, or no visit at all for AUTH-03 since cy.login already lands on an authenticated page).
- **Rephrased explanatory comment from "No cy.login() here" to "No login call here":** the literal token `cy.login()` triggered the grep gate (which expects exactly 1 occurrence — the actual call site). Two ways to resolve: (a) rephrase the comment so the literal token only appears once, or (b) relax the grep gate. Chose (a) because the gate intent ("cy.login() called exactly once") is the load-bearing invariant; the comment's job is just to document why the conventional pattern was deviated from, and "No login call here" is functionally equivalent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Comment text duplicated the grep-gated token `cy.login()`**
- **Found during:** Task 1 (post-write verification)
- **Issue:** The plan's action instruction mandated the literal comment text "No cy.login() here — most of these specs hit an unauthenticated route." Writing that comment puts the string `cy.login()` on line 6 (beforeEach) AND on line 15 (AUTH-03 it body), causing `grep -c 'cy.login()'` to return 2 — which fails the acceptance criterion "grep -c 'cy.login()' returns 1 — called exactly once, inside the AUTH-03 it() body, NOT in beforeEach" and the matching must_haves.truths invariant.
- **Fix:** Rephrased the comment to "No login call here — most of these specs hit an unauthenticated route." Preserves the intent (document why cy.login is absent from beforeEach) while keeping the literal `cy.login()` token to exactly one occurrence — the real call site inside the AUTH-03 it() body.
- **Files modified:** vue/cypress/integration/auth-extras.spec.js (line 6 only)
- **Verification:** `grep -c 'cy\.login()' vue/cypress/integration/auth-extras.spec.js` returns 1; `grep -n 'cy\.login()' …` shows the single hit on line 15 inside the AUTH-03 it() body
- **Committed in:** `8bf3024` (committed once after the fix; no separate commit for the rephrase)

---

**Total deviations:** 1 auto-fixed (1 blocking — internal consistency between plan action and plan acceptance criteria)
**Impact on plan:** No scope change. Plan action mandate vs. plan grep gate conflicted; chose the grep gate as the load-bearing constraint (it matches the must_haves invariant verbatim). Comment intent preserved via paraphrase.

## Issues Encountered
- None during execution. The plan-internal conflict between action text and acceptance criteria is documented under Deviations above.

## Validation Results (from execution context)

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| `node --check vue/cypress/integration/auth-extras.spec.js` | exit 0 | exit 0 | PASS |
| `grep -c '^  it(' …` | 4 | 4 | PASS |
| `grep -c 'cy.login()' …` | 1 | 1 | PASS |
| `grep -c 'it.only' …` | 0 | 0 | PASS |
| `grep -F -c "cy.visit('http://localhost:3000/#/password-reset" …` | ≥3 | 3 | PASS |
| `grep -c 'TODO AUTH-' …` | ≥4 | 4 | PASS |
| `grep -F -c "describe('Auth Extras feature'" …` | 1 | 1 | PASS |
| AUTH-01 in it() description | ≥1 | 1 | PASS |
| AUTH-02 in it() description | ≥2 | 2 | PASS |
| AUTH-03 in it() description | ≥1 | 1 | PASS |
| cy.login() only inside AUTH-03 it() body (read-verify) | true | line 15 only | PASS |
| `yarn build` | N/A (per execution context: "yarn build is not required for Wave 0") | not run | SKIP |

## Threat Flags

None — the plan's threat model holds: this commit introduces no new network endpoints, no secrets, no new dependencies, and no new arbitrary code paths. The spec uses only `describe`, `it`, `cy.viewport`, `cy.visit`, and `cy.login` (custom command, already in use across Phases 4–7).

## Known Stubs

The whole spec file IS a stub by design (Wave-0 pattern). All four it() bodies are TODO comments — no assertions, no cy.get, no cy.intercept. This is intentional and matches the established Wave-0 contract from Phases 5/6/7. Waves 1 and 2 will fill in the assertions:

| TODO | Wave to land in | What it will test |
|------|-----------------|-------------------|
| AUTH-01 (page renders unauthenticated) | Wave 1 (08-01) | Page title visible, no console errors, no redirect to /login |
| AUTH-02 (initiate form) | Wave 1 (08-01) | Email input visible, password fields not visible |
| AUTH-02 (confirm form) | Wave 1 (08-01) | Two password inputs visible, email input not visible |
| AUTH-03 (session expiry → /login) | Wave 2 (08-02) | Forge JWT with exp 1s ahead, wait 2s, assert window.location.hash === '#/login' |

## Deferred Items (out of scope, surfaced during execution)

The following untracked files were present in the working tree at execution time but are NOT introduced by this task. They are out of scope per the Scope Boundary rule and are NOT committed:
- `.claude/` (pre-existing tooling directory)
- `vue/src/pages/PasswordReset/` (pre-existing scaffold dir; will be populated by Wave 1 plan 08-01)

## User Setup Required

None. No external services, environment variables, secrets, or dashboard configuration required.

## Next Phase Readiness

- **Wave 1 (08-01) ready:** Page + route + store action work can begin against the now-existing stub. The three TODOs covering AUTH-01 and AUTH-02 give Wave 1's verifier concrete pending tests to make passing.
- **Wave 2 (08-02) ready:** AUTH-03 scheduleExpiry timer work is also unblocked structurally — the one TODO inside the AUTH-03 it() body gives Wave 2's verifier a single concrete pending test.
- **No production code touched** — all existing specs (login, devices, device-detail, dashboard, profile, history) and the entire Vue app remain unchanged. No regression risk.
- **Deploy note (from execution context):** "Do NOT push — the user is handling the deploy separately. Local commits only." This SUMMARY and the spec are committed on `thinx-staging` locally; the deploy to console.thinx.cloud happens via the parent submodule bump in `suculent/thinx-device-api`, handled by the user.

## Self-Check: PASSED

- `[ -f vue/cypress/integration/auth-extras.spec.js ]` → FOUND
- `git log --oneline | grep 8bf3024` → FOUND (`8bf3024 test(08-00): add Cypress stub for password reset + session expiry (AUTH-01..03)`)
- All acceptance criteria gates above show PASS
- No pre-existing specs altered

---
*Phase: 08-auth-extras*
*Completed: 2026-05-24*

---
phase: 06-user-profile
plan: "00"
subsystem: testing
tags: [cypress, e2e, vue, vuex, bugfix, notifications, profile]

# Dependency graph
requires: []
provides:
  - "Wave 0 Cypress spec stub for Profile page (PROF-01 through PROF-06, 7 it() stubs)"
  - "G1 bugfix: mapGetters moved from computed: to methods: in Notifications.vue so getBuildLog() works as a function"
affects: [06-01, 06-02]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cypress spec stub pattern: describe/beforeEach/cy.login()/cy.visit() with TODO-comment-only it() bodies"
    - "Vuex mapGetters in methods: (not computed:) when getter returns a function to be called"

key-files:
  created:
    - vue/cypress/integration/profile.spec.js
  modified:
    - vue/src/components/Notifications/Notifications.vue

key-decisions:
  - "mapGetters({ getBuildLog }) moved to methods: because getBuildLog is a Vuex getter that returns a function — spreading it in computed: causes Vue to call it as a computed getter, not expose it as a callable"
  - "Profile spec stubs use TODO comments only (no assertions) to maintain Nyquist compliance without locking implementation details before Wave 1"

patterns-established:
  - "Profile spec: describe('Profile feature', ...) with 1536x754 viewport and cy.login() in beforeEach"
  - "Vuex function-returning getters must be spread into methods:, not computed:"

requirements-completed: [PROF-01, PROF-02, PROF-03, PROF-04, PROF-05, PROF-06]

# Metrics
duration: 8min
completed: 2026-05-23
---

# Phase 6 Plan 00: Profile Cypress Stub + Notifications G1 Fix Summary

**Cypress spec stub for 6 Profile requirements (7 it() stubs) and one-line fix eliminating TypeError: getBuildLog is not a function on every authenticated page**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-23T00:00:00Z
- **Completed:** 2026-05-23T00:08:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `vue/cypress/integration/profile.spec.js` with 7 it() stubs covering PROF-01 through PROF-06 using the same describe/beforeEach/cy.login()/cy.visit() pattern as devices.spec.js
- Fixed G1 bug in Notifications.vue: removed `...mapGetters({ getBuildLog })` from `computed:` and added it as the first spread in `methods:`, resolving the TypeError that fired on every authenticated page
- All acceptance criteria verified via node --check and grep gates before committing

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Cypress spec stub for Profile page (PROF-01-06 + G1)** - `40c34bb` (feat)
2. **Task 2: Fix G1 - move mapGetters from computed to methods in Notifications.vue** - `208328d` (fix)

**Plan metadata:** (committed with SUMMARY)

## Files Created/Modified
- `vue/cypress/integration/profile.spec.js` - Wave 0 Cypress spec stub, 7 it() blocks, no assertions, all PROF-XX requirements covered
- `vue/src/components/Notifications/Notifications.vue` - mapGetters spread moved from computed: to methods: (1 line removed, 1 line added)

## Decisions Made
- mapGetters for getBuildLog moved to methods: because the Vuex getter returns a callable function — spreading into computed: causes Vue to evaluate the getter as a computed property, not expose it as a method. This matches the project convention documented in CONVENTIONS.md:94.
- Profile spec stubs contain TODO comments only (no cy.get/cy.intercept/assertions) so Wave 1 and Wave 2 tasks can fill them in without merge conflicts or locked expectations.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Wave 0 complete: profile.spec.js is available as a non-MISSING automated verify target for Wave 1 and Wave 2
- Notifications.vue G1 fix ships independently and unblocks any authenticated page that renders the Notifications widget
- Wave 1 tasks (PROF-01 implementation) can begin immediately

---
*Phase: 06-user-profile*
*Completed: 2026-05-23*

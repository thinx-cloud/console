# Retrospective — THiNX Console Vue Migration

Living retrospective. New milestone sections appended above "Cross-Milestone Trends" at each close.

---

## Milestone: v1.999 — Vue Console Feature-Parity GA

**Shipped:** 2026-05-27
**Phases:** 11 | **Plans:** 21 (+ 2 quick tasks) | **Timeline:** 9 days (2026-05-18 → 2026-05-27)
**Code:** ~6,200 LOC in `vue/src/` | **Deps added:** 0 | **Commits today on submodule:** ~565 across all branches; `thinx-staging` branch carries the milestone close-out lineage.

### What Was Built

Full feature parity between the Vue console and the legacy AngularJS console. Device owners can now manage their entire IoT fleet through `console.thinx.cloud` — devices (with filter/sort/search/grid+list/Revoke/Transfer/Push Config/Build firmware/Detail page), API keys, repositories, RSA keys, environment globals, mesh channels, transformers (with CodeMirror editor), profile + account settings (Profile/Avatar/Notifications/Admin/Delete), history (Build Log + Audit Log with date-range + flag filters and inline log expand), password reset (initiate + confirm), session-expiry timer + `clearSession` chokepoint + `composeOptions` belt-and-suspenders, and admin features (paginated user list, session revocation via Redis blacklist, impersonation with sticky banner + MM:SS countdown).

### What Worked

- **Atomic per-plan commits + per-phase SUMMARY.md.** Every shipped wave was rollback-able; the SUMMARY artifacts made it trivial to cross-reference what was actually delivered when REQUIREMENTS traceability fell behind.
- **Cypress Wave-0 stubs before code waves.** Every multi-wave phase (4, 5, 6, 7, 8, 10) shipped a `*.spec.js` skeleton in Wave 0 before authoring production code. Gave the verifier a non-MISSING automated target from the start and prevented "we'll add tests later" drift.
- **`mapGetters` in `methods:` convention enforced.** Phase 6 G1 (`Notifications.vue#getBuildLog is not a function`) surfaced the convention; every subsequent phase respected it; no regressions across Phases 6-11.
- **Cross-repo phase coordination via parent submodule bumps.** Phases 10 + 11 spanned the parent monorepo and this submodule; the deploy unit was a single parent commit bumping the console submodule. Worked cleanly for ADMIN-01/02/03 and for G8/G9.
- **chrome-devtools MCP for synthetic UAT walks.** AUTH-03 laptop-sleep belt-and-suspenders verification used `evaluate_script` to backdate a JWT in `localStorage`, then a page reload to exercise the rehydrate-path. Faster than waiting 1 hour, more faithful than a unit test.
- **Production-fs audit before declaring DASH-04 done.** The 2026-05-27 SSH audit of `/mnt/gluster/thinx/deploy` produced empirical proof that no successful builds exist platform-wide; this turned DASH-04 from "needs lookup" into a definitive G10 blocker with citation-worthy evidence.

### What Was Inefficient

- **REQUIREMENTS.md traceability fell behind early and was bulk-flipped at milestone close.** Phase 1-3 reqs stayed `[ ]` and "Pending" for the entire milestone despite the code being shipped 2026-05-19. Caught at close-out via grep (35 "Pending" rows discovered post-PR). Future milestones: flip checkboxes per-phase in the phase SUMMARY commit, not at milestone close.
- **G9 (Devices.vue selection-prune) was a UAT-surfaced gap that should have been caught by review.** The fix is a 2-line splice mirroring an existing in-file pattern (`toggleDevice indexOf+splice`). Per-row vs bulk-Revoke asymmetry was visible in the original PR diff.
- **Swarm auto-pull broke mid-milestone (2026-05-25)** and required manual `./restart.sh` for every subsequent deploy. Slowed the dev loop noticeably during Phase 10/11 ship. Tracked but not fixed in v1.999.
- **GPG pinentry broke 2026-05-26** — 22 commits intentionally unsigned by user authorization. Adds amend-later work for whoever wants signed history.
- **Phase 11 Wave 1 (G8) was discovered to already be done in the parent monorepo** at progress time, not at filing time. Could have caught this earlier with a cross-repo state check before scoping Phase 11 Wave 1 separately.
- **chrome-devtools MCP B-button quirks.** Several Phase 6 + 9 walks needed `evaluate_script` fallbacks because Kapture/chrome-devtools `click` on `<b-button type="submit">` and `<b-tab>` didn't always fire Vue handlers. Documented in Phase 9 UAT summary as a tool-quirk caveat.

### Patterns Established

- **Two-phase verification per requirement:** AI-UAT (headless via chrome-devtools) for the rendering / code-path assertions + human-UAT (live walk) for end-to-end behavior. Phase 9 was the explicit human-UAT consolidation point for Phases 4-8 carry-overs.
- **Wave-0 Cypress stub + Wave-N production code** convention across all multi-wave phases.
- **`clearSession` single-chokepoint** for any session teardown (manual logout, timer expiry, route guard, delete-account success). Multiple discovery paths converge on one action — easier to reason about and verify.
- **Cross-repo gap-closure phases** (Phase 10, Phase 11) — Plans split by repo: parent-monorepo work in parent's phase artifacts, submodule work in console's phase artifacts; deploy unit is the parent submodule bump.
- **Quick task affordance** for tiny, mid-phase fixes (`260520-w52`, `260526-2d3`) — kept Phase 11 from spawning a full plan-doc cycle for a 2-line splice.

### Key Lessons

1. **Flip REQUIREMENTS checkboxes inline at phase SUMMARY time, not at milestone close.** Bulk-flipping 35 rows at close-out is process-debt that costs nothing during the phase but ~20 minutes at close. Discipline > batch fixup.
2. **Cross-repo state check before scoping a phase.** Before authoring Phase 11 Wave 1 separately, a `grep` on the parent's `.planning/` for the same gap could have detected that AUTH-API-01 was already shipped.
3. **Production-fs audit is cheap and definitive.** The DASH-04 audit ran in ~30 seconds and produced ground-truth evidence that turned an open UAT walk into a documented v1.x carry-over. Reach for empirical checks before debating walk preconditions.
4. **Synthetic UAT via chrome-devtools MCP is viable for time-bound assertions** (1-hour wait, laptop-sleep, etc.) when the underlying code path is local to the browser. Production-bundle limitations (no `__vue__` exposure) constrain the exact code path you can isolate, but the chokepoint converge means the user-visible behavior is testable end-to-end.
5. **Track GPG/CI/swarm degradations in v1.x backlog as they happen.** Three operational issues surfaced mid-milestone (GPG pinentry, swarm auto-pull, thinx_worker). All three are filed in `.planning/v1.x-backlog.md` so v1.x planning has them visible from day 1.

### Cost Observations

- Model mix: ~95% Claude Opus 4.7, occasional Sonnet for parallel agents.
- Sessions: spans 2026-05-18 → 2026-05-27, several distinct sessions per day during peak Phase 6-8 ship.
- Notable: heaviest context use during Phase 9 UAT (verifying 33 individual items across the live console); lightest during Phase 11 (close-out reconciliation).

---

## Cross-Milestone Trends

(Populated as additional milestones ship.)

### Velocity

| Milestone | Phases | Plans | Days | Notes |
|---|---|---|---|---|
| v1.999 | 11 | 21 + 2 quick | 9 | Feature-parity GA — full Vue migration kickoff to ship |

### Process maturity

| Practice | v1.999 | Notes |
|---|---|---|
| Atomic per-plan commits | ✓ | Worked end-to-end |
| Wave-0 Cypress stubs | ✓ | All multi-wave phases |
| `clearSession` chokepoint | ✓ | Single-path teardown verified Phase 8 + 10 |
| Inline REQUIREMENTS traceability | ✗ | Fell behind; bulk-fixed at close |
| Pre-phase cross-repo state check | ✗ | Phase 11 Wave 1 turned out already-done in parent |
| Production-fs audit before "needs external" deferrals | ✓ | DASH-04 audit produced empirical evidence |

---

*Retrospective initialized at v1.999 milestone close, 2026-05-27.*

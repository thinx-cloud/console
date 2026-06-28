# Roadmap: THiNX Console — Vue Migration

**Status:** v1.999 shipped 2026-05-27 — feature-parity GA across 11 phases.
**Next milestone scheduled (2026-06-03):** v1.x Operational Hygiene — Phase 1: SEC-DEP-02 (coordinated from `thinx-device-api` v1.9 Phase 10). Other v1.x candidates remain in `.planning/v1.x-backlog.md`; run `/gsd-new-milestone` to widen scope.

## Milestones

- ✅ **v1.999 Feature-Parity GA** — Phases 1-11 (shipped 2026-05-27)
- 🚧 **v1.x Operational Hygiene** — Phase 1 scheduled 2026-06-03 (SEC-DEP-02 cross-project triage from `thinx-device-api` v1.9 Phase 10); execution awaits operator `/gsd-plan-phase`.

Archives: [v1.999-ROADMAP.md](./milestones/v1.999-ROADMAP.md), [v1.999-REQUIREMENTS.md](./milestones/v1.999-REQUIREMENTS.md)
Full shipped scope: [MILESTONES.md](./MILESTONES.md)

## Phases

<details>
<summary>✅ v1.999 Feature-Parity GA (Phases 1-11) — SHIPPED 2026-05-27</summary>

- [x] **Phase 1**: Bug Fixes & Scaffolding Cleanup — completed 2026-05-18 (pre-existing, no plan docs authored)
- [x] **Phase 2**: CRUD for Simple Management Pages — completed 2026-05-19 (code-only, no plan docs)
- [x] **Phase 3**: Transformers with Code Editor (2/2 plans) — completed 2026-05-19
- [x] **Phase 4**: Device Management (3/3 plans) — completed 2026-05-22
- [x] **Phase 5**: Real Dashboard (3/3 plans) — completed 2026-05-23
- [x] **Phase 6**: User Profile & Account Settings (3/3 plans) — completed 2026-05-23
- [x] **Phase 7**: History Improvements (3/3 plans) — completed 2026-05-23
- [x] **Phase 8**: Authentication Extras (3/3 plans) — completed 2026-05-24
- [x] **Phase 9**: Manual UAT Review (21/22 actionable items + 1 BLOCKED on G10) — Verified 2026-05-27
- [x] **Phase 10**: Admin Features v1.1 (4/4 plans) — Verified 2026-05-26
- [x] **Phase 11**: v1 GA Gap Closures — Verified 2026-05-27 (Wave 1 G8 closed in parent monorepo as AUTH-API-01; Wave 2 G9 via quick task `260526-2d3`)

Quick tasks: `260520-w52` (button color polish, 2026-05-20), `260526-2d3` (G9 Devices.vue selection-prune, 2026-05-26).

Full per-phase details: [`milestones/v1.999-ROADMAP.md`](./milestones/v1.999-ROADMAP.md)

</details>

### 📋 Next milestone (to be planned)

Run `/gsd-new-milestone` to scope v1.x — backlog candidates in `.planning/v1.x-backlog.md`:

- `ADMIN-search` — Admin user-list search/filter (S)
- `AUTH-04` — Vue console signup form (M)
- `ADMIN-devcount` — Real `device_count` per user (S–M)
- `HIST-flags` — Native admin/impersonation flag chips (XS)
- `OPS-swarmpull` — Diagnose swarm auto-pull failure (unknown)
- `OPS-builder-broken` (G10) — Fix `thinx_worker` Docker build failure (unknown — out-of-repo; blocks DASH-04 walk completion)
- `CY-loginargs` — `cy.login(user, pass)` ignores its args (XS)
- `AUTH-bearer-null` — Vue console stops sending `Bearer null` on logged-out requests (XS)

## v1.x Operational Hygiene — Scheduled Phases

### Phase 1: SEC-DEP-02 — Vendored Asset Dependency Triage (Cross-Project)

**Goal:** Remediate the 2 high-severity Dependabot alerts on `thinx-cloud/console` (Alert 54: grunt < 1.5.3 / GHSA-rm36-94g8-835r; Alert 52: grunt < 1.3.0 / GHSA-m5pj-vjjf-4m3h), both lodged in the vendored static-asset bundle at `src/assets/global/plugins/jquery-validation-1.19.5/package.json`. The vulnerabilities are reachable ONLY if a future build step starts invoking grunt against the vendored manifest; effective production exposure today is zero.

**Depends on:** Nothing (cross-project coordination — the parent project's Phase 10 of v1.9 has already classified the alerts and annexed the verdict roll-up to `thinx-device-api/.planning/dep-triage.md`).

**Requirements:** SEC-DEP-02 (parent-project requirement; mirrored here for execution).

**Recommended remediation** (per parent annex):
- **Preferred:** delete the vendored plugin's `package.json` at `src/assets/global/plugins/jquery-validation-1.19.5/package.json`. The compiled JS/CSS in the same directory is what actually loads — the package.json is metadata only.
- **Acceptable:** dismiss both alerts in the Dependabot UI with rationale "vendored asset; grunt not in services/console build path".

**Success Criteria** (what must be TRUE):
  1. Both Dependabot alerts on `thinx-cloud/console` (#54 GHSA-rm36-94g8-835r and #52 GHSA-m5pj-vjjf-4m3h) are resolved — auto-closed after vendored `package.json` delete OR manually dismissed in the Dependabot UI with the rationale recorded in the closing commit message / dismissal note.
  2. EITHER the vendored `src/assets/global/plugins/jquery-validation-1.19.5/package.json` is removed from the repo (preferred path), OR a `### Deferred — dismiss-only` note is appended to this phase entry capturing the dismissal-with-rationale decision and the date.
  3. services/console CI green on the resulting branch (typically `thinx-staging`) — the Vue console build (`npm run build:test` or equivalent) still completes without referencing the deleted manifest.
  4. The parent `thinx-device-api` submodule pointer for `services/console` bumps cleanly across the SEC-DEP-02 commit; parent CircleCI stays green across the pointer-bump commit on `thinx-staging`.

**Plans:** TBD (operator runs `/gsd-plan-phase 1` in this GSD workspace after `/gsd-new-milestone` is run for `v1.x Operational Hygiene`).

**Cross-project references:**
- Parent project verdict roll-up: `thinx-device-api/.planning/dep-triage.md` § "Phase 10 / SEC-DEP-02 (services/console) — Cross-Project Roll-up" (2 rows; both `deferred-vendored-asset`).
- Parent project phase that scheduled this work: `thinx-device-api/.planning/ROADMAP.md` Phase 10 of v1.9.
- Cross-project coordination runbook (parent): `thinx-device-api/.planning/runbooks/cross-project-dependency-coordination.md`.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Bug Fixes & Scaffolding | v1.999 | 0/0 (pre-existing) | Complete | 2026-05-18 |
| 2. CRUD Management Pages | v1.999 | 0/0 (code-only) | Complete | 2026-05-19 |
| 3. Transformers with Code Editor | v1.999 | 2/2 | Complete | 2026-05-19 |
| 4. Device Management | v1.999 | 3/3 | Complete | 2026-05-22 |
| 5. Real Dashboard | v1.999 | 3/3 | Complete | 2026-05-23 |
| 6. User Profile | v1.999 | 3/3 | Complete | 2026-05-23 |
| 7. History Improvements | v1.999 | 3/3 | Complete | 2026-05-23 |
| 8. Authentication Extras | v1.999 | 3/3 | Complete | 2026-05-24 |
| 9. Manual UAT Review | v1.999 | 1 UAT summary + carry-overs all closed | Verified | 2026-05-27 |
| 10. Admin Features (v1.1) | v1.999 | 4/4 | Verified | 2026-05-26 |
| 11. v1 GA Gap Closures | v1.999 | 0/0 (closed via quick task + parent phase) | Verified | 2026-05-27 |

---

*v1.999 GA close-out: 2026-05-27. Run `/gsd-new-milestone` to plan v1.x.*

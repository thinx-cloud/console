# THiNX Console — Vue Migration

## What This Is

THiNX is an IoT device management platform. This project is the web console service: a Vue 2 SPA (`vue/`) that manages devices, API keys, firmware builds, transformers, and user accounts. A legacy AngularJS console (`src/`) remains frozen and deployed; all new feature work targets the Vue console only.

## Core Value

Device owners can fully manage their IoT fleet through the Vue console without ever needing the legacy AngularJS UI.

## Current State

**Shipped:** v1.999 (2026-05-27) — full feature-parity GA across 11 phases over 9 days. The Vue console at `console.thinx.cloud` now covers every legacy AngularJS console workflow. v1.0 GA from the console submodule's side is locked in. See [MILESTONES.md](./MILESTONES.md) for the full shipped scope.

**Tech stack today:** Vue 2.6 + Vuex + Vue Router + BootstrapVue 2.21.2 + CodeMirror (transformer editor) + vue-chartjs 3.5.1 + chart.js 2.9.4 (dashboard). ~6.2k LOC in `vue/src/`. NO new npm dependencies added during v1.999. Legacy `services/console/src/` AngularJS console remains frozen and deployed — must stay working until Vue is GA'd as v2.0.x (see project memory `legacy-console-supported-until-v2`).

**Deployed bundle:** `console.thinx.cloud` via parent monorepo submodule bump + `./restart.sh` on swarm host `188.166.23.244`. Last v1.999 deploy unit was parent commit `382cebfc` (G9 ship) followed by `71fab68b` (parent v1.0 milestone audit). The 5 docs-only commits authored during v1.999 close-out (`3e3fae4` → `b3154e4`) are NOT yet bumped to parent — they'll ride along with the first v1.x code change.

## Requirements

### Validated

- ✓ User can log in and log out — Phase 0 (existing)
- ✓ User can view device list — Phase 0 (existing, read-only)
- ✓ User can view API keys, repositories, RSA keys, enviros, channels, history — Phase 0 (existing, read-only)
- ✓ Bug fixes and scaffolding cleanup (broken getters, AngularJS refs in Vue, demo pages removed) — v1.999 / Phase 1
- ✓ Full CRUD for API keys, repositories, RSA keys, environment globals, mesh channels — v1.999 / Phase 2
- ✓ Transformer editor with code editor (CodeMirror) — v1.999 / Phase 3
- ✓ Device actions: revoke (per-row + bulk), transfer, config push, build firmware — v1.999 / Phase 4 (+ G9 selection-prune in Phase 11)
- ✓ Device detail page (`/app/device/:udid`) — v1.999 / Phase 4
- ✓ Functional dashboard with real stats from `/stats` endpoint — v1.999 / Phase 5 (DASH-04 zip-download sub-criterion carries over to v1.x — see "Known carry-over" below)
- ✓ User profile and account settings page (Profile / Avatar / Notifications / Admin / Delete) — v1.999 / Phase 6 (+ G7 delete-success teardown in Phase 10)
- ✓ History improvements: tab split, inline log expand, search/filter, date range — v1.999 / Phase 7
- ✓ Password reset page — v1.999 / Phase 8 (+ G8 backend Bearer-null guard closed in parent monorepo as AUTH-API-01)
- ✓ Session-expiry timer + clearSession chokepoint + composeOptions belt-and-suspenders — v1.999 / Phase 8 (synthetic laptop-sleep walk Verified 2026-05-27)
- ✓ Admin features: user list, session revocation, impersonation with banner+countdown — v1.999 / Phase 10 (v1.1 tier)

### Active

(None — see "Next Milestone Goals" below for v1.x candidates.)

### Known carry-over from v1.999

- **DASH-04 zip-download sub-criterion** — Blocked on G10 `OPS-builder-broken` (`thinx_worker` has been broken since at least 2023 per 2026-05-27 production-fs audit; 0 successful firmware build artifacts exist platform-wide). Widget render itself Verified; only live download walk is blocked. Unblocks together with worker fix.
- **PROF-04 negative case** — Still HN (needs a non-admin account to confirm Admin tab is hidden); not GA-blocking — positive case Verified.

### Out of Scope (v1.999, may revisit for v2.x)

- InfluxDB / Chronograf migration — existing `/stats` endpoint is sufficient for v1 dashboard
- AngularJS console enhancements — legacy UI is frozen (but must stay working until v2.0.x cuts over per memory `legacy-console-supported-until-v2`)
- Mobile app — web-first
- Real-time push updates — polling/refresh is acceptable for v1
- GDPR consent page — low priority, deferred to v2 (`GDPR-01`)
- InfluxDB event logging + embedded Chronograf views — v2 (`STAT-01`, `STAT-02`)

## Next Milestone Goals

v1.x scope candidates seeded during v1.999 — see `.planning/v1.x-backlog.md` for full per-item context. Run `/gsd-new-milestone` to scope a subset.

- `ADMIN-search` — Admin user-list search/filter (S)
- `AUTH-04` — Vue console signup form (M)
- `ADMIN-devcount` — Real `device_count` per user, currently placeholder 0 (S–M)
- `HIST-flags` — Native admin/impersonation flag chips on History page (XS)
- `OPS-swarmpull` — Diagnose swarm auto-pull failure broken since 2026-05-25 (unknown)
- `OPS-builder-broken` (G10) — Fix `thinx_worker` Docker build failure (unknown — out-of-repo; blocks DASH-04 walk)
- `CY-loginargs` — `cy.login(user, pass)` ignores its args at `commands.ts:43` (XS)
- `AUTH-bearer-null` — Vue console stops sending `Bearer null` on logged-out requests (XS — hygiene; harmless under parent's class-fix backend guard)

## Context

- Legacy console lives in `src/` — deployed at rtm.thinx.cloud — **do not modify**
- Vue console lives in `vue/` — deployed at staging.thinx.cloud
- Vue console uses Vuex for state, Vue Router for navigation, BootstrapVue for UI
- All 9 management pages exist as read-only stubs — store modules have fetch actions but no create/update/delete mutations
- Detailed implementation plan with API endpoint mapping: `services/console/IMPLEMENTATION_PLAN.md`
- Codebase map: `.planning/codebase/`

## Constraints

- **Tech stack**: Vue 2 + Vuex + Vue Router + BootstrapVue — do not introduce Vue 3 or other frameworks
- **API**: All endpoints are already defined in the legacy console (`thinx-api.js`) — no backend changes needed
- **Legacy**: `src/` directory is frozen — no changes, no feature parity obligation
- **Dockerfile**: Fix `NODE_ENV=development` hardcode before any production deploy

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Freeze AngularJS, grow Vue only | Dual-maintenance is unsustainable; Vue is the future | ✓ Good — v1.999 shipped full parity; legacy stays read-only until v2.0.x cuts over |
| Use existing `/stats` endpoint for dashboard | InfluxDB migration is a separate infrastructure concern | ✓ Good — dashboard works on `/stats` today; STAT-01/STAT-02 stay in v2 backlog |
| Fine-grained phases (8 planned, 11 actual) | Changes are risky; atomic phases allow safe rollback | ✓ Good — granularity caught G7/G8/G9 mid-walk; Phase 11 spun up only after gaps were filed |
| `mapGetters` in `methods:` not `computed:` (Phase 6 G1 anti-regression) | Pre-existing project convention; `Notifications.vue` broke when split into `computed:` and threw `getBuildLog is not a function` on every authenticated page | ✓ Good — convention enforced across all subsequent phases; documented in project memory |
| HIST-03 inline expand vs modal (Phase 7 scope revision) | Modal pattern broke long-log readability; inline expand kept context | ✓ Good — accepted mid-phase via `07-CONTEXT.md` scope-revision note |
| Plain `<table>` + custom pagination, NOT `<b-table>` (Phase 10) | `<b-table>` is unused everywhere else in the project; consistency over BootstrapVue convenience | ✓ Good — locked at Phase 10 CONTEXT correction |
| No new npm packages across v1.999 | Dependency hygiene; legacy `chai-http v4` lock honored | ✓ Good — entire 11-phase milestone shipped with zero new deps |
| Phase 11 G8 fix lives in parent monorepo, not submodule | G8 root cause is backend Bearer-null guard — wrong layer to fix in Vue | ✓ Good — parent's AUTH-API-01 closed end-to-end; class-fix benefits ALL routes, not just `/password/reset` |
| DASH-04 deferred on G10 (worker broken since 2023) vs trying to fix worker for GA | Worker fix is out-of-repo + unknown scope; widget render itself Verified; only zip download walk blocked | ✓ Good — v1.0 GA shipped without artificial blockers; G10 carries into v1.x as `OPS-builder-broken` |

## Operational facts (worth knowing for v1.x)

- **Swarm auto-pull broken** since 14:44 CET 2026-05-25 — every deploy requires manual `./restart.sh` on swarm host `188.166.23.244` (NOT `./scripts/stack-deploy` as docs say — see memory `swarm-deploy-script-name`). Filed as `OPS-swarmpull`.
- **GPG signing degraded** — pinentry unreachable from 2026-05-26; ~22 commits across both repos unsigned by explicit authorization. See memory `unsigned-commits-260526` for the full list and amend-later path.
- **Test credentials live at** `vue/cypress/fixtures/thinx.json` (admin account). Non-admin account needed externally for PROF-04 negative case.
- **`cy.login(user, pass)` quirk** — args are ignored at `commands.ts:43` (latent bug; harmless today because all 7 specs use the fixture-only behavior). Filed as `CY-loginargs`.
- **Parent monorepo commitlint** rejects custom types like `plan(N):` — use `docs(phase-NN):` in parent commits. Console submodule has no such hook. (Memory `parent-monorepo-commitlint`.)
- **GSD command syntax**: project uses `/gsd-…` (hyphen) form — `/gsd:…` (colon) is legacy. (Memory `gsd-command-syntax-hyphen`.)

---
*Last updated: 2026-05-27 after v1.999 milestone shipped*

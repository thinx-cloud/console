---
phase: 07-history-improvements
status: seed
created: 2026-05-23
---

# Phase 7 — History Improvements — Seed Context

This is a session-handoff seed for the planner/researcher. Read this BEFORE running `gsd-phase-researcher` so the research targets the **right** scope: Phase 7 has been partially pre-built and one requirement has been **deliberately re-scoped** by the user.

## Current state of `vue/src/pages/History/History.vue` (at HEAD = 99cadb6)

The page already has:

- `<b-tabs>` with two `<b-tab>` panels: **"Audit Log"** (active by default) and **"Build Log"** — satisfies **HIST-01** at structure level.
- Audit Log tab: search input bound to `auditSearch`, `filteredAudit` computed that case-insensitively matches `item.message`. Row CSS gets `table-danger` / `table-warning` via `rowClass()` keyed on `item.flags`. Per-row flag badges via `flagVariant()`. Satisfies most of **HIST-05** (text search; "flag filter" is currently colour-only).
- Build Log tab: search input bound to `buildSearch`, `filteredBuilds` matching `item.name`. **Inline truncated log** rendered in the Log column as a `<pre>` (400-char / 120px-height cap, monospace on light bg, `…` for overflow). The previous "View" button + xl modal + `showLog()` / `logTitle` / `logContent` were removed in commit `0ab3117` per explicit user direction.
- `b-breadcrumb` showing only `<b-breadcrumb-item active>History</b-breadcrumb-item>` — the "YOU ARE HERE >" placeholder was removed across all 9 pages in `0ab3117`.

## Requirements (`.planning/REQUIREMENTS.md` HIST-01..05) and how they map to current code

| Req | Original wording | Status today | What Phase 7 should do |
|---|---|---|---|
| HIST-01 | History page has two tabs: Build Log and Audit Log | ✓ structurally present | confirm + lock down with a Cypress stub |
| HIST-02 | Tab state reflected in URL (`/app/history/builds`, `/app/history/audit`) | ✗ tabs use internal state only; URL stays `/#/app/history` | implement — add child routes (or query param), bind to `<b-tabs>` `v-model` and `vue-router` |
| HIST-03 | Clicking a build row opens a modal with full log text | ⚠ **SCOPE-REVISED 2026-05-23** — the modal was removed by user request in favor of inline truncated logs. Phase 7 must NOT re-add the modal. Acceptable reinterpretations: (a) row is already expanded inline, treat HIST-03 as satisfied; (b) "Expand" toggle that drops the 120px cap on click so full log shows in-place; (c) row click navigates to `/app/history/build/:build_id` detail page. Pick the lightest-touch option that genuinely lets a user read the full log without a modal. Record the choice + rationale in 07-CONTEXT/07-DISCUSSION before planning. | implement chosen variant |
| HIST-04 | Both tabs support date range filtering | ✗ not present | implement — date range picker (BootstrapVue or `<input type="date">`; **no new npm packages**), filter `filteredAudit` and `filteredBuilds` by `item.date` within the range. Persist range in route query so reloads preserve it. |
| HIST-05 | Audit log supports text search (warning/danger flag filtering) | ◐ text search done; flag filter is colour only — needs an actual filter control (e.g. `<b-form-checkbox-group>` for danger / warning / info) | implement flag-filter UI; combine with the existing text-search filter |

## Hard constraints (carried over from prior phases)

- **NO new npm packages.** Reuse Vue 2 + BootstrapVue 2.21.2 + Vuex + vue-chartjs (already pinned). Don't even consider date-fns / vue-datepicker / moment for HIST-04 — `<input type="date">` plus `new Date()` math is fine.
- `mapGetters` MUST be spread into `methods:` (not `computed:`), called as functions. Convention enforced across the codebase (see saved memory `thinx-console-vue-conventions`).
- Existing stores `auditlog` and `buildlog` already provide `fetchAuditlog`/`fetchBuildLog` + `getItems` getters. Extend them only if a new server-side query is needed (likely not for client-side filtering).
- Project's planning directory is `.planning/phase-N/` (flat) — `gsd-sdk query` phase-discovery returns "not found" for this layout. Use direct file ops + plain `git` for orchestrator work. See saved memory `gsd-sdk-flat-phase-dirs` for the executor/verifier `<environment_notes>` template that worked through phases 5 and 6.
- Deploy is via the parent meta-repo bump pattern at `/Users/igraczech/Repositories/thinx-device-api` — see memory `deployment-console-thinx-cloud`.
- CI: `vue` Docker job only runs on the `thinx-console` branch (doesn't exist); `legacy` + `test_vue` run on `thinx-staging`. The deployed image at console.thinx.cloud is what the swarm pulls after the meta-repo push. See memory `ci-thinx-cloud-console`.

## Test data observations

- The `test` account (cypress fixture creds) has plenty of audit log entries (login events) but builds are all `status: ERROR` — useful for testing search/filter, not so useful for "log content variety". The Phase 9 manual UAT can repeat this on richer accounts.

## Cypress stub

Mirror the Phase 5 / Phase 6 Wave 0 pattern: `vue/cypress/integration/history.spec.js` with `describe('History feature')`, `beforeEach` doing `cy.viewport(1536,754) + cy.login() + cy.visit('http://localhost:3000/#/app/history')`, one `it()` per HIST-XX with a `TODO HIST-XX` comment body, no `it.only`, no assertions yet.

## Suggested wave breakdown (planner decides final)

- **Wave 0** — Cypress stub `history.spec.js` (HIST-01..05 TODO stubs).
- **Wave 1** — Router work (HIST-02): add `/app/history/builds` and `/app/history/audit` child routes, bind `<b-tabs>` v-model to the active route. Filter primitives: extend `filteredAudit` / `filteredBuilds` to accept date-range + flag-filter inputs (HIST-04, HIST-05 enhancement). Possibly add a small `historyFilters.js` mixin or component if filter logic gets repetitive.
- **Wave 2** — UI: date-range picker (`<b-form-input type="date">` pair), flag-filter checkbox group, HIST-03 chosen variant (inline expand toggle preferred — lightest touch on the just-shipped inline log). Persist filter state in route query params so reloads/links work.

## Out of scope for Phase 7

- Re-adding the build log modal (explicitly removed; see `0ab3117`).
- Server-side filtering (existing client-side filtering on already-fetched logs is sufficient at the v1 data volumes).
- Pagination — the existing logs are short enough.
- The session-expiry stale-localStorage timer fix (Phase 8 — see `session-expiry-stale-localstorage` memory).

## Resume prompt for next session

```
/gsd-discuss-phase 7
```

or, if you prefer to skip discussion and go straight to research/plan/execute:

```
Research, plan and execute Phase 7 — History Improvements. Read .planning/phase-7/07-CONTEXT.md first; it captures the deliberate scope revision on HIST-03 and what's already shipped. Use the same pattern as Phases 5 and 6: gsd-phase-researcher → gsd-planner → gsd-executor per wave, with environment_notes pointing at .planning/phase-7/ and noting gsd-sdk discovery is broken. Deploy via parent meta-repo bump after the work lands.
```

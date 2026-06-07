# THiNX Console — Improvement Ideas Backlog

> **Generated:** 2026-06-07 · **Scope:** `services/console` (legacy AngularJS `src/` + Vue 2 app in `vue/`)
> **Nature:** Discovery/analysis deliverable. Nothing here is auto-applied — this is a prioritized, evidence-backed backlog for human review and triage.

## How to read this

Each idea carries a **category**, the **problem/motivation**, a **proposed approach**, a rough **effort** (S = hours, M = a day or two, L = multi-day/cross-cutting), a **priority** (P0–P3), and **concrete file references** so the next person can jump straight to the evidence.

Ideas are filtered against this project's known constraints:

- **The legacy AngularJS console (`src/app/`) must keep working until the Vue app is GA'd as v2.0.x** — legacy items are framed as "keep alive / de-risk," never "delete now."
- **No gratuitous new npm dependencies** — suggestions that add deps say so explicitly and justify it, or prefer removing/consolidating instead.
- **Established Vue patterns are intentional** (`mapGetters` used inside `methods` rather than `computed`; some Cypress steps are deliberate stubs). Ideas respect those.

---

## Top quick wins (start here)

1. **Drop unused heavy charting libraries** — `highcharts`, `highcharts-vue`, `echarts`, and `vue-echarts` are declared in `vue/package.json` but never imported anywhere under `vue/src/`. Removing them shrinks `node_modules`, install time, and the dependency-audit surface with zero runtime risk. *(QW-1 / DEP-2, effort S, P1)*
2. **Fix the bogus CORS request header in the API client** — `vue/src/core/api.js:56` sets `'Access-Control-Allow-Origin': 'http://localhost:3080 ' + this.baseApiUrl` on **outgoing requests**. ACAO is a *response* header; on a request it is meaningless at best and trips strict CORS preflight at worst, and it hardcodes a localhost origin into production traffic. *(QW-2 / SEC-3, effort S, P1)*
3. **Strip stray `console.*` and dead commented code from shipped Vue source** — 5 `console.*` calls and commented-out logic (e.g. the dead baseApiUrl branch at `vue/src/core/api.js:8`) leak into the bundle. *(QW-3 / TD-1, effort S, P2)*
4. **Externalize the hardcoded `localhost` API URLs** — `vue/src/core/api.js:6,56` and `vue/src/pages/Login/Login.vue:162` hardcode `http://localhost:3000/3080`. Route through `vue/src/config.js` / build env so dev defaults never leak into prod builds. *(QW-4 / SEC-2, effort S, P2)*
5. **Document the access/refresh token-name swap or rename it** — `setAccessToken` stores its argument as `this.refreshToken` (so `this.refreshToken` actually holds the access JWT). It's documented in a comment at `vue/src/core/api.js:20-23`, but the naming is a latent foot-gun for the next maintainer. *(QW-5 / TD-3, effort S, P2)*

---

## 1. Dependency & security hygiene

### DEP-1 — Vue 2 / BootstrapVue / Bootstrap 4 are all end-of-life
- **Category:** security/deps · **Effort:** L · **Priority:** P1
- **Problem:** `vue/package.json` pins `vue@^2.6.14`, `bootstrap-vue@2.21.2`, `bootstrap@^4.6.0`, `font-awesome@4.7.0`. Vue 2 reached end-of-life on 2023-12-31 (no further security patches); BootstrapVue 2.x only supports Vue 2 and is itself unmaintained; Bootstrap 4 and Font Awesome 4 are both superseded. This is the single largest long-term risk surface in the app.
- **Approach:** Treat as the strategic driver of the legacy→Vue-3 migration (see MIG-1). Short term, pin transitive versions via the existing `overrides` block and track CVEs. Do **not** attempt an in-place Vue 3 jump while BootstrapVue blocks it — sequence it.
- **Refs:** `vue/package.json` dependencies block.

### DEP-2 — Four+ charting libraries bundled, several unused
- **Category:** performance/deps · **Effort:** S–M · **Priority:** P1
- **Problem:** `amcharts4` (+ `amcharts4-geodata`), `apexcharts`/`vue-apexcharts`, `chart.js`/`vue-chartjs`, `echarts`/`vue-echarts`, and `highcharts`/`highcharts-vue` are all declared. Only three are actually imported: `vue-chartjs` (`AreaChart.vue:2`, `CheckinsTimeline.vue:13`), `vue-apexcharts` (`main.js:8`), and `amcharts4` (`Map/Map.vue:20-22`). `highcharts`, `highcharts-vue`, `echarts`, `vue-echarts` appear unused in `vue/src/`.
- **Approach:** (1) Remove the unused four immediately (quick win QW-1). (2) Longer term, consolidate to a single charting library to cut bundle size dramatically — amCharts4 + USA geodata is especially heavy for one map component.
- **Refs:** `vue/package.json`; `vue/src/main.js:8`, `vue/src/pages/Visits/components/AreaChart/AreaChart.vue`, `.../CheckinsTimeline/CheckinsTimeline.vue`, `.../Map/Map.vue`.

### DEP-3 — Toolchain pinned to pre-OpenSSL-3 / legacy Node
- **Category:** build/deps · **Effort:** M · **Priority:** P2
- **Problem:** CI sets `NODE_OPTIONS=--openssl-legacy-provider` for the Vue build (`.circleci/config.yml`, `test_vue` job), and the stack uses `sass-loader@^7.3.1`, `webpack-cli@4` (override), `typescript@~4.5.5`, `vue-tsc@^0.31.4`, `cypress@^9.5.4`, `eslint@^8`. The legacy-provider flag is a smell that the build cannot run on a modern Node/OpenSSL without a compatibility shim.
- **Approach:** Plan a toolchain refresh (sass-loader, webpack, Cypress 13+, ESLint 9) so the `--openssl-legacy-provider` crutch can be dropped. Stage it; some of these bumps interact with the Vue 2 lock (DEP-1).
- **Refs:** `.circleci/config.yml` (`test_vue`), `vue/package.json` devDependencies + `overrides`.

### DEP-4 — Run and record a dependency audit in CI
- **Category:** security · **Effort:** S · **Priority:** P2
- **Problem:** There is no `yarn audit` / `npm audit` gate in the pipeline; vulnerability drift is invisible until something breaks. (A live audit could not be captured in this analysis session because the sandbox blocked the network call — which itself argues for running it where it belongs: CI.)
- **Approach:** Add a **non-blocking** `yarn audit` step to the `test_vue` job that records results as an artifact. Keep it advisory first so it does not wedge deploys, then tighten.
- **Refs:** `.circleci/config.yml`.

---

## 2. Build, CI & tooling

### CI-1 — Vue tests run E2E-only and the legacy test job runs no tests at all
- **Category:** build/CI/testing · **Effort:** M · **Priority:** P1
- **Problem:** The legacy `test` job builds the AngularJS app but its Cypress run is commented out with `# Disabled, will never work here, must be migrated to thinx-device-api .circle/config.yml`. The `test_vue` job runs `yarn test`, which is `start-server-and-test serve … cy:test` — Cypress E2E only. There is **no unit/component test layer** in either app.
- **Approach:** Decide the testing strategy explicitly (see TEST-1). At minimum, document in the config *why* the legacy tests are disabled and where they were meant to migrate, so it is not read as an accidental gap.
- **Refs:** `.circleci/config.yml` (`test`, `test_vue`), `vue/package.json` scripts, `src/package.json` scripts.

### CI-2 — Two parallel package trees duplicate tooling
- **Category:** build/tech-debt · **Effort:** M · **Priority:** P3
- **Problem:** `src/package.json` (legacy, gulp+protractor+nyc) and `vue/package.json` (vue-cli+cypress) maintain separate, divergent ESLint/Cypress/test stacks. Expected during migration, but it doubles upgrade and audit work.
- **Approach:** No action while both apps ship. When Vue reaches v2.0.x GA, schedule retirement of the `src/` toolchain as part of legacy sunset. Track it so it is not forgotten.
- **Refs:** `src/package.json`, `vue/package.json`.

### CI-3 — `.coveralls.yml` + nyc config exist but coverage is not collected
- **Category:** CI/testing · **Effort:** S · **Priority:** P3
- **Problem:** Legacy `src/package.json` has a full `nyc` block with `check-coverage: true` and a `coverage` script wired to coveralls, but the tests that would feed it are disabled (CI-1). Coverage gating is configured but inert.
- **Approach:** Either re-enable a minimal test run to make the coverage config meaningful, or mark it dormant in docs so it does not imply coverage that is not measured.
- **Refs:** `src/package.json` (`nyc`, `coverage`), `.coveralls.yml`.

---

## 3. Testing

### TEST-1 — No component/unit test layer for the Vue app
- **Category:** testing · **Effort:** L · **Priority:** P2
- **Problem:** 36 `.vue` components and 23 `.js` modules under `vue/src/` are covered only by Cypress E2E (with some intentional stubs). Logic-heavy units — `core/api.js`, store modules under `vue/src/store/`, mixins — have no fast, isolated tests, so refactors (e.g. the token-swap in api.js) are risky.
- **Approach:** Introduce component/unit testing for the highest-logic units first (`core/api.js`, store modules). **Dependency note:** this needs a test runner; prefer Vitest or `@vue/test-utils`+Jest. That is a new dev dependency, so it needs explicit sign-off against the "no gratuitous deps" rule — justified here by the complete absence of a unit layer. Respect existing intentional Cypress stubs; do not convert those blindly.
- **Refs:** `vue/src/core/api.js`, `vue/src/store/`, `vue/src/mixins/`, `vue/cypress/`.

### TEST-2 — Resolve and document outstanding TODO/FIXME markers
- **Category:** testing/tech-debt · **Effort:** S–M · **Priority:** P3
- **Problem:** 6 TODO/FIXME/HACK markers in `vue/src/` and 9 in `src/app/`. Some may flag missing test coverage or known-broken paths.
- **Approach:** Sweep them into tracked issues; convert "HACK" markers near auth/API into either tests or fixes. Low-risk grooming.
- **Refs:** `grep -rn -E 'TODO|FIXME|HACK' vue/src src/app`.

---

## 4. Code quality & tech-debt

### TD-1 — Console noise and dead code in shipped Vue source
- **Category:** tech-debt · **Effort:** S · **Priority:** P2
- **Problem:** 5 `console.*` calls remain in `vue/src/`, plus commented-out logic (e.g. the dead `baseApiUrl` ternary at `vue/src/core/api.js:8`). Ships debug noise and confuses readers.
- **Approach:** Remove or gate behind a debug flag; consider an ESLint `no-console` rule (warn) to prevent regressions. (Already covered as quick win QW-3.)
- **Refs:** `vue/src/core/api.js:8`; `grep -rn 'console\.' vue/src`.

### TD-2 — Hardcoded environment-specific URLs scattered in source
- **Category:** tech-debt/config · **Effort:** S · **Priority:** P2
- **Problem:** `localhost:3000`/`3080` in `vue/src/core/api.js:6,56` and `vue/src/pages/Login/Login.vue:162`; a `console.thinx.cloud` link baked into `vue/src/pages/Error/Error.vue:27`; a `flatlogic.com` template link in `Calendar.vue:68`. Config-as-code drift.
- **Approach:** Centralize endpoints/links in `vue/src/config.js` and build-time env (the project already injects build args in the Docker/CircleCI flow). (Quick win QW-4 covers the localhost subset.)
- **Refs:** `vue/src/core/api.js`, `vue/src/pages/Login/Login.vue`, `vue/src/pages/Error/Error.vue`, `vue/src/pages/Visits/components/Calendar/Calendar.vue`.

### TD-3 — Confusing access/refresh token naming in the API client
- **Category:** tech-debt/correctness · **Effort:** S · **Priority:** P2
- **Problem:** `setAccessToken` stores its value into `this.refreshToken`, so `this.refreshToken` is really the access JWT (documented at `vue/src/core/api.js:20-23`). The expiry-teardown logic in `composeOptions` depends on understanding this inversion. One careless edit breaks session handling.
- **Approach:** Rename to accurate fields (`this.accessToken`) in a single focused, well-tested change — *after* TEST-1 gives `api.js` unit coverage so the rename is safe. Until then, the existing comment is the mitigation. (Quick win QW-5 is the doc-now option.)
- **Refs:** `vue/src/core/api.js:14-52`.

---

## 5. Performance

### PERF-1 — No route-level code splitting; all pages eagerly imported
- **Category:** performance · **Effort:** M · **Priority:** P2
- **Problem:** `vue/src/Routes.js` imports every page component statically (`component: Login`, `component: DeviceManager`, …) rather than via dynamic `import()`. The whole app — including heavy pages like the amCharts map — loads up front, inflating first paint.
- **Approach:** Convert route components to lazy `() => import(...)` so charts/maps/admin pages split into separate chunks. Pairs naturally with DEP-2 (fewer chart libs) for a compounding bundle win. Low behavioral risk, measurable payoff.
- **Refs:** `vue/src/Routes.js`.

### PERF-2 — amCharts4 + full USA geodata for a single map
- **Category:** performance · **Effort:** M · **Priority:** P3
- **Problem:** `vue/src/pages/Visits/components/Map/Map.vue:20-22` pulls `@amcharts/amcharts4/core`, `/maps`, and `amcharts4-geodata/usaHigh`. amCharts4 is one of the heaviest charting libs and is loaded for one visualization.
- **Approach:** Lazy-load the map (PERF-1), or migrate this single chart to the consolidated library chosen in DEP-2. Confirm the map is still a live feature before investing.
- **Refs:** `vue/src/pages/Visits/components/Map/Map.vue`.

---

## 6. Accessibility & UX

### UX-1 — Establish a baseline a11y pass on core flows
- **Category:** accessibility · **Effort:** M · **Priority:** P3
- **Problem:** No evidence of accessibility checks (axe, Lighthouse) in CI or the component set. Login, device list, and forms are the high-traffic flows most likely to have label/contrast/focus issues.
- **Approach:** Run a one-off Lighthouse/axe audit on Login + Devices, fix the top findings, then optionally wire an advisory a11y check into the Cypress suite (uses existing Cypress, no major new dep beyond an axe plugin — justify before adding).
- **Refs:** `vue/src/pages/Login/`, `vue/src/pages/Devices/`, `vue/src/components/Form/`.

---

## 7. Documentation

### DOC-1 — Capture the legacy↔Vue boundary and migration status
- **Category:** docs · **Effort:** S · **Priority:** P2
- **Problem:** The repo ships two apps (`src/` AngularJS, `vue/` Vue 2) with overlapping responsibilities, plus `vue-dev/`. Newcomers cannot tell which is canonical, what is deployed where, or how far migration has progressed. `IMPROVEMENTS.md` tracks deferred *backend* items but not the frontend migration map.
- **Approach:** Add a short `vue/README` or top-level section documenting: which app is live, the GA target (v2.0.x), and the page-by-page migration status. Complements the existing `.planning/` phase docs.
- **Refs:** `src/app/`, `vue/src/`, `vue-dev/`, `IMPROVEMENTS.md`, `.planning/ROADMAP.md`.

### DOC-2 — Document why the legacy Cypress/test jobs are disabled
- **Category:** docs/CI · **Effort:** S · **Priority:** P3
- **Problem:** The disabled legacy test step (CI-1) has a terse inline note but no durable record of the migration intent. Reads as an accidental gap.
- **Approach:** One paragraph in the CI config or a `TESTING.md` explaining the "migrate to thinx-device-api" plan and the current interim state.
- **Refs:** `.circleci/config.yml`.

---

## 8. Legacy → Vue migration path

### MIG-1 — Sequence the Vue 3 migration behind a BootstrapVue exit
- **Category:** migration · **Effort:** L · **Priority:** P2
- **Problem:** Vue 2 EOL (DEP-1) makes a Vue 3 move strategically necessary, but `bootstrap-vue@2.x` hard-blocks Vue 3 (it has no Vue-3 release). A naive Vue 3 bump breaks the entire UI layer.
- **Approach:** Plan in order: (1) inventory BootstrapVue component usage, (2) choose a Vue-3-compatible UI layer (BootstrapVueNext or a migration off Bootstrap-Vue), (3) then the Vue 2→3 codemod. This is a milestone-sized effort, not a phase — flag it for roadmap planning. **Honors the constraint** that legacy AngularJS stays alive until Vue is GA'd as v2.0.x; this is about the Vue app's *own* forward path, not legacy removal.
- **Refs:** `vue/package.json`, `vue/src/components/` (BootstrapVue usage), `.planning/ROADMAP.md`.

### MIG-2 — Define the legacy AngularJS sunset checklist (do not execute yet)
- **Category:** migration · **Effort:** S (planning only) · **Priority:** P3
- **Problem:** `src/app/` (18 JS modules) must keep working until v2.0.x GA, but there is no written trigger/checklist for when and how it gets retired. Risk of it lingering indefinitely or being cut prematurely.
- **Approach:** Write the sunset criteria now (feature parity matrix, deploy cutover, redirect plan) so retirement is a checklist later, not a debate. **Explicitly gated on the v2.0.x GA constraint** — this idea only *documents* the exit, it does not remove anything.
- **Refs:** `src/app/`, `.planning/MILESTONES.md`, `.planning/ROADMAP.md`.

---

## Priority summary

| Priority | Ideas |
|----------|-------|
| **P1** | DEP-1 (Vue/Bootstrap EOL), DEP-2 (chart libs), CI-1 (test gaps), QW-1, QW-2 |
| **P2** | DEP-3, DEP-4, TEST-1, TD-1, TD-2, TD-3, PERF-1, DOC-1, MIG-1, QW-3, QW-4, QW-5 |
| **P3** | CI-2, CI-3, TEST-2, PERF-2, UX-1, DOC-2, MIG-2 |

**Sequencing note:** the cheap, high-value cluster is QW-1→QW-5 + DEP-2 + PERF-1 — all low-risk, no new runtime deps, and they compound (fewer libs + lazy routes = a much smaller bundle). The structural items (DEP-1, MIG-1, TEST-1) are milestone-scale and belong in roadmap planning, not a quick phase.

# scripts/

Maintenance scripts for the THiNX console repo. Zero npm dependencies — plain Node.

## doc-drift.js — documentation drift detector

Catches docs that have fallen out of sync with the code. It scans the markdown
docs (`README.md`, `AGENTS.md`, `CLAUDE.md`, and `docs/*.md`) for three
high-signal drift indicators:

| Check            | What it flags                                                                 |
|:-----------------|:------------------------------------------------------------------------------|
| `broken-link`    | A relative file/dir path referenced in prose (markdown links + inline code) that no longer exists on disk. |
| `unknown-script` | An `npm`/`yarn`/`pnpm run <name>` reference whose script is absent from **every** `package.json` in the repo. |
| `missing-source` | A source path inside a fenced code block that points into the repo but does not exist. |

A path is only checked when its first segment is a real top-level entry (e.g.
`src/`, `vue/`, `.circleci/`) or when it is explicitly `./` / `../` relative.
This keeps npm package names, URLs, and shell variables out of the results
without an ever-growing allowlist. Legacy AngularJS paths under `src/` are
treated as live (legacy is supported until the Vue console ships as v2.0.x).

### Running it

```
# from the repo root
node scripts/doc-drift.js

# or via the vue/ project
cd vue && npm run doc-drift
```

It exits `1` when drift is found and `0` when clean, so it can gate CI.

### Suppressing intentional examples

False positives (deliberate examples, placeholder paths) can be silenced:

- Put `<!-- doc-drift-ignore -->` on the offending line, or on the line directly
  above it.
- Put `<!-- doc-drift-ignore-file -->` anywhere in a file to skip the whole file.
- Add a substring to the `ALLOWLIST` array near the top of `scripts/doc-drift.js`.

## cypress-flake-analyzer.js - Cypress flakiness scanner

Creates repeatable local reports for Cypress flakiness signals. The static scan
covers both active Vue tests under `vue/cypress` and legacy AngularJS tests
under `src/cypress`. Dynamic repeated execution is limited to the active Vue
Cypress suite because CircleCI currently runs `vue` Cypress tests while the
legacy `src` Cypress job is disabled.

The script has no npm dependencies beyond the Cypress package that already
belongs to the Vue project. It writes generated reports under
`.flake-reports/latest/` by default:

| File | Purpose |
|:-----|:--------|
| `report.json` | Machine-readable scan metadata, static findings, dynamic run outcomes, and inferred classifications. |
| `summary.md` | Concise human summary for local review or PR notes. |
| `runs/run-*.json` | Raw Cypress module API results for each completed repeated run. |

Generated report files are ignored by git.
Custom `--out-dir` / `FLAKE_OUT_DIR` values are resolved from the current
working directory, so `cd vue && FLAKE_OUT_DIR=../.flake-reports/login ...`
writes under the repo-level ignored report directory.

### Static checks

The static pass flags:

- focused tests: `it.only`, `describe.only`, `context.only`
- skipped tests: `xit`, `*.skip`, `this.skip()`
- fixed waits: numeric `cy.wait(...)`
- active tests whose body only contains TODO/pending comments
- credential-dependent tests using `cy.login()`, `cy.loginAsAdmin()`, or Cypress credential env reads
- direct localhost URL assumptions such as `http://localhost:3000/...`

Static findings are advisory. The script exits successfully when it finds
signals so developers can generate reports without breaking local workflows.

### Dynamic repeated runs

`flake:analyze` can run the Vue Cypress suite repeatedly and aggregate outcomes
per spec/test. A test is classified as `flaky` only when the same test has at
least one final passing run and one final failing run across the repeated
executions. Consistently failing tests are reported separately.

Before starting Cypress, the analyzer checks prerequisites that would otherwise
look like test failures:

- Vue Cypress package is installed in `vue/node_modules`
- selected specs that call `cy.login()` have a configured username/password
- the Vue app is reachable at the `baseUrl` from `vue/cypress.json`, unless the
  server check is disabled

Missing non-admin login credentials skip dynamic execution by default and are
recorded in the report. Admin credentials are not a hard preflight gate because
`vue/cypress/integration/admin.spec.js` already skips itself when
`CYPRESS_ADMIN_USER` / `CYPRESS_ADMIN_PASS` are absent.

### Running it

```
# static scan for both Vue and legacy Cypress tests
cd vue && yarn flake:scan

# static-only legacy scan
cd src && npm run flake:scan

# repeated Vue analysis, default 5 runs
cd vue && yarn flake:analyze

# run a single spec 10 times and write to a custom report directory
cd vue && FLAKE_RUNS=10 FLAKE_SPEC=cypress/integration/login.spec.js \
  FLAKE_OUT_DIR=../.flake-reports/login yarn flake:analyze
```

For dynamic runs, start the Vue dev server first or run the analyzer behind
`start-server-and-test`:

```
cd vue
yarn serve
# in another shell:
CYPRESS_THINX_TEST_PASSWORD=... yarn flake:analyze
```

### Environment variables and options

| Env var | CLI option | Default | Notes |
|:--------|:-----------|:--------|:------|
| `FLAKE_RUNS` | `--runs` | `5` | Number of repeated Vue Cypress executions. |
| `FLAKE_SPEC` / `CYPRESS_SPEC` | `--spec` | all Vue specs | Cypress spec path/glob for dynamic runs. |
| `FLAKE_SUITE` | `--suite` | `all` | Static scan scope: `all`, `vue`, or `legacy`. |
| `FLAKE_OUT_DIR` | `--out-dir` | `.flake-reports/latest` | Report output directory. |
| `FLAKE_STATIC_ONLY=1` | `--static-only` | off | Skip dynamic Cypress execution. |
| `FLAKE_SKIP_DYNAMIC=1` | `--skip-dynamic` | off | Skip dynamic Cypress execution. |
| `FLAKE_SKIP_MISSING_CREDENTIALS=0` | `--require-credentials` | skip missing creds | Treat missing required login creds as setup errors. |
| `FLAKE_SKIP_UNAVAILABLE_SERVER=0` | `--require-server` | skip unavailable app | Treat an unreachable Vue app as a setup error. |
| `FLAKE_SKIP_SERVER_CHECK=1` | `--skip-server-check` | off | Let Cypress perform the baseUrl check. |
| `FLAKE_BROWSER` | `--browser` | Cypress default | Browser passed to Cypress. |

Credential variables recognized by the Vue login helpers:

- `CYPRESS_THINX_TEST_USER` or `CYPRESS_LOGIN_USERNAME`
- `CYPRESS_THINX_TEST_PASSWORD` or `CYPRESS_LOGIN_PASSWORD`
- `CYPRESS_ADMIN_USER`
- `CYPRESS_ADMIN_PASS`

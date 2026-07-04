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

## test-flakiness-analyzer.js - Cypress flakiness analyzer

Provides a repeatable local baseline for the active Vue Cypress suite while
also scanning the legacy AngularJS Cypress tree. The script is zero-dependency
Node and writes generated output under `.flakiness-reports/`, which is ignored.

### Static checks

The static scan walks `vue/cypress` and/or `src/cypress` and reports:

| Check | What it flags |
|:------|:--------------|
| `focused-test` | `it.only`, `describe.only`, or `context.only` that limits suite coverage. |
| `skipped-test` / `runtime-skip` | `xit`, `.skip`, and `this.skip()` coverage gaps. |
| `fixed-wait` | `cy.wait(<number>)` and legacy `browser.sleep(<number>)` timing assumptions. |
| `todo-only-test` | Tests whose bodies contain only TODO comments. |
| `credential-dependent` | Specs that call login helpers or read credential-like env/fixture values. |
| `localhost-url` | Direct `localhost` / `127.0.0.1` URL visits instead of portable baseUrl-relative visits. |

Focused tests are treated as blocking findings. Other static findings are
warnings or info so the scan remains useful while the current suite is being
hardened.

### Running it

```
# from the repo root, scan both Vue and legacy Cypress tests
node scripts/test-flakiness-analyzer.js --project all --static-only

# from the Vue project, static-only scan
cd vue && yarn flake:scan

# npm works too if Yarn is not installed locally
cd vue && npm run flake:scan

# from the Vue project, start the dev server and run repeated Cypress analysis
cd vue && yarn flake:analyze

# from the legacy AngularJS project, static-only scan
cd src && npm run flake:scan
```

Dynamic analysis is intentionally Vue-only because CircleCI runs the Vue test
job while the legacy `src/cypress` job is disabled. By default it requests 5
Cypress runs and classifies a test as flaky only when the same full test title
both passes and fails across parsed runs.

### Dynamic prerequisites

Repeated runs require the Vue dependencies and Cypress binary:

```
cd vue && yarn install
# or
cd vue && npm install
```

Most Vue specs also require live test credentials. Set them before dynamic
analysis:

```
export CYPRESS_THINX_TEST_USER=...
export CYPRESS_THINX_TEST_PASSWORD=...
```

When credentials are missing, the analyzer records `missing-credentials` and
skips Cypress by default. This is reported as setup state, not test flakiness.

### Controls

CLI flags and matching environment variables:

| Flag | Environment | Default | Meaning |
|:-----|:------------|:--------|:--------|
| `--project vue|src|all` | `FLAKE_PROJECT` | `all` | Static scan scope. Dynamic is Vue-only. |
| `--static-only` | `FLAKE_STATIC_ONLY` | `false` | Skip repeated Cypress execution. |
| `--runs <count>` | `FLAKE_RUNS` | `5` | Number of Vue Cypress repetitions. |
| `--spec <pattern>` | `FLAKE_SPEC` | empty | Pass a Cypress `--spec` filter to repeated runs. |
| `--out-dir <path>` | `FLAKE_OUT_DIR` | `.flakiness-reports` | Report and run artifact directory. |
| `--run-without-credentials` | `FLAKE_SKIP_DYNAMIC_WITHOUT_CREDS=false` | skip | Attempt dynamic execution even when login credentials are missing. |
| `--require-dynamic` | `FLAKE_REQUIRE_DYNAMIC` | `false` | Exit non-zero when dynamic execution is skipped. |

### Output

Each run writes:

- `.flakiness-reports/latest.json` - machine-readable static and dynamic
  results, including per-spec and per-test pass/fail/skip counts, duration
  stats, first failure messages, inferred failure categories, and flaky
  classifications.
- `.flakiness-reports/latest.md` - concise human summary.
- `.flakiness-reports/cypress-run-*/` - stdout/stderr logs and Cypress
  screenshots from repeated runs when dynamic execution is attempted.

Failure categories are heuristics intended to speed triage, not replace reading
the Cypress failure output. A setup failure such as missing credentials, missing
Cypress binary, or failed `cypress verify` is kept separate from test outcomes.

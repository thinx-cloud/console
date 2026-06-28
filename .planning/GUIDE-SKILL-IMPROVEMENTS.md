# Guide & Skill Documentation — Improvement Report

**Audit date:** 2026-06-07
**Branch:** `nightshift/guide-improver`
**Scope:** Human- and agent-facing guide/skill documentation in `services/console`
**Task:** Nightshift `guide-improver`

## Files audited

| File | Type | Verdict |
|------|------|---------|
| `README.md` | Build/test/commit guide | Fixes applied + recommendations |
| `dev/README.md` | Dev-env stub (deprecated) | Recommendation |
| `vue-dev/README.md` | Dev-env stub (deprecated) | Recommendation |
| `dev/TASK_GROOMING.md` | Task-template guide | OK — accurate |
| `IMPROVEMENTS.md` | Deferred-work log | OK — accurate |
| `IMPLEMENTATION_PLAN.md` | Migration plan | Recommendation |
| `.planning/PROJECT.md` | Living project constitution | OK — already correct |
| `.planning/ROADMAP.md` | Milestone roadmap | Fix applied |
| `.planning/v1.x-backlog.md` | Operational backlog | Fix applied |
| `.planning/` phase-N docs | Historical GSD artifacts | Left intact (see F-06) |

No `AGENTS.md`, `CLAUDE.md`, or `docs/` directory exists in this repo. The
memory note `swarm-deploy-script-name` references an `AGENTS.md` docs fix; the
equivalent live error actually lived in `.planning/v1.x-backlog.md` (see F-03).

---

## Applied fixes (safe, verifiable)

### F-01 — README build command: backslash + missing context — `README.md:18` — MEDIUM
**Was:** `docker build -t yourname\console`
**Now:** `docker build -t yourname/console .`
Windows-style backslash made the tag invalid on the documented (Linux/macOS)
toolchain, and the build context (`.`) was missing entirely. Verifiable typo.

### F-02 — README test example malformed + non-existent script — `README.md:38` — MEDIUM
**Was:** `docker run -ti -v $(pwd):/var/work thinxcloud/console-build-env:vue cd /var/work && npm run test:unit`
**Now:** `docker run -ti -v $(pwd):/var/work thinxcloud/console-build-env:vue bash -c "cd /var/work/vue && yarn && yarn test"`
Three defects: (1) `cd /var/work` was passed as the container's command (not a
valid binary); (2) `&& npm run test:unit` ran on the **host**, not the
container; (3) there is **no** `test:unit` script — `vue/package.json` defines
`test` (`start-server-and-test serve … cy:test`), and CI (`.circleci/config.yml`
`test_vue`) runs `yarn test` from `vue/`. New form mirrors CI.

### F-03 — Swarm deploy script name — `.planning/v1.x-backlog.md:117,121` — LOW
**Was:** `./scripts/stack-deploy` / `stack-deploy`
**Now:** `./restart.sh`
The real swarm-host script on `188.166.23.244` is `./restart.sh` (memory
`swarm-deploy-script-name`). `.planning/PROJECT.md:101` already documents the
correct name and flags the discrepancy; the backlog still carried the wrong
name. Now consistent.

### F-04 — Legacy GSD colon command syntax — `.planning/ROADMAP.md:9,70` — LOW
**Was:** `/gsd:plan-phase`
**Now:** `/gsd-plan-phase`
Project standard is the hyphen form; colon is legacy (memory
`gsd-command-syntax-hyphen`). These are forward-looking operator instructions,
not historical records. Line 70 was internally inconsistent — it already used
the hyphen form `/gsd-new-milestone` in the same sentence.

---

## Recommendations (not auto-applied — need owner judgement)

### F-05 — Stale Vue deploy URL — `IMPLEMENTATION_PLAN.md:5` — LOW
Header states Vue console is "deployed at staging.thinx.cloud". The current
deploy target is `console.thinx.cloud` (`.planning/PROJECT.md:17`). This is a
dated (2026-03-14) plan header; left untouched because the staging URL may be an
accurate historical record. Recommend updating the live target or annotating it
as historical.

### F-06 — Legacy `/gsd:` colon syntax across historical phase docs — INFO
The colon form persists in many `.planning/phase-*/` RESEARCH/VALIDATION docs
(e.g. `phase-4/04-RESEARCH.md`, `phase-8/08-RESEARCH.md`). These are immutable
historical artifacts and were deliberately **not** rewritten. Recommendation:
use the hyphen form in all new docs; do not retroactively edit completed phases.

### F-07 — Duplicate deprecated dev-env stubs — `dev/README.md`, `vue-dev/README.md` — LOW
Both files are byte-identical ("THiNX Console Development Environment —
Deprecated") and carry trailing whitespace. Recommend consolidating to a single
canonical stub (or deleting the redundant `vue-dev/README.md`) to avoid drift.

### F-08 — Outdated "until this is documented" clause — `README.md:9` — LOW
The Usage section says to read `.circleci/config.yml` for build-args "until this
is documented" — but the build-args **are** documented in the table immediately
below. Recommend dropping the clause.

### F-09 — Dead status badges — `README.md:3` — LOW
The README links an `lgtm.com` alerts badge. LGTM.com was retired by GitHub in
2022, so the badge is permanently broken. Recommend removing the LGTM badge
(FOSSA badges remain valid).

---

## Verified-correct (no change — documented to prevent future regressions)

### F-10 — `WEB_HOSTNAME` default `rtm.thinx.cloud` — `README.md:25`
Looks inconsistent with the `console.thinx.*` example, but is **correct**: the
legacy console deploys to `rtm.thinx.cloud` (`src/package.json` `build:test`
sets `WEB_HOSTNAME=https://rtm.thinx.cloud`; `IMPLEMENTATION_PLAN.md:4` and
`PROJECT.md:71` confirm). Do not "fix" this to `console.thinx.cloud`.

---

## Summary

- **4 fixes applied** (F-01..F-04): 2 in `README.md`, 1 in `.planning/v1.x-backlog.md`, 1 in `.planning/ROADMAP.md`.
- **5 recommendations** (F-05..F-09) left for owner judgement.
- **1 false-positive documented** (F-10) so it is not mistakenly "corrected" later.
- All applied changes verified against the live repo (`.circleci/config.yml`,
  `vue/package.json`, `src/package.json`) and project memory.

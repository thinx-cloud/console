# Skill Grooming Audit

**Date:** 2026-06-13
**Scope:** Audit and update project-local agent skills (`.claude/skills`, `.codex/skills`) to match the current codebase.
**Result:** No project-local agent skills exist. Nothing to groom. One follow-up proposed (deferred to maintainer).

---

## What was checked

| Location | Finding |
|:---------|:--------|
| `.codex/` | Absent (no `.codex` directory at repo root). |
| `.claude/` | Present, but holds only `settings.local.json`, `scheduled_tasks.lock`, and an empty `worktrees/` dir. No `skills/` subdirectory. |
| `.claude/skills` | Absent. |
| `.codex/skills` | Absent. |
| `git ls-files .codex .claude` | No tracked files under either path. |
| `find . -name 'SKILL.md' -not -path '*/node_modules/*'` | Zero matches (tracked or untracked). |
| `find . -type d -name 'skills'` | Zero matches outside `node_modules`. |

**Conclusion:** Zero project-local `SKILL.md` files exist in this repository. There are therefore no frontmatter violations, no naming-rule violations, and no stale file/script/path references to fix within skills.

> Note: The skills surfaced in the agent runtime (e.g. `gsd-*`, `superpowers:*`) are installed globally / via plugins, not committed to this repo. They are out of scope for a *project-local* skill audit and were not modified.

## Spec criteria applied

Grounded against the Agent Skills specification, indexed via `https://agentskills.io/llms.txt` and read from `https://agentskills.io/specification.md` (fetched 2026-06-13). Had any `SKILL.md` been found, it would have been validated against:

**Required frontmatter**
- `name` — 1-64 chars; lowercase `a-z`, `0-9`, hyphens only; must not start/end with a hyphen; no consecutive hyphens (`--`); **must match the parent directory name**.
- `description` — 1-1024 chars; non-empty; should state both what the skill does and when to use it.

**Optional frontmatter**
- `license`, `compatibility` (1-500 chars), `metadata` (string->string map), `allowed-tools` (space-separated, experimental).

**Structure**
- Skill = a directory containing at minimum `SKILL.md`; optional `scripts/`, `references/`, `assets/`.
- File references use relative paths from the skill root, kept one level deep.
- Keep `SKILL.md` under ~500 lines / ~5000 tokens; push detail into `references/`.
- Official validator: `skills-ref validate ./my-skill`.

## Project context reviewed (for any future skill authoring)

Authoritative sources read during the audit, both confirmed present:

- `README.md` — THiNX Management Console. AngularJS app (legacy) managing IoT devices via the THiNX API, with a Vue rewrite in `vue/`. Key facts a skill would need: image must be **self-built** (build-args inject env-specific values; no public image); build via `docker build` with `LANDING_HOSTNAME` / `API_HOSTNAME` / `API_BASEURL` / `WEB_HOSTNAME` / `ENTERPRISE` / `ENVIRONMENT` / integration tokens; unit tests via `npm run test:unit` inside the build-env container; **Conventional Commits enforced** by a `commit-msg` husky/commitlint hook (install with `yarn install` in `vue/`).
- `dev/TASK_GROOMING.md` — task template (Title / Goal / Acceptance criteria / Steps / Estimate / Owner / Assumptions) plus three worked examples; keep groomed tasks <= 2 days.

Both paths cited above were verified to exist at audit time.

## Follow-up (deferred to maintainer)

**Should this repo scaffold project-local skills?** Creating new skills is outside the safe-update scope of a grooming pass, so it is left as a maintainer decision rather than applied here.

Two candidates would have clear, repeatable value and are well-grounded in existing docs:

1. **`build-and-test-console`** — encode the self-build requirement, the build-arg matrix, and the `npm run test:unit`-in-container workflow from `README.md`, so an agent stops re-deriving the (non-obvious) "build your own image" constraint.
2. **`groom-task`** — wrap `dev/TASK_GROOMING.md` into an invocable skill that emits the task template and enforces the <= 2-day / acceptance-criteria-required conventions.

If pursued, place them under `.claude/skills/<name>/SKILL.md` (and mirror to `.codex/skills/` if Codex support is wanted), with `name` matching the directory, a when-to-use `description`, and validate via `skills-ref validate` before committing.

No files were modified by this audit other than the creation of this record.

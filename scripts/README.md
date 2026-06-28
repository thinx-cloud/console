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

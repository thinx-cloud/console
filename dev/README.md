# THiNX Console Development Environment

Deprecated – migrated to:

- registry.thinx.cloud:5000/thinxcloud/thinx-build-env 
- docker.io/suculent/thinx-build-env 
---

## Schema Evolution Advisor

`dev/schema-advisor.js` is a zero-dependency Node dev tool that guards the
console against breaking backend API schema drift.

### Why it exists

The authoritative database schema lives in the parent `thinx-device-api`
repository, not in this UI client. The console is a *consumer* of that schema.
When the backend renames, removes, or retypes a field the console reads, the UI
breaks silently. The advisor turns that risk into a CI-gating signal by:

1. Statically extracting the per-entity field sets the console relies on, from
   the Vuex store modules (`vue/src/store/*.js`) and the legacy AngularJS
   controllers (`src/app/js/controllers/*.js`) -- so **both** supported clients
   are covered (legacy must keep working until Vue ships as v2.0.x).
2. Snapshotting that contract into a committed baseline (`dev/schema-baseline.json`).
3. Diffing live code against the baseline, classifying each change and failing
   the build on breaking ones.

### Usage

Run from the `vue/` workspace via the npm script (no new dependencies):

```
npm run schema:advisor              # diff live code vs baseline (CI gate)
npm run schema:advisor -- --update  # re-snapshot the baseline + report
npm run schema:advisor -- --json    # print the extracted model as JSON
npm run schema:advisor -- --help    # usage
```

Or directly: `node dev/schema-advisor.js [--update|--json|--help]`.

Every run rewrites `dev/SCHEMA_ADVISOR.md` (human-readable report). `--update`
additionally rewrites `dev/schema-baseline.json`.

### Interpreting the output

Each change is classified and severity-ranked:

| Kind | Severity | Meaning |
| --- | --- | --- |
| `REMOVED` | breaking | a field the console reads is gone from the code -> exit 1 |
| `RENAMED` | breaking | a removed + added pair look like a rename (string-similarity heuristic) -> exit 1 |
| `TYPE-CHANGED` | breaking | a field's inferred type changed -> exit 1 |
| `ADDED` | info | a new field appeared; informational only -> exit 0 |

Exit codes: **0** = no breaking drift, **1** = breaking drift detected (or error).

### Workflow

- When you intentionally change which fields the console consumes, run
  `--update` and commit the regenerated `schema-baseline.json` alongside your
  change. Reviewers see the contract delta in the diff.
- In CI, run `npm run schema:advisor` (no flag). A non-zero exit means the live
  code no longer matches the committed contract -- either an accidental
  regression or a baseline that needs updating.

### Scope and intentional limitations

This first slice covers the highest-value entities: `devices`, `apikeys`,
`rsakeys`, `channels`, `enviros`, `profile`. Extraction is **deliberately
conservative** (favours precision over recall):

- Fields come from two high-signal sources only: Vuex `headers[].prop`
  declarations and member-access expressions (`alias.field`) on a small, curated
  set of item aliases per source file. Comments are stripped first, so
  commented-out config does not leak phantom fields.
- Write payloads (request params like `udids`, `fingerprints`) are *not* treated
  as entity fields -- they are request shapes, not read contract.
- Inferred types are name-based heuristics, present only to catch obvious
  `TYPE-CHANGED` drift; they are not authoritative.

To extend coverage, add entries to the `ENTITIES` array in
`dev/schema-advisor.js` and re-run `--update`.

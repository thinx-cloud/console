---
phase: 3
phase_name: Transformers with Code Editor
date: 2026-05-19
---

# Phase 3: Validation Strategy

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Cypress 9.5.4 (E2E only — no unit test framework present) |
| Config file | `vue/cypress.json` |
| Quick run command | `yarn cy:open` (interactive) |
| Full suite command | `yarn test` (starts dev server + runs Cypress headless) |

**Note:** There are no unit tests in this project. The only tests are Cypress E2E. The existing Cypress login test is marked failing with a TODO. No new test infrastructure is created in Phase 3 scope. Task-level verification uses `grep` commands to confirm code edits, not behavioral tests.

## Requirements → Verification Map

| Req ID | Behavior | Type | Command / Method | Notes |
|--------|----------|------|-----------------|-------|
| TRAN-01 | Store sends `{ transformers: [...] }` at POST body top level | grep | `grep -n "JSON.stringify" vue/src/store/transformers.js` | Must show no `info:` wrapper |
| TRAN-02 | Create transformer with alias → appears in list | manual smoke | `yarn cy:open` | Requires logged-in session; verify in browser |
| TRAN-03 | Delete transformer → removed from list | manual smoke | `yarn cy:open` | Pre-existing deleteItem action |
| TRAN-04 | Click Edit → navigates to `/app/transformer/:utid` | manual smoke | `yarn cy:open` | Route already registered in Routes.js |
| TRAN-05 | Editor renders with JS syntax highlighting | visual manual | `yarn cy:open` | CodeMirror renders colored tokens |
| TRAN-06 | Save → body stored as base64; reload → body decoded safely | manual smoke | `yarn cy:open` | Reload page, verify editor shows readable JS; test with non-ASCII comment to confirm UTF-8 wrapper |
| TRAN-07 | Edit body, navigate away → confirm dialog appears | manual smoke | `yarn cy:open` | beforeRouteLeave guard; verify in browser |

## Wave 0 Gaps

None — no pre-execution test infrastructure changes required. Cypress smoke tests are sufficient for this phase. No unit test framework exists or is required by project convention.

## Automated Edit Confirmation (per task)

| Task | Command | Expected Output |
|------|---------|----------------|
| 03-01 T1 (POST body fix) | `grep -n "JSON.stringify" vue/src/store/transformers.js` | Shows `JSON.stringify({ transformers })` — no `info:` |
| 03-01 T2 (alias guard) | `grep -n "duplicate\|A transformer with this alias" vue/src/pages/Transformers/Transformers.vue` | Shows find() call and error string |
| 03-02 T1 (post-save nav) | `grep -n "router.push\|hasChanges" vue/src/pages/Transformers/TransformerEditor.vue` | Shows `hasChanges = false` before push |
| 03-02 T2 (UTF-8 btoa) | `grep -n "encodeURIComponent\|decodeURIComponent" vue/src/store/transformers.js vue/src/pages/Transformers/TransformerEditor.vue` | Shows wrappers in both files |

## Build Verification

After all tasks complete:

```bash
cd vue && npm run build
```

Must exit 0. No new webpack errors introduced.

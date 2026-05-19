---
phase: 03-transformers
plan: 02
subsystem: transformers
tags: [vue, store, ux, bug-fix, security]
dependency_graph:
  requires: [03-01]
  provides: [transformer-save-redirect, utf8-safe-base64]
  affects: [transformer-editor, transformers-store]
tech_stack:
  added: []
  patterns: [router-push-after-save, utf8-btoa-wrapper, utf8-atob-wrapper]
key_files:
  created: []
  modified:
    - vue/src/pages/Transformers/TransformerEditor.vue
    - vue/src/store/transformers.js
decisions:
  - "hasChanges = false set before $router.push to prevent beforeRouteLeave confirm dialog firing on programmatic redirect"
  - "UTF-8 btoa wrapper (btoa(unescape(encodeURIComponent(body)))) applied only to updateItem — createItem defaultBody is ASCII-only constant so no wrapper needed there"
  - "try/catch fallback in loadTransformer preserved unchanged to handle malformed stored base64 gracefully"
metrics:
  duration: 5m
  completed: 2026-05-20
  tasks_completed: 2
  files_modified: 2
---

# Phase 3 Plan 02: Fix Post-Save Navigation and UTF-8 Safe Base64 Summary

Post-save redirect from TransformerEditor to the transformer list, plus UTF-8 safe btoa/atob wrappers preventing InvalidCharacterError when transformer bodies contain non-Latin1 characters.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix post-save navigation in TransformerEditor.vue | 83a2174 | vue/src/pages/Transformers/TransformerEditor.vue |
| 2 | UTF-8 safe base64 encode (store) and decode (editor) | 62baa98 | vue/src/store/transformers.js, vue/src/pages/Transformers/TransformerEditor.vue |

## What Was Built

**Task 1 — TransformerEditor.vue post-save redirect:**
- Replaced `this.saved = true` in `save()` success branch with `this.$router.push('/app/transformers')`.
- `this.hasChanges = false` is set immediately before the push so `beforeRouteLeave` does not intercept the programmatic navigation with a confirm dialog.
- Removed dead code: `saved: false` from `data()` and the green `<b-alert v-if="saved" ...>Transformer saved.</b-alert>` from the template.
- `beforeRouteLeave`, `loadTransformer`, the error alert, and the unsaved-changes alert are all unchanged.

**Task 2 — UTF-8 safe base64:**
- `transformers.js` `updateItem`: `body: btoa(body)` changed to `body: btoa(unescape(encodeURIComponent(body)))` — prevents `InvalidCharacterError` when transformer body contains non-Latin1 characters (e.g. Unicode identifiers, arrow functions with `→`).
- `TransformerEditor.vue` `loadTransformer` try block: `atob(transformer.body)` changed to `decodeURIComponent(escape(atob(transformer.body)))` — symmetric decode-safe counterpart.
- `createItem` `defaultBody` uses plain `btoa` (ASCII-only string constant) — left unchanged per plan.
- try/catch fallback in `loadTransformer` preserved intact: malformed stored base64 falls back to `transformer.body || ''`.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. T-03-04 (btoa UTF-8 safety), T-03-05 (atob UTF-8 safety), and T-03-06 (beforeRouteLeave guard ordering) mitigated as planned.

## Self-Check: PASSED

- [x] vue/src/pages/Transformers/TransformerEditor.vue exists and contains `$router.push('/app/transformers')` in save() success branch
- [x] No `this.saved = true`, `saved: false`, or `v-if="saved"` remain in the file
- [x] vue/src/store/transformers.js exists and contains `btoa(unescape(encodeURIComponent(body)))` in updateItem
- [x] vue/src/pages/Transformers/TransformerEditor.vue contains `decodeURIComponent(escape(atob(transformer.body)))` in loadTransformer
- [x] try/catch block still present in loadTransformer at lines 84-87
- [x] Commit 83a2174 exists
- [x] Commit 62baa98 exists

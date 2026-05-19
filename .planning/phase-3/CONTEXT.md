# Phase 3: Transformers with Code Editor - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Transformers are fully manageable with a proper code editing experience. This phase delivers:
- Transformer list with create (alias only) + delete
- TransformerEditor page at `/app/transformer/:utid` with CodeMirror 5 JS editor
- Base64 encode on save, decode on load (with UTF-8 safety wrapper)
- Unsaved-changes guard via `beforeRouteLeave`
- Duplicate alias prevention in create modal

**Both Transformers.vue and TransformerEditor.vue are already scaffolded** — this phase is verification, targeted fixes, and closing 4 specific gaps identified in discussion.

</domain>

<decisions>
## Implementation Decisions

### TRAN-01: Store decoupling from /profile
- **D-01:** Accept the current POST /api/v2/profile approach — no dedicated `/transformer` CRUD endpoints exist on the backend (confirmed via codebase scan). The store already sends only `{ transformers: [...] }`, not the full profile; `owner.js process_update` handles partial updates safely.
- **D-02:** The planner should verify the store's `fetchItems` path is self-contained (reads from `result.response.info.transformers` after GET /api/v2/profile) and add a code comment explaining the backend constraint so future developers understand why `/transformer` endpoints are not used.

### Duplicate alias guard
- **D-03:** Add duplicate alias detection to `create()` in `Transformers.vue` using `this.items.find(t => t.alias === alias)`. Show an inline `<b-alert>` error inside the create modal (same pattern as REPO-03 in Repositories.vue). Clear the error at the start of each `create()` call.

### Post-save navigation
- **D-04:** After a successful save in `TransformerEditor.vue`, navigate back to `/app/transformers` (replace the current "stay on page + green banner" behavior). Clear `hasChanges = false` before navigating to avoid triggering the `beforeRouteLeave` guard.

### btoa/atob UTF-8 safety
- **D-05:** Replace the raw `btoa(body)` call in the store's `updateItem` action with a UTF-8 safe encode wrapper: `btoa(unescape(encodeURIComponent(body)))`. Replace the `atob(transformer.body)` decode in `TransformerEditor.vue` with: `decodeURIComponent(escape(atob(transformer.body)))`. The existing try/catch around the decode call should remain as a fallback for malformed stored data.

### Claude's Discretion
- CodeMirror editor height (currently 400px fixed) — maintain as-is unless there's a functional reason to change
- Editor tab size, theme, line numbers — already configured in `editorOptions`; maintain current values
- Success feedback on save — a brief toast or redirect banner is acceptable, but the redirect to list is the primary UX

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core implementation files
- `vue/src/store/transformers.js` — current store: fetchItems, createItem, updateItem, deleteItem, saveTransformers
- `vue/src/pages/Transformers/Transformers.vue` — list page with create modal and delete confirm
- `vue/src/pages/Transformers/TransformerEditor.vue` — editor page with CodeMirror, beforeRouteLeave, save/cancel
- `vue/src/Routes.js` — transformer routes already registered here

### API constraint reference
- `services/console/IMPLEMENTATION_PLAN.md` — API endpoint map; the `/transformer` POST/DELETE rows are marked "missing" and should be treated as "will not be implemented" (backend does not support them)
- `.planning/phase-3/RESEARCH.md` — full research with verified API findings, pitfalls, and code patterns

### Phase 2 pattern reference (for alias guard)
- `vue/src/pages/Repositories/Repositories.vue` — REPO-03 duplicate alias guard implementation to mirror in Transformers.vue

### Project requirements
- `.planning/REQUIREMENTS.md` — TRAN-01 through TRAN-07 definitions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `codemirror@5.65.21` + `vue-codemirror@4.0.6`: already installed, do NOT upgrade (Vue 3 incompatible)
- `this.$bvModal.msgBoxConfirm`: used for delete confirm and beforeRouteLeave — same for any new confirm dialogs
- `<b-alert>` with `:show="!!error"` pattern from Repositories.vue: reuse for alias guard error display

### Established Patterns
- Store modules use `mapGetters` spread into `methods` (not `computed`) — existing convention, do not refactor
- `this.$api.$post('/profile', JSON.stringify({ transformers }))` — the correct profile write pattern; note `JSON.stringify` wrapping
- `this.$api.$get('/profile')` resolves to `GET /api/v2/profile` (ThinxApi prepends `/api/v2` to all paths)

### Integration Points
- `Transformers.vue` create modal → `transformers/createItem` action → POST /api/v2/profile
- `TransformerEditor.vue` save → `transformers/updateItem` action → btoa encode → POST /api/v2/profile
- Both routes already registered: `{ path: '/app/transformers', name: 'Transformers' }` and `{ path: '/app/transformer/:utid', name: 'TransformerEditor' }`

</code_context>

<specifics>
## Specific Ideas

- Post-save navigation: `this.$router.push('/app/transformers')` after `this.hasChanges = false` in the `save()` method's success branch
- Alias guard mirrors Repositories.vue exactly — same `b-alert` placement inside the modal, same `this.error = null` at start of `create()`
- UTF-8 safe wrappers: encode = `btoa(unescape(encodeURIComponent(body)))`, decode = `decodeURIComponent(escape(atob(s)))` — standard browser-safe pattern, no libraries needed

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 3-Transformers with Code Editor*
*Context gathered: 2026-05-19*

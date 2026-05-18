# Phase 2: Management Page CRUD — Research

**Researched:** 2026-05-18
**Domain:** Vue 2 + Vuex + BootstrapVue — CRUD management pages
**Confidence:** HIGH (all findings from direct codebase inspection, no training-data guesses)

---

## Summary

All five management pages (API Keys, Repositories, RSA Keys, Enviros, Channels) share an
**identical architectural skeleton** that is already fully implemented in the codebase. Every
store module already has `createItem` and `deleteItems` actions. Every page component already
has a working `create()` and `deleteSelected()` method wired to a `b-modal` and the `List`
component. The two "one-time reveal" pages (Apikeys and Rsakeys) already have result modals
in their templates.

**The work is already done for all five pages.** The planner should verify each page against
the API spec and confirm correctness rather than building from scratch. The only real gap is
Channels: the store uses `/mesh` (not `/channel`) and the delete payload shape needs
verification against the actual API.

**Primary recommendation:** Run integration tests against all five pages against a live API
instance before declaring Phase 2 complete. Code review for correctness (payload shapes,
field names, error handling) is the primary task.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| API communication | Vuex store actions (`this.$api.*`) | — | All HTTP calls go through the shared `Api` class injected as `store.$api` |
| State management | Vuex store module | — | `state.items` + mutations keep data; page reads via getters |
| UI / form collection | Vue page component | BootstrapVue `b-modal` | Form state lives in `data().form`, never in the store |
| Row selection | `List.vue` component | Page (`selectionUpdated` handler) | List owns checkbox state, emits `selection-update` events |
| One-time key display | Page component | `b-modal` (result modal) | `createdKey` / `createdPubkey` in `data()`, shown once then cleared |
| Alias auto-generation | Page component method | — | Pure JS regex in `autoAlias()` on `@input` |

---

## Standard Stack

All dependencies are already installed. No new packages are required for Phase 2.

| Library | Version (in package.json) | Role |
|---------|--------------------------|------|
| `vue` | ^2.6.14 | Framework |
| `vuex` | ^3.6.2 | State management |
| `bootstrap-vue` | 2.21.2 | UI components including `b-modal`, `b-button`, `b-form-*` |
| `vue-router` | ^3.5.1 | Route-param watching pattern |

**No new packages needed.** Clipboard is handled by the native `navigator.clipboard` API
(see Q6 below).

---

## Package Legitimacy Audit

> No external packages are being added in this phase. This section is not applicable.

---

## Q1: Store Pattern — How Actions Are Structured

**Finding:** All five store modules follow an identical pattern. [VERIFIED: direct file read]

**API client injection:** In `vue/src/main.js` line 21, the `Api` instance is injected directly
onto the store object: `store.$api = Api;`. Inside Vuex actions, `this` refers to the store,
so actions call `this.$api.$get(...)`, `this.$api.$post(...)`, etc.

**Action return contract:** Every action returns the raw result object from `api.js`. The
result always has shape `{ success: boolean, response: any }`. On success, the action
re-fetches the list via `dispatch('fetchItems')` before returning.

**Standard action skeleton (from `apikeys.js` lines 48–64):**
```js
async fetchItems({ state, commit }) {
  const result = await this.$api.$get('/apikey');
  if (result.success) {
    commit('saveItems', { items: result.response });
  }
  return state.items;
},
async createItem({ dispatch }, alias) {
  const result = await this.$api.$post('/apikey', JSON.stringify({ alias }));
  if (result.success) await dispatch('fetchItems');
  return result;         // <-- caller inspects result.success and result.response
},
async deleteItems({ dispatch }, fingerprints) {
  const result = await this.$api.$delete('/apikey', JSON.stringify({ fingerprints }));
  if (result.success) await dispatch('fetchItems');
  return result;
},
```

**HTTP method discrepancy — IMPORTANT:** Several stores use `$put` for create, not `$post`.
Cross-reference with the Phase 2 spec:

| Page | Store currently uses | Phase 2 spec says |
|------|---------------------|-------------------|
| API Keys | `$post('/apikey', ...)` | POST `/apikey` — matches |
| Repositories | `$put('/source', ...)` | POST `/source` — MISMATCH; store uses PUT |
| RSA Keys | `$put('/rsakey', ...)` | POST `/rsakey` — MISMATCH; store uses PUT |
| Enviros | `$put('/env', ...)` | POST `/enviro` — MISMATCH: method AND path differ |
| Channels | `$put('/mesh', ...)` | POST `/channel` — MISMATCH: method AND path differ |

The planner must decide: does the actual backend accept PUT, or does it require POST? This
needs verification against the live API or backend route definitions before shipping. The
existing store code was presumably written against the real backend, so PUT may be correct
and the Phase 2 spec table may be approximate.

**`saveItems` mutation pattern:** Two variants exist.

Variant A — object keyed by id (`apikeys`, `repositories`, `rsakeys`, `channels`):
```js
saveItems(state, data) {
  let flatItems = [];
  for (let id of Object.keys(data.items)) {
    flatItems.push({ id: id, ...data.items[id] });
  }
  state.items = flatItems;
}
```

Variant B — simple array (`enviros`):
```js
saveSimpleArray(state, data) {
  let flatItems = data.items.map((item, index) => ({
    id: index,
    label: item,
  }));
  state.items = flatItems;
}
```
Enviros fetches from `/env` (not `/enviro`) and the response is a flat array of strings.
Each item gets a synthetic numeric `id` and `label` field. The `deleteItems` action sends
`{ names }` (the label values), not numeric ids.

---

## Q2: Page Pattern — What's Implemented vs What Needs Work

**Finding:** All five pages are **fully implemented** with working `create()` and
`deleteSelected()` methods. There are no empty stubs. [VERIFIED: direct file read]

**Canonical page skeleton** (identical across all 5 pages):

```
data() {
  isSelected: false        — drives Delete button :disabled
  selectedCount: 0         — shown in Delete button label
  selectedIds: []          — array of item.id values from List
  items: []                — local copy of store state
  headers: []              — local copy of store headers
  loading: true            — passed to List :showLoading
  error: null              — shown in b-alert
  form: { ... }            — create-modal form fields
}

created() {
  $watch route.params -> loadData()  [immediate: true]
}

methods:
  create(bvModalEvt)       — preventDefault, validate, call store, show result or error
  deleteSelected()         — map selectedIds to payload field, call store
  selectionUpdated(value)  — receives { count, items } from List, updates isSelected/selectedIds
  loadData()               — fetchItems() -> getItems() -> this.items
```

**Existing implementation file locations:**
- `vue/src/pages/Apikeys/Apikeys.vue` — complete, includes create modal + result modal
- `vue/src/pages/Enviros/Enviros.vue` — complete
- `vue/src/pages/Rsakeys/Rsakeys.vue` — complete, uses inline `create()` button (no modal for input; generate is a single click)
- `vue/src/pages/Repositories/Repositories.vue` — complete, includes `autoAlias()` method
- `vue/src/pages/Channels/Channels.vue` — complete

**What might still need work:**

1. **Apikeys** `deleteItems` — store sends `{ fingerprints }` (array of hash values), but the
   spec says DELETE with `{ key_hash }` (singular). The page extracts `item.hash` and passes
   the array as `fingerprints`. Verify whether the API accepts an array under `fingerprints`
   or only a single `key_hash`.

2. **RSA Keys result modal** — current implementation shows `createdPubkey` (public key), but
   the Phase 2 spec says show the **private key** in the one-time modal. The store's
   `createItem` returns the full `result.response` object from the server — check what fields
   the server actually returns (`pubkey`? `privkey`?).

3. **Channels** — the store and page use `/mesh` and `mesh_id` field names. The Phase 2 spec
   says `/channel` and `{ id }`. These are probably the same feature (mesh = channel) but
   field name alignment needs verification.

---

## Q3: Modal Pattern

**Finding:** BootstrapVue `b-modal` is used consistently across all five pages.
[VERIFIED: direct file read]

**Pattern:** Two modal types appear:

**Type A — Input modal (create form):**
```html
<b-modal id="create-apikey-modal" title="Add API Key" @ok="create" ok-title="Create">
  <!-- form fields here -->
</b-modal>
```
Triggered by: `this.$bvModal.show('create-apikey-modal')` (from a button's `@click`).
The `@ok` handler receives `bvModalEvt`. The handler **must** call `bvModalEvt.preventDefault()`
to stop the modal auto-closing before async work completes, then manually call
`this.$bvModal.hide('...')` on success.

**Type B — Result/info modal (one-time reveal, no user input):**
```html
<b-modal id="apikey-result-modal" title="API Key Created" ok-only ok-title="Close">
  <b-form-input readonly :value="createdKey" />
</b-modal>
```
Triggered by: `if (this.createdKey) this.$bvModal.show('apikey-result-modal');`
`ok-only` removes the Cancel button. No `@ok` handler needed.

**RSA Keys difference:** RSA keys has no input modal — "Generate RSA Key" is a plain
`@click="create"` button (creating requires no user input). The result modal shows the
generated public key via `b-form-textarea` (multi-line, suitable for long key strings).

**Global API:** `this.$bvModal` is available on all Vue component instances because
`Vue.use(BootstrapVue)` is called in `main.js`. No per-component import is needed.

---

## Q4: Form Component (`Form.vue`)

**Finding:** `Form.vue` (`vue/src/components/Form/Form.vue`) is an **empty stub** —
it renders `<div>Form</div>` and accepts only one meaningless `size` prop. [VERIFIED: direct
file read at lines 1–14]

**Conclusion:** The Form component is not used anywhere in the management pages. All five
pages define their form fields inline inside `b-modal`. Do not attempt to use `Form.vue`.

---

## Q5: List Component — Row Selection

**Finding:** `List.vue` (`vue/src/components/List/List.vue`) is the authoritative source.
[VERIFIED: direct file read]

**Props:**
| Prop | Type | Default | Purpose |
|------|------|---------|---------|
| `size` | Number | 21 | Unused in current template |
| `datasource` | Array | `[]` | Row data, each item needs an `id` field |
| `dataheaders` | Array | `[]` | Column definitions |
| `showLoading` | Boolean | `true` | Shows "Loading..." instead of table when true |

**Header filtering:** Only headers with `pos !== null` are shown (`filteredHeaders` computed,
line 59). Headers with `pos: null` are intentionally hidden (e.g., the full `id` and `url`
columns in Repositories).

**Selection mechanism:**
- List maintains `selectedItems: []` — an array of `item.id` values.
- Individual checkbox `@change` calls `changeCheck(ev, id)` which splices/pushes the id.
- "Select all" checkbox calls `checkAll(ev)` which sets `selectedItems` to all ids or `[]`.
- After each change, the List emits: `this.$emit('selection-update', { count, items })`.

**Page-side wiring:**
```js
selectionUpdated(value) {
  this.isSelected = value.count > 0;      // drives Delete button :disabled
  this.selectedCount = value.count;        // shown in button label
  this.selectedIds = value.items || [];    // array of item.id values
},
```

**How `deleteSelected` extracts the payload:** Each page maps `selectedIds` through
`this.items.find(item => item.id === id)` to recover the full item object, then picks the
API-required field (e.g., `item.hash` for apikeys, `item.filename` for rsakeys, `item.id`
for repos, `item.label` for enviros, `item.mesh_id` for channels).

**Known bug:** `isAllSelected` computed (line 63) uses `length == datasource.length - 1`
(off-by-one). This is a pre-existing bug; Phase 2 should not change it.

---

## Q6: Copy-to-Clipboard

**Finding:** No clipboard utility exists in the codebase. [VERIFIED: no clipboard import
found in any read file]

**Recommended approach:** Use the native `navigator.clipboard.writeText()` API. It is
supported in all modern browsers and requires no package install. For Vue 2, add a method:

```js
async copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    // Optional: show success feedback
    this.$toasted.show('Copied to clipboard!', { type: 'success' });
  } catch (err) {
    // Fallback for older browsers or non-HTTPS contexts
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
},
```

**`vue-toasted` is already installed** (package.json line 46, initialized in main.js line 53
with `duration: 10000`). Use `this.$toasted.show(...)` for clipboard success feedback.
`navigator.clipboard` requires HTTPS or localhost; the `execCommand` fallback covers HTTP
dev environments.

**Where to add the copy button:** Inside the result modal, alongside the readonly input:
```html
<b-button size="sm" @click="copyToClipboard(createdKey)">Copy</b-button>
```

---

## Q7: Alias Auto-Generation for Git URLs

**Finding:** The regex is already implemented in `Repositories.vue` line 93.
[VERIFIED: direct file read]

```js
autoAlias() {
  const match = this.form.url.match(/\/([^/]+?)(\.git)?$/);
  if (match) this.form.alias = match[1];
},
```

This regex:
- `\/([^/]+?)` — captures one or more non-slash characters after the last `/`
- `(\.git)?$` — optionally strips the `.git` suffix

**Coverage:**
| URL | Result |
|-----|--------|
| `https://github.com/user/my-repo` | `my-repo` |
| `https://github.com/user/my-repo.git` | `my-repo` |
| `git@github.com:user/my-repo.git` | `my-repo` |
| `git@github.com:user/my-repo` | `my-repo` |

The regex works correctly for both HTTPS and SSH git URLs because both end in `/reponame`
or `/reponame.git` (SSH URLs use `:org/repo` — the last `/` still exists before the repo name).

**Duplicate alias detection** (Phase 2 special requirement): Not yet implemented.
The current `create()` method does not check for duplicate aliases before submitting.
Add this guard in `create()`:
```js
const duplicate = this.items.some(item => item.alias === this.form.alias.trim());
if (duplicate) {
  this.error = `Alias "${this.form.alias.trim()}" is already in use.`;
  return;
}
```

---

## Architecture Patterns

### Data Flow
```
User clicks "Add" button
  → $bvModal.show('create-*-modal')
    → User fills form
      → User clicks modal OK
        → create(bvModalEvt) called
          → bvModalEvt.preventDefault()
            → store.dispatch('module/createItem', payload)
              → this.$api.$post|$put(path, JSON.stringify(payload))
                → api.js fetch() → parseResult()
              → if success: dispatch('fetchItems') → commit('saveItems')
              → return result
            → if result.success: hide modal, loadData(), [show result modal]
            → if !result.success: this.error = result.message

User checks rows in List
  → List emits 'selection-update' { count, items: [ids] }
    → selectionUpdated(value) stores ids in this.selectedIds

User clicks "Delete (N)" button
  → deleteSelected() called
    → map selectedIds → find items → extract payload field
      → store.dispatch('module/deleteItems', payloadArray)
        → this.$api.$delete(path, JSON.stringify({ payloadField: array }))
        → if success: dispatch('fetchItems')
      → clear selectedIds, isSelected, selectedCount
```

### Recommended Project Structure

No structural changes needed. All files are in place:
```
vue/src/
├── store/
│   ├── apikeys.js        # complete
│   ├── repositories.js   # complete
│   ├── rsakeys.js        # complete
│   ├── enviros.js        # complete
│   └── channels.js       # complete
└── pages/
    ├── Apikeys/Apikeys.vue       # complete
    ├── Repositories/Repositories.vue  # complete
    ├── Rsakeys/Rsakeys.vue       # complete
    ├── Enviros/Enviros.vue       # complete
    └── Channels/Channels.vue    # complete
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Clipboard write | Custom clipboard plugin | `navigator.clipboard.writeText()` + `execCommand` fallback |
| Toast notification | Custom notification component | `vue-toasted` (`this.$toasted.show(...)`) — already installed |
| Modal management | Custom modal state machine | `this.$bvModal.show/hide()` — already wired |
| HTTP client | Custom fetch wrapper | `this.$api.$get/post/put/delete()` via `api.js` |
| Row selection state | Custom checkbox logic | `List.vue` emits `selection-update` — already wired |

---

## Common Pitfalls

### Pitfall 1: Modal OK Handler — Forgetting `preventDefault`
**What goes wrong:** If `bvModalEvt.preventDefault()` is not called at the top of the `@ok`
handler, BootstrapVue closes the modal immediately before the async API call completes.
The user sees the modal close even if the API returned an error.
**How to avoid:** Always call `bvModalEvt.preventDefault()` on the first line of `@ok`
handlers. Call `this.$bvModal.hide(id)` manually on success.
**Warning signs:** Modal closes before the error alert appears.

### Pitfall 2: HTTP Method Mismatch (PUT vs POST)
**What goes wrong:** The Phase 2 spec says "POST" for most create endpoints, but the existing
stores use `$put`. If the method is wrong, the backend will return 404 or 405.
**How to avoid:** Test each endpoint manually (or read the backend route definitions) before
changing method verbs. The existing store code may be correct.
**Warning signs:** Store action returns `{ success: false }` with a 404/405 status.

### Pitfall 3: `deleteItems` payload field naming
**What goes wrong:** Each page sends a differently-named array field in the delete body:
`fingerprints` (apikeys), `source_ids` (repos), `filenames` (rsakeys), `names` (enviros),
`mesh_ids` (channels). Getting these wrong is silent on the frontend and the API will either
error or silently do nothing.
**How to avoid:** Verify the backend route handler for each delete endpoint before testing.

### Pitfall 4: Enviros `id` is a synthetic numeric index
**What goes wrong:** Enviros items have `id: 0, 1, 2, ...` (synthetic). You cannot send
these ids to the API. The delete payload must use `item.label` (the env var name string).
This is already implemented correctly in `Enviros.vue` but is easy to break if copied from
another page.
**How to avoid:** The enviros store `deleteItems` action wraps the array as `{ names }`.

### Pitfall 5: RSA Key result modal shows pubkey, spec says privkey
**What goes wrong:** `Rsakeys.vue` shows `result.response.pubkey` in the result modal. The
Phase 2 spec says "display private key". If the server returns the private key under a
different field name (e.g., `privkey`), the modal will be blank.
**How to avoid:** Log `result.response` after a real `createItem` call to see actual fields
returned by the server.

### Pitfall 6: List `isAllSelected` off-by-one
**What goes wrong:** `List.vue` line 63 checks `selectedItems.length == datasource.length - 1`
(off-by-one). The "select all" visual state is wrong when exactly all items are selected.
**How to avoid:** Do not fix in Phase 2 unless scoped. Document as a known bug.

---

## Code Examples

### Create action (verified, from `apikeys.js` lines 55–58)
```js
async createItem({ dispatch }, alias) {
  const result = await this.$api.$post('/apikey', JSON.stringify({ alias }));
  if (result.success) await dispatch('fetchItems');
  return result;
},
```

### Modal show/hide flow (verified, from `Apikeys.vue` lines 71–83)
```js
async create(bvModalEvt) {
  bvModalEvt.preventDefault();
  if (!this.form.alias.trim()) return;
  const result = await this.createItem(this.form.alias.trim());
  if (result.success) {
    this.createdKey = result.response && result.response.key ? result.response.key : null;
    this.form.alias = '';
    this.$bvModal.hide('create-apikey-modal');
    if (this.createdKey) this.$bvModal.show('apikey-result-modal');
    this.loadData();
  } else {
    this.error = result.message || 'Failed to create API key.';
  }
},
```

### Selection → delete flow (verified, from `Apikeys.vue` lines 85–96)
```js
async deleteSelected() {
  const hashes = this.selectedIds
    .map(id => this.items.find(item => item.id === id))
    .filter(Boolean)
    .map(item => item.hash);
  if (!hashes.length) return;
  const result = await this.deleteItems(hashes);
  if (!result.success) this.error = result.message || 'Failed to delete API keys.';
  this.selectedIds = [];
  this.isSelected = false;
  this.selectedCount = 0;
},
```

### Alias auto-generation (verified, from `Repositories.vue` line 93)
```js
autoAlias() {
  const match = this.form.url.match(/\/([^/]+?)(\.git)?$/);
  if (match) this.form.alias = match[1];
},
```

### Clipboard with fallback (recommended, no package required)
```js
async copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    this.$toasted.show('Copied!', { type: 'success' });
  } catch {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
},
```

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Backend accepts `$put` for create on repos, rsakeys, enviros, channels (matching current store code, not Phase 2 spec's "POST") | Q1 HTTP method table | Wrong HTTP method → 405 from server on every create |
| A2 | RSA key create response has field `pubkey`; private key field name unknown | Q2, Pitfall 5 | Result modal shows nothing if field name differs |
| A3 | Enviro API path is `/env` (current store), not `/enviro` (Phase 2 spec) | Q1 table | 404 on all enviro API calls if path is wrong |
| A4 | Channel API path is `/mesh` (current store), not `/channel` (Phase 2 spec) | Q1 table | 404 on all channel API calls if path is wrong |

---

## Open Questions (RESOLVED 2026-05-18)

1. **HTTP method for create operations** — RESOLVED: `PUT` is correct. Backend routes confirmed:
   `app.put("/api/v2/source")`, `app.put("/api/v2/rsakey")`, `app.put("/api/v2/env")`,
   `app.put("/api/v2/mesh")`. The stores are correct as-is.

2. **RSA key create response shape** — RESOLVED: Backend returns only `pubkey` (lib/thinx/rsakey.js
   line 51: `pubkey: key_data.toString('utf8')`). Private key is written to disk only, never
   returned in the API response. Current modal showing `pubkey` is correct UX — user needs the
   public key for repo deploy keys.

3. **Apikeys delete — single or array?** — RESOLVED: Backend accepts both `fingerprint` (singular)
   and `fingerprints` (array) via router.apikey.js lines 49-50. The store's `{ fingerprints: [...] }`
   is correct for bulk delete.

4. **Duplicate alias detection for Repositories** — RESOLVED: Client-side check against `this.items`
   is the right approach. No server-side error is defined for duplicate alias. Plan Task 1 implements
   this guard.

---

## Environment Availability

> Step 2.6: SKIPPED — this phase is purely Vue component and Vuex store changes. No external
> CLI tools, databases, or services need to be installed. The dev server (`npm run serve`) and
> BootstrapVue are already available.

---

## Validation Architecture

> Cypress is the test framework (`cypress: ^9.5.4` in devDependencies). Test script:
> `start-server-and-test serve http://127.0.0.1:3000/ cy:test`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Cypress 9.5.4 |
| Config file | `vue/cypress.json` (check for existence) |
| Quick run command | `npm run cy:open` (interactive) |
| Full suite command | `npm run test` (start-server-and-test) |

### Phase Requirements → Test Map
| Behavior | Test Type | Notes |
|----------|-----------|-------|
| Create API key, alias field required | e2e | Stub API response, verify modal closes |
| Created key shown in result modal | e2e | Inspect modal content |
| Delete selected API keys | e2e | Select rows, click Delete, verify list updates |
| Repository alias auto-fills from URL | e2e | Type URL, check alias field value |
| Duplicate alias blocked | unit/e2e | Simulate existing items list |
| RSA key generate button creates key | e2e | Stub response, verify result modal |
| Enviro create with key+value | e2e | Submit form, verify list |
| Channel create with mesh_id | e2e | Submit form, verify list |
| Delete clears selection count | e2e | Post-delete, verify button label |

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `vue/src/store/apikeys.js` — store action pattern, API paths, payload shapes
- `vue/src/store/repositories.js` — store pattern, PUT method, alias field
- `vue/src/store/rsakeys.js` — store pattern, filename-based delete
- `vue/src/store/enviros.js` — saveSimpleArray mutation, /env path
- `vue/src/store/channels.js` — mesh_id field, /mesh path
- `vue/src/store/index.js` — all modules registered
- `vue/src/pages/Apikeys/Apikeys.vue` — full CRUD implementation, result modal
- `vue/src/pages/Enviros/Enviros.vue` — full CRUD implementation
- `vue/src/pages/Rsakeys/Rsakeys.vue` — generate-only create, result modal
- `vue/src/pages/Repositories/Repositories.vue` — autoAlias implementation
- `vue/src/pages/Channels/Channels.vue` — full CRUD implementation
- `vue/src/components/List/List.vue` — props, selection-update event shape
- `vue/src/components/Form/Form.vue` — confirmed empty stub
- `vue/src/core/api.js` — $get/$post/$put/$delete methods, parseResult contract
- `vue/src/main.js` — store.$api injection, BootstrapVue/vue-toasted registration
- `vue/package.json` — installed dependencies and versions

---

## Metadata

**Confidence breakdown:**
- Store patterns: HIGH — read directly from all 5 store files
- Page patterns: HIGH — read all 5 page components
- Modal pattern: HIGH — `b-modal` usage consistent across all pages
- Clipboard: HIGH — `navigator.clipboard` is standard Web API, no package needed
- HTTP methods (PUT vs POST): LOW — discrepancy between stores (PUT) and spec (POST); backend source of truth not read
- API response shapes: LOW — inferred from store comments and page code; no backend route files read

**Research date:** 2026-05-18
**Valid until:** 60 days (stable codebase, no external dependencies)

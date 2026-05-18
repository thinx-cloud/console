# Phase 2: Management Page CRUD - Pattern Map

**Mapped:** 2026-05-18
**Files analyzed:** 10 (5 pages + 5 stores)
**Analogs found:** 10 / 10

---

## Key Finding: All Five Pages Are Already Fully Implemented

**None of the five pages are read-only stubs.** Every page (Apikeys, Enviros, Channels, Repositories, Rsakeys) already contains a working `create()` method, a working `deleteSelected()` method, a wired-up `b-modal` create dialog, and store actions (`createItem`, `deleteItems`) that call real API endpoints. The `List` component already emits `selection-update`. The `Form` component is an empty stub but is NOT used by any of these pages — all forms are inline `b-form-group` elements inside `b-modal`.

The planner should treat Phase 2 as **verification and gap-filling**, not greenfield implementation.

---

## File Classification

| File | Role | Data Flow | Status | Match Quality |
|------|------|-----------|--------|---------------|
| `vue/src/pages/Apikeys/Apikeys.vue` | page/controller | CRUD + request-response | **Fully implemented** | primary template |
| `vue/src/pages/Enviros/Enviros.vue` | page/controller | CRUD + request-response | **Fully implemented** | exact match |
| `vue/src/pages/Channels/Channels.vue` | page/controller | CRUD + request-response | **Fully implemented** | exact match |
| `vue/src/pages/Repositories/Repositories.vue` | page/controller | CRUD + request-response | **Fully implemented** | exact match |
| `vue/src/pages/Rsakeys/Rsakeys.vue` | page/controller | CRUD + no-input create | **Fully implemented** | variant |
| `vue/src/store/apikeys.js` | Vuex store module | CRUD | **Fully implemented** | primary template |
| `vue/src/store/enviros.js` | Vuex store module | CRUD | **Fully implemented** | exact match |
| `vue/src/store/channels.js` | Vuex store module | CRUD | **Fully implemented** | exact match |
| `vue/src/store/repositories.js` | Vuex store module | CRUD | **Fully implemented** | exact match |
| `vue/src/store/rsakeys.js` | Vuex store module | CRUD | **Fully implemented** | variant |
| `vue/src/components/List/List.vue` | shared component | event-driven | Active, no changes needed | — |
| `vue/src/components/Form/Form.vue` | shared component | — | **Empty stub, unused** | — |

---

## Pattern Assignments

### Standard Page Pattern (Apikeys is the canonical template)

**Analog:** `vue/src/pages/Apikeys/Apikeys.vue`

**Imports block** (lines 46-47):
```javascript
import List from '@/components/List/List';
import { mapGetters, mapActions } from 'vuex';
```

**`data()` block** (lines 52-63):
```javascript
data() {
  return {
    isSelected: false,
    selectedCount: 0,
    selectedIds: [],
    items: [],
    headers: [],
    loading: true,
    error: null,
    createdKey: null,      // page-specific: holds server-returned secret after create
    form: { alias: '' },   // page-specific: matches modal fields
  };
},
```

**Lifecycle hook** (lines 65-67):
```javascript
created() {
  this.$watch(() => this.$route.params, () => { this.loadData(); }, { immediate: true });
},
```

**`methods` — store binding** (lines 69-70):
```javascript
...mapGetters({ getItems: 'apikeys/getItems', getHeaders: 'apikeys/getHeaders' }),
...mapActions({ fetchItems: 'apikeys/fetchItems', createItem: 'apikeys/createItem', deleteItems: 'apikeys/deleteItems' }),
```

**`create()` method** (lines 71-84):
```javascript
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

**`deleteSelected()` method** (lines 85-96):
```javascript
async deleteSelected() {
  const hashes = this.selectedIds
    .map(id => this.items.find(item => item.id === id))
    .filter(Boolean)
    .map(item => item.hash);         // page-specific: field name used as delete key
  if (!hashes.length) return;
  const result = await this.deleteItems(hashes);
  if (!result.success) this.error = result.message || 'Failed to delete API keys.';
  this.selectedIds = [];
  this.isSelected = false;
  this.selectedCount = 0;
},
```

**`selectionUpdated()` handler** (lines 97-101 — identical across all pages):
```javascript
selectionUpdated(value) {
  this.isSelected = value.count > 0;
  this.selectedCount = value.count;
  this.selectedIds = value.items || [];
},
```

**`loadData()` method** (lines 102-108 — identical across all pages):
```javascript
loadData() {
  this.loading = true;
  this.fetchItems().then(() => {
    this.items = this.getItems();
    this.headers = this.getHeaders();
    this.loading = false;
  });
},
```

**Button bar template** (lines 12-19):
```html
<b-button variant="success" @click="$bvModal.show('create-apikey-modal')">Add API Key</b-button>
<b-button
  variant="danger"
  @click="deleteSelected"
  :disabled="!isSelected"
  class="ml-2"
>Delete ({{ selectedCount }})</b-button>
```

**List component usage** (lines 23-28 — identical across all pages):
```html
<List
  @selection-update="selectionUpdated"
  :datasource="items"
  :dataheaders="headers"
  :showLoading="loading"
></List>
```

**Create modal template** (lines 31-35):
```html
<b-modal id="create-apikey-modal" title="Add API Key" @ok="create" ok-title="Create">
  <b-form-group label="Alias" label-for="apikey-alias">
    <b-form-input id="apikey-alias" v-model="form.alias" placeholder="e.g. My Device Key" required />
  </b-form-group>
</b-modal>
```

**Result/reveal modal** (lines 38-41 — Apikeys only, also Rsakeys):
```html
<b-modal id="apikey-result-modal" title="API Key Created" ok-only ok-title="Close">
  <p>Your new API key has been created. Copy it now — it will not be shown again.</p>
  <b-form-input readonly :value="createdKey" />
</b-modal>
```

**Error alert** (line 21 — identical across all pages):
```html
<b-alert v-if="error" variant="danger" show dismissible @dismissed="error = null">{{ error }}</b-alert>
```

---

### Per-Page Variations

#### Enviros (`vue/src/pages/Enviros/Enviros.vue`)

- **Form fields:** Two fields — `key` (string) and `value` (string). Both required.
- **`create()` payload** (lines 69-79): `this.createItem({ key, value })` — object argument, not a scalar.
- **`deleteSelected()` key field** (lines 81-92): extracts `item.label` as the delete identifier.
- **Store HTTP verb for create:** `$put` (not `$post`).
- **Store response normalization:** uses `saveSimpleArray` mutation — the API returns a plain array `["evnvar1","envvar2"]`, not an object keyed by ID. Items are given synthetic numeric `id` and stored as `{ id: index, label: item }`.
- **No result modal** — create simply closes the modal and reloads.

#### Channels (`vue/src/pages/Channels/Channels.vue`)

- **Form fields:** `mesh_id` (required) and `alias` (optional, defaults to `mesh_id` if empty).
- **`create()` payload** (lines 69-84): `this.createItem({ mesh_id, alias })`.
- **`deleteSelected()` key field** (lines 85-96): extracts `item.mesh_id`.
- **Store HTTP verb for create:** `$put`.
- **Store response normalization:** standard `saveItems` — API response is an object keyed by index; items get `{ id, mesh_id, alias }`.

#### Repositories (`vue/src/pages/Repositories/Repositories.vue`)

- **Form fields:** `url` (required), `alias` (required, auto-filled from URL via `autoAlias()`), `branch` (default `origin/master`), `is_private` (boolean checkbox), `circleToken` (optional), `secret` (optional).
- **Modal size:** `size="lg"` (only page with a large modal).
- **Extra method:** `autoAlias()` (lines 92-95) — parses URL on `@input` to auto-fill alias field.
- **`create()` payload** (lines 96-114): conditionally appends optional fields only if non-empty.
- **`deleteSelected()` key field** (lines 116-127): extracts `item.id` (the repository source ID).
- **Store HTTP verb for create:** `$put`.
- **Store action name difference:** store internally has `fetchRepositories` as the real fetcher; `fetchItems` is a pass-through alias that calls `dispatch('fetchRepositories')`.

#### Rsakeys (`vue/src/pages/Rsakeys/Rsakeys.vue`)

- **No create modal** — `create()` is triggered directly from the button click (`@click="create"`), not via `$bvModal`.
- **No form input** — RSA key generation takes no user input; `createItem()` is called with no arguments.
- **Button state:** button uses `:disabled="creating"` and shows loading text `"Generating..."` during async call.
- **Extra `data` field:** `creating: false` (lines 59) — tracks in-flight create request.
- **`create()` signature** (lines 70-81): no `bvModalEvt` parameter. Sets `this.creating = true` before await, resets to `false` after.
- **Result modal:** shows `createdPubkey` in a `b-form-textarea` (not `b-form-input`) with `rows="4"`.
- **`deleteSelected()` key field** (lines 82-93): extracts `item.filename`.
- **Store `createItem` signature:** `async createItem({ dispatch })` — no payload parameter; sends `$put('/rsakey', JSON.stringify({}))`.
- **Store `deleteItems` payload key:** `{ filenames }`.

---

## List Component Contract

**File:** `vue/src/components/List/List.vue`

**Props** (lines 47-52):
```javascript
props: {
  size: { type: Number, default: 21 },        // unused by pages currently
  datasource: { type: Array, default: [] },    // array of row objects, each must have an `id` field
  dataheaders: { type: Array, default: [] },   // array of { title, prop, pos } — pos: null hides column
  showLoading: { type: Boolean, default: true },
},
```

**Event emitted:** `selection-update`

**Payload shape** (lines 73-76 and 84-87):
```javascript
this.$emit("selection-update", {
  count: this.selectedItems.length,   // Number
  items: this.selectedItems,          // Array of item.id values (not full objects)
});
```

**`isAllSelected` bug** (line 63): The check uses `length == datasource.length - 1` (off-by-one). Do not rely on "all selected" state being accurate when all rows are checked.

**Column visibility:** Headers with `pos: null` are filtered out by `filteredHeaders` computed (line 60). Pages can hide columns by setting `pos: null` in the store's `headers` array.

---

## Form Component Status

**File:** `vue/src/components/Form/Form.vue`

The `Form` component is an **empty placeholder** — its template renders only `<div>Form</div>` and it has a single unused `size` prop. It is not imported or used by any of the five management pages. All form inputs are inline inside `<b-modal>` blocks directly in the page templates. Do not plan to use `Form.vue` for Phase 2.

---

## Vuex Store Pattern (Canonical: apikeys.js)

**All five stores share the same module structure:**

```javascript
export default {
  namespaced: true,
  state: { items: [], headers: [...] },
  mutations: {
    saveItems(state, data) {
      let flatItems = [];
      for (let id of Object.keys(data.items)) {
        flatItems.push({ id: id, ...data.items[id] });
      }
      state.items = flatItems;
    }
  },
  actions: {
    async fetchItems({ state, commit }) { ... },
    async createItem({ dispatch }, payload) {
      const result = await this.$api.$METHOD('/endpoint', JSON.stringify(payload));
      if (result.success) await dispatch('fetchItems');
      return result;                    // always return result to page
    },
    async deleteItems({ dispatch }, identifiers) {
      const result = await this.$api.$delete('/endpoint', JSON.stringify({ key: identifiers }));
      if (result.success) await dispatch('fetchItems');
      return result;
    },
  },
  getters: {
    getItems(state) { return state.items; },
    getHeaders(state) { return state.headers; },
  },
};
```

**All five stores are already registered** in `vue/src/store/index.js` (lines 4-11, 23-30) under their namespaced keys: `apikeys`, `channels`, `rsakeys`, `enviros`, `repositories`.

---

## Per-Store API Endpoint and HTTP Verb Summary

| Store | `fetchItems` | `createItem` | `deleteItems` | Delete payload key |
|-------|-------------|-------------|--------------|-------------------|
| `apikeys.js` | `$get('/apikey')` | `$post('/apikey')` | `$delete('/apikey')` | `fingerprints` |
| `enviros.js` | `$get('/env')` | `$put('/env')` | `$delete('/env')` | `names` |
| `channels.js` | `$get('/mesh')` | `$put('/mesh')` | `$delete('/mesh')` | `mesh_ids` |
| `repositories.js` | `$get('/source')` | `$put('/source')` | `$delete('/source')` | `source_ids` |
| `rsakeys.js` | `$get('/rsakey')` | `$put('/rsakey')` | `$delete('/rsakey')` | `filenames` |

---

## Shared Patterns

### Selection State Management
**Source:** All five pages (identical code)
**Apply to:** Any new management page
```javascript
selectionUpdated(value) {
  this.isSelected = value.count > 0;
  this.selectedCount = value.count;
  this.selectedIds = value.items || [];   // array of id values from List
},
```

### Data Loading
**Source:** All five pages (identical code)
**Apply to:** Any new management page
```javascript
loadData() {
  this.loading = true;
  this.fetchItems().then(() => {
    this.items = this.getItems();
    this.headers = this.getHeaders();
    this.loading = false;
  });
},
```
Note: `getItems` and `getHeaders` come from `...mapGetters` and are bound as plain functions (not computed properties), so they must be called as `this.getItems()`, not accessed as `this.getItems`.

### Error Display
**Source:** All five pages (identical template)
```html
<b-alert v-if="error" variant="danger" show dismissible @dismissed="error = null">{{ error }}</b-alert>
```

### Delete Key Extraction Pattern
**Source:** All five pages (structural pattern, field name varies)
```javascript
const identifiers = this.selectedIds
  .map(id => this.items.find(item => item.id === id))
  .filter(Boolean)
  .map(item => item.FIELD_NAME);   // varies per page: hash / label / mesh_id / id / filename
if (!identifiers.length) return;
```

### Post-Delete Reset
**Source:** All five pages (identical)
```javascript
this.selectedIds = [];
this.isSelected = false;
this.selectedCount = 0;
// Note: loadData() is NOT called after delete — store action re-fetches via dispatch('fetchItems')
```

### Store Result Return Convention
**Source:** All five stores
All store actions (`createItem`, `deleteItems`) return the raw API result object `{ success: boolean, message?: string, response?: any }`. Pages check `result.success` directly.

---

## No Analog Found

None. All five pages and stores are fully implemented. The `Form.vue` component is an empty stub but is deliberately not used — no analog is needed for it in Phase 2.

---

## Metadata

**Analog search scope:** `vue/src/pages/`, `vue/src/store/`, `vue/src/components/`
**Files read:** 12
**Pattern extraction date:** 2026-05-18

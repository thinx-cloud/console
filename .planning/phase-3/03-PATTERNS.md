# Phase 3: Transformers with Code Editor - Pattern Map

**Mapped:** 2026-05-19
**Files analyzed:** 3 (all modifications to existing files)
**Analogs found:** 3 / 3

---

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `vue/src/store/transformers.js` | store | CRUD, request-response | `vue/src/store/repositories.js` | role-match |
| `vue/src/pages/Transformers/Transformers.vue` | page/component | CRUD, request-response | `vue/src/pages/Repositories/Repositories.vue` | exact |
| `vue/src/pages/Transformers/TransformerEditor.vue` | page/component | CRUD, request-response | `vue/src/pages/Repositories/Repositories.vue` (create pattern) + self (already scaffolded) | role-match |

---

## Pattern Assignments

### `vue/src/store/transformers.js` (store, CRUD)

**Analog:** `vue/src/store/repositories.js`

**Current issue — saveTransformers wraps in `info:` object** (transformers.js lines 32–36):
```javascript
// WRONG — current code wraps in info: { transformers }
async saveTransformers({ dispatch }, transformers) {
  const result = await this.$api.$post('/profile', JSON.stringify({
    info: { transformers }   // <-- BUG: should be { transformers } directly
  }));
  if (result.success) await dispatch('fetchItems');
  return result;
}
```

**Correct POST body pattern** — per owner.js process_update, `body.transformers` is checked separately from `body.info`. The fix:
```javascript
// CORRECT — post { transformers } at top level, not nested under info
async saveTransformers({ dispatch }, transformers) {
  const result = await this.$api.$post('/profile', JSON.stringify({ transformers }));
  if (result.success) await dispatch('fetchItems');
  return result;
}
```

**fetchItems path is already correct** (transformers.js lines 24–30) — reads `result.response.info.transformers` which matches the verified GET /api/v2/profile response shape. Add a comment explaining the backend constraint:
```javascript
async fetchItems({ state, commit }) {
  // Transformers are stored inside the user profile document.
  // No dedicated GET /transformer endpoint exists on the backend.
  // The only read path is GET /api/v2/profile → response.info.transformers.
  const result = await this.$api.$get('/profile');
  if (result.success && result.response && result.response.info) {
    commit('saveItems', result.response.info.transformers || []);
  }
  return state.items;
},
```

**updateItem — btoa must be UTF-8 safe** (transformers.js lines 45–51):
```javascript
// CURRENT (line 48) — throws on non-Latin1 characters:
{ utid, alias, body: btoa(body) }

// FIXED — UTF-8 safe encode wrapper:
{ utid, alias, body: btoa(unescape(encodeURIComponent(body))) }
```

**Store module structure to keep** (transformers.js lines 2–71) — namespaced, state/mutations/actions/getters shape is correct. Repositories.js analog shows same shape (`namespaced: true`, `fetchItems` delegates, `createItem`/`deleteItem` return the raw API result). No structural changes needed.

---

### `vue/src/pages/Transformers/Transformers.vue` (page/component, CRUD)

**Analog:** `vue/src/pages/Repositories/Repositories.vue` (lines 97–122 for the duplicate alias guard)

**Duplicate alias guard — copy exactly from Repositories.vue lines 97–106:**
```javascript
// Repositories.vue create() lines 97-106 — the REPO-03 pattern:
async create(bvModalEvt) {
  bvModalEvt.preventDefault();
  this.error = null;                                              // clear error at start
  if (!this.form.url.trim() || !this.form.alias.trim()) return;
  const duplicate = this.items.find(r => r.alias === this.form.alias.trim());
  if (duplicate) {
    this.error = 'A repository with this alias already exists.'; // inline modal error
    return;
  }
  // ... proceed with createItem ...
}
```

**Adapted for Transformers.vue create() — apply the same three-step pattern:**
```javascript
async create(bvModalEvt) {
  bvModalEvt.preventDefault();
  this.error = null;                                              // step 1: clear at start
  if (!this.form.alias.trim()) return;
  const duplicate = this.items.find(t => t.alias === this.form.alias.trim()); // step 2: check
  if (duplicate) {
    this.error = 'A transformer with this alias already exists.';// step 3: set error, return
    return;
  }
  const result = await this.createItem(this.form.alias.trim());
  if (result.success) {
    this.form.alias = '';
    this.$bvModal.hide('create-transformer-modal');
    this.loadData();
  } else {
    this.error = result.message || 'Failed to create transformer.';
  }
},
```

**b-alert inside modal — copy from Repositories.vue line 32:**
```html
<!-- Repositories.vue line 32 — alert INSIDE the b-modal, before form fields -->
<b-alert :show="!!error" variant="danger" class="mb-3">{{ error }}</b-alert>
```

Add this inside `<b-modal id="create-transformer-modal" ...>` in Transformers.vue (currently line 42–46), before the `<b-form-group>`. Note: Repositories.vue uses `:show="!!error"` (no `dismissible`) inside the modal — Transformers.vue should follow the same convention inside the modal. The page-level alert (line 15 in Transformers.vue) already uses `dismissible` and is separate.

**Existing patterns to preserve in Transformers.vue:**

Imports (lines 51–52):
```javascript
import { mapGetters, mapActions } from 'vuex';
```

mapGetters/mapActions in methods (lines 67–68):
```javascript
...mapGetters({ getItems: 'transformers/getItems' }),
...mapActions({ fetchItems: 'transformers/fetchItems', createItem: 'transformers/createItem', deleteItem: 'transformers/deleteItem' }),
```

loadData pattern (lines 91–97):
```javascript
loadData() {
  this.loading = true;
  this.fetchItems().then(() => {
    this.items = this.getItems();
    this.loading = false;
  });
},
```

---

### `vue/src/pages/Transformers/TransformerEditor.vue` (page/component, CRUD + file-I/O)

**Analog:** Self (already scaffolded) + Repositories.vue for error/nav patterns

**Two targeted changes required:**

#### Change 1: Post-save navigation (D-04)

Current save() success branch (lines 101–104):
```javascript
// CURRENT — stays on page and shows green banner
if (result.success) {
  this.hasChanges = false;
  this.saved = true;           // <-- shows b-alert, stays on page
}
```

Fixed save() success branch — navigate away after clearing guard:
```javascript
// FIXED — clear hasChanges first so beforeRouteLeave does not fire, then redirect
if (result.success) {
  this.hasChanges = false;     // step 1: clear BEFORE navigating (prevents guard prompt)
  this.$router.push('/app/transformers');  // step 2: redirect to list
}
```

The `saved` data property and the `<b-alert v-if="saved" ...>` block (template line 12) can be removed once this change is in place, since the user will never see it. Keep or remove at implementer's discretion — the redirect makes it irrelevant.

#### Change 2: UTF-8 safe atob decode on load (D-05)

Current loadTransformer() decode (lines 86–90):
```javascript
// CURRENT — atob only; throws on malformed data (caught), but not UTF-8 safe on decode
try {
  this.form.body = transformer.body ? atob(transformer.body) : '';
} catch {
  this.form.body = transformer.body || '';
}
```

Fixed decode — UTF-8 safe, try/catch fallback preserved:
```javascript
// FIXED — decodeURIComponent(escape(atob(s))) is the standard UTF-8 safe decode
try {
  this.form.body = transformer.body
    ? decodeURIComponent(escape(atob(transformer.body)))
    : '';
} catch {
  this.form.body = transformer.body || '';  // fallback for malformed stored data
}
```

**Patterns to preserve in TransformerEditor.vue (no changes needed):**

beforeRouteLeave guard (lines 62–72) — already correct, no changes:
```javascript
beforeRouteLeave(to, from, next) {
  if (this.hasChanges) {
    this.$bvModal.msgBoxConfirm('You have unsaved changes. Leave anyway?', {
      title: 'Unsaved Changes',
      okVariant: 'warning',
      okTitle: 'Leave',
    }).then(confirmed => { next(confirmed ? undefined : false); });
  } else {
    next();
  }
},
```

CodeMirror imports and editorOptions (lines 34–56) — already correct, no changes:
```javascript
import { codemirror } from 'vue-codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/mode/javascript/javascript.js';
import 'codemirror/theme/material.css';
// ...
editorOptions: {
  tabSize: 2,
  mode: 'text/javascript',
  theme: 'material',
  lineNumbers: true,
  lineWrapping: false,
},
```

mapGetters in methods (line 74) — existing anti-pattern the project intentionally keeps:
```javascript
...mapGetters({ getByUtid: 'transformers/getByUtid' }),
// accessed as: this.getByUtid()(utid)  — two-call pattern, do not change
```

---

## Shared Patterns

### Error display — two locations
**Source:** `vue/src/pages/Repositories/Repositories.vue`
**Apply to:** `Transformers.vue` (both page-level and inside modal)

Page-level alert (dismissible, shown after API failures):
```html
<!-- Page scope — used for delete errors and other non-modal errors (Repositories.vue line 21) -->
<b-alert v-if="error" variant="danger" show dismissible @dismissed="error = null">{{ error }}</b-alert>
```

Modal-inline alert (non-dismissible, shown for duplicate alias validation):
```html
<!-- Modal scope — shown while modal is open (Repositories.vue line 32) -->
<b-alert :show="!!error" variant="danger" class="mb-3">{{ error }}</b-alert>
```

Note: When the modal is hidden (`$bvModal.hide()`), `error` is reset to `null` at the start of the next `create()` call — no `@hidden` hook needed.

### mapGetters/mapActions in methods (project convention)
**Source:** All existing page components (Repositories.vue line 91-92, Apikeys.vue lines 70-71, Transformers.vue lines 67-68)
**Apply to:** All three modified files
```javascript
// Convention: mapGetters and mapActions both spread into methods, NOT computed
methods: {
  ...mapGetters({ getItems: 'module/getItems' }),
  ...mapActions({ fetchItems: 'module/fetchItems', createItem: 'module/createItem' }),
}
// Getter functions accessed as: this.getItems() (call the function)
```

### loadData pattern
**Source:** `vue/src/pages/Repositories/Repositories.vue` lines 140-147
**Apply to:** `Transformers.vue` (already uses this pattern correctly)
```javascript
loadData() {
  this.loading = true;
  this.fetchItems().then(() => {
    this.items = this.getItems();
    this.loading = false;
  });
},
```

### $bvModal confirm dialog
**Source:** `vue/src/pages/Transformers/Transformers.vue` lines 85-86 (already in use)
**Apply to:** TransformerEditor.vue beforeRouteLeave (already in use)
```javascript
const confirmed = await this.$bvModal.msgBoxConfirm('message', {
  title: 'Title',
  okVariant: 'danger',   // or 'warning'
  okTitle: 'Action Label'
});
if (!confirmed) return;
```

### Store result shape
**Source:** `vue/src/store/repositories.js` lines 65-69
**Apply to:** `vue/src/store/transformers.js`
All store actions return the raw API result object `{ success, response, message }`. Callers check `result.success`.

---

## No Analog Found

All three files have close analogs. No files are without a match.

---

## Critical Fix Summary

| File | Line(s) | Current Code | Fixed Code | Decision |
|---|---|---|---|---|
| `transformers.js` | 33 | `JSON.stringify({ info: { transformers } })` | `JSON.stringify({ transformers })` | D-01 / TRAN-01 |
| `transformers.js` | 48 | `btoa(body)` | `btoa(unescape(encodeURIComponent(body)))` | D-05 |
| `Transformers.vue` | 72-83 | `create()` has no duplicate check | add `this.error = null` + `find()` guard + inline b-alert in modal | D-03 |
| `TransformerEditor.vue` | 87 | `atob(transformer.body)` | `decodeURIComponent(escape(atob(transformer.body)))` | D-05 |
| `TransformerEditor.vue` | 101-104 | `this.saved = true` (stays on page) | `this.hasChanges = false; this.$router.push('/app/transformers')` | D-04 |

---

## Metadata

**Analog search scope:** `vue/src/store/`, `vue/src/pages/Repositories/`, `vue/src/pages/Apikeys/`, `vue/src/pages/Transformers/`
**Files scanned:** 6 (3 target files + 3 analog files)
**Pattern extraction date:** 2026-05-19

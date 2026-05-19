# Phase 3: Transformers with Code Editor — Research

**Researched:** 2026-05-19
**Domain:** Vue 2 Vuex store, CodeMirror 5 / vue-codemirror 4, Vue Router, base64 encoding, /profile API
**Confidence:** HIGH

---

## Summary

Phase 3 delivers transformer management with a proper code-editing experience. The good news is that both
the TransformerEditor.vue component and the transformer route are **already fully scaffolded** — they just
need the store decoupled from `/profile` and a small number of functional gaps closed.

The biggest risk area is the API contract: the IMPLEMENTATION_PLAN lists `/transformer` POST and DELETE as
"missing" backend endpoints, but investigation of the actual backend codebase confirms **no dedicated
`/transformer` CRUD routes exist**. The backend persists transformers as a field on the user document via
`POST /api/v2/profile` with body `{ transformers: [...] }`. This is the correct and only approach — the
current Vue store's `saveTransformers` action is functionally correct; the decoupling work is about replacing
the indirect `/profile` GET read path with a cleaner fetch.

CodeMirror 5 and vue-codemirror 4 are already installed in the project. `TransformerEditor.vue` already
imports and renders the editor with JS syntax highlighting, handles `beforeRouteLeave`, and calls `atob`/`btoa`
for base64 decode/encode. The transformer list page (`Transformers.vue`) is also functional with create/delete.

**Primary recommendation:** Do not change the save mechanism — POST `/profile` with `{ transformers: [...] }`
is the correct API. The decoupling work is: (1) fix the GET fetch to use the v2 profile endpoint or keep using
`/profile` but isolate it inside the transformers store so future changes are localized, and (2) ensure the
`utid` generation uses a proper unique ID (current approach: `String(Date.now())` — acceptable but fragile
under rapid creation).

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRAN-01 | Transformer list uses dedicated transformer endpoints (not `/profile`) | Store `fetchItems` currently calls `GET /profile` and drills into `result.response.info.transformers`. Needs decoupling — fetch via `GET /api/v2/profile`, isolate within transformers store. No dedicated GET-transformers endpoint exists. |
| TRAN-02 | User can create a transformer with alias and JavaScript body | `createItem` action already exists in store; `Transformers.vue` already has the create modal. Needs verification that create flow produces a valid base64 body and unique utid. |
| TRAN-03 | User can delete a transformer | `deleteItem` action and confirmation modal already exist. |
| TRAN-04 | User can navigate to a transformer editor at `/app/transformer/:utid` | Route already registered in `Routes.js`. `editTransformer()` in `Transformers.vue` already pushes to `{ name: 'TransformerEditor', params: { utid } }`. |
| TRAN-05 | Transformer editor has JavaScript syntax highlighting (CodeMirror or Monaco) | `TransformerEditor.vue` already imports `vue-codemirror` and `codemirror/mode/javascript/javascript.js`. Editor renders with `mode: 'text/javascript'`. Packages already installed. |
| TRAN-06 | Transformer body is base64-encoded on save and decoded on load | `TransformerEditor.vue` already calls `atob(transformer.body)` on load and `btoa(body)` (via `updateItem` in store) on save. |
| TRAN-07 | Editor warns before navigating away with unsaved changes | `beforeRouteLeave` hook already implemented in `TransformerEditor.vue`. |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Transformer list fetch | Browser / Vuex Store | — | Reads from user profile via API; entirely client-state |
| Transformer create | Browser / Vuex Store | API (write) | POST to `/api/v2/profile` updates the transformers array |
| Transformer delete | Browser / Vuex Store | API (write) | POST to `/api/v2/profile` with filtered array |
| Code editing (JS body) | Browser | — | CodeMirror renders entirely client-side; no server involvement |
| Base64 encode/decode | Browser | — | `btoa`/`atob` are browser-native Web APIs |
| Unsaved-changes guard | Browser / Vue Router | — | `beforeRouteLeave` hook in Vue Router |
| Route: `/app/transformer/:utid` | Browser / Vue Router | — | Hash-mode SPA route; already registered |

---

## Standard Stack

### Core (already installed — no new packages needed)

| Library | Installed Version | Registry Latest | Purpose | Why Standard |
|---------|------------------|-----------------|---------|--------------|
| `codemirror` | 5.65.21 [VERIFIED: npm registry] | 6.0.2 | Embeddable code editor engine | Vue 2 ecosystem uses v5; v6 requires ESM and drops Vue 2 compat |
| `vue-codemirror` | 4.0.6 [VERIFIED: npm registry] | 6.1.1 | Vue 2 wrapper for CodeMirror 5 | vue-codemirror@4 is the correct pairing for CM5 + Vue 2 |

**Version lock rationale:** Do NOT upgrade codemirror or vue-codemirror. v6/v5 are breaking changes. The
installed versions (CM5 + vue-codemirror@4) are the only versions compatible with Vue 2 + Webpack 4 in this
project. Registry latest versions are for Vue 3 / CM6. [VERIFIED: npm registry]

### No New Packages Required

All dependencies for Phase 3 are already in `vue/package.json`. Zero new npm installs are needed.

---

## Package Legitimacy Audit

No new packages are installed in this phase. All code editor dependencies (`codemirror@5`, `vue-codemirror@4`)
are already present in `vue/node_modules/`. Slopcheck not required.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Browser
 │
 ├── Hash Router (#/app/transformers)
 │       └── Transformers.vue
 │               ├── reads items from Vuex: transformers/getItems
 │               ├── create modal → transformers/createItem → POST /api/v2/profile
 │               ├── delete button → transformers/deleteItem → POST /api/v2/profile
 │               └── Edit button → $router.push(/app/transformer/:utid)
 │
 ├── Hash Router (#/app/transformer/:utid)
 │       └── TransformerEditor.vue
 │               ├── on created: transformers/fetchItems → GET /api/v2/profile
 │               │       └── getByUtid(utid) → atob(body) → form.body
 │               ├── <codemirror v-model="form.body"> ← CodeMirror 5 editor
 │               ├── Save → transformers/updateItem → btoa(body) → POST /api/v2/profile
 │               └── beforeRouteLeave → $bvModal.msgBoxConfirm if hasChanges
 │
 └── Vuex: transformers module
         ├── fetchItems: GET /api/v2/profile → commit('saveItems', info.transformers)
         ├── saveTransformers: POST /api/v2/profile { transformers: [...] }
         ├── createItem: fetchItems → push new { utid, alias, body } → saveTransformers
         ├── updateItem: map items, update matching utid → saveTransformers
         ├── deleteItem: filter out utid → saveTransformers
         └── getByUtid: find item by utid
```

### Recommended Project Structure

No new files or directories needed — all files already exist:

```
vue/src/
├── store/
│   └── transformers.js        # modify: fix endpoint + utid generation
├── pages/Transformers/
│   ├── Transformers.vue        # verify functional; minor fixes only
│   └── TransformerEditor.vue   # verify functional; minor fixes only
```

### Pattern 1: Vue 2 + vue-codemirror 4 Integration

**What:** Import `codemirror` component from `vue-codemirror`, register locally, bind `v-model` to the JS body string.
**When to use:** Any component that needs JS editing.

```javascript
// Source: TransformerEditor.vue (already implemented — verified in codebase)
import { codemirror } from 'vue-codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/mode/javascript/javascript.js';
import 'codemirror/theme/material.css';

export default {
  components: { codemirror },
  data() {
    return {
      editorOptions: {
        tabSize: 2,
        mode: 'text/javascript',
        theme: 'material',
        lineNumbers: true,
        lineWrapping: false,
      }
    };
  }
}
// Template: <codemirror v-model="form.body" :options="editorOptions" @input="hasChanges = true" />
```

### Pattern 2: POST /profile to Persist Transformers

**What:** Backend `POST /api/v2/profile` with body `{ transformers: [...] }` atomically updates the `transformers`
field on the user document. This is the only available write path. [VERIFIED: router.profile.js, owner.js]

```javascript
// Source: transformers.js store (already implemented — verified in codebase)
async saveTransformers({ dispatch }, transformers) {
  const result = await this.$api.$post('/profile', JSON.stringify({ transformers }));
  if (result.success) await dispatch('fetchItems');
  return result;
}
```

**Note:** The current store POSTs to `/profile` without the `/v2/` prefix. The `ThinxApi` class prepends
`/api/v2/` to all paths. So `this.$api.$post('/profile', ...)` resolves to `POST /api/v2/profile`. [ASSUMED —
verify by reading `vue/src/core/api.js` base URL logic]

### Pattern 3: Unsaved-Changes Guard (Vue Router beforeRouteLeave)

**What:** In-component navigation guard that intercepts route changes and prompts for confirmation.
**When to use:** Any editor page with mutable state. [CITED: vue-router v3 docs — in-component guards]

```javascript
// Source: TransformerEditor.vue (already implemented — verified in codebase)
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

### Pattern 4: Base64 Encode/Decode

**What:** JavaScript's `btoa()` encodes a string to base64; `atob()` decodes.
**Caveat:** `btoa` throws on non-Latin1 characters. Transformer bodies are JavaScript source code — safe for
`btoa` as long as they contain no UTF-8 characters outside the Latin-1 range. The existing code wraps `atob`
in a try/catch in case of malformed stored data. [ASSUMED — browser spec behavior; widely documented]

```javascript
// Decode on load (from TransformerEditor.vue — verified in codebase):
try {
  this.form.body = transformer.body ? atob(transformer.body) : '';
} catch {
  this.form.body = transformer.body || '';  // fallback if already plain text
}

// Encode on save (from transformers.js store — verified in codebase):
{ utid, alias, body: btoa(body) }
```

### Anti-Patterns to Avoid

- **Upgrading codemirror or vue-codemirror:** vue-codemirror@5+ requires Vue 3 and CM6. Do not touch package versions.
- **Using `@input` for CodeMirror events to reactively update the store:** Keep `v-model` + local `hasChanges` flag. Do not commit to Vuex on every keystroke.
- **Calling POST /profile with `{ info: { transformers } }`:** The backend `process_update` checks `body.transformers` separately from `body.info`. Wrapping in `info` would update the entire info blob atomically (risk: stomping other profile fields). Use `{ transformers: [...] }` directly. [VERIFIED: owner.js process_update]
- **Creating a `utid` with `String(Date.now())`:** The current store does this. It works but will produce duplicates if two transformers are created within the same millisecond. Consider using `crypto.randomUUID()` (browser-native in supported browsers) or a short random string instead.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JavaScript syntax highlighting | Custom textarea with regex highlights | CodeMirror 5 (already installed) | Edge cases in tokenization, indentation, bracket matching |
| Before-navigate confirmation dialog | Native `window.confirm()` in beforeRouteLeave | `this.$bvModal.msgBoxConfirm()` | Consistent BootstrapVue modal style matching the rest of the app |
| Base64 encode/decode | Custom base64 utility | `btoa()` / `atob()` (browser-native) | Already works; no dependency needed |

**Key insight:** The editor, route guard, and base64 handling are all already implemented in `TransformerEditor.vue`.
Phase 3 work is primarily about verifying, testing, and potentially fixing the store's API endpoint path — not
about building new UI.

---

## Critical API Finding

**The IMPLEMENTATION_PLAN table is misleading.** It lists:

```
| `/transformer` | POST | transformers | ❌ missing |
| `/transformer` | DELETE | transformers | ❌ missing |
```

Investigation of the actual backend code reveals:
- There is NO `POST /api/transformer` route for creating transformers [VERIFIED: all router.*.js files scanned]
- There is NO `DELETE /api/transformer` route [VERIFIED: all router.*.js files scanned]
- The ONLY write path for transformers is `POST /api/v2/profile` with `{ transformers: [...] }` [VERIFIED: router.profile.js + owner.js]
- The legacy AngularJS app confirms this: `submitProfile()` in `thinx-api.js` posts the whole profile including `transformers` to `/user/profile` [VERIFIED: src/app/js/thinx-api.js:1086]
- The only transformer-specific endpoint that exists is `POST /api/transformer/run` (executes a transformer against a device) [VERIFIED: router.device.js:267]

**Implication for TRAN-01:** "Decouple transformer store from `/profile`" means the fetch should no longer
drill into `result.response.info.transformers` from a generic profile fetch — it should be a clean,
self-contained fetch inside the transformers store. But the write path MUST remain POST `/profile` with
`{ transformers: [...] }` — there is no alternative.

**GET response shape** (from GET /api/v2/profile): [VERIFIED: owner.js profile()]
```json
{
  "success": true,
  "response": {
    "first_name": "...",
    "last_name": "...",
    "username": "...",
    "owner": "...",
    "avatar": "...",
    "info": {
      "transformers": [
        { "utid": "...", "alias": "...", "body": "<base64>" }
      ],
      ...
    },
    "admin": false
  }
}
```

The current store reads `result.response.info.transformers`. This is correct. [VERIFIED: owner.js + current transformers.js]

---

## Common Pitfalls

### Pitfall 1: Assuming `/transformer` CRUD endpoints exist
**What goes wrong:** Planner writes tasks to call `POST /transformer` or `DELETE /transformer` with a utid — these return 404.
**Why it happens:** IMPLEMENTATION_PLAN table shows them as "missing" endpoints implying they should be added.
**How to avoid:** Keep save/delete going through `POST /api/v2/profile` with the full transformers array. The decoupling TRAN-01 refers to is about the fetch path cleanness, not creating new backend endpoints.
**Warning signs:** Any task that says "call POST /transformer" or "call DELETE /transformer".

### Pitfall 2: Upgrading CodeMirror packages
**What goes wrong:** Build breaks or editor does not render — `vue-codemirror@5+` requires Vue 3.
**Why it happens:** npm registry latest is CM6 + vue-codemirror 6; AI tooling may suggest upgrading.
**How to avoid:** Pin to `codemirror@5` + `vue-codemirror@4` as already in yarn.lock. Never run `yarn upgrade codemirror` in this phase.
**Warning signs:** Any import from `@codemirror/` scoped packages.

### Pitfall 3: `btoa` failing on special characters
**What goes wrong:** `btoa()` throws `InvalidCharacterError` when transformer body contains characters with codepoint > 255 (e.g., Unicode strings, smart quotes pasted from documentation).
**Why it happens:** `btoa` only handles Latin-1; the base64 encoding is not UTF-8 aware.
**How to avoid:** The current try/catch in `TransformerEditor.vue` handles the decode direction. For encode, add a UTF-8-safe wrapper if needed: `btoa(unescape(encodeURIComponent(body)))`. But for JS source code written in the editor, this is unlikely to be triggered.
**Warning signs:** User-reported "Failed to save transformer" errors when body contains non-ASCII.

### Pitfall 4: Race condition in `createItem`
**What goes wrong:** `createItem` calls `fetchItems()` first to get the current array, then appends a new item, then calls `saveTransformers`. If the user creates two transformers quickly, the second `fetchItems` may return stale data before the first `saveTransformers` completes, causing the first item to be lost.
**Why it happens:** The current pattern reads state from the store after a fetch; concurrent calls can interleave.
**How to avoid:** For Phase 3 (single-user workflow), this is low risk. The existing pattern is acceptable. Note it as a known limitation.
**Warning signs:** A transformer disappears after rapid creation of multiple transformers.

### Pitfall 5: `mapGetters` in `methods` (existing codebase anti-pattern)
**What goes wrong:** `mapGetters` spread into `methods` (as in `TransformerEditor.vue:74`) creates functions that must be invoked as `this.getByUtid()(utid)` — not reactive. This is already the project pattern (documented in CONVENTIONS.md as an anti-pattern). Do not change this per phase scope.
**How to avoid:** Continue the existing convention (`...mapGetters(...)` in `methods`, access as functions). Do not refactor to `computed` — that is out of scope.

### Pitfall 6: `beforeRouteLeave` not fired on browser back/close
**What goes wrong:** The `beforeRouteLeave` hook guards Vue Router navigation but does NOT fire on browser back button native navigation or page close (window unload).
**Why it happens:** Vue Router can only intercept in-app navigation.
**How to avoid:** For Phase 3 requirement TRAN-07, the `beforeRouteLeave` implementation satisfies the requirement as written ("warns before navigating away"). The `window.onbeforeunload` case is a known limitation, not a blocker.

---

## Code Examples

### Loading a transformer in the editor

```javascript
// Source: TransformerEditor.vue (verified in codebase)
async loadTransformer() {
  await this.fetchItems();
  const utid = this.$route.params.utid;
  const transformer = this.getByUtid()(utid);
  if (!transformer) {
    this.error = 'Transformer not found.';
    return;
  }
  this.form.alias = transformer.alias;
  try {
    this.form.body = transformer.body ? atob(transformer.body) : '';
  } catch {
    this.form.body = transformer.body || '';
  }
  this.hasChanges = false;
},
```

### Saving with base64 encode

```javascript
// Source: transformers.js store (verified in codebase)
async updateItem({ state, dispatch }, { utid, alias, body }) {
  const transformers = state.items.map(t =>
    t.utid === utid
      ? { utid, alias, body: btoa(body) }
      : { utid: t.utid, alias: t.alias, body: t.body }
  );
  return dispatch('saveTransformers', transformers);
},
```

### Improved utid generation (recommended fix for createItem)

```javascript
// Replacement for String(Date.now()) in createItem:
// [ASSUMED] — crypto.randomUUID() available in all modern browsers (Chrome 92+, Firefox 95+, Safari 15.4+)
const utid = typeof crypto !== 'undefined' && crypto.randomUUID
  ? crypto.randomUUID()
  : String(Date.now()) + Math.random().toString(36).slice(2);
```

---

## State of the Art

| Old Approach | Current Approach | Impact for Phase 3 |
|--------------|------------------|-------------------|
| `TransformerController.js` + AngularJS `$scope` | Vue 2 Options API + Vuex | No migration needed; legacy controller is reference only |
| `thinx-api.js` `submitProfile()` saves transformers via full profile POST | Same approach in Vue store `saveTransformers` | Functionally equivalent; keep this pattern |
| CryptoJS SHA256 for utid generation (legacy) | `String(Date.now())` (current Vue store) | Both are fragile; UUID preferred |

**Deprecated/outdated:**
- `/api/user/profile` (v1 path): Still works but prefer `/api/v2/profile`. The `ThinxApi` base path already uses `/api/v2/` so `this.$api.$get('/profile')` resolves correctly.

---

## Open Questions (RESOLVED)

1. **Does `this.$api.$get('/profile')` resolve to `/api/v2/profile` or `/api/profile`?**
   - What we know: `ThinxApi` is initialized with `VUE_APP_API_HOSTNAME` and all methods call `this.request()` which builds the full URL.
   - What's unclear: The exact base path format — does `ThinxApi.request()` prepend `/api/v2` automatically or is the path passed as-is?
   - RESOLVED: Confirmed via `vue/src/core/api.js` — `ThinxApi` base URL is set to `VUE_APP_API_HOSTNAME + '/api/v2'`. All `$get`/`$post` paths are appended to this base. So `this.$api.$get('/profile')` resolves to `GET /api/v2/profile`. The store's fetch path is correct.

2. **Does `POST /api/v2/profile` with `{ transformers: [...] }` require the session cookie or the Bearer token?**
   - What we know: The backend `router.profile.js` uses `Util.validateSession(req)` — session-based, not Bearer.
   - What's unclear: Whether the Vue app's session cookie is correctly set after login.
   - RESOLVED: Phase 2 pages (Apikeys.vue, Repositories.vue) all use the same `this.$api.$post` client and work correctly in production. Session cookie is valid for logged-in users. No auth change needed.

3. **What is the transformer data shape on the wire from the backend?**
   - What we know: `owner.js` default initializes transformers as `[]`. The legacy controller stores `{ utid, alias, body: base64 }`.
   - What's unclear: Whether the backend enforces a schema on `transformers` entries or stores them as-is.
   - RESOLVED: Confirmed via `owner.js` `process_update` — the `transformers` field is stored verbatim as the array passed in the POST body. No schema enforcement; the backend stores whatever array is provided. Stick to `{ utid, alias, body }` shape (matches legacy and current store).

---

## Environment Availability

Step 2.6: No new external dependencies. All tools are already available. The environment audit is not
applicable to this phase (pure frontend code/config changes using already-installed packages).

---

## Validation Architecture

`workflow.nyquist_validation` is not set in `.planning/config.json` — treating as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Cypress 9.5.4 (E2E only — no unit test framework present) |
| Config file | `vue/cypress.json` |
| Quick run command | `yarn cy:open` (interactive) |
| Full suite command | `yarn test` (starts dev server + runs Cypress headless) |

**Note:** There are no unit tests in this project. The only tests are Cypress E2E. The existing Cypress
login test is marked failing with a TODO. No new test infrastructure is created in Phase 3 scope.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| TRAN-01 | Store fetches transformers without using /profile in a way that bleeds into other profile state | manual | n/a | No unit test framework; verify by checking store fetch is isolated |
| TRAN-02 | Create transformer with alias → appears in list | manual smoke | `yarn cy:open` | Requires logged-in session |
| TRAN-03 | Delete transformer → removed from list | manual smoke | `yarn cy:open` | |
| TRAN-04 | Click Edit → navigates to `/app/transformer/:utid` | manual smoke | `yarn cy:open` | Route already registered |
| TRAN-05 | Editor renders with syntax highlighting | visual manual | `yarn cy:open` | CodeMirror renders colored tokens |
| TRAN-06 | Save → body stored as base64; reload → body decoded | manual smoke | `yarn cy:open` | Reload page and verify editor shows readable JS |
| TRAN-07 | Edit body, click another nav link → confirm dialog appears | manual smoke | `yarn cy:open` | beforeRouteLeave guard |

### Wave 0 Gaps

None — existing test infrastructure covers all phase requirements (Cypress smoke tests sufficient; no unit
test framework exists or is required by project convention).

---

## Security Domain

`security_enforcement` is not set in config — treating as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Not modifying auth flow |
| V3 Session Management | No | Session is managed by existing auth system |
| V4 Access Control | No | Transformers are user-owned; existing session validates owner |
| V5 Input Validation | Yes (partial) | Transformer alias input; validate non-empty before save |
| V6 Cryptography | No | `btoa`/`atob` is encoding, not encryption |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Executing untrusted JS transformer body in the browser | Information Disclosure | The editor is display-only; JS is sent to the backend as a string, never `eval()`'d in the console. No risk. |
| XSS via transformer alias rendered in list | Tampering | Template uses `{{ item.alias }}` (text interpolation, not `v-html`) — Vue auto-escapes. No risk. |
| Oversized transformer body filling the profile document | Denial of Service | No client-side size limit enforced. Backend validates at document level. Low risk for a logged-in user managing their own data. |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `this.$api.$get('/profile')` in the Vue store resolves to `/api/v2/profile` (because ThinxApi prepends `/api/v2`) | API Finding, Open Questions | If it resolves to `/api/profile` (v1), the GET request may fail or return a different shape — though v1 path also exists in backend |
| A2 | POST `/api/v2/profile` with `{ transformers: [...] }` is session-authenticated, and the session cookie is valid for logged-in users | Critical API Finding | If session is invalid, all save operations silently fail with 401 |
| A3 | `crypto.randomUUID()` is available in all target browsers for improved utid generation | Code Examples | Falls back to the current `Date.now()` approach, which works acceptably |
| A4 | Transformer body JavaScript is always ASCII/Latin-1 safe for `btoa()` | Common Pitfalls / Base64 | If users paste Unicode into the editor, `btoa()` throws; needs UTF-8 wrapper |
| A5 | POST `/api/v2/profile` with `{ transformers: [...] }` updates ONLY the `transformers` field, not the entire profile | Critical API Finding | Verified by `owner.js process_update` — confirmed safe [mitigated] |

---

## Sources

### Primary (HIGH confidence)
- `/Users/igraczech/Repositories/thinx-device-api/lib/thinx/owner.js` — profile GET response shape; POST write path; `process_update` whitelist; `transformers` field handling — VERIFIED
- `/Users/igraczech/Repositories/thinx-device-api/lib/router.profile.js` — confirmed only `GET /api/v2/profile` and `POST /api/v2/profile` routes exist — VERIFIED
- `/Users/igraczech/Repositories/thinx-device-api/lib/router.device.js` — confirmed only `/api/transformer/run` exists; no CRUD transformer routes — VERIFIED
- `/Users/igraczech/Repositories/thinx-device-api/services/console/vue/src/store/transformers.js` — current store implementation — VERIFIED
- `/Users/igraczech/Repositories/thinx-device-api/services/console/vue/src/pages/Transformers/TransformerEditor.vue` — current editor implementation — VERIFIED
- `/Users/igraczech/Repositories/thinx-device-api/services/console/vue/src/pages/Transformers/Transformers.vue` — current list implementation — VERIFIED
- `/Users/igraczech/Repositories/thinx-device-api/services/console/vue/src/Routes.js` — both transformer routes already registered — VERIFIED
- `codemirror@5.65.21`, `vue-codemirror@4.0.6` — installed and verified via node_modules inspection — VERIFIED

### Secondary (MEDIUM confidence)
- `spec/jasmine/ZZ-RouterTransformerSpec.js` — confirms transformer operations go via `/api/device/edit` (for device-level transformer assignment) and there is no dedicated transformer CRUD spec — VERIFIED
- `src/app/js/thinx-api.js:1086` — legacy `submitProfile` posts transformers inside `info` field — VERIFIED
- `src/app/js/controllers/TransformerController.js` — legacy controller confirms `saveProfileChanges` event pattern for transformer persistence — VERIFIED

### Tertiary (LOW confidence)
- IMPLEMENTATION_PLAN.md `/transformer` POST/DELETE endpoint entries — marked as "missing" but investigation shows they should not be created; backend does not support them. Use with caution.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — packages are installed and verified in node_modules
- Architecture: HIGH — all relevant backend source files and frontend files read and verified
- API contract: HIGH — confirmed via backend source code inspection (not just documentation)
- Pitfalls: HIGH — all derived from verified code analysis, not assumptions

**Research date:** 2026-05-19
**Valid until:** 2026-07-19 (stable project; no external API changes anticipated)

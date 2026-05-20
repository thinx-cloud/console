# Phase 4: Device Management - Research

**Researched:** 2026-05-20
**Domain:** Vue 2 / BootstrapVue — Device list enhancements + Device detail page completion
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Category filter: row of colored `b-button` pill buttons (one per category + "All"). Active = `variant="primary"`, inactive = `variant="outline-secondary"`. "All" clears filter.
- **D-02:** 7 hardcoded category names in `Devices.vue`: `yellow-crusta`, `red-intense`, `purple-studio`, `blue`, `green`, `green-dark`, `grey-mint`. Default category is `"grey-mint"` when absent.
- **D-03:** Sort via `b-form-select`. Options: Last update (`lastupdate` desc), Platform (`platform` asc), Alias (`alias` asc). Default: Last update. Client-side only.
- **D-04:** Live search filters by `alias` AND `mac` (case-insensitive substring). Client-side only, no API calls.
- **D-05:** Single toolbar row: grid/list toggles (left) → category pills → flex spacer → sort dropdown → search input (right). `<div class="d-flex align-items-center mb-3">`.
- **D-06:** Grid cards: category color badge + alias + platform + firmware + last seen (`fromNow`) + Detail + Build buttons. Same select-checkbox as list. Grid/list state is session-only data property.
- **D-07:** Grid/list toggle: two small icon buttons at toolbar start. Bootstrap responsive: `col-12 col-sm-6 col-md-4` per card.
- **D-08:** Build history: dispatch `buildlog/fetchBuildLog` (note: the store action is `fetchBuildLog`, not `fetchItems`), filter client-side by `device.udid`. Table: date, build ID, status. Note future endpoint in `IMPROVEMENTS.md`.
- **D-09:** Device environment variables: read-only key-value table from `device.environment`. No extra API call needed.
- **D-10:** Transformer multi-select: `<b-form-select multiple>` from `transformers/getItems`. Map `{ value: t.utid, text: t.alias }`. Save via `updateDevice({ udid, changes: { transformers: [...utids] } })`.
- **D-11:** Device logs: build log entries filtered by `device.last_build_id`. Display as scrollable `<pre>` or log line list.
- **D-12:** Transfer button in DeviceDetail Actions card. Reuse transfer modal pattern from `Devices.vue`. Dispatch `devices/transferDevices({ udids: [device.udid], ... })`.
- **D-13:** Per-row "Revoke" button (danger, sm) in Actions column. `msgBoxConfirm` then `revokeDevices([udid])`. After success, reload device list.

### Claude's Discretion

- SCSS/styling for category color pills — map category names to inline `style="background-color: ..."` or scoped CSS (no BootstrapVue named variant for these custom colors).
- Exact sort order tie-breaking — standard JS sort is acceptable.
- Empty state for build history — "No build history." text message.
- Transformer dropdown display: alias preferred if transformers store is loaded.

### Deferred Ideas (OUT OF SCOPE)

- Dedicated per-device build history API endpoint (`GET /device/:udid/builds`) — note to `IMPROVEMENTS.md` only.
- Real-time device log streaming via WebSocket.
- Category assignment editing from device detail or list.
- IoT icon display (`device.icon`, values 1–72).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEVI-01 | User can filter devices by category (color/icon-coded) | Category pill buttons using `device.category` field; 7 hardcoded names confirmed in `main.js` |
| DEVI-02 | User can sort devices by last update, platform, or alias | Client-side JS sort on `items`; no new API needed |
| DEVI-03 | User can search/filter the device list | Client-side substring filter on `alias` and `mac` fields |
| DEVI-04 | User can toggle between grid and list view | `viewMode` data property toggles between `<table>` and `<b-row>` grid sections |
| DEVI-05 | User can revoke a single device (with confirmation) | `revokeDevices([udid])` action exists; `msgBoxConfirm` pattern already established |
| DEVI-06 | User can bulk-revoke selected devices | Already implemented in `Devices.vue` — confirmed in codebase audit |
| DEVI-07 | User can transfer a device to another owner | Already implemented in `Devices.vue` transfer modal — confirmed in codebase audit |
| DEVI-08 | User can push config to a device | Already implemented in `Devices.vue` push-config modal — confirmed in codebase audit |
| DEVI-09 | User can trigger a firmware build for a device | `buildFirmware(udid)` already in `Devices.vue` — confirmed in codebase audit |
| DEVI-10 | User can navigate to device detail page at `/app/device/:udid` | Route already registered in `Routes.js`; `DeviceDetail.vue` exists |
| DEVI-11 | Device detail page shows: metadata, repo, build/deploy history, device enviros, transformer assignment, device logs, revoke/transfer actions | Sections need to be added to existing `DeviceDetail.vue`; all store actions exist |
</phase_requirements>

---

## Summary

Phase 4 is a pure UI extension phase — no new API endpoints, no new store modules, no new routes. All backing infrastructure (store actions, routes, modals for transfer/push/build) already exists in the codebase. The work is entirely in extending two Vue SFC files: `Devices.vue` (list enhancements + per-row revoke) and `DeviceDetail.vue` (five new card sections).

The critical implementation detail is the **computed filteredItems pipeline**: the items array must pass through category filter → search filter → sort in that order, as a computed property. The template's `v-for` binds to `filteredItems`, not the raw `items` array. This is the key architectural addition to `Devices.vue`.

For `DeviceDetail.vue`, the `loadDevice()` method must be extended with a `Promise.all` that also dispatches `buildlog/fetchBuildLog` and `transformers/fetchItems` in parallel with the existing `devices/fetchItems`. The new sections (build history, environment, transformers, device logs, transfer) all read from data properties populated after these dispatches.

**Primary recommendation:** Implement in two focused plans: (1) `Devices.vue` list enhancements + per-row revoke, (2) `DeviceDetail.vue` new sections + transfer button.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Category filter | Frontend (Vue component) | — | Pure client-side filter on already-loaded device array |
| Sort | Frontend (Vue component) | — | Client-side JS sort; no server-side sort endpoint used |
| Live search | Frontend (Vue component) | — | Substring match on loaded data; no API call |
| Grid/list view toggle | Frontend (Vue component) | — | Session state only; display logic |
| Per-row revoke | Frontend (Vue component) | API (DELETE /device) | Confirm in component, dispatch to store action |
| Build history display | Frontend (Vue component) | Vuex (buildlog store) | Fetch via existing store action, filter client-side |
| Environment variables display | Frontend (Vue component) | — | Data already in device payload from GET /device |
| Transformer assignment | Frontend (Vue component) | Vuex (devices + transformers stores) | Load transformer list, save via updateDevice |
| Device logs display | Frontend (Vue component) | Vuex (buildlog store) | Reuse buildlog store; filter by last_build_id |
| Transfer from detail page | Frontend (Vue component) | API (POST /transfer/request) | Reuse modal pattern + existing store action |

---

## Standard Stack

### Core (already installed — no new packages)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vue 2 | 2.6.14 | Component framework | Project standard [VERIFIED: package.json] |
| BootstrapVue | 2.21.2 | UI components (`b-button`, `b-form-select`, `b-card`, `b-modal`) | Project standard [VERIFIED: package.json] |
| Bootstrap | 4.6.0 | Grid system (`col-12 col-sm-6 col-md-4`), utilities (`d-flex`, `ml-auto`) | Project standard [VERIFIED: package.json] |
| Vuex | 3.6.2 | State management (devices, buildlog, transformers stores) | Project standard [VERIFIED: package.json] |
| Vue Router | 3.5.1 | Routing — both routes already registered | Project standard [VERIFIED: package.json] |

### No New Packages Required

This phase adds no new npm dependencies. All required libraries are already installed.

## Package Legitimacy Audit

> No new packages are installed in this phase. Existing packages were verified at project setup.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
User interaction (filter / sort / search / toggle)
        |
        v
[Devices.vue]
  data: { items[], selectedUdids[], viewMode, filterCategory, sortBy, searchText }
  computed: filteredItems  <-- category filter → search filter → sort (in order)
        |
        |-- v-if="viewMode === 'list'" --> <table> (existing, add Revoke column)
        |-- v-if="viewMode === 'grid'" --> <b-row> of <b-card> (new)
        |
        v (per-row Revoke click)
  msgBoxConfirm → revokeDevices([udid]) → loadData()

[DeviceDetail.vue]
  loadDevice():
    Promise.all([fetchItems(), fetchBuildLog(), fetchItems(transformers)])
        |
        v
    device = getByUdid()(udid)
    buildHistory = getBuildItems().filter(b => b.udid === udid)
    deviceLogs = getBuildItems().filter(b => b.build_id === device.last_build_id)
    transformers populated from getItems(transformers)
    editForm.transformers = [...device.transformers]

  Sections rendered:
    - Device Info (existing)
    - Network (existing)
    - Edit Device (existing)
    - Actions card: Build + Revoke + Transfer (new Transfer button)
    - Linked Repository (existing)
    - Environment Variables (new card — device.environment)
    - Transformer Assignment (new card — multi-select + save)
    - Build History (new card — filtered buildlog table)
    - Device Logs (new card — filtered buildlog <pre>)
```

### Recommended Project Structure

No new files needed. All changes go into two existing files:

```
vue/src/pages/Devices/
├── Devices.vue      — extend with toolbar, filteredItems computed, grid view, per-row revoke
└── DeviceDetail.vue — extend with new card sections, extended loadDevice(), transfer modal
```

One new file needed:
```
IMPROVEMENTS.md  (project root or .planning/) — note for future GET /device/:udid/builds endpoint
```

### Pattern 1: filteredItems Computed Property

**What:** A single computed property chains category filter → search filter → sort.
**When to use:** Whenever the list needs multi-dimensional client-side filtering.

```javascript
// Source: [ASSUMED] — standard Vue 2 computed pattern matching established codebase style
computed: {
  filteredItems() {
    let result = this.items;
    // 1. Category filter
    if (this.filterCategory && this.filterCategory !== 'All') {
      result = result.filter(d => d.category === this.filterCategory);
    }
    // 2. Search filter (alias OR mac, case-insensitive)
    if (this.searchText) {
      const q = this.searchText.toLowerCase();
      result = result.filter(d =>
        (d.alias || '').toLowerCase().includes(q) ||
        (d.mac || '').toLowerCase().includes(q)
      );
    }
    // 3. Sort
    result = [...result].sort((a, b) => {
      if (this.sortBy === 'lastupdate') {
        return (b.lastupdate || 0) - (a.lastupdate || 0); // descending
      }
      if (this.sortBy === 'platform') {
        return (a.platform || '').localeCompare(b.platform || '');
      }
      if (this.sortBy === 'alias') {
        return (a.alias || '').localeCompare(b.alias || '');
      }
      return 0;
    });
    return result;
  },
},
```

### Pattern 2: Category Color Pills with Inline Styles

**What:** The legacy `bg-{name}` CSS classes do not exist in Vue's SCSS. Use inline styles mapping category name to the legacy hex values. [VERIFIED: legacy CSS components.css]

```javascript
// Source: [VERIFIED: src/html/assets/global/css/components.css]
// Category hex colors extracted from legacy .bg-{name} classes:
const CATEGORY_COLORS = {
  'yellow-crusta': '#f3c200',
  'red-intense':   '#e35b5a',
  'purple-studio': '#8E44AD',
  'blue':          '#3598dc',
  'green':         '#32c5d2',
  'green-dark':    '#4DB3A2',
  'grey-mint':     '#525e64',
};
```

Template pill example:
```html
<!-- Source: [ASSUMED] — BootstrapVue b-button pattern matching existing Devices.vue style -->
<b-button
  v-for="cat in categories"
  :key="cat"
  size="sm"
  :variant="filterCategory === cat ? 'primary' : 'outline-secondary'"
  :style="filterCategory !== cat ? { borderColor: categoryColor(cat), color: categoryColor(cat) } : {}"
  @click="filterCategory = cat"
  class="mr-1"
>{{ cat === 'All' ? 'All' : cat }}</b-button>
```

### Pattern 3: Extended loadDevice() with Parallel Dispatches

**What:** DeviceDetail must fetch buildlog and transformers in parallel with devices.

```javascript
// Source: [ASSUMED] — follows established Promise.all pattern from Devices.vue loadData()
async loadDevice() {
  this.loading = true;
  const udid = this.$route.params.udid;
  await Promise.all([
    this.fetchItems(),           // devices/fetchItems
    this.fetchBuildLog(),        // buildlog/fetchBuildLog  ← action name is fetchBuildLog
    this.fetchTransformers(),    // transformers/fetchItems
  ]);
  this.device = this.getByUdid()(udid) || null;
  if (this.device) {
    this.editForm.alias = this.device.alias;
    this.editForm.description = this.device.description || '';
    this.editForm.transformers = [...(this.device.transformers || [])];
    const allBuilds = this.getBuildItems();
    this.buildHistory = allBuilds.filter(b => b.udid === udid);
    this.deviceLogs = allBuilds.filter(b => b.build_id === (this.device.last_build_id));
  }
  this.loading = false;
},
```

### Pattern 4: Transformer Multi-Select Save

**What:** Save updated transformer list via existing `updateDevice` action.

```javascript
// Source: [ASSUMED] — uses existing updateDevice store action confirmed in devices.js
async saveTransformers() {
  const result = await this.updateDevice({
    udid: this.device.udid,
    changes: { transformers: this.editForm.transformers },
  });
  if (result.success) {
    this.message = 'Transformers saved.';
    await this.loadDevice();
  } else {
    this.error = result.message || 'Failed to save transformers.';
  }
},
```

### Anti-Patterns to Avoid

- **Mutating `this.items` directly in the filter/sort:** Create `filteredItems` as a computed property. Never mutate `items` — it is the source of truth populated from the store.
- **Calling `fetchBuildLog` as `buildlog/fetchItems`:** The buildlog store action is named `fetchBuildLog`, not `fetchItems`. The History page and the store confirm this. CONTEXT.md's reference to `buildlog/fetchItems` contains a naming error — use `buildlog/fetchBuildLog`.
- **Filtering `buildlog` items by `build_id` directly:** The normalized build item shape has `build_id` (not `_id`) and `udid` (not `device_udid`). See `normalizeBuildItems()` in `buildlog.js`.
- **Using BootstrapVue named variants for category colors:** The 7 category colors (`yellow-crusta`, etc.) are not BootstrapVue variant names. They require inline styles or scoped CSS. The legacy `bg-{name}` classes exist only in the legacy CSS bundle which is not loaded in Vue.
- **Putting `mapGetters` in `computed`:** The established project pattern is `mapGetters` spread into `methods` — getters are called as functions `this.getItems()`. Do not change to `computed` in files that are only partially modified.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Confirm dialogs | Custom confirm modal component | `this.$bvModal.msgBoxConfirm()` | Already used in `Devices.vue` for bulk revoke; consistent UX |
| Transfer modal | New modal component | Copy/adapt the existing transfer modal HTML from `Devices.vue` | Pattern already established and working |
| Build log fetching | Separate API call in component | `buildlog/fetchBuildLog` store action | Already normalized by `normalizeBuildItems()` in store |
| Relative time formatting | `moment.js` or `date-fns` | `fromNow` filter already defined in both files | Keep in-file filter — no new dependency needed |
| Category color mapping | CSS class lookup | Inline style with hardcoded CATEGORY_COLORS map | Legacy CSS classes not available in Vue bundle |

**Key insight:** Every backing operation (fetch, revoke, transfer, build, update) already has a working store action. This phase is 100% UI/template work.

---

## Common Pitfalls

### Pitfall 1: buildlog Action Name Mismatch
**What goes wrong:** Dispatching `buildlog/fetchItems` causes a Vuex "unknown action type" warning; build history stays empty.
**Why it happens:** The buildlog store has `fetchBuildLog` as its action name (verified in `buildlog.js:40`), not `fetchItems`. The CONTEXT.md reference to `buildlog/fetchItems` is incorrect.
**How to avoid:** Use `buildlog/fetchBuildLog` in all dispatch calls. Map it as `fetchBuildLog: 'buildlog/fetchBuildLog'` in `mapActions`.
**Warning signs:** Empty build history section with no error message; check Vue DevTools for failed dispatches.

### Pitfall 2: `mapGetters` in `methods` (not `computed`)
**What goes wrong:** Standard Vue `mapGetters` usage puts getters in `computed`. This project spreads them into `methods` instead. Mixing the two patterns in one file breaks reactivity or causes duplicate property errors.
**Why it happens:** Established pattern in this codebase — `...mapGetters({...})` is inside `methods: { ... }`. Both `Devices.vue` and `DeviceDetail.vue` use this pattern.
**How to avoid:** Keep the same pattern when adding new getter mappings. Add to the existing `...mapGetters({})` spread.
**Warning signs:** Vue warning about "Computed property X is already defined in data" or getters not reacting to store changes.

### Pitfall 3: `filteredItems` Accidentally Mutates Source Array
**What goes wrong:** Sort mutates `this.items` in place, causing check-all checkbox to use sorted order inconsistently, and subsequent filter operations fail.
**Why it happens:** JavaScript `Array.prototype.sort()` is in-place. If `filteredItems` does `this.items.sort(...)`, it modifies the store-linked array.
**How to avoid:** Always spread before sort: `result = [...result].sort(...)`.
**Warning signs:** Checkbox state becomes inconsistent after sorting; "select all" stops working correctly.

### Pitfall 4: `device.environment` May Be `null` or `undefined`
**What goes wrong:** `v-for="(val, key) in device.environment"` throws if `device.environment` is `null`.
**Why it happens:** The backend sets `environment` only when env vars are assigned. Some devices have `null`.
**How to avoid:** Use `v-if="device.environment && Object.keys(device.environment).length"` before the table, with a "No environment variables." fallback.
**Warning signs:** Vue warning "Cannot convert undefined or null to object" for `v-for` on null.

### Pitfall 5: Build History Filter by `udid` vs `build_id`
**What goes wrong:** Build history returns all build log items for the user, not just this device.
**Why it happens:** `buildlog/fetchBuildLog` fetches ALL builds for the account (`GET /logs/build`). Must filter client-side.
**How to avoid:** For build history: filter by `b.udid === this.$route.params.udid`. For device logs section (showing log lines of last build): filter by `b.build_id === device.last_build_id`. These are two different filtered views of the same dataset.
**Warning signs:** Build history shows builds for all devices; device log shows nothing or wrong content.

### Pitfall 6: Transformers Store Has No Alias Until Fetched
**What goes wrong:** Transformer dropdown shows blank option text because `transformers/fetchItems` was not dispatched.
**Why it happens:** The transformers store starts empty (`state.items = []`). If `DeviceDetail.vue` does not dispatch `fetchItems`, the options array is empty.
**How to avoid:** Include `transformers/fetchItems` in the `Promise.all` in `loadDevice()`.
**Warning signs:** Empty dropdown; `transformerOptions` computed property returns `[]`.

---

## Code Examples

Verified patterns from codebase inspection:

### Confirmed store action signatures (all exist in current codebase)
```javascript
// Source: [VERIFIED: vue/src/store/devices.js]
// devices/revokeDevices(udids: string[]) → { success, message? }
// devices/transferDevices({ udids, to, mig_sources, mig_apikeys }) → { success, message? }
// devices/buildFirmware(udid: string) → { success, message? }
// devices/updateDevice({ udid, changes: object }) → { success, message? }

// Source: [VERIFIED: vue/src/store/buildlog.js]
// buildlog/fetchBuildLog() → normalized array
// Normalized item shape: { id, build_id, udid, date, name, status, log: string[], raw }

// Source: [VERIFIED: vue/src/store/transformers.js]
// transformers/fetchItems() → array of { id, utid, alias, body }
```

### Confirmed device object fields (from CONTEXT.md canonical refs)
```javascript
// Source: [VERIFIED: 04-CONTEXT.md canonical refs — from backend list() function]
// device.alias, device.category (default "grey-mint"), device.environment (masked, may be null)
// device.transformers (array of UTIDs), device.last_build_id, device.last_build_date
// device.icon (1–72), device.tags, device.auto_update, device.firmware, device.platform
// device.status, device.lastupdate, device.source, device.mac, device.udid
// device.version, device.rssi, device.station, device.lat, device.lon, device.commit
// device.description
```

### Per-row Revoke button (in table Actions column)
```html
<!-- Source: [ASSUMED] — follows existing msgBoxConfirm pattern in Devices.vue:163-176 -->
<b-button size="sm" variant="danger" @click="revokeRow(device.udid)" class="ml-1">Revoke</b-button>
```
```javascript
async revokeRow(udid) {
  const confirmed = await this.$bvModal.msgBoxConfirm(
    'Revoke this device? This cannot be undone.',
    { title: 'Confirm Revoke', okVariant: 'danger', okTitle: 'Revoke' }
  );
  if (!confirmed) return;
  const result = await this.revokeDevices([udid]);
  if (result.success) {
    this.message = 'Device revoked.';
    this.loadData();
  } else {
    this.error = result.message || 'Failed to revoke device.';
  }
},
```

### Grid card template sketch
```html
<!-- Source: [ASSUMED] — follows d-07 decision and legacy grid card structure in devices.html:133-195 -->
<b-col v-for="device in filteredItems" :key="device.udid" cols="12" sm="6" md="4" class="mb-3">
  <b-card class="h-100">
    <template #header>
      <span
        class="badge mr-2"
        :style="{ backgroundColor: categoryColor(device.category), color: '#fff' }"
      >{{ device.category }}</span>
      <strong>{{ device.alias }}</strong>
    </template>
    <p class="mb-1">{{ device.platform }}</p>
    <p class="mb-1 text-muted small">{{ device.firmware }}</p>
    <p class="mb-2 text-muted small">{{ device.lastupdate | fromNow }}</p>
    <b-button size="sm" variant="primary" @click="viewDevice(device.udid)" class="mr-1">Detail</b-button>
    <b-button size="sm" variant="secondary" @click="buildDevice(device.udid)">Build</b-button>
  </b-card>
</b-col>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AngularJS `ng-repeat` with `filter` and `orderBy` pipes | Vue computed `filteredItems` chaining | Vue migration | Must replicate pipe chain as computed property |
| `ui-select multiple` (AngularJS ui-select) | `<b-form-select multiple>` (BootstrapVue) | Vue migration | Standard BootstrapVue; no extra library |
| Legacy `bg-{name}` CSS utility classes | Inline styles with hex values | Vue migration | Legacy CSS bundle not loaded in Vue; use inline styles |

**Deprecated/outdated:**
- The CONTEXT.md reference `buildlog/fetchItems` is incorrect — the actual action is `buildlog/fetchBuildLog` (verified in `buildlog.js`). This discrepancy exists only in the CONTEXT discussion note, not in the actual store.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Category color hex values (`#f3c200`, etc.) are the correct values to use in Vue inline styles | Code Examples, Pattern 2 | Colors would not match legacy; low visual risk, easy fix |
| A2 | `device.last_build_id` matches `build_id` in normalized buildlog items | Pattern 3, Common Pitfalls | Device logs section would show nothing; debug by logging both values |
| A3 | `device.transformers` is an array of UTID strings (not objects) | Pattern 4 | Multi-select would show UTIDs instead of aliases; fix by adjusting value mapping |
| A4 | The `transformers/fetchItems` action name matches the Vuex namespaced dispatch path | Pattern 3 | Store dispatch would fail silently; transformer dropdown empty |

**Note on A4:** The transformers store action at line 29 is named `fetchItems` — this IS correct (unlike buildlog which uses `fetchBuildLog`). Dispatch as `transformers/fetchItems`.

---

## Open Questions

1. **Does `device.environment` contain keys with masked values (e.g., `"*****"`) or is it a full plain-text object?**
   - What we know: CONTEXT.md says "masked" — so values are likely partially hidden server-side.
   - What's unclear: Whether `Object.keys(device.environment)` works normally or if the field is a special structure.
   - Recommendation: Render as-is with `v-for="(val, key) in device.environment"` — the display will show whatever the server returns; add a note "(masked)" in the card title.

2. **Is `device.last_build_id` reliably populated for all devices?**
   - What we know: CONTEXT.md lists it as a device field.
   - What's unclear: Whether devices that have never been built have `last_build_id: null`.
   - Recommendation: Guard with `v-if="device.last_build_id"` before the device logs section.

---

## Environment Availability

> Step 2.6: SKIPPED — this phase is purely Vue SFC code changes. No new external tools, services, CLIs, or databases are required. All APIs are already in use by the existing codebase.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Cypress 9.5.4 |
| Config file | `vue/cypress.json` |
| Quick run command | `yarn cy:open` (interactive) |
| Full suite command | `yarn test` (requires server running on :3000) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEVI-01 | Category filter shows only matching devices | e2e | `yarn cy:open` → devices spec | ❌ Wave 0 |
| DEVI-02 | Sort by alias reorders list | e2e | `yarn cy:open` → devices spec | ❌ Wave 0 |
| DEVI-03 | Search for alias substring shows filtered results | e2e | `yarn cy:open` → devices spec | ❌ Wave 0 |
| DEVI-04 | Grid/list toggle switches view mode | e2e | `yarn cy:open` → devices spec | ❌ Wave 0 |
| DEVI-05 | Per-row revoke shows confirm and removes device | e2e | `yarn cy:open` → devices spec | ❌ Wave 0 |
| DEVI-06–09 | Already implemented — smoke test only | e2e/manual | `yarn cy:open` → devices spec | ❌ Wave 0 |
| DEVI-10 | Clicking Detail navigates to `/app/device/:udid` | e2e | `yarn cy:open` → device-detail spec | ❌ Wave 0 |
| DEVI-11 | Device detail shows all required sections | e2e | `yarn cy:open` → device-detail spec | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** Manual review in browser (dev server at :3000)
- **Per wave merge:** `yarn cy:open` — run devices + device-detail specs interactively
- **Phase gate:** All spec assertions green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vue/cypress/integration/devices.spec.js` — covers DEVI-01 through DEVI-09 (filter, sort, search, toggle, per-row revoke)
- [ ] `vue/cypress/integration/device-detail.spec.js` — covers DEVI-10 and DEVI-11 (navigation, all sections render)

*(The existing `login.spec.js` is the only spec; device pages have no Cypress coverage yet.)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Auth already handled by login flow |
| V3 Session Management | no | No session changes in this phase |
| V4 Access Control | no | No new routes; existing auth guard unchanged |
| V5 Input Validation | yes (low) | Search input is client-side only — no injection risk. Transfer modal `to` field is sent to backend — existing store action handles it without additional escaping needed at component level |
| V6 Cryptography | no | No crypto in this phase |

### Known Threat Patterns for Vue 2 / Device Management

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via `device.alias` in v-bind | Tampering | Vue's default `{{ }}` interpolation auto-escapes; do not use `v-html` for device fields |
| Mass revoke without confirmation | Tampering | `msgBoxConfirm` pattern already established for all destructive actions — extend to per-row revoke |
| Transfer to arbitrary email | Tampering | Backend validates target owner; frontend sends as-is (existing pattern, no change needed) |

---

## Sources

### Primary (HIGH confidence)
- `vue/src/pages/Devices/Devices.vue` — current implementation; all existing patterns verified by direct read
- `vue/src/pages/Devices/DeviceDetail.vue` — current implementation verified by direct read
- `vue/src/store/devices.js` — all action names and signatures verified by direct read
- `vue/src/store/buildlog.js` — `fetchBuildLog` action name and normalized item shape verified by direct read
- `vue/src/store/transformers.js` — `fetchItems` action name verified by direct read
- `vue/src/store/enviros.js` — enviros shape and `saveSimpleArray` mutation verified
- `vue/src/Routes.js` — both device routes confirmed registered
- `vue/package.json` — Vue 2.6.14, BootstrapVue 2.21.2, Vuex 3.6.2 confirmed
- `src/html/assets/global/css/components.css` — 7 category hex color values extracted programmatically
- `src/app/js/main.js` lines 141–149 — 7 hardcoded category names confirmed

### Secondary (MEDIUM confidence)
- `vue/src/pages/History/History.vue` — confirms correct dispatch path `buildlog/fetchBuildLog` and getter `buildlog/getItems`
- `.planning/phase-4/04-CONTEXT.md` — all locked decisions read; one naming discrepancy found and documented (see Pitfall 1)
- `src/app/views/devices.html` — legacy category filter and grid view pattern read for reference
- `src/app/views/device.html` — legacy transformer assignment and build history display read for reference

### Tertiary (LOW confidence)
- None — all claims in this research are either verified from codebase or tagged [ASSUMED] with risk noted.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified from package.json
- Architecture: HIGH — all store actions, routes, and patterns verified from source files
- Pitfalls: HIGH — most pitfalls discovered from direct code reading (actual action names, null checks, sort mutation)
- Category colors: HIGH — extracted programmatically from legacy CSS

**Research date:** 2026-05-20
**Valid until:** 2026-06-20 (stable Vue 2 ecosystem; changes unlikely)

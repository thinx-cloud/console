# Phase 4: Device Management - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Full device management parity with the legacy console. This phase delivers:

**Device list enhancements (DEVI-01–04):**
- Category filter (7 color-coded pill buttons)
- Sort dropdown (last update, platform, alias)
- Live search (alias + MAC, client-side)
- Grid / list view toggle

**Device list actions (DEVI-05–09):**
- Per-row single Revoke button with confirmation (DEVI-05)
- All other actions (bulk revoke, transfer, push config, build firmware) already implemented

**Device detail page completion (DEVI-10–11):**
- Route `/app/device/:udid` and `DeviceDetail.vue` already exist — this phase adds the missing sections
- Build/deploy history (filtered from buildlog store)
- Device-specific environment variables (from `device.environment` field — already in GET /device payload)
- Transformer assignment: editable multi-select dropdown with save
- Device logs (build log entries filtered by `last_build_id`)
- Transfer action button (modal, same pattern as list page)

**What is already done and NOT in scope:**
- Store actions: `revokeDevices`, `transferDevices`, `pushConfiguration`, `buildFirmware`, `updateDevice` — all exist in `devices.js`
- Transfer modal and push-config modal in `Devices.vue` — already implemented
- Bulk revoke with confirmation in `Devices.vue` — already implemented
- Basic `DeviceDetail.vue` with metadata, alias/description edit, linked repo, build + revoke buttons

</domain>

<decisions>
## Implementation Decisions

### Category filter (DEVI-01)
- **D-01:** Display category filter as a row of colored `b-button` pill buttons — one per category plus an "All" pill. Active category highlighted with `variant="primary"`, inactive with `variant="outline-secondary"`. Filter is cleared when "All" is selected.
- **D-02:** The 7 category names are hardcoded directly in `Devices.vue` (same values as legacy `src/app/js/main.js`): `yellow-crusta`, `red-intense`, `purple-studio`, `blue`, `green`, `green-dark`, `grey-mint`. The device object includes `category` field (default `"grey-mint"` if absent).

### Sort (DEVI-02)
- **D-03:** Sort is a `b-form-select` dropdown above the table/grid. Options: "Last update" (sort by `lastupdate` descending), "Platform" (sort by `platform` ascending), "Alias" (sort by `alias` ascending). Default: Last update. Sort is applied client-side to the filtered list.

### Search (DEVI-03)
- **D-04:** Live search input filters by `alias` AND `mac` (case-insensitive substring match). Client-side only — no API calls. Matches legacy `propsFilter` behavior.

### Toolbar layout
- **D-05:** Single toolbar row above the table/grid in this order: grid/list toggle icon buttons (left) → category pill buttons → flex spacer → sort dropdown → search input (right). All in one `<div class="d-flex align-items-center mb-3">` row.

### Grid view (DEVI-04)
- **D-06:** Grid cards are rich: category color badge + alias (card title) + platform + firmware + last seen (`fromNow` filter) + "Detail" and "Build" action buttons. Same select-checkbox as list view. Grid/list state is a data property (session-only, not persisted).
- **D-07:** Grid/list toggle: two small icon buttons at the start of the toolbar row. Bootstrap responsive layout: `col-12 col-sm-6 col-md-4` per card.

### Device detail: build history (DEVI-11)
- **D-08:** Build history is fetched by dispatching `buildlog/fetchItems` and filtering client-side by `device.udid`. The buildlog store already exists. Display as a table of build entries (date, build ID, status). Add a note to `IMPROVEMENTS.md` tracking the future dedicated per-device build history endpoint.

### Device detail: environment variables (DEVI-11)
- **D-09:** Device-specific environment variables are included in the GET /device payload as `device.environment` (masked). Display as a read-only key-value table in `DeviceDetail.vue`. No additional API call needed.

### Device detail: transformer assignment (DEVI-11)
- **D-10:** Editable multi-select dropdown using available transformers from the `transformers` store. Shows assigned transformers (from `device.transformers` array of UTIDs); allows adding/removing. Save via `updateDevice({ udid, changes: { transformers: [...utids] } })` using the existing `updateDevice` store action.

### Device detail: device logs (DEVI-11)
- **D-11:** Device logs section shows build log entries filtered by `device.last_build_id`. Reuse the buildlog store dispatch. Display as a scrollable `<pre>` or log line list.

### Device detail: transfer action (DEVI-11)
- **D-12:** Add a "Transfer" button to the Actions card in `DeviceDetail.vue`. Reuse the same transfer modal pattern from `Devices.vue` (target owner email + migrate sources/API keys checkboxes). Dispatch `devices/transferDevices({ udids: [device.udid], to, mig_sources, mig_apikeys })`.

### Single device revoke from list (DEVI-05)
- **D-13:** Add a small danger "Revoke" button per row in the Actions column of the device table. Triggers `msgBoxConfirm` then `revokeDevices([udid])` — same pattern as the bulk revoke. After success, reload the device list.

### Claude's Discretion
- SCSS/styling for category color pills — Claude maps category names to BootstrapVue variants or inline styles matching the legacy CSS color class pattern
- Exact sort order behavior (stable sort, tie-breaking) — standard JS sort behavior is acceptable
- Empty state for build history (no builds for device) — simple "No build history." text message
- Whether the transformer dropdown shows alias or UTID — alias preferred if transformers store is loaded

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core implementation files (current state — read before modifying)
- `vue/src/pages/Devices/Devices.vue` — current device list page with existing revoke/transfer/push-config/build
- `vue/src/pages/Devices/DeviceDetail.vue` — current device detail page (metadata, edit, revoke, build)
- `vue/src/store/devices.js` — devices Vuex module: all store actions already exist here
- `vue/src/store/buildlog.js` — build log store: fetchItems calls GET /logs/build
- `vue/src/store/transformers.js` — transformers store: used for UTID→alias lookup in DeviceDetail
- `vue/src/store/enviros.js` — global enviros store: used for push-config modal env multi-select

### Device object shape (critical)
The GET /device payload normalizes each device to include: `alias`, `category` (default `"grey-mint"`), `environment` (masked env vars), `transformers` (array of UTIDs), `last_build_id`, `last_build_date`, `icon` (1–72), `tags`, `auto_update`, `firmware`, `platform`, `status`, `lastupdate`, `source`, `mac`, `udid`, `version`, `rssi`, `station`, `lat`, `lon`, `commit`, `description`. The shape is defined in the backend `list()` function of the device service.

### Legacy reference (patterns to port)
- `src/app/views/devices.html` — legacy category filter pills, grid/list toggle, search input, grid card layout
- `src/app/views/device.html` — legacy device detail sections: transformer assignment UI, build history display
- `src/app/js/main.js` lines 141–149 — the 7 hardcoded category color names and iotIcons array (icons 1–72)

### API and requirements
- `services/console/IMPLEMENTATION_PLAN.md` — API endpoint map; device endpoints section (Phase 4)
- `.planning/REQUIREMENTS.md` — DEVI-01 through DEVI-11 definitions

### Routing
- `vue/src/Routes.js` — both `/app/devices` (Devices) and `/app/device/:udid` (DeviceDetail) routes already registered

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `this.$bvModal.msgBoxConfirm`: use for per-row single revoke confirm (same as existing bulk revoke pattern)
- `devices/transferDevices` action: handles array of UDIDs — pass `[device.udid]` for single-device transfer from detail page
- `devices/revokeDevices` action: same array pattern — `[udid]` for single revoke
- `buildlog/fetchBuildLog` action: fetches all build log entries — filter by udid or last_build_id after dispatch
- `transformers/getItems` getter: returns transformer list — use for UTID→alias lookup and dropdown options
- `fromNow` filter: defined locally in both `Devices.vue` and `DeviceDetail.vue` — duplicate as needed or extract to mixin if both files are touched

### Established Patterns
- `mapGetters` spread into `methods` (not `computed`) — all getters called as `this.getItems()` functions
- `loadData()` pattern: `Promise.all([...dispatches]).then(() => { this.localData = this.getItems(); })`
- Error handling: `if (result.success) { this.message = '...'; } else { this.error = result.message || 'Failed.'; }`
- Store module pattern: `namespaced: true`, actions use `this.$api.$get/post/delete()`
- Category default: backend sets `category: dvc.category || "grey-mint"` — always safe to use `device.category` as a CSS class or variant key

### Integration Points
- `Devices.vue` is the primary file to extend with toolbar controls, grid view, and per-row revoke
- `DeviceDetail.vue` gets new sections: build history, environment, transformer assignment, device logs, transfer button
- Both `buildlog` and `transformers` store modules need to be dispatched from `DeviceDetail.vue`'s `loadDevice()`
- Grid view: add a `<b-row v-if="viewMode === 'grid'">` block alongside the existing `<table v-if="viewMode === 'list'">` — not a separate component

</code_context>

<specifics>
## Specific Ideas

- Toolbar row: `<div class="d-flex align-items-center flex-wrap mb-3 gap-2">` — grid/list icons first, then category pills, then `<div class="ml-auto d-flex">` for sort + search
- Category pills: `v-for="cat in ['All', 'yellow-crusta', 'red-intense', ...]"` with `:variant="filterCategory === cat ? 'primary' : 'outline-secondary'"` and `size="sm"`
- Sort dropdown: `<b-form-select v-model="sortBy" :options="sortOptions" size="sm" style="width:160px" />`
- Grid card: `<b-card class="mb-3 h-100">` with `<b-card-body>` containing category badge + alias + platform + firmware + last seen
- Transformer multi-select: `<b-form-select multiple v-model="editForm.transformers" :options="transformerOptions" />`; `transformerOptions` built from `this.getTransformers()` mapped to `{ value: t.utid, text: t.alias }`
- Environment display: `<tr v-for="(val, key) in device.environment" :key="key"><td>{{ key }}</td><td>{{ val }}</td></tr>`
- Build history: load via `Promise.all([fetchBuildLog()])` in `loadDevice()`, filter client-side: `this.buildHistory = this.getBuildLogItems().filter(b => b.udid === udid)`
- Note to add to `IMPROVEMENTS.md`: "Add `GET /device/:udid/builds` endpoint for per-device build history (currently requires client-side filter of full build log)"

</specifics>

<deferred>
## Deferred Ideas

- Dedicated per-device build history API endpoint (`GET /device/:udid/builds`) — add to `IMPROVEMENTS.md` as backend improvement item; client-side filter is the v1 approach
- Real-time device log streaming via WebSocket — out of scope for v1 (polling/static display acceptable)
- Category assignment editing from the device detail or list — device category is editable via `updateDevice` but the UI for it is not in scope for Phase 4 list enhancements
- IoT icon display (device.icon, values 1–72) — the legacy uses these for grid cards; Vue implementation deferred unless easy to add

</deferred>

---

*Phase: 4-Device Management*
*Context gathered: 2026-05-20*

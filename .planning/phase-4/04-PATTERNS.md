# Phase 4: Device Management - Pattern Map

**Mapped:** 2026-05-20
**Files analyzed:** 4 files to modify/create (2 Vue SFCs + 2 Cypress spec stubs)
**Analogs found:** 4 / 4

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `vue/src/pages/Devices/Devices.vue` | component (extend) | CRUD + client-side transform | `vue/src/pages/History/History.vue` (computed filter chain) | role-match |
| `vue/src/pages/Devices/DeviceDetail.vue` | component (extend) | CRUD + parallel fetch | `vue/src/pages/Devices/Devices.vue` (loadData pattern) | exact |
| `vue/cypress/integration/devices.spec.js` | test (new) | request-response (e2e) | `vue/cypress/integration/login.spec.js` | role-match |
| `vue/cypress/integration/device-detail.spec.js` | test (new) | request-response (e2e) | `vue/cypress/integration/login.spec.js` | role-match |

---

## Pattern Assignments

### `vue/src/pages/Devices/Devices.vue` (component, extend)

**Primary analog:** `vue/src/pages/Devices/Devices.vue` (self — extend existing patterns)
**Secondary analog:** `vue/src/pages/History/History.vue` (computed filter chain)

---

#### Existing imports block (lines 101–102) — copy as-is, add new action/getter mappings

```javascript
import { mapGetters, mapActions } from 'vuex';
```

---

#### Existing data() (lines 117–127) — extend with new filter/sort/view properties

```javascript
data() {
  return {
    items: [],
    loading: true,
    error: null,
    message: null,
    selectedUdids: [],
    enviros: [],
    transferForm: { to: '', mig_sources: false, mig_apikeys: false },
    pushForm: { selectedEnviros: [], reset_devices: false },
    // ADD BELOW — new properties for toolbar controls
    viewMode: 'list',            // 'list' | 'grid'
    filterCategory: 'All',
    sortBy: 'lastupdate',
    searchText: '',
  };
},
```

---

#### Existing computed (lines 128–132) — extend, do NOT replace

```javascript
computed: {
  isSelected() { return this.selectedUdids.length > 0; },
  selectedCount() { return this.selectedUdids.length; },
  isAllSelected() { return this.items.length > 0 && this.selectedUdids.length === this.items.length; },
  // ADD filteredItems computed below — uses this.items as source of truth, never mutates it
},
```

**filteredItems computed — new addition:**

```javascript
filteredItems() {
  let result = this.items;
  if (this.filterCategory && this.filterCategory !== 'All') {
    result = result.filter(d => d.category === this.filterCategory);
  }
  if (this.searchText) {
    const q = this.searchText.toLowerCase();
    result = result.filter(d =>
      (d.alias || '').toLowerCase().includes(q) ||
      (d.mac || '').toLowerCase().includes(q)
    );
  }
  result = [...result].sort((a, b) => {  // spread to avoid in-place mutation of this.items
    if (this.sortBy === 'lastupdate') return (b.lastupdate || 0) - (a.lastupdate || 0);
    if (this.sortBy === 'platform')   return (a.platform || '').localeCompare(b.platform || '');
    if (this.sortBy === 'alias')      return (a.alias || '').localeCompare(b.alias || '');
    return 0;
  });
  return result;
},
```

---

#### Existing mapGetters in methods (line 137) — extend, keep in methods (not computed)

```javascript
methods: {
  ...mapGetters({ getItems: 'devices/getItems', getEnviros: 'enviros/getItems' }),
  // pattern: getters mapped into methods and called as this.getItems() functions
  // ...
```

---

#### Existing mapActions (lines 138–145) — extend for new getter, no new store actions needed

```javascript
...mapActions({
  fetchItems: 'devices/fetchItems',
  revokeDevices: 'devices/revokeDevices',
  transferDevices: 'devices/transferDevices',
  pushConfiguration: 'devices/pushConfiguration',
  buildFirmware: 'devices/buildFirmware',
  fetchEnviros: 'enviros/fetchItems',
}),
```

---

#### Bulk revoke pattern (lines 163–177) — copy directly for per-row revokeRow method

```javascript
async confirmRevoke() {
  const confirmed = await this.$bvModal.msgBoxConfirm(
    `Revoke ${this.selectedCount} device(s)? This cannot be undone.`,
    { title: 'Confirm Revoke', okVariant: 'danger', okTitle: 'Revoke' }
  );
  if (!confirmed) return;
  const result = await this.revokeDevices([...this.selectedUdids]);
  if (result.success) {
    this.message = 'Devices revoked.';
    this.selectedUdids = [];
    this.loadData();
  } else {
    this.error = result.message || 'Failed to revoke devices.';
  }
},
```

**Adapt to per-row revokeRow(udid) — single device:**

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

---

#### loadData pattern (lines 212–219) — copy structure exactly for all new Promise.all calls

```javascript
loadData() {
  this.loading = true;
  Promise.all([this.fetchItems(), this.fetchEnviros()]).then(() => {
    this.items = this.getItems();
    this.enviros = this.getEnviros();
    this.loading = false;
  });
},
```

---

#### Error handling pattern (lines 160–162, 170–175) — apply to all new methods

```javascript
if (result.success) {
  this.message = 'Build triggered.';
} else {
  this.error = result.message || 'Build failed.';
}
```

---

#### Table row template (lines 45–69) — current v-for source, change to filteredItems

```html
<tr v-for="(device, index) in items" :key="device.udid">
  <!-- Change items → filteredItems in the v-for -->
  <!-- Also update empty-state colspan check: v-if="!filteredItems.length" -->
```

**Per-row Revoke button — add to Actions column (line 64 area):**

```html
<b-button size="sm" variant="primary" @click="viewDevice(device.udid)" class="mr-1">Detail</b-button>
<b-button size="sm" variant="secondary" @click="buildDevice(device.udid)" class="mr-1">Build</b-button>
<!-- ADD: -->
<b-button size="sm" variant="danger" @click="revokeRow(device.udid)" class="ml-1">Revoke</b-button>
```

---

#### Transfer modal (lines 73–81) — copy verbatim for DeviceDetail transfer modal

```html
<b-modal id="transfer-modal" title="Transfer Devices" @ok="transfer" ok-title="Transfer" ok-variant="warning">
  <p>Transfer {{ selectedCount }} selected device(s) to another owner.</p>
  <b-form-group label="Target owner email" label-for="transfer-to">
    <b-form-input id="transfer-to" v-model="transferForm.to" placeholder="owner@example.com" required />
  </b-form-group>
  <b-form-checkbox v-model="transferForm.mig_sources" class="mb-2">Migrate source repositories</b-form-checkbox>
  <b-form-checkbox v-model="transferForm.mig_apikeys">Migrate API keys</b-form-checkbox>
</b-modal>
```

---

#### transfer() method (lines 178–196) — copy and adapt for DeviceDetail (single udid)

```javascript
async transfer(bvModalEvt) {
  bvModalEvt.preventDefault();
  if (!this.transferForm.to.trim()) return;
  const result = await this.transferDevices({
    udids: [...this.selectedUdids],       // DeviceDetail: replace with [this.device.udid]
    to: this.transferForm.to.trim(),
    mig_sources: this.transferForm.mig_sources,
    mig_apikeys: this.transferForm.mig_apikeys,
  });
  if (result.success) {
    this.message = 'Transfer request sent.';
    this.$bvModal.hide('transfer-modal');
    this.transferForm = { to: '', mig_sources: false, mig_apikeys: false };
    this.selectedUdids = [];
    this.loadData();
  } else {
    this.error = result.message || 'Failed to transfer devices.';
  }
},
```

---

#### Category color helper — new method (no analog in codebase; use hex values from research)

```javascript
// Category hex values verified from src/html/assets/global/css/components.css
const CATEGORY_COLORS = {
  'yellow-crusta': '#f3c200',
  'red-intense':   '#e35b5a',
  'purple-studio': '#8E44AD',
  'blue':          '#3598dc',
  'green':         '#32c5d2',
  'green-dark':    '#4DB3A2',
  'grey-mint':     '#525e64',
};

categoryColor(cat) {
  return CATEGORY_COLORS[cat] || '#525e64';
},
```

---

#### Toolbar template — new addition above `<div v-if="loading">` (before line 26)

```html
<div class="d-flex align-items-center flex-wrap mb-3 gap-2">
  <!-- Grid/list toggle icons -->
  <b-button size="sm" :variant="viewMode === 'list' ? 'primary' : 'outline-secondary'" @click="viewMode = 'list'" class="mr-1">
    <span>&#9776;</span>
  </b-button>
  <b-button size="sm" :variant="viewMode === 'grid' ? 'primary' : 'outline-secondary'" @click="viewMode = 'grid'" class="mr-1">
    <span>&#9635;</span>
  </b-button>
  <!-- Category pills -->
  <b-button
    v-for="cat in ['All', 'yellow-crusta', 'red-intense', 'purple-studio', 'blue', 'green', 'green-dark', 'grey-mint']"
    :key="cat"
    size="sm"
    :variant="filterCategory === cat ? 'primary' : 'outline-secondary'"
    :style="filterCategory !== cat && cat !== 'All' ? { borderColor: categoryColor(cat), color: categoryColor(cat) } : {}"
    @click="filterCategory = cat"
    class="mr-1"
  >{{ cat }}</b-button>
  <!-- Spacer -->
  <div class="ml-auto d-flex align-items-center">
    <!-- Sort -->
    <b-form-select v-model="sortBy" :options="[
      { value: 'lastupdate', text: 'Last Update' },
      { value: 'platform',   text: 'Platform' },
      { value: 'alias',      text: 'Alias' }
    ]" size="sm" style="width:140px" class="mr-2" />
    <!-- Search -->
    <b-form-input v-model="searchText" placeholder="Search alias or MAC..." size="sm" style="width:200px" />
  </div>
</div>
```

---

#### Grid view template — new block alongside existing table (after table closing tag, line 71)

```html
<!-- Grid view -->
<b-row v-if="viewMode === 'grid'">
  <b-col
    v-for="device in filteredItems"
    :key="device.udid"
    cols="12" sm="6" md="4"
    class="mb-3"
  >
    <b-card class="h-100">
      <template #header>
        <span
          class="badge mr-2"
          :style="{ backgroundColor: categoryColor(device.category), color: '#fff' }"
        >{{ device.category }}</span>
        <strong>{{ device.alias }}</strong>
      </template>
      <p class="mb-1"><strong>Platform:</strong> {{ device.platform }}</p>
      <p class="mb-1 text-muted small">{{ device.firmware }}</p>
      <p class="mb-2 text-muted small">{{ device.lastupdate | fromNow }}</p>
      <div class="abc-checkbox d-inline-block mr-2">
        <input
          type="checkbox"
          :id="'grid-checkbox-' + device.udid"
          :checked="isSelected_(device.udid)"
          @change="toggleDevice(device.udid)"
        />
        <label :for="'grid-checkbox-' + device.udid" />
      </div>
      <b-button size="sm" variant="primary" @click="viewDevice(device.udid)" class="mr-1">Detail</b-button>
      <b-button size="sm" variant="secondary" @click="buildDevice(device.udid)">Build</b-button>
    </b-card>
  </b-col>
  <b-col v-if="!filteredItems.length" cols="12">
    <p class="text-muted">No devices match the current filter.</p>
  </b-col>
</b-row>
```

---

### `vue/src/pages/Devices/DeviceDetail.vue` (component, extend)

**Primary analog:** `vue/src/pages/Devices/Devices.vue` (loadData, msgBoxConfirm, transfer patterns)
**Secondary analog:** `vue/src/pages/History/History.vue` (buildlog dispatch + getItems pattern)

---

#### Existing imports (line 79) — extend mapActions with new store modules

```javascript
import { mapGetters, mapActions } from 'vuex';
```

---

#### Existing data() (lines 95–101) — extend with new properties

```javascript
data() {
  return {
    device: null,
    loading: true,
    error: null,
    message: null,
    editForm: { alias: '', description: '', transformers: [] },  // add transformers array
    // ADD BELOW:
    buildHistory: [],
    deviceLogs: [],
    transferForm: { to: '', mig_sources: false, mig_apikeys: false },
  };
},
```

---

#### Existing mapGetters in methods (line 107) — extend for buildlog and transformers

```javascript
...mapGetters({ getByUdid: 'devices/getByUdid' }),
// EXTEND TO:
...mapGetters({
  getByUdid:       'devices/getByUdid',
  getBuildItems:   'buildlog/getItems',   // confirmed: getter is getItems in buildlog.js line 49
  getTransformers: 'transformers/getItems',
}),
```

---

#### Existing mapActions (lines 108–113) — extend for buildlog and transformers fetches

```javascript
...mapActions({
  fetchItems:    'devices/fetchItems',
  revokeDevices: 'devices/revokeDevices',
  buildFirmware: 'devices/buildFirmware',
  updateDevice:  'devices/updateDevice',
  // ADD:
  fetchBuildLog:      'buildlog/fetchBuildLog',    // CRITICAL: action name is fetchBuildLog, NOT fetchItems
  fetchTransformers:  'transformers/fetchItems',   // transformers action IS fetchItems (confirmed line 29)
  transferDevices:    'devices/transferDevices',
}),
```

---

#### Existing loadDevice() (lines 114–124) — replace with extended version

```javascript
async loadDevice() {
  this.loading = true;
  const udid = this.$route.params.udid;
  await Promise.all([
    this.fetchItems(),          // devices/fetchItems
    this.fetchBuildLog(),       // buildlog/fetchBuildLog — not fetchItems
    this.fetchTransformers(),   // transformers/fetchItems
  ]);
  this.device = this.getByUdid()(udid) || null;
  if (this.device) {
    this.editForm.alias = this.device.alias;
    this.editForm.description = this.device.description || '';
    this.editForm.transformers = [...(this.device.transformers || [])];
    const allBuilds = this.getBuildItems();
    this.buildHistory = allBuilds.filter(b => b.udid === udid);
    this.deviceLogs   = allBuilds.filter(b => b.build_id === this.device.last_build_id);
  }
  this.loading = false;
},
```

---

#### Existing saveField() (lines 125–135) — copy for saveTransformers method

```javascript
async saveField(field) {
  const result = await this.updateDevice({
    udid: this.device.udid,
    changes: { [field]: this.editForm[field] },
  });
  if (result.success) {
    this.message = 'Saved.';
    await this.loadDevice();
  } else {
    this.error = result.message || 'Failed to save.';
  }
},
```

**Adapt for saveTransformers():**

```javascript
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

---

#### Existing revokeDevice() (lines 142–153) — keep unchanged; copy pattern for transfer

```javascript
async revokeDevice() {
  const confirmed = await this.$bvModal.msgBoxConfirm('Revoke this device? This cannot be undone.', {
    title: 'Confirm Revoke', okVariant: 'danger', okTitle: 'Revoke',
  });
  if (!confirmed) return;
  const result = await this.revokeDevices([this.device.udid]);
  if (result.success) {
    this.$router.push('/app/devices');
  } else {
    this.error = result.message || 'Failed to revoke device.';
  }
},
```

---

#### Actions card template (lines 60–63) — extend with Transfer button

```html
<b-card title="Actions" class="mb-3">
  <b-button variant="secondary" @click="buildDevice" class="mr-2 mb-2">Build Firmware</b-button>
  <b-button variant="danger" @click="revokeDevice" class="mr-2 mb-2">Revoke Device</b-button>
  <!-- ADD: -->
  <b-button variant="warning" @click="$bvModal.show('transfer-modal')" class="mr-2 mb-2">Transfer Device</b-button>
</b-card>
```

---

#### New card sections — add after the Linked Repository card (line 67 area)

**Environment variables card:**

```html
<!-- Environment Variables -->
<b-card title="Environment Variables (masked)" class="mb-3">
  <div v-if="device.environment && Object.keys(device.environment).length">
    <table class="table table-sm table-borderless mb-0">
      <tr v-for="(val, key) in device.environment" :key="key">
        <td class="text-muted" style="width:200px">{{ key }}</td>
        <td><code>{{ val }}</code></td>
      </tr>
    </table>
  </div>
  <p v-else class="text-muted mb-0">No environment variables.</p>
</b-card>
```

**Transformer assignment card:**

```html
<!-- Transformer Assignment -->
<b-card title="Transformer Assignment" class="mb-3">
  <b-form-group label="Assigned transformers">
    <b-form-select
      multiple
      v-model="editForm.transformers"
      :options="transformerOptions"
      :select-size="5"
    />
  </b-form-group>
  <b-button variant="primary" @click="saveTransformers" size="sm">Save Transformers</b-button>
</b-card>
```

**transformerOptions computed — add to computed block (or as method if keeping methods pattern):**

```javascript
// Note: this project uses mapGetters in methods, not computed. Add as a computed property
// since it is a pure derivation with no side effects and benefits from caching.
computed: {
  transformerOptions() {
    return (this.getTransformers() || []).map(t => ({
      value: t.utid,
      text:  t.alias || t.utid,
    }));
  },
},
```

**Build history card:**

```html
<!-- Build History -->
<b-card title="Build History" class="mb-3">
  <div v-if="buildHistory.length">
    <table class="table table-striped table-sm">
      <thead>
        <tr>
          <th>Date</th>
          <th>Build ID</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(build, i) in buildHistory" :key="i">
          <td>{{ build.date | fromNow }}</td>
          <td><code>{{ build.build_id }}</code></td>
          <td>
            <b-badge :variant="build.status === 'OK' ? 'success' : 'danger'">
              {{ build.status || '—' }}
            </b-badge>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <p v-else class="text-muted mb-0">No build history.</p>
</b-card>
```

**Device logs card — analog: History.vue lines 73 (pre log viewer) and lines 136–139 (log join):**

```html
<!-- Device Logs (last build) -->
<b-card v-if="device.last_build_id" title="Device Logs (last build)" class="mb-3">
  <div v-if="deviceLogs.length">
    <pre
      v-for="(entry, i) in deviceLogs"
      :key="i"
      style="max-height:300px;overflow-y:auto;font-size:12px;background:#1e1e1e;color:#ddd;padding:1rem;border-radius:4px"
    >{{ Array.isArray(entry.log) ? entry.log.join('\n') : (entry.log || '') }}</pre>
  </div>
  <p v-else class="text-muted mb-0">No log entries for last build.</p>
</b-card>
```

---

#### Transfer modal — copy from Devices.vue lines 73–81 (paste inside DeviceDetail template)

```html
<b-modal id="transfer-modal" title="Transfer Device" @ok="transferDevice" ok-title="Transfer" ok-variant="warning">
  <p>Transfer this device to another owner.</p>
  <b-form-group label="Target owner email" label-for="transfer-to">
    <b-form-input id="transfer-to" v-model="transferForm.to" placeholder="owner@example.com" required />
  </b-form-group>
  <b-form-checkbox v-model="transferForm.mig_sources" class="mb-2">Migrate source repositories</b-form-checkbox>
  <b-form-checkbox v-model="transferForm.mig_apikeys">Migrate API keys</b-form-checkbox>
</b-modal>
```

**transferDevice() method — adapted from Devices.vue lines 178–196 for single device:**

```javascript
async transferDevice(bvModalEvt) {
  bvModalEvt.preventDefault();
  if (!this.transferForm.to.trim()) return;
  const result = await this.transferDevices({
    udids: [this.device.udid],
    to: this.transferForm.to.trim(),
    mig_sources: this.transferForm.mig_sources,
    mig_apikeys: this.transferForm.mig_apikeys,
  });
  if (result.success) {
    this.message = 'Transfer request sent.';
    this.$bvModal.hide('transfer-modal');
    this.transferForm = { to: '', mig_sources: false, mig_apikeys: false };
  } else {
    this.error = result.message || 'Failed to transfer device.';
  }
},
```

---

### `vue/cypress/integration/devices.spec.js` (test, new — Wave 0 stub)

**Analog:** `vue/cypress/integration/login.spec.js`

**Spec structure pattern (lines 1–16 of login.spec.js):**

```javascript
describe('Login feature', function() {
  beforeEach(() => {
    cy.viewport(1536, 754);
    cy.visit('http://localhost:3000/#/login');
  });
  it.only('Should log in with static test account', function() {
    cy.login();
  });
  // ...
});
```

**Apply to devices spec — Wave 0 stub pattern:**

```javascript
describe('Devices feature', function() {
  beforeEach(() => {
    cy.viewport(1536, 754);
    cy.login();
    cy.visit('http://localhost:3000/#/app/devices');
  });

  it('Should display category filter pills', function() {
    // TODO DEVI-01: verify pill buttons are visible
  });

  it('Should filter devices by category', function() {
    // TODO DEVI-01: click a category pill, verify table rows filtered
  });

  it('Should sort devices by alias', function() {
    // TODO DEVI-02: select 'Alias' from sort dropdown, verify order
  });

  it('Should search devices by alias substring', function() {
    // TODO DEVI-03: type in search input, verify matching rows only
  });

  it('Should toggle to grid view', function() {
    // TODO DEVI-04: click grid icon, verify b-card elements appear
  });

  it('Should revoke a single device with confirmation', function() {
    // TODO DEVI-05: click row Revoke button, confirm dialog, verify device removed
  });
});
```

---

### `vue/cypress/integration/device-detail.spec.js` (test, new — Wave 0 stub)

**Analog:** `vue/cypress/integration/login.spec.js` (same structure)

```javascript
describe('Device Detail feature', function() {
  beforeEach(() => {
    cy.viewport(1536, 754);
    cy.login();
    cy.visit('http://localhost:3000/#/app/devices');
  });

  it('Should navigate to device detail on Detail button click', function() {
    // TODO DEVI-10: click first Detail button, verify URL changes to /app/device/:udid
  });

  it('Should display device info section', function() {
    // TODO DEVI-11: verify Device Info card is visible
  });

  it('Should display environment variables section', function() {
    // TODO DEVI-11: verify Environment Variables card is present
  });

  it('Should display transformer assignment section', function() {
    // TODO DEVI-11: verify Transformer Assignment card and select element are present
  });

  it('Should display build history section', function() {
    // TODO DEVI-11: verify Build History card is present (may show empty state)
  });

  it('Should display Transfer button in Actions card', function() {
    // TODO DEVI-11/D-12: verify Transfer button is visible in Actions card
  });
});
```

---

## Shared Patterns

### mapGetters in methods (NOT in computed)
**Source:** `vue/src/pages/Devices/Devices.vue` line 137, `vue/src/pages/Devices/DeviceDetail.vue` line 107
**Apply to:** All methods blocks in both modified components
**Critical rule:** `...mapGetters({})` MUST be spread inside `methods: { ... }`, NOT inside `computed: { ... }`. Getters are called as `this.getItems()` functions.

```javascript
methods: {
  ...mapGetters({ getItems: 'devices/getItems' }),
  ...mapActions({ fetchItems: 'devices/fetchItems' }),
  // getters called as: this.getItems()
}
```

### loadData / Promise.all pattern
**Source:** `vue/src/pages/Devices/Devices.vue` lines 212–219; `vue/src/pages/History/History.vue` lines 141–148
**Apply to:** `loadData()` in Devices.vue, `loadDevice()` in DeviceDetail.vue

```javascript
// Devices.vue pattern:
loadData() {
  this.loading = true;
  Promise.all([this.fetchItems(), this.fetchEnviros()]).then(() => {
    this.items = this.getItems();
    this.enviros = this.getEnviros();
    this.loading = false;
  });
},

// History.vue pattern (async variant — either style is acceptable):
loadData() {
  this.loading = true;
  Promise.all([this.fetchAuditlog(), this.fetchBuildlog()]).then(() => {
    this.auditlog = this.getAuditItems() || [];
    this.buildlog = this.getBuildItems() || [];
    this.loading = false;
  });
},
```

### Error / message feedback pattern
**Source:** `vue/src/pages/Devices/Devices.vue` lines 160–162, 170–176
**Apply to:** Every async method in both components

```javascript
if (result.success) {
  this.message = 'Action completed.';
} else {
  this.error = result.message || 'Action failed.';
}
```

Template binding (lines 23–24 of Devices.vue):

```html
<b-alert v-if="error" variant="danger" show dismissible @dismissed="error = null">{{ error }}</b-alert>
<b-alert v-if="message" variant="success" show dismissible @dismissed="message = null">{{ message }}</b-alert>
```

### msgBoxConfirm destructive action pattern
**Source:** `vue/src/pages/Devices/Devices.vue` lines 163–177; `vue/src/pages/Devices/DeviceDetail.vue` lines 142–153
**Apply to:** All destructive button handlers (per-row revoke in Devices.vue)

```javascript
const confirmed = await this.$bvModal.msgBoxConfirm(
  'Message text. This cannot be undone.',
  { title: 'Confirm Title', okVariant: 'danger', okTitle: 'Action Label' }
);
if (!confirmed) return;
```

### buildlog dispatch path
**Source:** `vue/src/store/buildlog.js` line 40; confirmed by `vue/src/pages/History/History.vue` line 123
**Apply to:** DeviceDetail.vue loadDevice() — CRITICAL naming note

```javascript
// CORRECT:
fetchBuildlog: "buildlog/fetchBuildLog",   // History.vue line 123 — matches store action name
// WRONG (do not use):
// fetchBuildlog: "buildlog/fetchItems"    // This action does NOT exist in buildlog store
```

### Normalized buildlog item fields
**Source:** `vue/src/store/buildlog.js` lines 58–80 (`normalizeBuildItems` function)
**Apply to:** All filter expressions on build log items in DeviceDetail.vue

```javascript
// Normalized shape (from normalizeBuildItems, lines 68–80):
{
  id:       item._id || latestLog.build_id || ...,
  build_id: latestLog.build_id || item._id || '',  // filter device logs by this
  udid:     latestLog.udid || latestEntry.udid || '',  // filter build history by this
  date:     latestEntry.last_update || ...,
  name:     item.name || ...,
  status:   normalizeStatus(...),
  log:      entries.map(e => e.contents || e.message),  // array of strings
}
```

### fromNow filter
**Source:** `vue/src/pages/Devices/Devices.vue` lines 106–114; `vue/src/pages/Devices/DeviceDetail.vue` lines 84–92
**Apply to:** Both files already have this filter defined identically — keep in-file, do NOT extract to mixin (out of scope)

```javascript
filters: {
  fromNow(val) {
    if (!val) return '—';
    const d = new Date(val);
    const diff = Math.floor((Date.now() - d) / 1000);
    if (diff < 60) return diff + 's ago';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
  }
},
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Category color pill inline styles | component sub-pattern | transform | No existing colored pill pattern in Vue SFCs; use inline styles with hex map from legacy CSS |
| `filteredItems` computed chain | component sub-pattern | client-side transform | No existing multi-filter computed property in Vue SFCs; History.vue uses simple single-field filter only |

---

## Key Pitfalls (from RESEARCH.md — embed here for planner reference)

1. **buildlog action name:** Use `buildlog/fetchBuildLog`, NEVER `buildlog/fetchItems`. Verified at `buildlog.js` line 40.
2. **mapGetters placement:** Always in `methods`, never in `computed`. Verified at `Devices.vue` line 137, `DeviceDetail.vue` line 107.
3. **Sort mutation:** Always spread before sort: `result = [...result].sort(...)`. Never `this.items.sort(...)`.
4. **device.environment null guard:** `v-if="device.environment && Object.keys(device.environment).length"` required.
5. **buildlog filter fields:** Build history filtered by `b.udid === udid`. Device logs filtered by `b.build_id === device.last_build_id`. Different fields, same dataset.
6. **Transformer options empty until fetched:** `transformers/fetchItems` must be in `Promise.all` inside `loadDevice()`.
7. **Category colors are NOT BootstrapVue variants:** Use inline `style` with hex values, not `variant` prop.

---

## Metadata

**Analog search scope:** `vue/src/pages/`, `vue/src/store/`, `vue/cypress/integration/`
**Files scanned:** 8 (Devices.vue, DeviceDetail.vue, History.vue, devices.js, buildlog.js, transformers.js, login.spec.js, Routes.js implied)
**Pattern extraction date:** 2026-05-20

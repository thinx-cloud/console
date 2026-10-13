<template>
  <div>
    <b-breadcrumb>
      <b-breadcrumb-item active>Management</b-breadcrumb-item>
    </b-breadcrumb>
    <h1 class="page-title">
      Management - <span class="fw-semi-bold">Devices</span>
    </h1>

    <p>
      <b-button variant="danger" data-cy="bulk-revoke" @click="confirmRevoke" :disabled="!isSelected" class="mr-2">
        Revoke ({{ selectedCount }})
      </b-button>
      <b-button variant="warning" data-cy="bulk-transfer" @click="$bvModal.show('transfer-modal')" :disabled="!isSelected" class="mr-2">
        Transfer ({{ selectedCount }})
      </b-button>
      <b-button variant="info" data-cy="bulk-push" @click="$bvModal.show('push-config-modal')" :disabled="!isSelected">
        Push Config ({{ selectedCount }})
      </b-button>
    </p>

    <b-alert v-if="error" variant="danger" show dismissible @dismissed="error = null">{{ error }}</b-alert>
    <b-alert v-if="message" variant="success" show dismissible @dismissed="message = null">{{ message }}</b-alert>

    <div class="d-flex align-items-center flex-wrap mb-3 gap-2">
      <b-button size="sm" data-cy="view-list" :variant="viewMode === 'list' ? 'primary' : 'outline-secondary'" @click="viewMode = 'list'" class="mr-1">
        <span>&#9776;</span>
      </b-button>
      <b-button size="sm" data-cy="view-grid" :variant="viewMode === 'grid' ? 'primary' : 'outline-secondary'" @click="viewMode = 'grid'" class="mr-1">
        <span>&#9635;</span>
      </b-button>
      <div role="group" aria-label="Filter by platform" class="d-inline-flex flex-wrap">
        <b-button
          v-for="pill in platformPills"
          :key="pill.key"
          :data-cy="'platform-pill-' + pill.key"
          size="sm"
          :variant="activePlatform === pill.key ? 'light' : 'outline-light'"
          :aria-pressed="String(activePlatform === pill.key)"
          @click="platformFilter = pill.key"
          class="mr-1"
        >{{ pill.label }}</b-button>
      </div>
      <div class="ml-auto d-flex align-items-center">
        <b-form-select data-cy="device-sort" v-model="sortBy" :options="[{ value: 'lastupdate', text: 'Last Update' }, { value: 'platform', text: 'Platform' }, { value: 'alias', text: 'Alias' }]" size="sm" style="width:140px" class="mr-2" />
        <b-form-input data-cy="device-search" v-model="searchText" placeholder="Search alias or MAC..." size="sm" style="width:200px" />
      </div>
    </div>
    <div v-if="loading">Loading...</div>
    <div v-else-if="viewMode === 'list'" class="table-responsive">
      <table class="table table-striped">
        <thead>
          <tr>
            <th>
              <div class="abc-checkbox">
                <input type="checkbox" id="checkboxAll" :checked="isAllSelected" @change="checkAll" />
                <label for="checkboxAll" />
              </div>
            </th>
            <th><span class="sr-only">Icon</span></th>
            <th>Alias</th>
            <th>Platform</th>
            <th>Firmware</th>
            <th>Status</th>
            <th>Last Seen</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(device, index) in filteredItems" :key="device.udid" data-cy="device-row">
            <td>
              <div class="abc-checkbox">
                <input
                  type="checkbox"
                  :id="'checkbox-' + index"
                  :checked="isSelected_(device.udid)"
                  @change="toggleDevice(device.udid)"
                />
                <label :for="'checkbox-' + index" />
              </div>
            </td>
            <td>
              <span
                class="device-icon device-icon--sm"
                :class="'platform-' + platformOf(device).key"
                :title="platformOf(device).label"
              ><img class="device-icon-symbol" :src="symbolSrc(device.icon)" :alt="platformOf(device).label + ' device icon'"></span>
            </td>
            <td>{{ device.alias }}</td>
            <td><PlatformBullet :platform="device.platform" /></td>
            <td class="firmware-cell" :title="device.firmware || null"><i class="fa fa-cogs" aria-hidden="true"></i>{{ device.firmware || '—' }}</td>
            <td>
              <span class="device-status">
                <i class="fa fa-heartbeat" aria-hidden="true"></i>
                <span
                  v-if="missingApiKey(device)"
                  class="api-key-indicator"
                  role="img"
                  data-cy="api-key-warning"
                  :aria-label="apiKeyTip"
                  :title="apiKeyTip"
                ><i class="fa fa-warning" aria-hidden="true"></i></span>
                <span :title="statusTitle(device.status)">{{ statusText(device.status) }}</span>
                <span
                  v-if="statusHasError(device.status)"
                  class="status-alert"
                  role="img"
                  aria-label="Device reported an error"
                  title="Device reported an error"
                ><i class="fa fa-warning" aria-hidden="true"></i></span>
                <span
                  v-if="statusHasWarning(device.status)"
                  class="status-warning"
                  role="img"
                  aria-label="Device reported a warning"
                  title="Device reported a warning"
                ><i class="fa fa-warning" aria-hidden="true"></i></span>
              </span>
            </td>
            <td>{{ device.lastupdate | fromNow }}</td>
            <td class="actions-cell">
              <IconButton
                :icon="buildAction(device).icon"
                :label="buildAction(device).label"
                :disabled="buildAction(device).disabled"
                data-cy="row-build"
                @click="buildDevice(device)"
              />
              <IconButton
                icon="fa fa-eye"
                :label="hasBuild(device) ? 'View log' : 'No build yet'"
                :disabled="!hasBuild(device)"
                data-cy="row-log"
                @click="openLastBuild(device)"
              />
              <IconButton icon="fa fa-pencil" label="Edit" data-cy="row-detail" @click="viewDevice(device.udid)" />
              <IconButton icon="fa fa-trash" label="Revoke" variant="danger" data-cy="row-revoke" @click="revokeRow(device.udid)" />
            </td>
          </tr>
          <tr v-if="!filteredItems.length">
            <td colspan="8">{{ emptyMessage }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <b-row v-else-if="viewMode === 'grid'">
      <b-col
        v-for="device in filteredItems"
        :key="device.udid"
        cols="12" sm="6" md="4"
        class="mb-3"
      >
        <b-card class="h-100" data-cy="device-card">
          <template #header>
            <div class="device-card-heading d-flex align-items-center">
              <span
                class="device-icon"
                :class="'platform-' + platformOf(device).key"
                :title="platformOf(device).label"
              ><img class="device-icon-symbol" :src="symbolSrc(device.icon)" :alt="platformOf(device).label + ' device icon'"></span>
              <strong>{{ device.alias }}</strong>
            </div>
          </template>
          <p class="mb-1"><PlatformBullet :platform="device.platform" /></p>
          <p class="mb-1 device-firmware"><i class="fa fa-cogs" aria-hidden="true"></i>{{ device.firmware || '—' }}</p>
          <p class="mb-1">
            <span class="device-status">
              <i class="fa fa-heartbeat" aria-hidden="true"></i>
              <span
                v-if="missingApiKey(device)"
                class="api-key-indicator"
                role="img"
                data-cy="api-key-warning"
                :aria-label="apiKeyTip"
                :title="apiKeyTip"
              ><i class="fa fa-warning" aria-hidden="true"></i></span>
              <span :title="statusTitle(device.status)">{{ statusText(device.status) }}</span>
              <span
                v-if="statusHasError(device.status)"
                class="status-alert"
                role="img"
                aria-label="Device reported an error"
                title="Device reported an error"
              ><i class="fa fa-warning" aria-hidden="true"></i></span>
              <span
                v-if="statusHasWarning(device.status)"
                class="status-warning"
                role="img"
                aria-label="Device reported a warning"
                title="Device reported a warning"
              ><i class="fa fa-warning" aria-hidden="true"></i></span>
            </span>
          </p>
          <p class="mb-2 small">{{ device.lastupdate | fromNow }}</p>
          <div class="d-flex align-items-center flex-nowrap">
            <div class="abc-checkbox d-inline-block mr-2">
              <input
                type="checkbox"
                :id="'grid-checkbox-' + device.udid"
                :checked="isSelected_(device.udid)"
                @change="toggleDevice(device.udid)"
              />
              <label :for="'grid-checkbox-' + device.udid" />
            </div>
            <IconButton
              :icon="buildAction(device).icon"
              :label="buildAction(device).label"
              :disabled="buildAction(device).disabled"
              data-cy="card-build"
              @click="buildDevice(device)"
            />
            <IconButton
              icon="fa fa-eye"
              :label="hasBuild(device) ? 'View log' : 'No build yet'"
              :disabled="!hasBuild(device)"
              data-cy="card-log"
              @click="openLastBuild(device)"
            />
            <IconButton icon="fa fa-pencil" label="Edit" class="ml-auto" data-cy="card-detail" @click="viewDevice(device.udid)" />
          </div>
        </b-card>
      </b-col>
      <b-col v-if="!filteredItems.length" cols="12">
        <p>{{ emptyMessage }}</p>
      </b-col>
    </b-row>

    <BuildLogDialog ref="buildLogDialog" />

    <!-- Transfer Modal -->
    <b-modal id="transfer-modal" title="Transfer Devices" @ok="transfer" ok-title="Transfer" ok-variant="warning">
      <p>Transfer {{ selectedCount }} selected device(s) to another owner.</p>
      <b-form-group label="Target owner email" label-for="transfer-to">
        <b-form-input id="transfer-to" v-model="transferForm.to" placeholder="owner@example.com" required />
      </b-form-group>
      <b-form-checkbox v-model="transferForm.mig_sources" class="mb-2">Migrate source repositories</b-form-checkbox>
      <b-form-checkbox v-model="transferForm.mig_apikeys">Migrate API keys</b-form-checkbox>
    </b-modal>

    <!-- Push Config Modal -->
    <b-modal id="push-config-modal" title="Push Configuration" @ok="pushConfig" ok-title="Push" ok-variant="info">
      <p>Push configuration to {{ selectedCount }} selected device(s).</p>
      <b-form-group label="Environment variables to include">
        <b-form-checkbox
          v-for="enviro in enviros"
          :key="enviro.id"
          v-model="pushForm.selectedEnviros"
          :value="enviro.label"
        >{{ enviro.label }}</b-form-checkbox>
        <p v-if="!enviros.length" class="text-muted">No environment globals defined.</p>
      </b-form-group>
      <b-form-checkbox v-model="pushForm.reset_devices">Reset devices after push</b-form-checkbox>
    </b-modal>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex';
import moment from 'moment';
import PlatformBullet from '@/components/PlatformBullet/PlatformBullet';
import IconButton from '@/components/IconButton/IconButton';
import BuildLogDialog from '@/components/BuildLogDialog/BuildLogDialog';
import { basePlatform, platformInfo } from '@/utils/platforms';

// Tip for a device without an API key (DEV-05). Legacy's text from device.html: keyhash
// is the key chosen for the device in the console (builds use it); devices register and
// report with the key they send, so the tip says nothing about connectivity (44 CR-01).
const API_KEY_TIP = 'No API Key assigned';

// Danger alert text when GET /device or the environment list fails (UI review).
const LOAD_ERROR = 'Could not load devices. Refresh to retry.';

// Legacy device symbols b_medium_01.png .. b_medium_73.png (DEV-01, UI-D10).
const DEVICE_SYMBOLS = require.context('@/assets/thinx/ioticons', false, /^\.\/b_medium_\d\d\.png$/);

export default {
  name: "Devices",
  components: { PlatformBullet, IconButton, BuildLogDialog },
  filters: {
    fromNow(val) {
      if (!val) return '—';
      return moment(val).fromNow();
    }
  },
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
      viewMode: 'list',
      platformFilter: 'All',
      sortBy: 'lastupdate',
      searchText: '',
      // udids whose build request is in flight (UI-D17).
      buildingUdids: [],
      // GET /logs/build first page (buildlog store), newest first; View log reads it (WR-02).
      builds: [],
      apiKeyTip: API_KEY_TIP,
    };
  },
  computed: {
    isSelected() { return this.selectedUdids.length > 0; },
    selectedCount() { return this.selectedUdids.length; },
    isAllSelected() { return this.filteredItems.length > 0 && this.filteredItems.every(d => this.selectedUdids.includes(d.udid)); },
    // Pills: All, then each base platform present in the loaded list, by label, unknown last.
    platformPills() {
      const keys = [...new Set(this.items.map(d => basePlatform(d.platform)))];
      const pills = keys.map(key => ({ key, label: platformInfo(key).label }));
      pills.sort((a, b) => {
        if (a.key === 'unknown') return 1;
        if (b.key === 'unknown') return -1;
        return a.label.toLowerCase().localeCompare(b.label.toLowerCase());
      });
      return [{ key: 'All', label: 'All' }, ...pills];
    },
    // The selected platform, or All once a reload no longer contains it.
    activePlatform() {
      const key = this.platformFilter;
      if (key === 'All' || !this.items.some(d => basePlatform(d.platform) === key)) return 'All';
      return key;
    },
    emptyMessage() {
      return this.items.length ? 'No devices match the current filter.' : 'No devices registered yet.';
    },
    filteredItems() {
      let result = this.items;
      if (this.activePlatform !== 'All') {
        result = result.filter(d => basePlatform(d.platform) === this.activePlatform);
      }
      if (this.searchText) {
        const q = this.searchText.toLowerCase();
        result = result.filter(d =>
          (d.alias || '').toLowerCase().includes(q) ||
          (d.mac || '').toLowerCase().includes(q)
        );
      }
      result = [...result].sort((a, b) => {
        if (this.sortBy === 'lastupdate') return new Date(b.lastupdate || 0).getTime() - new Date(a.lastupdate || 0).getTime();
        if (this.sortBy === 'platform')   return basePlatform(a.platform).localeCompare(basePlatform(b.platform)) || (a.alias || '').localeCompare(b.alias || '');
        if (this.sortBy === 'alias')      return (a.alias || '').localeCompare(b.alias || '');
        return 0;
      });
      return result;
    },
  },
  watch: {
    // A pill switch starts a fresh selection (44 IN-04).
    platformFilter() {
      this.selectedUdids = [];
    },
    // Bulk Revoke, Transfer and Push Config act only on visible devices: whatever the
    // platform filter, the search or a reload hides is dropped from the selection (UI review).
    filteredItems(list) {
      const visible = new Set(list.map(d => d.udid));
      const kept = this.selectedUdids.filter(udid => visible.has(udid));
      if (kept.length !== this.selectedUdids.length) this.selectedUdids = kept;
    },
    // Once a reload no longer holds the selected platform the filter is All, and stays All
    // when such devices come back (44 IN-04).
    activePlatform(key) {
      if (key === 'All' && this.platformFilter !== 'All') this.platformFilter = 'All';
    },
  },
  created() {
    this.$watch(() => this.$route.params, () => { this.loadData(); }, { immediate: true });
  },
  methods: {
    ...mapGetters({ getItems: 'devices/getItems', getEnviros: 'enviros/getItems', getBuildItems: 'buildlog/getItems' }),
    ...mapActions({
      fetchItems: 'devices/fetchItems',
      revokeDevices: 'devices/revokeDevices',
      transferDevices: 'devices/transferDevices',
      pushConfiguration: 'devices/pushConfiguration',
      buildFirmware: 'devices/buildFirmware',
      fetchEnviros: 'enviros/fetchItems',
      fetchBuildLog: 'buildlog/fetchBuildLog',
    }),
    isSelected_(udid) { return this.selectedUdids.includes(udid); },
    platformOf(device) { return platformInfo(device.platform); },
    // b_medium_NN.png for icons 1..73, otherwise 01. Only a number or a string is read:
    // parseInt would throw on an object whose toString is not a function (44-SECURITY N-1).
    symbolSrc(icon) {
      const n = typeof icon === 'number' || typeof icon === 'string' ? parseInt(icon, 10) : NaN;
      const nn = Number.isInteger(n) && n >= 1 && n <= 73 ? String(n).padStart(2, '0') : '01';
      return DEVICE_SYMBOLS('./b_medium_' + nn + '.png');
    },
    // Device-supplied status without control characters (code below 32 or 127). A charCode
    // scan, not a regex: Codacy flags control-character regexes (quick 261012-r9z).
    // Only a string is read; any other type is empty (44-SECURITY N-1).
    cleanStatus(status) {
      const raw = typeof status === 'string' ? status : '';
      let out = '';
      for (let i = 0; i < raw.length; i++) {
        const code = raw.charCodeAt(i);
        if (code >= 32 && code !== 127) out += raw[i];
      }
      return out;
    },
    // Legacy status text (UI-D13): Registered for 0-1 characters, 22 characters plus an ellipsis beyond.
    statusText(status) {
      const text = this.cleanStatus(status);
      if (text.length <= 1) return 'Registered';
      return text.length > 22 ? text.slice(0, 22) + '…' : text;
    },
    statusTitle(status) {
      const text = this.cleanStatus(status);
      return text.length > 22 ? text : null;
    },
    statusHasError(status) { return this.cleanStatus(status).toLowerCase().includes('#e'); },
    statusHasWarning(status) { return this.cleanStatus(status).toLowerCase().includes('#w'); },
    missingApiKey(device) {
      return device.keyhash === null || device.keyhash === undefined || device.keyhash === '';
    },
    toggleDevice(udid) {
      const i = this.selectedUdids.indexOf(udid);
      if (i > -1) this.selectedUdids.splice(i, 1);
      else this.selectedUdids.push(udid);
    },
    checkAll(ev) {
      this.selectedUdids = ev.target.checked ? this.filteredItems.map(d => d.udid) : [];
    },
    viewDevice(udid) {
      this.$router.push({ name: 'DeviceDetail', params: { udid } });
    },
    // Build action state (UI-SPEC Actions rows 1): in flight, not buildable, no source, else the hammer.
    buildAction(device) {
      if (this.buildingUdids.includes(device.udid)) {
        return { icon: 'fa fa-spin fa-circle-o-notch', label: 'Building…', disabled: true };
      }
      if (platformInfo(device.platform).build === false) return { icon: 'fa fa-ban', label: 'Not supported', disabled: true };
      if (!device.source) return { icon: 'fa fa-ban', label: 'No source', disabled: true };
      return { icon: 'icomoon-hammer_icon', label: 'Build', disabled: false };
    },
    // One request per device at a time; the udid is released however the request settles.
    async buildDevice(device) {
      if (this.buildAction(device).disabled) return;
      this.buildingUdids.push(device.udid);
      let result;
      try {
        result = await this.buildFirmware({ udid: device.udid, source_id: device.source });
      } catch (e) {
        result = { success: false };
      } finally {
        const i = this.buildingUdids.indexOf(device.udid);
        if (i > -1) this.buildingUdids.splice(i, 1);
      }
      if (result && result.success) this.message = 'Build triggered.';
      else this.error = (result && result.message) || 'Build failed.';
    },
    // Newest build of the device, failed ones included: the first entry for its udid in the
    // build list (GET /logs/build answers newest first, as Legacy's deviceBuilds[udid][0]).
    // last_build_id only moves on builds that produced an artifact, so it is the fallback for
    // a device whose builds are older than the loaded page (44 WR-02).
    latestBuildId(device) {
      const valid = (id) => typeof id === 'string' && id.trim() !== '';
      const own = this.builds.find(b => b && b.udid === device.udid && valid(b.build_id));
      if (own) return own.build_id;
      return valid(device.last_build_id) ? device.last_build_id : null;
    },
    hasBuild(device) {
      return this.latestBuildId(device) !== null;
    },
    openLastBuild(device) {
      const buildId = this.latestBuildId(device);
      if (buildId === null) return;
      this.$refs.buildLogDialog.open({ build_id: buildId });
    },
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
    async transfer(bvModalEvt) {
      bvModalEvt.preventDefault();
      if (!this.transferForm.to.trim()) return;
      const result = await this.transferDevices({
        udids: [...this.selectedUdids],
        to: this.transferForm.to.trim(),
        mig_sources: this.transferForm.mig_sources,
        mig_apikeys: this.transferForm.mig_apikeys,
      });
      this.$bvModal.hide('transfer-modal');
      if (result.success) {
        this.message = 'Transfer request sent.';
        this.transferForm = { to: '', mig_sources: false, mig_apikeys: false };
        this.selectedUdids = [];
        this.loadData();
      } else {
        this.error = result.message || 'Failed to transfer devices.';
      }
    },
    async pushConfig(bvModalEvt) {
      bvModalEvt.preventDefault();
      const result = await this.pushConfiguration({
        udids: [...this.selectedUdids],
        enviros: this.pushForm.selectedEnviros,
        reset_devices: this.pushForm.reset_devices,
      });
      if (result.success) {
        this.message = 'Configuration pushed.';
        this.$bvModal.hide('push-config-modal');
        this.pushForm = { selectedEnviros: [], reset_devices: false };
      } else {
        this.error = result.message || 'Failed to push configuration.';
      }
    },
    // A failed load shows a message in the danger alert and never leaves Loading... up (UI review).
    async loadData() {
      this.loading = true;
      // The build list only feeds View log: its failure must not fail the device list.
      const builds = Promise.resolve().then(() => this.fetchBuildLog()).catch(() => null);
      try {
        await Promise.all([this.fetchItems(), this.fetchEnviros(), builds]);
        this.items = this.getItems();
        this.enviros = this.getEnviros();
        const buildItems = this.getBuildItems();
        this.builds = Array.isArray(buildItems) ? buildItems : [];
        if (this.error === LOAD_ERROR) this.error = null;
      } catch (e) {
        this.error = LOAD_ERROR;
      } finally {
        this.loading = false;
      }
    },
    async revokeRow(udid) {
      const confirmed = await this.$bvModal.msgBoxConfirm(
        'Revoke this device? This cannot be undone.',
        { title: 'Confirm Revoke', okVariant: 'danger', okTitle: 'Revoke' }
      );
      if (!confirmed) return;
      const result = await this.revokeDevices([udid]);
      if (result.success) {
        this.message = 'Device revoked.';
        const i = this.selectedUdids.indexOf(udid);
        if (i > -1) this.selectedUdids.splice(i, 1);
        this.loadData();
      } else {
        this.error = result.message || 'Failed to revoke device.';
      }
    },
  },
};
</script>

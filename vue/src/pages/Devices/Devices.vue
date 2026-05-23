<template>
  <div>
    <b-breadcrumb>
      <b-breadcrumb-item active>Management</b-breadcrumb-item>
    </b-breadcrumb>
    <h1 class="page-title">
      Management - <span class="fw-semi-bold">Devices</span>
    </h1>

    <p>
      <b-button variant="danger" @click="confirmRevoke" :disabled="!isSelected" class="mr-2">
        Revoke ({{ selectedCount }})
      </b-button>
      <b-button variant="warning" @click="$bvModal.show('transfer-modal')" :disabled="!isSelected" class="mr-2">
        Transfer ({{ selectedCount }})
      </b-button>
      <b-button variant="info" @click="$bvModal.show('push-config-modal')" :disabled="!isSelected">
        Push Config ({{ selectedCount }})
      </b-button>
    </p>

    <b-alert v-if="error" variant="danger" show dismissible @dismissed="error = null">{{ error }}</b-alert>
    <b-alert v-if="message" variant="success" show dismissible @dismissed="message = null">{{ message }}</b-alert>

    <div class="d-flex align-items-center flex-wrap mb-3 gap-2">
      <b-button size="sm" :variant="viewMode === 'list' ? 'primary' : 'outline-secondary'" @click="viewMode = 'list'" class="mr-1">
        <span>&#9776;</span>
      </b-button>
      <b-button size="sm" :variant="viewMode === 'grid' ? 'primary' : 'outline-secondary'" @click="viewMode = 'grid'" class="mr-1">
        <span>&#9635;</span>
      </b-button>
      <b-button
        v-for="cat in ['All', 'yellow-crusta', 'red-intense', 'purple-studio', 'blue', 'green', 'green-dark', 'grey-mint']"
        :key="cat"
        size="sm"
        :variant="filterCategory === cat ? 'primary' : 'outline-secondary'"
        :style="filterCategory !== cat && cat !== 'All' ? { borderColor: categoryColor(cat), color: categoryColor(cat) } : {}"
        @click="filterCategory = cat"
        class="mr-1"
      >{{ cat }}</b-button>
      <div class="ml-auto d-flex align-items-center">
        <b-form-select v-model="sortBy" :options="[{ value: 'lastupdate', text: 'Last Update' }, { value: 'platform', text: 'Platform' }, { value: 'alias', text: 'Alias' }]" size="sm" style="width:140px" class="mr-2" />
        <b-form-input v-model="searchText" placeholder="Search alias or MAC..." size="sm" style="width:200px" />
      </div>
    </div>
    <div v-if="loading">Loading...</div>
    <table v-else-if="viewMode === 'list'" class="table table-striped">
      <thead>
        <tr>
          <th>
            <div class="abc-checkbox">
              <input type="checkbox" id="checkboxAll" :checked="isAllSelected" @change="checkAll" />
              <label for="checkboxAll" />
            </div>
          </th>
          <th>Alias</th>
          <th>Platform</th>
          <th>Firmware</th>
          <th>Status</th>
          <th>Last Seen</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(device, index) in filteredItems" :key="device.udid">
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
          <td>{{ device.alias }}</td>
          <td>{{ device.platform }}</td>
          <td>{{ device.firmware }}</td>
          <td>{{ device.status }}</td>
          <td>{{ device.lastupdate | fromNow }}</td>
          <td>
            <b-button size="sm" variant="primary" @click="viewDevice(device.udid)" class="mr-1">Detail</b-button>
            <b-button size="sm" variant="secondary" @click="buildDevice(device)" class="mr-1">Build</b-button>
            <b-button size="sm" variant="danger" @click="revokeRow(device.udid)" class="ml-1">Revoke</b-button>
          </td>
        </tr>
        <tr v-if="!filteredItems.length">
          <td colspan="7" class="text-muted">No devices registered yet.</td>
        </tr>
      </tbody>
    </table>
    <b-row v-else-if="viewMode === 'grid'">
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
          <b-button size="sm" variant="secondary" @click="buildDevice(device)">Build</b-button>
        </b-card>
      </b-col>
      <b-col v-if="!filteredItems.length" cols="12">
        <p class="text-muted">No devices match the current filter.</p>
      </b-col>
    </b-row>

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

const CATEGORY_COLORS = {
  'yellow-crusta': '#f3c200',
  'red-intense':   '#e35b5a',
  'purple-studio': '#8E44AD',
  'blue':          '#3598dc',
  'green':         '#32c5d2',
  'green-dark':    '#4DB3A2',
  'grey-mint':     '#525e64',
};

export default {
  name: "Devices",
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
      filterCategory: 'All',
      sortBy: 'lastupdate',
      searchText: '',
    };
  },
  computed: {
    isSelected() { return this.selectedUdids.length > 0; },
    selectedCount() { return this.selectedUdids.length; },
    isAllSelected() { return this.filteredItems.length > 0 && this.filteredItems.every(d => this.selectedUdids.includes(d.udid)); },
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
      result = [...result].sort((a, b) => {
        if (this.sortBy === 'lastupdate') return new Date(b.lastupdate || 0).getTime() - new Date(a.lastupdate || 0).getTime();
        if (this.sortBy === 'platform')   return (a.platform || '').localeCompare(b.platform || '');
        if (this.sortBy === 'alias')      return (a.alias || '').localeCompare(b.alias || '');
        return 0;
      });
      return result;
    },
  },
  created() {
    this.$watch(() => this.$route.params, () => { this.loadData(); }, { immediate: true });
  },
  methods: {
    ...mapGetters({ getItems: 'devices/getItems', getEnviros: 'enviros/getItems' }),
    ...mapActions({
      fetchItems: 'devices/fetchItems',
      revokeDevices: 'devices/revokeDevices',
      transferDevices: 'devices/transferDevices',
      pushConfiguration: 'devices/pushConfiguration',
      buildFirmware: 'devices/buildFirmware',
      fetchEnviros: 'enviros/fetchItems',
    }),
    isSelected_(udid) { return this.selectedUdids.includes(udid); },
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
    async buildDevice(device) {
      const result = await this.buildFirmware({ udid: device.udid, source_id: device.source });
      if (result.success) this.message = 'Build triggered.';
      else this.error = result.message || 'Build failed.';
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
    loadData() {
      this.loading = true;
      Promise.all([this.fetchItems(), this.fetchEnviros()]).then(() => {
        this.items = this.getItems();
        this.enviros = this.getEnviros();
        this.loading = false;
      });
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
        this.loadData();
      } else {
        this.error = result.message || 'Failed to revoke device.';
      }
    },
    categoryColor(cat) {
      return CATEGORY_COLORS[cat] || '#525e64';
    },
  },
};
</script>

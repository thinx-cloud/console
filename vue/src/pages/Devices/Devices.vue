<template>
  <div>
    <b-breadcrumb>
      <b-breadcrumb-item>YOU ARE HERE</b-breadcrumb-item>
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

    <div v-if="loading">Loading...</div>
    <table v-else class="table table-striped">
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
        <tr v-for="(device, index) in items" :key="device.udid">
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
            <b-button size="sm" variant="secondary" @click="buildDevice(device.udid)" class="mr-1">Build</b-button>
          </td>
        </tr>
        <tr v-if="!items.length">
          <td colspan="7" class="text-muted">No devices registered yet.</td>
        </tr>
      </tbody>
    </table>

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

export default {
  name: "Devices",
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
    };
  },
  computed: {
    isSelected() { return this.selectedUdids.length > 0; },
    selectedCount() { return this.selectedUdids.length; },
    isAllSelected() { return this.items.length > 0 && this.selectedUdids.length === this.items.length; },
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
      this.selectedUdids = ev.target.checked ? this.items.map(d => d.udid) : [];
    },
    viewDevice(udid) {
      this.$router.push({ name: 'DeviceDetail', params: { udid } });
    },
    async buildDevice(udid) {
      const result = await this.buildFirmware(udid);
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
  },
};
</script>

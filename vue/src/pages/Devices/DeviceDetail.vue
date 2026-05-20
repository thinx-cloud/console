<template>
  <div v-if="device">
    <b-breadcrumb>
      <b-breadcrumb-item to="/app/devices">Devices</b-breadcrumb-item>
      <b-breadcrumb-item active>{{ device.alias }}</b-breadcrumb-item>
    </b-breadcrumb>
    <h1 class="page-title">
      Device - <span class="fw-semi-bold">{{ device.alias }}</span>
    </h1>

    <b-alert v-if="error" variant="danger" show dismissible @dismissed="error = null">{{ error }}</b-alert>
    <b-alert v-if="message" variant="success" show dismissible @dismissed="message = null">{{ message }}</b-alert>

    <b-row>
      <!-- Left: metadata -->
      <b-col md="6">
        <b-card title="Device Info" class="mb-3">
          <table class="table table-sm table-borderless mb-0">
            <tr><td class="text-muted" style="width:140px">UDID</td><td><code>{{ device.udid }}</code></td></tr>
            <tr><td class="text-muted">MAC</td><td>{{ device.mac }}</td></tr>
            <tr><td class="text-muted">Platform</td><td>{{ device.platform }}</td></tr>
            <tr><td class="text-muted">Firmware</td><td>{{ device.firmware }}</td></tr>
            <tr><td class="text-muted">Version</td><td>{{ device.version }}</td></tr>
            <tr><td class="text-muted">Status</td><td>{{ device.status }}</td></tr>
            <tr><td class="text-muted">Last seen</td><td>{{ device.lastupdate | fromNow }}</td></tr>
            <tr><td class="text-muted">Commit</td><td><code>{{ device.commit }}</code></td></tr>
          </table>
        </b-card>

        <b-card title="Network" class="mb-3">
          <table class="table table-sm table-borderless mb-0">
            <tr><td class="text-muted" style="width:140px">RSSI</td><td>{{ device.rssi }}</td></tr>
            <tr><td class="text-muted">Station</td><td>{{ device.station }}</td></tr>
            <tr><td class="text-muted">Lat/Lon</td><td>{{ device.lat }}, {{ device.lon }}</td></tr>
          </table>
        </b-card>
      </b-col>

      <!-- Right: editable fields + actions -->
      <b-col md="6">
        <b-card title="Edit Device" class="mb-3">
          <b-form-group label="Alias">
            <b-input-group>
              <b-form-input v-model="editForm.alias" />
              <b-input-group-append>
                <b-button variant="primary" @click="saveField('alias')">Save</b-button>
              </b-input-group-append>
            </b-input-group>
          </b-form-group>
          <b-form-group label="Description">
            <b-input-group>
              <b-form-input v-model="editForm.description" />
              <b-input-group-append>
                <b-button variant="primary" @click="saveField('description')">Save</b-button>
              </b-input-group-append>
            </b-input-group>
          </b-form-group>
        </b-card>

        <b-card title="Actions" class="mb-3">
          <b-button variant="secondary" @click="buildDevice" class="mr-2 mb-2">Build Firmware</b-button>
          <b-button variant="danger" @click="revokeDevice" class="mr-2 mb-2">Revoke Device</b-button>
        </b-card>

        <b-card v-if="device.source" title="Linked Repository" class="mb-3">
          <p class="text-monospace">{{ device.source }}</p>
        </b-card>
      </b-col>
    </b-row>
  </div>
  <div v-else-if="loading">Loading device...</div>
  <div v-else>
    <b-alert variant="warning" show>Device not found.</b-alert>
    <b-button to="/app/devices" variant="secondary">Back to Devices</b-button>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex';

export default {
  name: "DeviceDetail",
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
      device: null,
      loading: true,
      error: null,
      message: null,
      editForm: { alias: '', description: '', transformers: [] },
      buildHistory: [],
      deviceLogs: [],
      transferForm: { to: '', mig_sources: false, mig_apikeys: false },
    };
  },
  created() {
    this.loadDevice();
  },
  methods: {
    ...mapGetters({ getByUdid: 'devices/getByUdid', getBuildItems: 'buildlog/getItems', getTransformers: 'transformers/getItems' }),
    ...mapActions({
      fetchItems: 'devices/fetchItems',
      revokeDevices: 'devices/revokeDevices',
      buildFirmware: 'devices/buildFirmware',
      updateDevice: 'devices/updateDevice',
      fetchBuildLog: 'buildlog/fetchBuildLog',
      fetchTransformers: 'transformers/fetchItems',
      transferDevices: 'devices/transferDevices',
    }),
    async loadDevice() {
      this.loading = true;
      const udid = this.$route.params.udid;
      await Promise.all([this.fetchItems(), this.fetchBuildLog(), this.fetchTransformers()]);
      this.device = this.getByUdid()(udid) || null;
      if (this.device) {
        this.editForm.alias = this.device.alias;
        this.editForm.description = this.device.description || '';
        this.editForm.transformers = [...(this.device.transformers || [])];
        const allBuilds = this.getBuildItems() || [];
        this.buildHistory = allBuilds.filter(b => b.udid === udid);
        this.deviceLogs = allBuilds.filter(b => b.build_id === this.device.last_build_id);
      }
      this.loading = false;
    },
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
    async buildDevice() {
      const result = await this.buildFirmware(this.device.udid);
      if (result.success) this.message = 'Build triggered.';
      else this.error = result.message || 'Build failed.';
    },
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
  },
};
</script>

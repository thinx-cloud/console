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
          <b-button variant="warning" @click="$bvModal.show('transfer-modal')" class="mr-2 mb-2">Transfer Device</b-button>
        </b-card>

        <b-card v-if="device.source" title="Linked Repository" class="mb-3">
          <p class="text-monospace">{{ device.source }}</p>
        </b-card>

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

        <b-card title="Transformer Assignment" class="mb-3">
          <b-form-group label="Assigned transformers">
            <b-form-select multiple v-model="editForm.transformers" :options="transformerOptions" :select-size="5" />
          </b-form-group>
          <b-button variant="primary" size="sm" @click="saveTransformers">Save Transformers</b-button>
        </b-card>

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
                    <b-badge :variant="build.status === 'OK' ? 'success' : 'danger'">{{ build.status || '—' }}</b-badge>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="text-muted mb-0">No build history.</p>
        </b-card>

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
      </b-col>
    </b-row>

    <b-modal id="transfer-modal" title="Transfer Device" @ok="transferDevice" ok-title="Transfer" ok-variant="warning">
      <p>Transfer this device to another owner.</p>
      <b-form-group label="Target owner email" label-for="transfer-to">
        <b-form-input id="transfer-to" v-model="transferForm.to" placeholder="owner@example.com" required />
      </b-form-group>
      <b-form-checkbox v-model="transferForm.mig_sources" class="mb-2">Migrate source repositories</b-form-checkbox>
      <b-form-checkbox v-model="transferForm.mig_apikeys">Migrate API keys</b-form-checkbox>
    </b-modal>
  </div>
  <div v-else-if="loading" class="text-center py-5">
    <b-spinner label="Loading device..." />
    <p class="text-muted mt-2">Loading device...</p>
  </div>
  <div v-else>
    <b-alert variant="warning" show>Device not found.</b-alert>
    <b-button to="/app/devices" variant="secondary">Back to Devices</b-button>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex';
import moment from 'moment';

export default {
  name: "DeviceDetail",
  filters: {
    fromNow(val) {
      if (!val) return '—';
      return moment(val).fromNow();
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
  computed: {
    transformerOptions() {
      return (this.getTransformers() || []).map(t => ({ value: t.utid, text: t.alias || t.utid }));
    },
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
      const result = await this.buildFirmware({ udid: this.device.udid, source_id: this.device.source });
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
    async transferDevice(bvModalEvt) {
      bvModalEvt.preventDefault();
      if (!this.transferForm.to.trim()) return;
      const result = await this.transferDevices({
        udids: [this.device.udid],
        to: this.transferForm.to.trim(),
        mig_sources: this.transferForm.mig_sources,
        mig_apikeys: this.transferForm.mig_apikeys,
      });
      this.$bvModal.hide('transfer-modal');
      if (result.success) {
        this.$router.push('/app/devices');
      } else {
        this.error = result.message || 'Failed to transfer device.';
      }
    },
  },
};
</script>

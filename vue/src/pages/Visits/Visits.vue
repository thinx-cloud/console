<template>
  <div>
    <h1 class="page-title">Dashboard</h1>

    <div v-if="loading" class="text-center py-5">Loading...</div>
    <div v-else>
      <!-- Stat cards -->
      <b-row class="mb-4">
        <b-col md="3" sm="6" class="mb-3" v-for="card in statCards" :key="card.label">
          <b-card :class="'text-white bg-' + card.variant">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <div style="font-size:2rem;font-weight:bold">{{ card.value }}</div>
                <div>{{ card.label }}</div>
              </div>
              <i :class="'fa fa-3x ' + card.icon" style="opacity:0.4" />
            </div>
          </b-card>
        </b-col>
      </b-row>

      <!-- Build stats row -->
      <b-row class="mb-4">
        <b-col md="4" sm="6" class="mb-3" v-for="card in buildCards" :key="card.label">
          <b-card :class="'text-white bg-' + card.variant">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <div style="font-size:2rem;font-weight:bold">{{ card.value }}</div>
                <div>{{ card.label }}</div>
              </div>
              <i :class="'fa fa-3x ' + card.icon" style="opacity:0.4" />
            </div>
          </b-card>
        </b-col>
      </b-row>

      <!-- Recent audit events -->
      <b-row>
        <b-col md="6" class="mb-4">
          <b-card title="Recent Audit Events">
            <div v-if="!auditItems.length" class="text-muted">No audit events yet.</div>
            <table v-else class="table table-sm mb-0">
              <thead><tr><th>Time</th><th>Event</th></tr></thead>
              <tbody>
                <tr v-for="(item, i) in auditItems.slice(0, 10)" :key="i">
                  <td class="text-muted" style="white-space:nowrap">{{ item.date | shortDate }}</td>
                  <td>{{ item.message }}</td>
                </tr>
              </tbody>
            </table>
            <router-link to="/app/history" class="mt-2 d-block">View all →</router-link>
          </b-card>
        </b-col>

        <b-col md="6" class="mb-4">
          <b-card title="Recent Builds">
            <div v-if="!buildItems.length" class="text-muted">No builds yet.</div>
            <table v-else class="table table-sm mb-0">
              <thead><tr><th>Time</th><th>Device</th><th>Status</th></tr></thead>
              <tbody>
                <tr v-for="(item, i) in buildItems.slice(0, 10)" :key="i">
                  <td class="text-muted" style="white-space:nowrap">{{ item.date | shortDate }}</td>
                  <td>{{ formatBuildName(item) }}</td>
                  <td>
                    <b-badge :variant="badgeVariant(item.status)">{{ item.status || '—' }}</b-badge>
                  </td>
                </tr>
              </tbody>
            </table>
            <router-link to="/app/history" class="mt-2 d-block">View all →</router-link>
          </b-card>
        </b-col>
      </b-row>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex';

export default {
  name: "Dashboard",
  filters: {
    shortDate(val) {
      if (!val) return '—';
      return new Date(val).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    },
  },
  data() {
    return {
      loading: true,
      statsData: null,
      todayData: null,
      auditItems: [],
      buildItems: [],
      deviceCount: 0,
    };
  },
  computed: {
    statCards() {
      const s = this.statsData || {};
      const t = this.todayData || {};
      return [
        { label: 'Devices', value: this.deviceCount, variant: 'primary', icon: 'fa-microchip' },
        { label: 'Check-ins (today)', value: this.extractMetric(t, 'DEVICE_CHECKIN'), variant: 'info', icon: 'fa-check-circle' },
        { label: 'New devices (week)', value: this.extractMetric(s, 'DEVICE_NEW'), variant: 'success', icon: 'fa-plus-circle' },
        { label: 'Revocations (week)', value: this.extractMetric(s, 'DEVICE_REVOCATION'), variant: 'warning', icon: 'fa-times-circle' },
      ];
    },
    buildCards() {
      const s = this.statsData || {};
      return [
        { label: 'Builds started (week)', value: this.extractMetric(s, 'BUILD_STARTED'), variant: 'secondary', icon: 'fa-hammer' },
        { label: 'Builds succeeded (week)', value: this.extractMetric(s, 'BUILD_SUCCESS'), variant: 'success', icon: 'fa-check' },
        { label: 'Builds failed (week)', value: this.extractMetric(s, 'BUILD_FAILED'), variant: 'danger', icon: 'fa-times' },
      ];
    },
  },
  created() {
    this.loadData();
  },
  methods: {
    ...mapGetters({ getStats: 'stats/getStats', getToday: 'stats/getToday', getDevices: 'devices/getItems', getAudit: 'auditlog/getItems', getBuildLog: 'buildlog/getItems' }),
    ...mapActions({ fetchStats: 'stats/fetchStats', fetchToday: 'stats/fetchToday', fetchDevices: 'devices/fetchItems', fetchAudit: 'auditlog/fetchAuditlog', fetchBuildLog: 'buildlog/fetchBuildLog' }),
    extractMetric(data, key) {
      if (!data) return 0;
      // InfluxDB v2 series format: [{series:[{name,columns,values}]}]
      if (Array.isArray(data)) {
        for (const result of data) {
          if (result && result.series) {
            for (const series of result.series) {
              const idx = series.columns && series.columns.indexOf(key);
              if (idx > -1 && series.values && series.values.length) {
                return series.values.reduce((sum, row) => sum + (row[idx] || 0), 0);
              }
            }
          }
        }
      }
      // owner_template format: { KEY: [count] }
      if (data[key] && Array.isArray(data[key])) return data[key][0] || 0;
      if (typeof data[key] === 'number') return data[key];
      return 0;
    },
    shortUdid(value) {
      if (!value) return '—';
      return `${value.substring(0, 8)}...`;
    },
    formatBuildName(item) {
      return item.name || this.shortUdid(item.udid);
    },
    badgeVariant(status) {
      const normalized = (status || '').toUpperCase();
      if (normalized === 'OK') return 'success';
      if (normalized === 'RUNNING') return 'warning';
      return 'danger';
    },
    async loadData() {
      this.loading = true;
      await Promise.allSettled([
        this.fetchStats(),
        this.fetchToday(),
        this.fetchDevices(),
        this.fetchAudit(),
        this.fetchBuildLog(),
      ]);
      this.statsData = this.getStats();
      this.todayData = this.getToday();
      this.deviceCount = (this.getDevices() || []).length;
      this.auditItems = this.getAudit() || [];
      this.buildItems = this.getBuildLog() || [];
      this.loading = false;
    },
  },
};
</script>

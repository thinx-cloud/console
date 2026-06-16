<template>
  <div>
    <h1 class="page-title">Dashboard</h1>

    <div v-if="loading" class="text-center py-5">Loading...</div>
    <div v-else>
      <!-- 6 Metric cards (DASH-02) -->
      <b-row class="mb-4">
        <b-col md="4" sm="6" class="mb-3" v-for="card in metricCards" :key="card.label">
          <b-card :class="'text-white bg-' + card.variant">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <div class="font-weight-bold">{{ card.label }}</div>
              <i :class="'fa fa-2x ' + card.icon" style="opacity:0.4" />
            </div>
            <div class="small">
              <div>Today: <strong>{{ card.today }}</strong></div>
              <div>Week: <strong>{{ card.week }}</strong></div>
              <div>Month: <strong>{{ card.month }}</strong></div>
            </div>
          </b-card>
        </b-col>
      </b-row>

      <!-- Timeline chart section (DASH-03) -->
      <b-row class="mb-4">
        <b-col cols="12">
          <b-card title="Device Check-ins">
            <div class="mb-3">
              <b-button
                size="sm"
                class="mr-1"
                :variant="chartRange === 7 ? 'primary' : 'outline-secondary'"
                @click="chartRange = 7"
              >7 days</b-button>
              <b-button
                size="sm"
                class="mr-1"
                :variant="chartRange === 31 ? 'primary' : 'outline-secondary'"
                @click="chartRange = 31"
              >31 days</b-button>
              <b-button
                size="sm"
                class="mr-1"
                :variant="chartRange === 365 ? 'primary' : 'outline-secondary'"
                @click="chartRange = 365"
              >365 days</b-button>
            </div>
            <checkins-timeline :checkins="timelineCheckins" :range="chartRange" />
          </b-card>
        </b-col>
      </b-row>

      <!-- Recent audit events (DASH-05) and Recent builds (DASH-04) -->
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
              <thead><tr><th>Time</th><th>Device</th><th>Status</th><th>Download</th></tr></thead>
              <tbody>
                <tr v-for="(item, i) in buildItems.slice(0, 10)" :key="i">
                  <td class="text-muted" style="white-space:nowrap">{{ item.date | shortDate }}</td>
                  <td>{{ formatBuildName(item) }}</td>
                  <td>
                    <b-badge :variant="badgeVariant(item.status)">{{ item.status || '—' }}</b-badge>
                  </td>
                  <td>
                    <b-button
                      v-if="item.build_id"
                      size="sm"
                      variant="primary"
                      @click="downloadArtifact(item)"
                    >Download</b-button>
                    <span v-else class="text-muted">—</span>
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
import CheckinsTimeline from './components/CheckinsTimeline/CheckinsTimeline.vue';
import hostnameMixin from '@/mixins/hostnames';

export default {
  name: "Dashboard",
  mixins: [hostnameMixin],
  components: { CheckinsTimeline },
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
      chartRange: 7,
    };
  },
  computed: {
    metricCards() {
      const s = this.statsData || {};
      const t = this.todayData || {};
      return [
        {
          label: 'Devices Checked In',
          icon: 'fa-check-circle',
          variant: 'info',
          today: this.extractMetric(t, 'DEVICE_CHECKIN'),
          week: this.extractMetric(s, 'DEVICE_CHECKIN'),
          month: this.extractMetric(s, 'DEVICE_CHECKIN'),
        },
        {
          label: 'New Devices',
          icon: 'fa-plus-circle',
          variant: 'success',
          today: this.extractMetric(t, 'DEVICE_NEW'),
          week: this.extractMetric(s, 'DEVICE_NEW'),
          month: this.extractMetric(s, 'DEVICE_NEW'),
        },
        {
          label: 'Active Devices',
          icon: 'fa-microchip',
          variant: 'primary',
          today: this.deviceCount,
          week: this.deviceCount,
          month: this.deviceCount,
        },
        {
          label: 'Errors',
          icon: 'fa-exclamation-triangle',
          variant: 'danger',
          today: this.extractMetric(t, 'DEVICE_REVOCATION'),
          week: this.extractMetric(s, 'DEVICE_REVOCATION'),
          month: this.extractMetric(s, 'DEVICE_REVOCATION'),
        },
        {
          label: 'Updates Deployed',
          icon: 'fa-cloud-upload',
          variant: 'warning',
          today: this.extractMetric(t, 'BUILD_STARTED'),
          week: this.extractMetric(s, 'BUILD_STARTED'),
          month: this.extractMetric(s, 'BUILD_STARTED'),
        },
        {
          label: 'Build Successes',
          icon: 'fa-check',
          variant: 'secondary',
          today: this.extractMetric(t, 'BUILD_SUCCESS'),
          week: this.extractMetric(s, 'BUILD_SUCCESS'),
          month: this.extractMetric(s, 'BUILD_SUCCESS'),
        },
      ];
    },
    timelineCheckins() {
      return (this.getTimeline() && this.getTimeline().CHECKINS) || [];
    },
  },
  created() {
    this.loadData();
  },
  methods: {
    ...mapGetters({ getStats: 'stats/getStats', getToday: 'stats/getToday', getTimeline: 'stats/getTimeline', getDevices: 'devices/getItems', getAudit: 'auditlog/getItems', getBuildLog: 'buildlog/getItems', getProfile: 'profile/getProfile' }),
    ...mapActions({ fetchDashboard: 'stats/fetchDashboard', fetchToday: 'stats/fetchToday', fetchDevices: 'devices/fetchItems' }),
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
        this.fetchDashboard(),
        this.fetchToday(),
        this.fetchDevices(),
      ]);
      this.statsData = this.getStats();
      this.todayData = this.getToday();
      this.deviceCount = (this.getDevices() || []).length;
      this.auditItems = this.getAudit() || [];
      this.buildItems = this.getBuildLog() || [];
      this.loading = false;
    },
    async downloadArtifact(item) {
      if (!item.build_id) return;
      const profile = this.getProfile() || {};
      const owner = profile.owner || '';
      const headers = {
        'Content-Type': 'application/json',
      };
      const accessToken = this.$store.$api.accessToken;
      if (accessToken) {
        headers.Authorization = 'Bearer ' + accessToken;
      }
      let response;
      try {
        response = await fetch(this.$hostnames.API + '/build/artifacts', {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify({ owner, udid: item.udid, build_id: item.build_id }),
        });
      } catch (networkError) {
        console.error('Download failed (network):', networkError);
        return;
      }
      if (!response.ok) {
        console.error('Download failed:', response.status, response.statusText);
        return;
      }
      // The API returns a JSON `{ success: false, response }` envelope (HTTP 200)
      // when no artifact exists for the build — guard against saving it as a .zip.
      const contentType = response.headers.get('content-type') || '';
      if (contentType.indexOf('application/json') !== -1) {
        const envelope = await response.json().catch(() => ({}));
        console.error('Download failed:', (envelope && envelope.response) || 'no artifact available');
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.build_id + '.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  },
};
</script>

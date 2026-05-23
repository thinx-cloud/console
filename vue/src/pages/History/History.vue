<template>
  <div>
    <b-breadcrumb>
      <b-breadcrumb-item active>History</b-breadcrumb-item>
    </b-breadcrumb>
    <h1 class="page-title">History</h1>

    <div v-if="loading" class="py-4 text-center">Loading...</div>
    <b-tabs v-else content-class="mt-3">

      <!-- Audit Log Tab -->
      <b-tab title="Audit Log" active>
        <b-form-input v-model="auditSearch" placeholder="Search audit log..." class="mb-3" style="max-width:400px" />
        <div v-if="!filteredAudit.length" class="text-muted">No audit events.</div>
        <table v-else class="table table-striped table-sm">
          <thead>
            <tr>
              <th>Date</th>
              <th>Message</th>
              <th>Flags</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, i) in filteredAudit" :key="i" :class="rowClass(item)">
              <td style="white-space:nowrap">{{ item.date | formatDate }}</td>
              <td>{{ item.message }}</td>
              <td>
                <b-badge
                  v-for="flag in (item.flags || [])"
                  :key="flag"
                  :variant="flagVariant(flag)"
                  class="mr-1"
                >{{ flag }}</b-badge>
              </td>
            </tr>
          </tbody>
        </table>
      </b-tab>

      <!-- Build Log Tab -->
      <b-tab title="Build Log">
        <b-form-input v-model="buildSearch" placeholder="Search build log..." class="mb-3" style="max-width:400px" />
        <div v-if="!filteredBuilds.length" class="text-muted">No build logs.</div>
        <table v-else class="table table-striped table-sm">
          <thead>
            <tr>
              <th>Date</th>
              <th>Name / Device</th>
              <th>Status</th>
              <th>Log</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, i) in filteredBuilds" :key="i">
              <td style="white-space:nowrap">{{ item.date | formatDate }}</td>
              <td>{{ item.name }}</td>
              <td>
                <b-badge :variant="item.status === 'OK' ? 'success' : 'danger'">{{ item.status || '—' }}</b-badge>
              </td>
              <td style="max-width:600px">
                <pre
                  v-if="item.log && (Array.isArray(item.log) ? item.log.length : item.log.length)"
                  class="mb-0"
                  style="white-space:pre-wrap;word-break:break-word;max-height:120px;overflow:hidden;font-size:11px;background:#f8f9fa;padding:6px;border-radius:3px;margin:0"
                >{{ logSnippet(item) }}</pre>
                <span v-else class="text-muted">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </b-tab>

    </b-tabs>
  </div>
</template>

<script>
import { mapGetters, mapActions } from "vuex";

export default {
  name: "History",
  filters: {
    formatDate(val) {
      if (!val) return '—';
      return new Date(val).toLocaleString();
    },
  },
  data() {
    return {
      loading: true,
      auditlog: [],
      buildlog: [],
      auditSearch: '',
      buildSearch: '',
    };
  },
  computed: {
    filteredAudit() {
      if (!this.auditSearch) return this.auditlog;
      const q = this.auditSearch.toLowerCase();
      return this.auditlog.filter(item => (item.message || '').toLowerCase().includes(q));
    },
    filteredBuilds() {
      if (!this.buildSearch) return this.buildlog;
      const q = this.buildSearch.toLowerCase();
      return this.buildlog.filter(item => (item.name || '').toLowerCase().includes(q));
    },
  },
  created() {
    this.loadData();
  },
  methods: {
    ...mapGetters({
      getAuditItems: "auditlog/getItems",
      getBuildItems: "buildlog/getItems",
    }),
    ...mapActions({
      fetchAuditlog: "auditlog/fetchAuditlog",
      fetchBuildlog: "buildlog/fetchBuildLog",
    }),
    rowClass(item) {
      if (!item.flags) return '';
      if (item.flags.includes('danger')) return 'table-danger';
      if (item.flags.includes('warning')) return 'table-warning';
      return '';
    },
    flagVariant(flag) {
      if (flag === 'danger') return 'danger';
      if (flag === 'warning') return 'warning';
      if (flag === 'info') return 'info';
      return 'secondary';
    },
    logSnippet(item) {
      const text = Array.isArray(item.log) ? item.log.join('\n') : (item.log || '');
      const MAX = 400;
      return text.length > MAX ? text.slice(0, MAX) + '…' : text;
    },
    loadData() {
      this.loading = true;
      Promise.all([this.fetchAuditlog(), this.fetchBuildlog()]).then(() => {
        this.auditlog = this.getAuditItems() || [];
        this.buildlog = this.getBuildItems() || [];
        this.loading = false;
      });
    },
  },
};
</script>

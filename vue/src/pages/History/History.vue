<template>
  <div>
    <b-breadcrumb>
      <b-breadcrumb-item active>History</b-breadcrumb-item>
    </b-breadcrumb>
    <h1 class="page-title">History</h1>

    <div v-if="loading" class="py-4 text-center">Loading...</div>
    <b-tabs v-else v-model="activeTabIndex" content-class="mt-3">

      <!-- Audit Log Tab -->
      <b-tab title="Audit Log">
        <b-form-inline class="mb-2">
          <label class="mr-2 mb-0">From</label>
          <b-form-input type="date" v-model="dateFrom" class="mr-3" style="max-width:180px" />
          <label class="mr-2 mb-0">To</label>
          <b-form-input type="date" v-model="dateTo" style="max-width:180px" />
        </b-form-inline>
        <b-form-input v-model="auditSearch" placeholder="Search audit log..." class="mb-3" style="max-width:400px" />
        <b-form-checkbox-group
          v-model="auditFlagFilter"
          :options="flagFilterOptions"
          class="mb-3"
          switches
        />
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
        <b-form-inline class="mb-2">
          <label class="mr-2 mb-0">From</label>
          <b-form-input type="date" v-model="dateFrom" class="mr-3" style="max-width:180px" />
          <label class="mr-2 mb-0">To</label>
          <b-form-input type="date" v-model="dateTo" style="max-width:180px" />
        </b-form-inline>
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
                  v-if="hasLog(item)"
                  class="mb-0"
                  :style="logStyle(item)"
                >{{ logFull(item) }}</pre>
                <b-button
                  v-if="logIsTruncatable(item)"
                  size="sm"
                  variant="link"
                  class="p-0"
                  @click="toggleExpand(item)"
                >{{ isExpanded(item) ? 'Collapse' : 'Expand' }}</b-button>
                <span v-if="!hasLog(item)" class="text-muted">—</span>
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
      dateFrom: '',
      dateTo: '',
      auditFlagFilter: ['danger', 'warning', 'info'],
      flagFilterOptions: [
        { text: 'Danger', value: 'danger' },
        { text: 'Warning', value: 'warning' },
        { text: 'Info', value: 'info' },
      ],
      // Array of build keys (build_id, falling back to id, falling back to row index) that are currently expanded.
      // Per-row, component-local state; not persisted across reload. Variant (b) of locked HIST-03 decision.
      expandedBuilds: [],
    };
  },
  computed: {
    activeTabIndex: {
      // Reactivity flow: $route changes -> this getter re-runs -> v-model updates -> b-tabs switches tab.
      // No watcher needed; computed dependency on this.$route.name is the entire reactivity link.
      get() {
        return this.$route.name === 'HistoryBuilds' ? 1 : 0;
      },
      set(idx) {
        const target = idx === 1 ? 'HistoryBuilds' : 'HistoryAudit';
        if (this.$route.name !== target) {
          this.$router.push({ name: target });
        }
      },
    },
    filteredAudit() {
      const q = this.auditSearch ? this.auditSearch.toLowerCase() : '';
      return this.auditlog.filter(item => {
        // Date-range predicate (Number.isFinite guard so items with empty/invalid dates fall through to include).
        const t = new Date(item.date).getTime();
        if (Number.isFinite(t)) {
          if (this.dateFrom && t < new Date(this.dateFrom).getTime()) return false;
          if (this.dateTo && t > new Date(this.dateTo).getTime() + 86399999) return false;
        }
        // Flag-filter predicate (audit only).
        const flags = item.flags || [];
        if (flags.length && !flags.some(f => this.auditFlagFilter.includes(f))) return false;
        // Text-search predicate (existing behaviour).
        if (q && !(item.message || '').toLowerCase().includes(q)) return false;
        return true;
      });
    },
    filteredBuilds() {
      const q = this.buildSearch ? this.buildSearch.toLowerCase() : '';
      return this.buildlog.filter(item => {
        // Date-range predicate (same guard as filteredAudit).
        const t = new Date(item.date).getTime();
        if (Number.isFinite(t)) {
          if (this.dateFrom && t < new Date(this.dateFrom).getTime()) return false;
          if (this.dateTo && t > new Date(this.dateTo).getTime() + 86399999) return false;
        }
        // Text-search predicate (existing behaviour).
        if (q && !(item.name || '').toLowerCase().includes(q)) return false;
        return true;
      });
    },
  },
  created() {
    this.loadData();
    // Hydrate filter state from URL query (deep-link support; Wave 2 wires the write side).
    const { from, to, flags } = this.$route.query;
    if (typeof from === 'string') this.dateFrom = from;
    if (typeof to === 'string') this.dateTo = to;
    if (typeof flags === 'string') this.auditFlagFilter = flags.split(',').filter(Boolean);
  },
  watch: {
    dateFrom() { this.syncFiltersToQuery(); },
    dateTo() { this.syncFiltersToQuery(); },
    auditFlagFilter() { this.syncFiltersToQuery(); },
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
    buildKey(item) {
      // Stable key for the expansion set. Prefer build_id (set by normalizeBuildItems for most rows);
      // fall back to id, then to the raw object reference via Object.prototype.hasOwnProperty.
      if (item && item.build_id) return item.build_id;
      if (item && item.id) return item.id;
      return null; // caller must use array index as a final fallback in the template
    },
    isExpanded(item) {
      const key = this.buildKey(item);
      if (key === null) return false;
      return this.expandedBuilds.indexOf(key) !== -1;
    },
    toggleExpand(item) {
      const key = this.buildKey(item);
      if (key === null) return;
      const idx = this.expandedBuilds.indexOf(key);
      if (idx === -1) {
        // Use Vue.set-style push so reactivity tracks the change
        this.expandedBuilds.push(key);
      } else {
        this.expandedBuilds.splice(idx, 1);
      }
    },
    hasLog(item) {
      if (!item) return false;
      if (Array.isArray(item.log)) return item.log.length > 0;
      return typeof item.log === 'string' && item.log.length > 0;
    },
    logFull(item) {
      // When collapsed, defer to logSnippet (Wave-1-preserved). When expanded, return the full text.
      if (!this.hasLog(item)) return '';
      if (!this.isExpanded(item)) return this.logSnippet(item);
      return Array.isArray(item.log) ? item.log.join('\n') : (item.log || '');
    },
    logStyle(item) {
      // Inline styles always applied; max-height/overflow added only when collapsed.
      const base = 'white-space:pre-wrap;word-break:break-word;font-size:11px;background:#f8f9fa;padding:6px;border-radius:3px;margin:0;';
      if (this.isExpanded(item)) return base;
      return base + 'max-height:120px;overflow:hidden;';
    },
    logIsTruncatable(item) {
      if (!this.hasLog(item)) return false;
      const text = Array.isArray(item.log) ? item.log.join('\n') : (item.log || '');
      return text.length > 400;
    },
    loadData() {
      this.loading = true;
      Promise.all([this.fetchAuditlog(), this.fetchBuildlog()]).then(() => {
        this.auditlog = this.getAuditItems() || [];
        this.buildlog = this.getBuildItems() || [];
        this.loading = false;
      });
    },
    syncFiltersToQuery() {
      const query = Object.assign({}, this.$route.query, {
        from: this.dateFrom || undefined,
        to: this.dateTo || undefined,
        flags: (this.auditFlagFilter && this.auditFlagFilter.length === 3)
          ? undefined
          : (this.auditFlagFilter || []).join(','),
      });
      // Avoid pushing identical queries (Vue Router emits a NavigationDuplicated warning otherwise)
      const current = this.$route.query;
      const same = current.from === query.from && current.to === query.to && current.flags === query.flags;
      if (same) return;
      this.$router.replace({ query }).catch(() => { /* NavigationDuplicated is benign */ });
    },
  },
};
</script>

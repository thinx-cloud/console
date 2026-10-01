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
        <b-form inline class="mb-2">
          <label class="mr-2 mb-0">From</label>
          <b-form-input type="date" data-cy="date-from" v-model="dateFrom" class="mr-3" style="max-width:180px" />
          <label class="mr-2 mb-0">To</label>
          <b-form-input type="date" data-cy="date-to" v-model="dateTo" style="max-width:180px" />
        </b-form>
        <b-form-input v-model="auditSearch" placeholder="Search audit log..." class="mb-3" style="max-width:400px" />
        <b-form-checkbox-group
          v-model="auditFlagFilter"
          :options="flagFilterOptions"
          class="mb-3"
          data-cy="flag-filter"
          switches
        />
        <div v-if="!auditlog.length" class="text-muted">No audit events.</div>
        <div v-else-if="!filteredAudit.length">No loaded entries match these filters.</div>
        <table v-else class="table table-striped table-sm" :aria-busy="auditLoadingMore ? 'true' : 'false'">
          <thead>
            <tr>
              <th>Date</th>
              <th>Message</th>
              <th>Flags</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, i) in filteredAudit" :key="i" :class="rowClass(item)" data-cy="audit-row">
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
        <!-- Paging footer: outside the empty/table branches so a filter can never hide Load more. -->
        <div
          class="log-paging"
          data-cy="audit-paging"
          tabindex="-1"
          ref="auditPaging"
          :aria-busy="auditLoadingMore ? 'true' : 'false'"
        >
          <button
            v-if="auditPaging.has_more"
            ref="auditLoadMore"
            type="button"
            class="btn btn-outline-secondary btn-sm log-paging-more"
            :class="{ disabled: auditLoadingMore }"
            :aria-disabled="auditLoadingMore ? 'true' : null"
            data-cy="audit-load-more"
            aria-label="Load more audit log entries"
            @click="loadMoreAudit"
          ><template v-if="auditLoadingMore"><b-spinner small aria-hidden="true" class="log-paging-icon" />Loading…</template><template v-else>Load more</template></button>
          <span
            v-if="auditPaging.has_more && auditFilterActive"
            class="log-paging-text"
            data-cy="audit-filter-hint"
          ><i class="la la-info-circle log-paging-icon" aria-hidden="true"></i>{{ filterHint(auditlog.length) }}</span>
          <span
            v-if="auditLoadError"
            role="alert"
            class="log-paging-text"
            data-cy="audit-load-more-error"
          ><i class="la la-exclamation-circle text-danger log-paging-icon" aria-hidden="true"></i>Couldn't load older entries. Select Load more to try again.</span>
        </div>
        <div class="sr-only" aria-live="polite" aria-atomic="true" data-cy="audit-paging-status">{{ auditStatus }}</div>
      </b-tab>

      <!-- Build Log Tab -->
      <b-tab title="Build Log">
        <b-form inline class="mb-2">
          <label class="mr-2 mb-0">From</label>
          <b-form-input type="date" data-cy="date-from" v-model="dateFrom" class="mr-3" style="max-width:180px" />
          <label class="mr-2 mb-0">To</label>
          <b-form-input type="date" data-cy="date-to" v-model="dateTo" style="max-width:180px" />
        </b-form>
        <b-form-input v-model="buildSearch" placeholder="Search build log..." class="mb-3" style="max-width:400px" />
        <div v-if="!buildlog.length" class="text-muted">No build logs.</div>
        <div v-else-if="!filteredBuilds.length">No loaded entries match these filters.</div>
        <table v-else class="table table-striped table-sm" :aria-busy="buildLoadingMore ? 'true' : 'false'">
          <thead>
            <tr>
              <th>Date</th>
              <th>Name / Device</th>
              <th>Status</th>
              <th>Log</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, i) in filteredBuilds" :key="i" data-cy="build-row">
              <td style="white-space:nowrap">{{ item.date | formatDate }}</td>
              <td>{{ item.name }}</td>
              <td>
                <b-badge :variant="item.status === 'OK' ? 'success' : 'danger'">{{ item.status || '—' }}</b-badge>
              </td>
              <td style="max-width:600px">
                <pre
                  v-if="hasLog(item)"
                  class="mb-0"
                  data-cy="build-log-pre"
                  :style="logStyle(item)"
                >{{ logFull(item) }}</pre>
                <b-button
                  v-if="logIsTruncatable(item)"
                  size="sm"
                  variant="link"
                  class="p-0"
                  data-cy="build-expand"
                  @click="toggleExpand(item)"
                >{{ isExpanded(item) ? 'Collapse' : 'Expand' }}</b-button>
                <span v-if="!hasLog(item)" class="text-muted">—</span>
              </td>
            </tr>
          </tbody>
        </table>
        <!-- Paging footer: outside the empty/table branches so a filter can never hide Load more. -->
        <div
          class="log-paging"
          data-cy="build-paging"
          tabindex="-1"
          ref="buildPaging"
          :aria-busy="buildLoadingMore ? 'true' : 'false'"
        >
          <button
            v-if="buildPaging.has_more"
            ref="buildLoadMore"
            type="button"
            class="btn btn-outline-secondary btn-sm log-paging-more"
            :class="{ disabled: buildLoadingMore }"
            :aria-disabled="buildLoadingMore ? 'true' : null"
            data-cy="build-load-more"
            aria-label="Load more builds"
            @click="loadMoreBuilds"
          ><template v-if="buildLoadingMore"><b-spinner small aria-hidden="true" class="log-paging-icon" />Loading…</template><template v-else>Load more</template></button>
          <span
            v-if="buildPaging.has_more && buildFilterActive"
            class="log-paging-text"
            data-cy="build-filter-hint"
          ><i class="la la-info-circle log-paging-icon" aria-hidden="true"></i>{{ filterHint(buildlog.length) }}</span>
          <span
            v-if="buildLoadError"
            role="alert"
            class="log-paging-text"
            data-cy="build-load-more-error"
          ><i class="la la-exclamation-circle text-danger log-paging-icon" aria-hidden="true"></i>Couldn't load older entries. Select Load more to try again.</span>
        </div>
        <div class="sr-only" aria-live="polite" aria-atomic="true" data-cy="build-paging-status">{{ buildStatus }}</div>
      </b-tab>

    </b-tabs>
  </div>
</template>

<script>
import { mapGetters, mapActions } from "vuex";
import { normPaging } from "@/store/logPaging";

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
      // Paging (phase 26). History owns its rows and cursors: it copies the store's
      // first page once and appends only the pages it requested itself, so a
      // first-page refresh from Header / Notifications / DeviceDetail cannot
      // shrink, reset or duplicate a table the user has paged.
      auditPaging: normPaging(null),
      auditLoadingMore: false,
      buildPaging: normPaging(null),
      buildLoadingMore: false,
      auditLoadError: false,
      buildLoadError: false,
      // Live-region text, set only after a successful append (empty at rest).
      auditStatus: '',
      buildStatus: '',
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
    // D-05: filters run over the loaded entries only; with older entries on the
    // server the page says so next to Load more. Text search counts as a filter.
    auditFilterActive() {
      return !!(this.dateFrom || this.dateTo || (this.auditSearch || '').trim() ||
        (this.auditFlagFilter || []).length !== 3);
    },
    buildFilterActive() {
      return !!(this.dateFrom || this.dateTo || (this.buildSearch || '').trim());
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
      getAuditPaging: "auditlog/getPaging",
      getBuildPaging: "buildlog/getPaging",
    }),
    ...mapActions({
      fetchAuditlog: "auditlog/fetchAuditlog",
      fetchBuildlog: "buildlog/fetchBuildLog",
      fetchAuditPage: "auditlog/fetchAuditPage",
      fetchBuildPage: "buildlog/fetchBuildPage",
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
      // Each table takes its first page independently; a rejected request leaves
      // that table empty (no Load more) and never keeps "Loading..." on screen.
      return Promise.allSettled([this.fetchAuditlog(), this.fetchBuildlog()]).then(([audit, build]) => {
        if (audit.status === 'fulfilled') {
          this.auditlog = (this.getAuditItems() || []).slice();
          this.auditPaging = normPaging(this.getAuditPaging());
        }
        if (build.status === 'fulfilled') {
          this.buildlog = (this.getBuildItems() || []).slice();
          this.buildPaging = normPaging(this.getBuildPaging());
        }
      }).finally(() => {
        this.loading = false;
      });
    },
    filterHint(n) {
      return `Filtering ${n.toLocaleString()} loaded ${n === 1 ? 'entry' : 'entries'}; older entries exist.`;
    },
    appendStatus(added, total, more) {
      const entries = (n) => `${n.toLocaleString()} ${n === 1 ? 'entry' : 'entries'}`;
      const loaded = `Loaded ${added.toLocaleString()} more ${added === 1 ? 'entry' : 'entries'}.`;
      return more ? `${loaded} ${entries(total)} loaded.` : `${loaded} All ${entries(total)} loaded.`;
    },
    hasFocus(refName) {
      const el = this.$refs[refName];
      return !!el && typeof document !== 'undefined' && document.activeElement === el;
    },
    // Load more (D-01): only an explicit activation requests a page, and only for
    // that table, with that table's own cursor (D-03).
    loadMoreAudit() {
      return this.loadMore('audit', this.fetchAuditPage);
    },
    loadMoreBuilds() {
      return this.loadMore('build', this.fetchBuildPage);
    },
    async loadMore(table, fetchPage) {
      const pagingKey = table + 'Paging';
      const loadingKey = table + 'LoadingMore';
      const rowsKey = table + 'log';
      const errorKey = table + 'LoadError';
      // aria-disabled, not disabled: repeat activations while loading are no-ops here.
      if (this[loadingKey] || !this[pagingKey].has_more) return;
      this[errorKey] = false;
      this[loadingKey] = true;
      try {
        const res = await fetchPage({ cursor: this[pagingKey].next_cursor });
        if (res && res.ok) {
          const hadFocus = this.hasFocus(table + 'LoadMore');
          this[rowsKey] = this[rowsKey].concat(res.items);
          this[pagingKey] = res.paging;
          this[table + 'Status'] = this.appendStatus(res.items.length, this[rowsKey].length, res.paging.has_more);
          if (!res.paging.has_more && hadFocus) {
            // The button is about to disappear: keep keyboard users on the footer.
            this.$nextTick(() => {
              const wrapper = this.$refs[pagingKey];
              if (wrapper && typeof wrapper.focus === 'function') wrapper.focus();
            });
          }
        } else {
          // Rows, cursor and has_more stay as they were, so a retry asks for the same page.
          this[errorKey] = true;
        }
      } finally {
        this[loadingKey] = false;
      }
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

<style scoped>
.log-paging {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  margin-top: 8px;
  margin-bottom: 16px;
}
.log-paging:empty {
  margin: 0;
}
.log-paging-more {
  min-width: 112px;
}
.log-paging-more:focus-visible {
  outline: 2px solid #2477FF;
  outline-offset: 2px;
}
.log-paging-text {
  font-size: 0.875rem;
  line-height: 1.5;
}
.log-paging-icon {
  margin-right: 4px;
}
</style>

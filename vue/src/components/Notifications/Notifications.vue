<template>
  <section class="notifications navbar-notifications">
    <header class="header">
      <h6 class="my-3 text-center">Recent Builds</h6>
    </header>
    <div v-if="loading" class="px-4 py-3 text-center text-muted">Loading...</div>
    <b-list-group v-else class="listGroup thin-scroll">
      <b-list-group-item v-if="!recentBuilds.length" class="listGroupItem">
        <p class="m-0 text-muted">No recent builds.</p>
      </b-list-group-item>
      <!-- A row is a button only with a build id; without one it is static text (D-14). -->
      <b-list-group-item
        v-for="build in recentBuilds"
        :key="build.id || `${build.date}-${build.name || build.udid}`"
        :class="['listGroupItem', { 'listGroupItem--static': !build.build_id }]"
        :button="!!build.build_id"
        data-cy="recent-build"
        v-on="rowListeners(build)"
      >
        <span class="notificationIcon thumb-sm">
          <span :class="statusIconClass(build)">
            <i :class="statusGlyph(build)" />
          </span>
        </span>
        <time class="text-link help float-right">{{ formatDate(build.date) }}</time>
        <span class="notification-title text-ellipsis">{{ build.name || shortUdid(build.udid) }}</span>
        <span class="notification-meta deemphasize text-ellipsis">
          <span :class="statusTextClass(build)">{{ build.status || '—' }}</span>
          <span v-if="build.udid"> · {{ shortUdid(build.udid) }}</span>
        </span>
      </b-list-group-item>
    </b-list-group>
    <BuildLogDialog ref="buildLogDialog" />
    <footer class="text-sm footer px-4 py-2">
      <router-link to="/app/history/builds" class="fs-mini">See all builds</router-link>
      <b-button
        variant="link"
        @click="loadNotifications"
        :class="{disabled: isLoad, 'btn-xs float-right py-0': true}"
      >
        <span v-if="isLoad"><i class="la la-refresh la-spin" /> Loading...</span>
        <i v-else class="la la-refresh" />
      </b-button>
    </footer>
  </section>
</template>

<script>
import BuildLogDialog from '@/components/BuildLogDialog/BuildLogDialog';
import Vue from 'vue';
import { mapActions, mapGetters } from 'vuex';
import { buildStatusVariant } from '@/utils/buildLog';

export default {
  name: 'Notification',
  components: { BuildLogDialog },
  data() {
    return {
      isLoad: false,
      loading: true,
      buildItems: [],
    };
  },
  computed: {
    recentBuilds() {
      return (this.buildItems || [])
        .slice()
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
        .slice(0, 10);
    },
  },
  created() {
    this.loadNotifications();
  },
  methods: {
    openBuildLog(build) { this.$refs.buildLogDialog.open(build); },
    // Only a row with a build id gets a click listener; a row without one sends no request.
    rowListeners(build) {
      if (typeof build.build_id === 'string' && build.build_id) return { click: () => this.openBuildLog(build) };
      return {};
    },
    ...mapGetters({ getBuildLog: 'buildlog/getItems' }),
    ...mapActions({ fetchBuildLog: 'buildlog/fetchBuildLog' }),
    async loadNotifications() {
      Vue.set(this, 'isLoad', true);
      this.loading = true;
      try {
        await this.fetchBuildLog();
        this.buildItems = this.getBuildLog() || [];
      } finally {
        this.loading = false;
        Vue.set(this, 'isLoad', false);
      }
    },
    formatDate(value) {
      if (!value) return '—';
      return new Date(value).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    },
    shortUdid(value) {
      if (!value) return '—';
      return `${value.substring(0, 8)}...`;
    },
    statusGlyph(build) {
      const glyph = { success: 'fa-check', warning: 'fa-clock-o', info: 'fa-circle-o-notch' }[buildStatusVariant(build.status)];
      return 'fa ' + (glyph || 'fa-times') + ' text-white';
    },
    statusIconClass(build) {
      return 'circle circle-lg bg-' + buildStatusVariant(build.status);
    },
    statusTextClass(build) {
      return 'text-' + buildStatusVariant(build.status);
    },
  },
};
</script>

<style src="./Notifications.scss" lang="scss" />
<style src="./NotificationsDemo/ListGroup.scss" lang="scss" />

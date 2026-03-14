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
      <b-list-group-item
        v-for="build in recentBuilds"
        :key="build.id || `${build.date}-${build.name || build.udid}`"
        class="listGroupItem"
      >
        <span class="notificationIcon thumb-sm">
          <span :class="statusIconClass(build)">
            <i :class="statusGlyph(build)" />
          </span>
        </span>
        <time class="text-link help float-right">{{ formatDate(build.date) }}</time>
        <h6 class="m-0 mb-1 text-ellipsis">{{ build.name || shortUdid(build.udid) }}</h6>
        <p class="deemphasize text-ellipsis m-0">
          <span :class="statusTextClass(build)">{{ build.status || 'UNKNOWN' }}</span>
          <span v-if="build.udid"> · {{ shortUdid(build.udid) }}</span>
        </p>
      </b-list-group-item>
    </b-list-group>
    <footer class="text-sm footer px-4 py-2">
      <router-link to="/app/history" class="fs-mini">See all builds</router-link>
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
import Vue from 'vue';
import { mapActions, mapGetters } from 'vuex';

export default {
  name: 'Notification',
  data() {
    return {
      isLoad: false,
      loading: true,
      buildItems: [],
    };
  },
  computed: {
    ...mapGetters({ getBuildLog: 'buildlog/getItems' }),
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
    isSuccess(build) {
      return (build.status || '').toUpperCase() === 'OK';
    },
    statusGlyph(build) {
      return this.isSuccess(build) ? 'fa fa-check text-white' : 'fa fa-times text-white';
    },
    statusIconClass(build) {
      return this.isSuccess(build)
        ? 'circle circle-lg bg-success'
        : 'circle circle-lg bg-danger';
    },
    statusTextClass(build) {
      return this.isSuccess(build) ? 'text-success' : 'text-danger';
    },
  },
};
</script>

<style src="./Notifications.scss" lang="scss" />
<style src="./NotificationsDemo/ListGroup.scss" lang="scss" />

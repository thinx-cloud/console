<template>
  <b-modal ref="modal" :title="'Build Log — ' + buildId" size="xl" ok-only ok-title="Close" @hidden="requestId++">
    <div v-if="loading" role="status"><b-spinner small /> Loading build log…</div>
    <b-alert v-else-if="error" variant="danger" show>{{ error }} <b-button size="sm" @click="load">Retry</b-button></b-alert>
    <pre v-else-if="text" class="build-log-text" data-cy="full-build-log">{{ text }}</pre>
    <p v-else class="text-muted">No log output is available for this build yet.</p>
  </b-modal>
</template>

<script>
import { buildLogText } from '@/utils/buildLog';
export default {
  name: 'BuildLogDialog',
  data() { return { buildId: '', loading: false, error: null, text: '', requestId: 0 }; },
  methods: {
    open(build) {
      this.buildId = build.build_id || build.id || '';
      this.text = '';
      this.error = null;
      this.$refs.modal.show();
      return this.load();
    },
    async load() {
      const request = ++this.requestId;
      this.loading = true;
      this.error = null;
      try {
        const result = await this.$store.dispatch('buildlog/fetchBuildDetail', this.buildId);
        if (request !== this.requestId) return;
        if (!result || !result.success) throw new Error('unavailable');
        this.text = buildLogText(result.response);
      } catch (e) {
        if (request === this.requestId) this.error = 'Could not load this build log.';
      } finally {
        if (request === this.requestId) this.loading = false;
      }
    },
  },
};
</script>
<style scoped>
.build-log-text { max-height: 70vh; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; background: #1e1e1e; color: #ddd; padding: 1rem; }
</style>

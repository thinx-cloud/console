<template>
  <b-modal ref="modal" :title="'Build Log — ' + buildId" size="xl" ok-only ok-title="Close" @hidden="onHidden">
    <div v-if="text && !loading && !error" class="build-log-search" role="search" aria-label="Search this build log" data-cy="build-log-search-bar">
      <b-input-group class="build-log-search__field">
        <b-input-group-prepend is-text><i class="fa fa-search" aria-hidden="true"></i></b-input-group-prepend>
        <b-form-input v-model="searchInput" type="text" aria-label="Search this build log" placeholder="Search log (3+ characters)" autocomplete="off" spellcheck="false" data-cy="build-log-search" @keydown.enter.prevent="onSearchEnter" />
      </b-input-group>
      <span class="build-log-search__count" data-cy="build-log-search-count"><span aria-hidden="true">{{ countText }}</span><span class="sr-only" aria-live="polite" aria-atomic="true">{{ countSpeech }}</span></span>
      <IconButton icon="fa fa-chevron-left" label="Previous match" :disabled="!result.count" data-cy="build-log-prev" @click="step(-1)" />
      <IconButton icon="fa fa-chevron-right" label="Next match" :disabled="!result.count" data-cy="build-log-next" @click="step(1)" />
    </div>
    <div v-if="loading" role="status"><b-spinner small /> Loading build log…</div>
    <b-alert v-else-if="error" variant="danger" show data-cy="build-log-error">Could not load this build log. <b-button size="sm" variant="default" data-cy="build-log-retry" @click="load"><i class="fa fa-refresh" aria-hidden="true"></i><span class="button-text">Try again</span></b-button></b-alert>
    <!-- Keep the <pre> and its children on one line: whitespace inside <pre> would become log text. -->
    <pre v-else-if="text" ref="log" class="build-log-text" data-cy="full-build-log"><template v-if="result.count"><template v-for="(seg, n) in result.segments"><mark v-if="seg.match" :key="n" class="build-log-match" :class="{ 'build-log-match--current': seg.index === current }" :aria-current="seg.index === current ? 'true' : null" data-cy="build-log-match">{{ seg.text }}</mark><span v-else :key="n">{{ seg.text }}</span></template></template><template v-else>{{ text }}</template></pre>
    <p v-else class="mb-0" data-cy="build-log-empty">No log output is available for this build yet.</p>
  </b-modal>
</template>

<script>
import { buildLogText, buildLogSearch, hasBuildLog } from '@/utils/buildLog';
import IconButton from '@/components/IconButton/IconButton';

// Phase 47 (BUILD-03): browser-find style search over the full log. Matches are rendered as
// text-only segments (interpolation, never HTML), so log content stays inert.
const SEARCH_DEBOUNCE_MS = 200;

export default {
  name: 'BuildLogDialog',
  components: { IconButton },
  data() {
    return { buildId: '', loading: false, error: null, text: '', requestId: 0, searchInput: '', term: '', current: 0, debounceTimer: null };
  },
  computed: {
    searching() { return this.term.length >= 3 && this.term.trim() !== ''; },
    result() { return buildLogSearch(this.text, this.term); },
    countText() {
      if (!this.searching) return '';
      if (!this.result.count) return 'No matches';
      return (this.current + 1) + ' / ' + this.result.count + (this.result.capped ? '+' : '');
    },
    countSpeech() {
      if (!this.searching) return '';
      if (!this.result.count) return 'No matches';
      return 'Match ' + (this.current + 1) + ' of ' + (this.result.capped ? 'more than ' : '') + this.result.count;
    },
  },
  watch: {
    searchInput(value) {
      this.cancelDebounce();
      if (value === this.term) return;
      this.debounceTimer = setTimeout(() => {
        this.debounceTimer = null;
        this.applyTerm();
      }, SEARCH_DEBOUNCE_MS);
    },
    term() { this.selectFirst(); },
    text() { this.selectFirst(); },
  },
  beforeDestroy() {
    this.cancelDebounce();
  },
  methods: {
    selectFirst() {
      this.current = 0;
      this.$nextTick(() => this.scrollToCurrent());
    },
    applyTerm() {
      this.term = this.searchInput;
      this.current = 0;
    },
    // Enter applies a still-pending term at once; otherwise Enter / Shift+Enter step (D-03).
    // Escape is not handled here: it bubbles to the modal, which closes.
    onSearchEnter(event) {
      if (this.debounceTimer) {
        this.cancelDebounce();
        this.applyTerm();
        return;
      }
      this.step(event && event.shiftKey ? -1 : 1);
    },
    step(delta) {
      const count = this.result.count;
      if (!count) return;
      this.current = (this.current + delta + count) % count;
      this.$nextTick(() => this.scrollToCurrent());
    },
    // Centre the current match inside the log box by moving only the box's own scrollTop:
    // the element scroll-into-view API would also scroll the modal and the page, and focus
    // stays in the search field (UI-B06).
    scrollToCurrent() {
      const log = this.$refs.log;
      if (!log) return;
      const mark = log.querySelector('.build-log-match--current');
      if (!mark) return;
      log.scrollTop = mark.offsetTop - (log.clientHeight - mark.offsetHeight) / 2;
    },
    // Only the row's own build_id is used (D-15), and the shared hasBuildLog predicate decides:
    // a row without a build log never shows the dialog or requests /logs/build/<list index>.
    // Each open forgets the previous search (D-12).
    open(build) {
      if (!hasBuildLog(build)) return Promise.resolve();
      const buildId = build.build_id;
      this.cancelDebounce();
      this.searchInput = '';
      this.term = '';
      this.current = 0;
      this.buildId = buildId;
      this.text = '';
      this.error = null;
      this.$refs.modal.show();
      return this.load();
    },
    // Closing drops a pending response and the loading state (35 IN-07) and the debounce.
    onHidden() {
      this.requestId++;
      this.loading = false;
      this.cancelDebounce();
    },
    cancelDebounce() {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
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

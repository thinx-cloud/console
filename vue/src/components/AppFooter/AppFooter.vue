<template>
  <footer :class="variant === 'layout' ? 'contentFooter' : 'auth-footer'">
    &copy; 2018<template v-if="buildYear"> &ndash; {{ buildYear }}</template> <a :href="$hostnames.CONSOLE" target="_blank">THiNX Console</a> by
    <a :href="$hostnames.LANDING" target="_blank">THiNX Cloud</a><template v-if="buildHash"><span
      class="footer-sep" aria-hidden="true"> &middot; </span><span class="build-hash" :title="'Build ' + buildHash"><span
      class="sr-only">Build </span>{{ buildHash }}</span></template>
  </footer>
</template>

<script>
// Shared build footer for the auth pages and the authenticated layout (phase 42,
// UI-05). One line: copyright range ending at the build year, the two THiNX links,
// then the 7-character commit id. vue.config.js sets VUE_APP_BUILD_YEAR and
// VUE_APP_BUILD_HASH before vue-cli inlines them; both are read inside the
// getters so the unit test can vary them per render. Anything that is not a valid
// year after the first one, or not 7 hex characters, is hidden rather than shown
// (D-11: never 'dev', '', or 'undefined' in the footer).
import hostnameMixin from '@/mixins/hostnames';

const FIRST_YEAR = 2018;

export default {
  name: 'AppFooter',
  mixins: [hostnameMixin],
  props: {
    variant: {
      type: String,
      default: 'auth',
      validator: (value) => value === 'auth' || value === 'layout',
    },
  },
  computed: {
    buildYear() {
      const year = String(process.env.VUE_APP_BUILD_YEAR || '');
      return /^\d{4}$/.test(year) && Number(year) > FIRST_YEAR ? year : '';
    },
    buildHash() {
      const hash = String(process.env.VUE_APP_BUILD_HASH || '');
      return /^[0-9a-f]{7}$/i.test(hash) ? hash : '';
    },
  },
};
</script>

<style lang="scss" scoped>
@import '../../styles/app';

.build-hash {
  font-family: $font-family-monospace;
  white-space: nowrap;
}
</style>

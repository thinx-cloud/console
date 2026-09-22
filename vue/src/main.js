// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import Vue from 'vue';
import BootstrapVue from 'bootstrap-vue';
import * as VueGoogleMaps from 'vue2-google-maps';
import Toasted from 'vue-toasted';
import VCalendar from 'v-calendar';
import VueApexCharts from 'vue-apexcharts';

import store from './store';
import router from './Routes';
import App from './App';
import layoutMixin from './mixins/layout';

import Rollbar from 'vue-rollbar';
import CrispChat from '@dansmaculotte/vue-crisp-chat'
import Moment from 'vue-moment'

import ThinxApi from './core/api';
const Api = new ThinxApi(process.env.VUE_APP_API_HOSTNAME);
store.$api = Api;

Vue.prototype.$hostnames = {};

Vue.use(CrispChat, {
  websiteId: process.env.VUE_APP_CRISP_WEBSITE_ID,
  disabled: true, // TODO in production should be disabled to comply with GDPR
  hideOnLoad: true
});
const rollbarAccessToken = process.env.VUE_APP_ROLLBAR_ACCESS_TOKEN;
if (/^[0-9a-f]{32}$/i.test(rollbarAccessToken || '')) {
  Vue.use(Rollbar, {
    accessToken: rollbarAccessToken,
    captureUncaught: true,
    captureUnhandledRejections: true,
    // Appended to Rollbar's own defaults (no overwriteScrubFields here).
    scrubFields: [
      'api_key',
      'apikey',
      'authorization',
      'jwt',
      'owner_api_key',
      'refresh_token',
      'session_key',
      'token'
    ],
    // rollbar.js records DOM/network telemetry by default; keep typed values
    // out of it.
    scrubTelemetryInputs: true,
    payload: {
      // NODE_ENV describes the webpack mode, not the deployment, and the
      // Dockerfile pins it to 'development' for the whole build stage; the
      // deployment name comes from the ENVIRONMENT build arg (vue.config.js).
      environment: process.env.VUE_APP_ENVIRONMENT || process.env.NODE_ENV,
      client: {
        javascript: {
          code_version: process.env.VUE_APP_BUILD_HASH,
          // vue.config.js sets productionSourceMap: false, nothing is uploaded.
          source_map_enabled: false
        }
      }
    }
  });

  // vue-rollbar only exposes the client; component render/watcher errors are
  // swallowed by Vue's own handler and never reach window.onerror.
  Vue.config.errorHandler = (error, vm, info) => {
    Vue.rollbar.error(error, { vueInfo: info, component: vm && vm.$options && vm.$options.name });
    if (process.env.NODE_ENV !== 'production') console.error(error);
  };
}
Vue.use(Moment);
Vue.use(BootstrapVue);
Vue.use(VCalendar, {
  firstDayOfWeek: 2
});
Vue.use(VueGoogleMaps, {
  load: {
    key: process.env.VUE_APP_GOOGLE_MAPS_APIKEY,
  },
});

Vue.component('apexchart', VueApexCharts);
Vue.mixin(layoutMixin);
Vue.use(Toasted, {duration: 10000});

Vue.config.productionTip = false;

/* eslint-disable no-new */
new Vue({
  el: '#app',
  store,
  router,
  render: h => h(App),
});

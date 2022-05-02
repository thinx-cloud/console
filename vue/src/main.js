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
Vue.use(Rollbar, {
  accessToken: process.env.VUE_APP_ROLLBAR_ACCESS_TOKEN,
  captureUncaught: true,
  payload: {
    environment: process.env.NODE_ENV,
  }
});
Vue.rollbar.debug('Vue console started!');
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

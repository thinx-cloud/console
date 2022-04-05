import Vue from 'vue';
import Vuex from 'vuex';

import layout from './layout';
import authentication from './authentication';

import thinxDeviceApi from '../core/thinxDeviceApi';


Vue.use(Vuex);

export default new Vuex.Store({
  modules: {
    layout,
    authentication,
    thinxDeviceApi
  },
});

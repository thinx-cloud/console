import Vue from 'vue';
import Vuex from 'vuex';

import layout from './layout';
import auth from './auth';
import repositories from './repositories';
import apikeys from './apikeys';

Vue.use(Vuex);

export default new Vuex.Store({
  modules: {
    layout,
    auth,
    repositories,
    apikeys
  },
});

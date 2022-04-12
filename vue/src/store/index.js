import Vue from 'vue';
import Vuex from 'vuex';

import layout from './layout';
import auth from './auth';
import repositories from './repositories';
import apikeys from './apikeys';
import channels from './channels';
import rsakeys from './rsakeys';
import enviros from './enviros';
import devices from './devices';
import profile from './profile';

//import history from './history';
import transformers from './transformers';

Vue.use(Vuex);

export default new Vuex.Store({
  modules: {
    layout,
    auth,
    repositories,
    apikeys,
    rsakeys,
    enviros,
    channels,
    transformers,
    profile,
    devices
  },
});

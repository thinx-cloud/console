import api from '../core/api';

export default {
    namespaced: true,
    state: {
        items: [
          /*
          {
            "id":"7038e0500a8690a8bf70d8470f46365458798011e8f46ff012f12cbcf898b2f4",
            "alias":"THiNX Vanilla ESP8266 Platform.io",
            "url":"git@github.com:suculent/thinx-firmware-esp8266-pio.git",
            "branch":"origin/master",
            "platform":"unknown_platform"
          }
          */
        ],
        headers: [
          {
            title: 'id',
            prop: 'id',
            pos: null,
          },
          {
            title: 'alias',
            prop: 'alias',
            pos: 0,
          },
          {
            title: 'url',
            prop: 'url',
            pos: null,
          },
          {
            title: 'branch',
            prop: 'branch',
            pos: 1,
          },
          {
            title: 'platform',
            prop: 'platform',
            pos: 2,
          },
        ]
    },
    mutations: {
      saveItems(state, data) { 
        let flatItems = [];
        for (let id of Object.keys(data.items)) {
          flatItems.push({id: id, ...data.items[id]});
        }
        state.items = flatItems;
      },
    },
    actions: {
      async fetchRepositories({ state, commit, rootState }) {
        const result = await api.$get('/source', rootState.auth.accessToken);        
        if (result.success) {
          commit('saveItems', { items: result.data });
        }
        return state.items;
      },
    },
    getters: {
        getItems(state) {
          return state.items;
        },
        getHeaders(state) {
          return state.headers;
        }
    },
  };

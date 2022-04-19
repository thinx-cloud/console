export default {
    namespaced: true,
    state: {
        repositories: [
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
      saveRepositories(state, data) { 
        let flatRepositories = [];
        for (let id of Object.keys(data.repositories)) {
          flatRepositories.push({id: id, ...data.repositories[id]});
        }
        state.repositories = flatRepositories;
      } 
    },
    actions: {
      async fetchRepositories({ state, commit, rootState }) {

        let accessToken = rootState.auth.accessToken;
        if (typeof rootState.auth.accessToken !== 'undefined') {
          accessToken = window.localStorage.getItem("accessToken");
        }
        
        const response = await fetch(process.env.VUE_APP_API_HOSTNAME + "/user/sources/list", {
          method: "GET",
          credentials: 'include',
          headers: {
            "Content-Type": "application/json",
            'Authorization': 'Bearer ' + accessToken,
            'Access-Control-Allow-Origin': 'http://localhost:3080',
          },
        });
        const { success, sources } = await response.json();
        
        if (success) {
          commit('saveRepositories', { repositories: sources });
        }
        return state.repositories;
      },
    },
    getters: {
        getItems(state) {
          return state.repositories;
        },
        getHeaders(state) {
          return state.headers;
        }
    },
  };

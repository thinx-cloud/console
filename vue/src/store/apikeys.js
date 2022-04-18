export default {
    namespaced: true,
    state: {
        items: [
          /*
          {
            "name": "******************************81d35b35a7ea1705e77b7d356a8447dcc3",
            "key": "55557c0229220a75e9946724f52a0481d35b35a7ea1705e77b7d356a8447dcc3",
            "hash": "5262bca2be441ec28998b16d059228ce990c9c8f67fcc617237fbac0a614a515",
            "alias": "Default MQTT API Key"
          }
          */
        ],
        headers: [
          {
            title: 'name',
            prop: 'name',
            pos: 3,
          },
          {
            title: 'key',
            prop: 'key',
            pos: 2,
          },
          {
            title: 'hash',
            prop: 'hash',
            pos: 1,
          },
          {
            title: 'alias',
            prop: 'alias',
            pos: 0,
          }
        ]
    },
    mutations: {
      saveItems(state, data) { 
        let flatItems = [];
        for (let id of Object.keys(data.items)) {
          flatItems.push({id: id, ...data.items[id]});
        }
        state.items = flatItems;
      } 
    },
    actions: {
      async fetchItems({ state, commit, rootState }) {

        let accessToken = rootState.auth.accessToken;
        if (typeof rootState.auth.accessToken !== 'undefined') {
          accessToken = window.localStorage.getItem("accessToken");
        }
        
        const response = await fetch( process.env.API_HOSTNAME + "/user/apikey/list", {
          method: "GET",
          credentials: 'include',
          headers: {
            "Content-Type": "application/json",
            'Authorization': 'Bearer ' + accessToken,
            'Access-Control-Allow-Origin': 'http://localhost:3080',
          },
        });
        const { success, api_keys } = await response.json();
        
        if (success) {
          commit('saveItems', { items: api_keys });
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

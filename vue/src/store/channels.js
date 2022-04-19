export default {
    namespaced: true,
    state: {
        items: [
          /*
          
              {"success":true,"mesh_ids":[{"mesh_id":"asd","alias":"teasd"}]}
          */
        ],
        headers: [
          {
            title: 'alias',
            prop: 'alias',
            pos: 0,
          },
          {
            title: 'mesh_id',
            prop: 'mesh_id',
            pos: 1,
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
        
        const response = await fetch(process.env.VUE_APP_API_HOSTNAME + "/mesh/list", {
          method: "GET",
          credentials: 'include',
          headers: {
            "Content-Type": "application/json",
            'Authorization': 'Bearer ' + accessToken,
            'Access-Control-Allow-Origin': 'http://localhost:3080',
          },
        });
        const { success, mesh_ids } = await response.json();
        
        if (success) {
          commit('saveItems', { items: mesh_ids });
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

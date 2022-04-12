export default {
    namespaced: true,
    state: {
        items: [
          /*
          
            buildlog: [
                
            ]
          
          */
        ],
        headers: [
          {
            title: 'name',
            prop: 'name',
            pos: 0,
          },
          {
            title: 'date',
            prop: 'date',
            pos: 1,
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
      saveBuildItems(state, data) { 
        console.log('saveBuildItems', data);
        state.items = data.items;
      },
    },
    actions: {
        async fetchBuildLog({ state, commit, rootState }) {

          let accessToken = rootState.auth.accessToken;
          if (typeof rootState.auth.accessToken !== 'undefined') {
              accessToken = window.localStorage.getItem("accessToken");
          }

          const response = await fetch("/user/logs/build/list", {
              method: "GET",
              credentials: 'include',
              headers: {
                  "Content-Type": "application/json",
                  'Authorization': 'Bearer ' + accessToken,
                  'Access-Control-Allow-Origin': 'http://localhost:3080',
              },
          });
          const { success, builds } = await response.json();
          if (success) {
              commit('saveBuildItems', { items: builds });
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

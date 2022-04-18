export default {
    namespaced: true,
    state: {
        items: [
          /*
          
            {"env_vars":["evnvar1","envvar2"]}

          */
        ],
        headers: [
          {
            title: 'id',
            prop: 'id',
            pos: 0,
          },
          {
            title: 'label',
            prop: 'label',
            pos: 1,
          },
          /*
          {
            title: 'date',
            prop: 'date',
            pos: 1,
          },
          
          {
            title: 'fingerprint',
            prop: 'fingerprint',
            pos: 2,
          },
          
          {
            title: 'pubkey',
            prop: 'pubkey',
            pos: 3,
          },
          {
            title: 'filename',
            prop: 'filename',
            pos: 4,
          }
          */
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
      saveSimpleArray(state, data) { 
        let flatItems = data.items.map((item, index) => {
            return{
                id: index,
                label: item,
            }
        });
        state.items = flatItems
      }
    },
    actions: {
      async fetchItems({ state, commit, rootState }) {

        let accessToken = rootState.auth.accessToken;
        if (typeof rootState.auth.accessToken !== 'undefined') {
          accessToken = window.localStorage.getItem("accessToken");
        }

        const response = await fetch( process.env.API_HOSTNAME + "/user/env/list", {
          method: "GET",
          credentials: 'include',
          headers: {
            "Content-Type": "application/json",
            'Authorization': 'Bearer ' + accessToken,
            'Access-Control-Allow-Origin': 'http://localhost:3080',
          },
        });
        const { env_vars } = await response.json();
        
        //if (success) {
          commit('saveSimpleArray', { items: env_vars });
        //}
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

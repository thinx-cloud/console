
export default {
    namespaced: true,
    state: {
        items: [
          /*
          
            auditlog: [
                {
                    "date": "2022-04-12T01:42:31.087Z",
                    "message": "OAuth2 User logged in...",
                    "flags": [
                        "info"
                    ]
                },
            ],
          
          */
        ],
        headers: [
          {
            title: 'date',
            prop: 'date',
            pos: 0,
          },
          {
            title: 'message',
            prop: 'message',
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
      saveAuditItems(state, data) {
        console.log('saveAuditItems', data); 
        state.items = data.items;
      }, 
    },
    actions: {
      async fetchAuditlog({ state, commit }) {
        const result = await this.$api.$get('/logs/audit');
        if (result.success) {
          commit('saveAuditItems', { items: result.response });
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

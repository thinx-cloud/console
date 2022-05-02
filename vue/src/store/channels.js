
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
      async fetchItems({ state, commit }) {
        const result = await this.$api.$get('/mesh');
        if (result.success) {
          commit('saveItems', { items: result.result });
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

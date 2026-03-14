
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
          commit('saveItems', { items: result.response });
        }
        return state.items;
      },
      async createItem({ dispatch }, { mesh_id, alias }) {
        const result = await this.$api.$put('/mesh', JSON.stringify({ mesh_id, alias }));
        if (result.success) await dispatch('fetchItems');
        return result;
      },
      async deleteItems({ dispatch }, mesh_ids) {
        const result = await this.$api.$delete('/mesh', JSON.stringify({ mesh_ids }));
        if (result.success) await dispatch('fetchItems');
        return result;
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

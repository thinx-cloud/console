import api from '../core/api';

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
        const response = await api.$get('/mesh', rootState.auth.accessToken);
        if (result.success) {
          commit('saveItems', { items: response.result });
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

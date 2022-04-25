import api from '../core/api';

export default {
    namespaced: true,
    state: {
        items: [
          /*
                {
                    "utid": "1",
                    "alias": "Pass-Through",
                    "body": "Ly8gTWluaW1hbCBgbm8tb3BgIFRyYW5zZm9ybWVyIChhbHdheXMgc3RhcnQgd2l0aCBjb21tZW50ISkKCnZhciB0cmFuc2Zvcm1lciA9IGZ1bmN0aW9uKHN0YXR1cywgZGV2aWNlKSB7CiAgICByZXR1cm4gc3RhdHVzOyAKfTs="
                }
          */
        ],
        headers: [
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
        const response = await api.$get('/profile', rootState.auth.accessToken);
        if (result.success) {
          commit('saveItems', { items: response.result.info.transformers });
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

import api from '../core/api';

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
        const result = await api.$get('/user/env/list', rootState.auth.accessToken);                
        if (result.success) {
          commit('saveSimpleArray', { items: result.data });
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

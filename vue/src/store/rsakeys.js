import api from '../core/api';

export default {
    namespaced: true,
    state: {
        items: [
          /*
          
              "name":"Sat Apr 14 2018 18:31:58 GMT+0000 (Coordinated Universal Time)",
              "fingerprint":"66955b5a84a8c78dae946204522e4724f062e6b747a16e94178ef65eb156a78e",
              "date":"Sat Apr 14 2018 18:31:58 GMT+0000 (Coordinated Universal Time)",
              "pubkey":"ssh-rsa AAAAB3NzaC1yc2EAAA"
              ,"filename":"cedc16bb6bb06daaa3ff6d3"
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
          /*
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
    },
    actions: {
      async fetchItems({ state, commit, rootState }) {
        const result = await api.$get('/rsakey', rootState.auth.accessToken);
        if (result.success) {
          commit('saveItems', { items: result.data });
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

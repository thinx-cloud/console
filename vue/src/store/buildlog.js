import api from '../core/api';

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
          const result = await api.$get('/user/logs/build/list', rootState.auth.accessToken);                
          if (result.success) {
            commit('saveBuildItems', { items: result.data });
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

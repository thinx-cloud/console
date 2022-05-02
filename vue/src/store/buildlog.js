
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
        async fetchBuildLog({ state, commit }) {
          const result = await this.$api.$get('/logs/build');
          if (result.success) {
            commit('saveBuildItems', { items: result.response });
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

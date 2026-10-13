
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
      async fetchItems({ state, commit }) {
        const result = await this.$api.$get('/env');
        if (result.success) {
          commit('saveSimpleArray', { items: result.response });
        }
        return state.items;
      },
      // The Environment Globals page load (UI-T25): like fetchItems, but a rejected request
      // or a failed answer throws, so the page can show its load error instead of a stuck
      // Loading line. fetchItems keeps its non-throwing behaviour for Devices.vue.
      async loadItems({ state, commit }) {
        const result = await this.$api.$get('/env');
        if (!result || !result.success || !Array.isArray(result.response)) {
          throw new Error('Could not load environment variables.');
        }
        commit('saveSimpleArray', { items: result.response });
        return state.items;
      },
      async createItem({ dispatch }, { key, value }) {
        const result = await this.$api.$put('/env', JSON.stringify({ key, value }));
        if (result.success) await dispatch('fetchItems');
        return result;
      },
      async deleteItems({ dispatch }, names) {
        const result = await this.$api.$delete('/env', JSON.stringify({ names }));
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

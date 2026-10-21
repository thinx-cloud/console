
// A write the server stored stays a success when only the follow-up list read fails (the
// Phase 35 IN-02 / 46-02 pattern): it resolves with refreshed: false and the page reloads,
// instead of telling the user the write failed.
async function refreshAfter(dispatch, result) {
  if (!result || !result.success) return result;
  try {
    await dispatch('fetchItems');
  } catch (e) {
    return Object.assign({}, result, { refreshed: false });
  }
  return result;
}

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
      // A refused or empty reply keeps the current list; a network failure throws, so
      // Devices.vue shows its load error (48-REVIEW CR-01). refreshAfter catches it.
      async fetchItems({ state, commit }) {
        const result = await this.$api.$get('/env');
        if (result.success) {
          commit('saveSimpleArray', { items: result.response || [] });
        } else if (result.networkError) {
          throw new Error('Could not reach the server.');
        }
        return state.items;
      },
      // The Environment Globals page load (UI-T25): like fetchItems, but a rejected request
      // or any failed answer throws, so the page can show its load error instead of a stuck
      // Loading line. fetchItems throws only on a network failure.
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
        return refreshAfter(dispatch, result);
      },
      async deleteItems({ dispatch }, names) {
        const result = await this.$api.$delete('/env', JSON.stringify({ names }));
        return refreshAfter(dispatch, result);
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

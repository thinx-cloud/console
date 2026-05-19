
export default {
    namespaced: true,
    state: {
        items: [],
        headers: [
          {
            title: 'alias',
            prop: 'alias',
            pos: 0,
          }
        ]
    },
    mutations: {
      saveItems(state, transformers) {
        if (!Array.isArray(transformers)) {
          state.items = [];
          return;
        }
        state.items = transformers.map((t, index) => ({ id: t.utid || String(index), ...t }));
      }
    },
    actions: {
      async fetchItems({ state, commit }) {
        const result = await this.$api.$get('/profile');
        if (result.success && result.response && result.response.info) {
          commit('saveItems', result.response.info.transformers || []);
        }
        return state.items;
      },
      async saveTransformers({ dispatch }, transformers) {
        const result = await this.$api.$post('/profile', JSON.stringify({
          info: { transformers }
        }));
        if (result.success) await dispatch('fetchItems');
        return result;
      },
      async createItem({ state, dispatch }, alias) {
        await dispatch('fetchItems');
        const utid = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
        const defaultBody = btoa('// Minimal no-op Transformer\n\nvar transformer = function(status, device) {\n    return status;\n};');
        const transformers = [...state.items.map(t => ({ utid: t.utid, alias: t.alias, body: t.body })), { utid, alias, body: defaultBody }];
        return dispatch('saveTransformers', transformers);
      },
      async updateItem({ state, dispatch }, { utid, alias, body }) {
        const transformers = state.items.map(t =>
          t.utid === utid
            ? { utid, alias, body: btoa(body) }
            : { utid: t.utid, alias: t.alias, body: t.body }
        );
        return dispatch('saveTransformers', transformers);
      },
      async deleteItem({ state, dispatch }, utid) {
        const transformers = state.items
          .filter(t => t.utid !== utid)
          .map(t => ({ utid: t.utid, alias: t.alias, body: t.body }));
        return dispatch('saveTransformers', transformers);
      },
    },
    getters: {
        getItems(state) {
          return state.items;
        },
        getHeaders(state) {
          return state.headers;
        },
        getByUtid: (state) => (utid) => {
          return state.items.find(t => t.utid === utid);
        },
    },
  };

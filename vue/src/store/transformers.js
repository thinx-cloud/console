
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
      // Transformers are stored inside the user profile document.
      // No dedicated GET /transformer endpoint exists on the backend.
      // The only read path is GET /api/v2/profile → response.info.transformers.
      // The write path is POST /api/v2/profile with { info: { transformers: [...] } }
      // — no /transformer CRUD routes exist on the server.
      async fetchItems({ state, commit }) {
        const result = await this.$api.$get('/profile');
        if (!result || !result.success || !result.response || !result.response.info) {
          throw new Error('Could not load transformers.');
        }
        commit('saveItems', result.response.info.transformers || []);
        return state.items;
      },
      async saveTransformers({ dispatch }, transformers) {
        // The console reads info.transformers. A top-level write is invisible
        // on reload. Use an info patch; the users/edit handler merges info fields.
        const result = await this.$api.$post('/profile', JSON.stringify({ info: { transformers } }));
        if (result.success) await dispatch('fetchItems');
        return result;
      },
      async createItem({ state, dispatch }, payload) {
        await dispatch('fetchItems');
        const alias = typeof payload === 'string' ? payload : payload.alias;
        const body = typeof payload === 'string' ? null : payload.body;
        const utid = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
        const defaultBody = btoa('// Minimal no-op Transformer\n\nvar transformer = function(status, device) {\n    return status;\n};');
        const transformers = [...state.items.map(t => ({ utid: t.utid, alias: t.alias, body: t.body })), { utid, alias, body: body == null ? defaultBody : btoa(unescape(encodeURIComponent(body))) }];
        const result = await dispatch('saveTransformers', transformers);
        return Object.assign({}, result, { utid });
      },
      async updateItem({ state, dispatch }, { utid, alias, body }) {
        await dispatch('fetchItems');
        const transformers = state.items.map(t =>
          t.utid === utid
            ? { utid, alias, body: btoa(unescape(encodeURIComponent(body))) }
            : { utid: t.utid, alias: t.alias, body: t.body }
        );
        return dispatch('saveTransformers', transformers);
      },
      async deleteItem({ state, dispatch }, utid) {
        await dispatch('fetchItems');
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

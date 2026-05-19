/**
 * @typedef {Object} TransformerHeader
 * @property {string} title - Display label for the column.
 * @property {string} prop - Transformer property key.
 * @property {number} pos - Column sort position.
 */

/**
 * @typedef {Object} TransformerItem
 * @property {string} id - Synthetic row id (utid, or stringified index as fallback).
 * @property {string} utid - Unique transformer identifier (UUID).
 * @property {string} alias - Human-readable transformer name.
 * @property {string} body - Base64-encoded JavaScript transformer source.
 */

/**
 * @typedef {Object} TransformersState
 * @property {TransformerItem[]} items - Flat list of transformer records.
 * @property {TransformerHeader[]} headers - Column definitions for the transformer table.
 */

/**
 * Vuex module for transformer management.
 * Transformers are stored server-side inside the user profile's `info.transformers` array.
 * All mutations go through `saveTransformers`, which POSTs the full array to `/profile`.
 */
export default {
    namespaced: true,
    /** @type {TransformersState} */
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
      /**
       * Replaces the transformer list. Clears state when `transformers` is not an array.
       * Assigns a synthetic `id` from `utid`, falling back to the array index.
       * @param {TransformersState} state
       * @param {TransformerItem[]|*} transformers - Raw transformer array from the API.
       */
      saveItems(state, transformers) {
        if (!Array.isArray(transformers)) {
          state.items = [];
          return;
        }
        state.items = transformers.map((t, index) => ({ id: t.utid || String(index), ...t }));
      }
    },
    actions: {
      /**
       * Fetches transformers from the user profile and commits them to state.
       * @returns {Promise<TransformerItem[]>} The updated transformer list.
       */
      async fetchItems({ state, commit }) {
        const result = await this.$api.$get('/profile');
        if (result.success && result.response && result.response.info) {
          commit('saveItems', result.response.info.transformers || []);
        }
        return state.items;
      },
      /**
       * Persists the full transformer array to the server profile, then refreshes state.
       * @param {Object} context
       * @param {TransformerItem[]} transformers - Complete transformer array to save.
       * @returns {Promise<ApiResult>}
       */
      async saveTransformers({ dispatch }, transformers) {
        const result = await this.$api.$post('/profile', JSON.stringify({
          info: { transformers }
        }));
        if (result.success) await dispatch('fetchItems');
        return result;
      },
      /**
       * Creates a new transformer with a no-op default body and a generated UTID.
       * @param {Object} context
       * @param {string} alias - Display name for the new transformer.
       * @returns {Promise<ApiResult>}
       */
      async createItem({ state, dispatch }, alias) {
        await dispatch('fetchItems');
        const utid = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
        const defaultBody = btoa('// Minimal no-op Transformer\n\nvar transformer = function(status, device) {\n    return status;\n};');
        const transformers = [...state.items.map(t => ({ utid: t.utid, alias: t.alias, body: t.body })), { utid, alias, body: defaultBody }];
        return dispatch('saveTransformers', transformers);
      },
      /**
       * Updates a single transformer's alias and body (body is base64-encoded before saving).
       * @param {Object} context
       * @param {{ utid: string, alias: string, body: string }} payload - Plain-text body.
       * @returns {Promise<ApiResult>}
       */
      async updateItem({ state, dispatch }, { utid, alias, body }) {
        const transformers = state.items.map(t =>
          t.utid === utid
            ? { utid, alias, body: btoa(body) }
            : { utid: t.utid, alias: t.alias, body: t.body }
        );
        return dispatch('saveTransformers', transformers);
      },
      /**
       * Removes a transformer by UTID and saves the remaining list.
       * @param {Object} context
       * @param {string} utid - UTID of the transformer to delete.
       * @returns {Promise<ApiResult>}
       */
      async deleteItem({ state, dispatch }, utid) {
        const transformers = state.items
          .filter(t => t.utid !== utid)
          .map(t => ({ utid: t.utid, alias: t.alias, body: t.body }));
        return dispatch('saveTransformers', transformers);
      },
    },
    getters: {
        /**
         * @param {TransformersState} state
         * @returns {TransformerItem[]} All transformer records.
         */
        getItems(state) {
          return state.items;
        },
        /**
         * @param {TransformersState} state
         * @returns {TransformerHeader[]} Table column definitions.
         */
        getHeaders(state) {
          return state.headers;
        },
        /**
         * Returns a transformer lookup function by UTID.
         * @param {TransformersState} state
         * @returns {function(string): TransformerItem|undefined}
         */
        getByUtid: (state) => (utid) => {
          return state.items.find(t => t.utid === utid);
        },
    },
  };

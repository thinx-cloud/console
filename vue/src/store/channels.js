/**
 * @typedef {Object} ChannelHeader
 * @property {string} title - Display label for the column.
 * @property {string} prop - Channel property key.
 * @property {number} pos - Column sort position.
 */

/**
 * @typedef {Object} ChannelItem
 * @property {string} id - Synthetic row identifier (same as the map key).
 * @property {string} mesh_id - Unique mesh channel identifier.
 * @property {string} alias - Human-readable channel name.
 */

/**
 * @typedef {Object} ChannelsState
 * @property {ChannelItem[]} items - Flat list of mesh channel records.
 * @property {ChannelHeader[]} headers - Column definitions for the channel table.
 */

/**
 * Vuex module for mesh channel management.
 * Handles fetching, creating, and deleting mesh channels.
 */
export default {
    namespaced: true,
    /** @type {ChannelsState} */
    state: {
        items: [
          /*

              {"success":true,"mesh_ids":[{"mesh_id":"asd","alias":"teasd"}]}
          */
        ],
        headers: [
          {
            title: 'alias',
            prop: 'alias',
            pos: 0,
          },
          {
            title: 'mesh_id',
            prop: 'mesh_id',
            pos: 1,
          }
        ]
    },
    mutations: {
      /**
       * Replaces the channel list from a keyed API response object.
       * @param {ChannelsState} state
       * @param {{ items: Record<string, Object> }} data - Map of channel id → channel data.
       */
      saveItems(state, data) {
        let flatItems = [];
        for (let id of Object.keys(data.items)) {
          flatItems.push({id: id, ...data.items[id]});
        }
        state.items = flatItems;
      }
    },
    actions: {
      /**
       * Fetches all mesh channels and commits them to state.
       * @returns {Promise<ChannelItem[]>} The updated channel list.
       */
      async fetchItems({ state, commit }) {
        const result = await this.$api.$get('/mesh');
        if (result.success) {
          commit('saveItems', { items: result.response });
        }
        return state.items;
      },
      /**
       * Creates a new mesh channel, then refreshes the list.
       * @param {Object} context
       * @param {{ mesh_id: string, alias: string }} payload
       * @returns {Promise<ApiResult>}
       */
      async createItem({ dispatch }, { mesh_id, alias }) {
        const result = await this.$api.$put('/mesh', JSON.stringify({ mesh_id, alias }));
        if (result.success) await dispatch('fetchItems');
        return result;
      },
      /**
       * Deletes one or more mesh channels, then refreshes the list.
       * @param {Object} context
       * @param {string[]} mesh_ids - Array of mesh channel IDs to delete.
       * @returns {Promise<ApiResult>}
       */
      async deleteItems({ dispatch }, mesh_ids) {
        const result = await this.$api.$delete('/mesh', JSON.stringify({ mesh_ids }));
        if (result.success) await dispatch('fetchItems');
        return result;
      },
    },
    getters: {
        /**
         * @param {ChannelsState} state
         * @returns {ChannelItem[]} All channel records.
         */
        getItems(state) {
          return state.items;
        },
        /**
         * @param {ChannelsState} state
         * @returns {ChannelHeader[]} Table column definitions.
         */
        getHeaders(state) {
          return state.headers;
        }
    },
  };

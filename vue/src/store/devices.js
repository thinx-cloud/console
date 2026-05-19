/**
 * @typedef {Object} DeviceHeader
 * @property {string} title - Display label for the column.
 * @property {string} prop - Device property key.
 * @property {number} pos - Column sort position.
 */

/**
 * @typedef {Object} DevicesState
 * @property {Object[]} items - Flat list of device records (udid aliased to id).
 * @property {DeviceHeader[]} headers - Column definitions for the device table.
 */

/**
 * Vuex module for device management.
 * Handles fetching, updating, revoking, firmware builds, and device transfers.
 */
export default {
    namespaced: true,
    /** @type {DevicesState} */
    state: {
        items: [],
        headers: [
          {
            title: 'alias',
            prop: 'alias',
            pos: 0,
          },
          {
            title: 'platform',
            prop: 'platform',
            pos: 1,
          },
          {
            title: 'firmware',
            prop: 'firmware',
            pos: 2,
          },
          {
            title: 'status',
            prop: 'status',
            pos: 3,
          },
        ]
    },
    mutations: {
      /**
       * Replaces the device list, normalising each entry so `id === udid`.
       * @param {DevicesState} state
       * @param {{ items: Object[] }} data - Raw device array from the API.
       */
      saveDevices(state, data) {
        let flatItems = [];
        for (let item of data.items) {
          flatItems.push({ ...item, id: item.udid });
        }
        state.items = flatItems;
      }
    },
    actions: {
      /**
       * Fetches all devices for the current user and commits them to state.
       * @returns {Promise<Object[]>} The updated device list.
       */
      async fetchItems({ state, commit }) {
        const result = await this.$api.$get('/device');
        if (result.success) {
          commit('saveDevices', { items: result.response });
        }
        return state.items;
      },
      /**
       * Deletes one or more devices by UDID, then refreshes the list.
       * @param {Object} context
       * @param {string[]} udids - Array of device UDIDs to revoke.
       * @returns {Promise<ApiResult>}
       */
      async revokeDevices({ dispatch }, udids) {
        const result = await this.$api.$delete('/device', JSON.stringify({ udids }));
        if (result.success) await dispatch('fetchItems');
        return result;
      },
      /**
       * Pushes environment configuration to one or more devices.
       * @param {Object} context
       * @param {{ udids: string[], enviros: Object, reset_devices: boolean }} payload
       * @returns {Promise<ApiResult>}
       */
      async pushConfiguration({ dispatch }, { udids, enviros, reset_devices }) {
        const result = await this.$api.$post('/device/configuration', JSON.stringify({ udids, enviros, reset_devices }));
        return result;
      },
      /**
       * Triggers a firmware build for the specified device.
       * @param {Object} context
       * @param {string} udid - Target device UDID.
       * @returns {Promise<ApiResult>}
       */
      async buildFirmware({ dispatch }, udid) {
        const result = await this.$api.$post('/build', JSON.stringify({ build: { udid } }));
        return result;
      },
      /**
       * Initiates a device transfer to another owner.
       * @param {Object} context
       * @param {{ udids: string[], to: string, mig_sources: string[], mig_apikeys: string[] }} payload
       * @returns {Promise<ApiResult>}
       */
      async transferDevices({ dispatch }, { udids, to, mig_sources, mig_apikeys }) {
        const result = await this.$api.$post('/transfer/request', JSON.stringify({ udids, to, mig_sources, mig_apikeys }));
        return result;
      },
      /**
       * Applies a partial update to a single device.
       * @param {Object} context
       * @param {{ udid: string, changes: Object }} payload
       * @returns {Promise<ApiResult>}
       */
      async updateDevice({ dispatch }, { udid, changes }) {
        const result = await this.$api.$post('/device', JSON.stringify({ udid, changes }));
        return result;
      },
    },
    getters: {
        /**
         * @param {DevicesState} state
         * @returns {Object[]} All device records.
         */
        getItems(state) {
          return state.items;
        },
        /**
         * @param {DevicesState} state
         * @returns {DeviceHeader[]} Table column definitions.
         */
        getHeaders(state) {
          return state.headers;
        },
        /**
         * Returns a device lookup function by UDID.
         * @param {DevicesState} state
         * @returns {function(string): Object|undefined}
         */
        getByUdid: (state) => (udid) => {
          return state.items.find(d => d.udid === udid);
        },
    },
  };

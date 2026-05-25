
export default {
    namespaced: true,
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
      saveDevices(state, data) {
        let flatItems = [];
        for (let item of data.items) {
          flatItems.push({ ...item, id: item.udid });
        }
        state.items = flatItems;
      }
    },
    actions: {
      async fetchItems({ state, commit }) {
        const result = await this.$api.$get('/device');
        if (result.success) {
          commit('saveDevices', { items: result.response });
        }
        return state.items;
      },
      async revokeDevices({ dispatch }, udids) {
        const result = await this.$api.$delete('/device', JSON.stringify({ udids }));
        if (result.success) await dispatch('fetchItems');
        return result;
      },
      async pushConfiguration({ dispatch: _dispatch }, { udids, enviros, reset_devices }) {
        const result = await this.$api.$post('/device/configuration', JSON.stringify({ udids, enviros, reset_devices }));
        return result;
      },
      async buildFirmware({ dispatch: _dispatch }, { udid, source_id }) {
        const result = await this.$api.$post('/build', JSON.stringify({ build: { udid, source_id, dryrun: false } }));
        return result;
      },
      async transferDevices({ dispatch: _dispatch }, { udids, to, mig_sources, mig_apikeys }) {
        const result = await this.$api.$post('/transfer/request', JSON.stringify({ udids, to, mig_sources, mig_apikeys }));
        return result;
      },
      async updateDevice({ dispatch: _dispatch }, { udid, changes }) {
        // PUT /api/v2/device -> editDevice. POST is getDeviceDetail (read).
        // editDevice reads req.body.changes and requires changes.udid.
        const result = await this.$api.$put('/device', JSON.stringify({ changes: { udid, ...changes } }));
        return result;
      },
    },
    getters: {
        getItems(state) {
          return state.items;
        },
        getHeaders(state) {
          return state.headers;
        },
        getByUdid: (state) => (udid) => {
          return state.items.find(d => d.udid === udid);
        },
    },
  };

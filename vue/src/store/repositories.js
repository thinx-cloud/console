
// A write the server stored stays a success when only the follow-up list read fails (the
// Phase 35 IN-02 / 46-02 pattern): it resolves with refreshed: false and the page reloads,
// instead of telling the user the write failed. The follow-up read is fetchRepositories.
async function refreshAfter(dispatch, result) {
  if (!result || !result.success) return result;
  try {
    await dispatch('fetchRepositories');
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
          {
            "id":"7038e0500a8690a8bf70d8470f46365458798011e8f46ff012f12cbcf898b2f4",
            "alias":"THiNX Vanilla ESP8266 Platform.io",
            "url":"git@github.com:suculent/thinx-firmware-esp8266-pio.git",
            "branch":"origin/master",
            "platform":"unknown_platform"
          }
          */
        ],
        // REPO-05: GET /source does not return a device count. Backend change required before this column can be added.
        headers: [
          {
            title: 'id',
            prop: 'id',
            pos: null,
          },
          {
            title: 'alias',
            prop: 'alias',
            pos: 0,
          },
          {
            title: 'url',
            prop: 'url',
            pos: null,
          },
          {
            title: 'branch',
            prop: 'branch',
            pos: 1,
          },
          {
            title: 'platform',
            prop: 'platform',
            pos: 2,
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
    },
    actions: {
      // A refused or empty reply keeps the current list. A request that never got a
      // response (result.networkError) throws, so Repositories.vue shows its load error and
      // no stale rows instead of a silent empty list (audit W2, 48-REVIEW CR-01 pattern);
      // DeviceDetail reads it through allSettled. refreshAfter catches it for the follow-up
      // read of a write.
      async fetchRepositories({ state, commit }) {
        const result = await this.$api.$get('/source');
        if (result.success) {
          commit('saveItems', { items: result.response || [] });
        } else if (result.networkError) {
          throw new Error('Could not reach the server.');
        }
        return state.items;
      },
      // Delegates, so it rejects with fetchRepositories.
      async fetchItems({ dispatch }) {
        return dispatch('fetchRepositories');
      },
      async createItem({ dispatch }, payload) {
        const result = await this.$api.$put('/source', JSON.stringify(payload));
        return refreshAfter(dispatch, result);
      },
      async deleteItems({ dispatch }, source_ids) {
        const result = await this.$api.$delete('/source', JSON.stringify({ source_ids }));
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

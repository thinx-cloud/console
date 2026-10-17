
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
      saveItems(state, data) { 
        let flatItems = [];
        for (let id of Object.keys(data.items)) {
          flatItems.push({id: id, ...data.items[id]});
        }
        state.items = flatItems;
      } 
    },
    actions: {
      // A refused or empty reply keeps the current list. A request that never got a
      // response (result.networkError) throws, so Channels.vue shows its load error and no
      // stale rows instead of a silent empty list (audit W2, 48-REVIEW CR-01 pattern).
      // refreshAfter catches it for the follow-up read of a write.
      async fetchItems({ state, commit }) {
        const result = await this.$api.$get('/mesh');
        if (result.success) {
          commit('saveItems', { items: result.response || [] });
        } else if (result.networkError) {
          throw new Error('Could not reach the server.');
        }
        return state.items;
      },
      async createItem({ dispatch }, { mesh_id, alias }) {
        const result = await this.$api.$put('/mesh', JSON.stringify({ mesh_id, alias }));
        return refreshAfter(dispatch, result);
      },
      async deleteItems({ dispatch }, mesh_ids) {
        const result = await this.$api.$delete('/mesh', JSON.stringify({ mesh_ids }));
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

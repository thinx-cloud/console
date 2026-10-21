
// Legacy console visibility contract (apikey.html line 96):
//   <i class="fa fa-key"></i> {{apikey.name | limitTo : 10 : apikey.name.length - 10}}
//   <span class="apikey-alias">{{apikey.alias}}</span>
// — i.e. the list shows ONLY the alias and the last 10 chars of `name` (the
// pre-masked fingerprint the backend returns). The full key (`api_key`) is shown ONCE
// in the create-result modal, then never again. The `hash` is internal-only
// (used for delete operations) — never in the UI.

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
        // Items from GET /apikey are {name, hash, alias}; the key itself is never listed.
        items: [],
        // Only Alias + masked Key shown in the list. `hash` stays on items[]
        // for the delete flow but is never rendered (pos: null hides it from
        // List.vue's filteredHeaders).
        headers: [
          { title: 'Alias',  prop: 'alias',   pos: 0 },
          { title: 'Key',    prop: 'display', pos: 1 },
          { title: 'hash',   prop: 'hash',    pos: null },
          { title: 'name',   prop: 'name',    pos: null },
        ]
    },
    mutations: {
      saveItems(state, data) {
        let flatItems = [];
        for (let id of Object.keys(data.items)) {
          const item = data.items[id];
          // display = last 10 chars of name (matches legacy `limitTo : 10 : length-10`)
          const name = item.name || '';
          const display = name.length > 10 ? '…' + name.slice(-10) : name;
          flatItems.push({ id: id, display, ...item });
        }
        state.items = flatItems;
      }
    },
    actions: {
      // A refused or empty reply keeps the current list. A request that never got a
      // response (result.networkError) throws, so Apikeys.vue shows its load error and no
      // stale rows instead of a silent empty list (audit W2, 48-REVIEW CR-01 pattern).
      // refreshAfter catches it for the follow-up read of a write.
      async fetchItems({ state, commit }) {
        const result = await this.$api.$get('/apikey');
        if (result.success) {
          commit('saveItems', { items: result.response || [] });
        } else if (result.networkError) {
          throw new Error('Could not reach the server.');
        }
        return state.items;
      },
      async createItem({ dispatch }, alias) {
        const result = await this.$api.$post('/apikey', JSON.stringify({ alias }));
        return refreshAfter(dispatch, result);
      },
      async deleteItems({ dispatch }, fingerprints) {
        const result = await this.$api.$delete('/apikey', JSON.stringify({ fingerprints }));
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

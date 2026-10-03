
// Legacy console visibility contract (apikey.html line 96):
//   <i class="fa fa-key"></i> {{apikey.name | limitTo : 10 : apikey.name.length - 10}}
//   <span class="apikey-alias">{{apikey.alias}}</span>
// — i.e. the list shows ONLY the alias and the last 10 chars of `name` (the
// pre-masked fingerprint the backend returns). The full key (`api_key`) is shown ONCE
// in the create-result modal, then never again. The `hash` is internal-only
// (used for delete operations) — never in the UI.
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
      async fetchItems({ state, commit }) {
        const result = await this.$api.$get('/apikey');
        if (result.success) {
          commit('saveItems', { items: result.response });
        }
        return state.items;
      },
      async createItem({ dispatch }, alias) {
        const result = await this.$api.$post('/apikey', JSON.stringify({ alias }));
        if (result.success) await dispatch('fetchItems');
        return result;
      },
      async deleteItems({ dispatch }, fingerprints) {
        const result = await this.$api.$delete('/apikey', JSON.stringify({ fingerprints }));
        if (result.success) await dispatch('fetchItems');
        return result;
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

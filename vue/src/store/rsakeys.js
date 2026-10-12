
export default {
    namespaced: true,
    state: {
        items: [
          /*
          
              "name":"Sat Apr 14 2018 18:31:58 GMT+0000 (Coordinated Universal Time)",
              "fingerprint":"66955b5a84a8c78dae946204522e4724f062e6b747a16e94178ef65eb156a78e",
              "date":"Sat Apr 14 2018 18:31:58 GMT+0000 (Coordinated Universal Time)",
              "pubkey":"ssh-rsa AAAAB3NzaC1yc2EAAA"
              ,"filename":"cedc16bb6bb06daaa3ff6d3"
          */
        ],
        headers: [
          {
            title: 'name',
            prop: 'name',
            pos: 0,
          },
          {
            title: 'date',
            prop: 'date',
            pos: 1,
          },
          /*
          {
            title: 'fingerprint',
            prop: 'fingerprint',
            pos: 2,
          },
          
          {
            title: 'pubkey',
            prop: 'pubkey',
            pos: 3,
          },
          {
            title: 'filename',
            prop: 'filename',
            pos: 4,
          }
          */
        ]
    },
    mutations: {
      saveItems(state, data) { 
        let flatItems = [];
        for (let id of Object.keys(data.items)) {
          flatItems.push({ ...data.items[id], id: data.items[id].filename || id });
        }
        state.items = flatItems.sort((a, b) => new Date(b.date) - new Date(a.date));
      },
    },
    actions: {
      async fetchItems({ state, commit }) {
        // api.js turns 401/5xx/non-JSON into { success: false } without throwing.
        // Throw here (like transformers/fetchItems) so the page reports the
        // failure instead of showing an empty "No deploy keys yet." (35 WR-05).
        const result = await this.$api.$get('/rsakey');
        if (!result || !result.success) throw new Error('Could not load deploy keys.');
        commit('saveItems', { items: result.response || [] });
        return state.items;
      },
      async createItem({ dispatch }, name) {
        const result = await this.$api.$put('/rsakey', JSON.stringify({ name }));
        // A failed refresh must not turn a created key into a reported failure;
        // the page reloads the list itself and reports a load error there.
        if (result.success) await dispatch('fetchItems').catch(() => {});
        return result;
      },
      async deleteItems({ dispatch }, filenames) {
        const result = await this.$api.$delete('/rsakey', JSON.stringify({ filenames }));
        if (result.success) await dispatch('fetchItems').catch(() => {});
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

import { PAGE_SIZE, normPaging, pagedPath } from './logPaging';

const AUDIT_PATH = '/logs/audit';

export default {
    namespaced: true,
    state: {
        // Paging of the first page in `items` (phase 26). Further pages are
        // fetched with fetchAuditPage and kept by the caller (History.vue).
        paging: { limit: PAGE_SIZE, has_more: false, next_cursor: null },
        items: [
          /*
          
            auditlog: [
                {
                    "date": "2022-04-12T01:42:31.087Z",
                    "message": "OAuth2 User logged in...",
                    "flags": [
                        "info"
                    ]
                },
            ],
          
          */
        ],
        headers: [
          {
            title: 'date',
            prop: 'date',
            pos: 0,
          },
          {
            title: 'message',
            prop: 'message',
            pos: 1,
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
      saveAuditItems(state, data) {
        state.items = data.items;
      },
      savePaging(state, paging) {
        state.paging = normPaging(paging);
      },
    },
    actions: {
      // First page (newest 100) for every consumer: dashboard, History (D-02, D-04).
      async fetchAuditlog({ state, commit }) {
        const result = await this.$api.$get(pagedPath(AUDIT_PATH, null));
        if (result.success) {
          commit('saveAuditItems', { items: result.response });
          commit('savePaging', normPaging(result.paging));
        }
        return state.items;
      },
      // One further page. Never mutates state and never throws: the caller owns
      // the appended list, so a background first-page refresh cannot reset it.
      async fetchAuditPage(ctx, { cursor } = {}) {
        try {
          const result = await this.$api.$get(pagedPath(AUDIT_PATH, cursor));
          if (!result || !result.success) return { ok: false };
          return {
            ok: true,
            items: Array.isArray(result.response) ? result.response : [],
            paging: normPaging(result.paging),
          };
        } catch (e) {
          return { ok: false };
        }
      },
    },
    getters: {
        getPaging(state) {
          return state.paging;
        },
        getItems(state) {
          return state.items;
        },
        getHeaders(state) {
          return state.headers;
        }
    },
  };

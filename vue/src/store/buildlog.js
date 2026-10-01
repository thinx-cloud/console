import { PAGE_SIZE, normPaging, pagedPath } from './logPaging';

const BUILD_PATH = '/logs/build';

export default {
    namespaced: true,
    state: {
        // Paging of the first page in `items` (phase 26). Further pages are
        // fetched with fetchBuildPage and kept by the caller (History.vue).
        paging: { limit: PAGE_SIZE, has_more: false, next_cursor: null },
        items: [
          /*
          
            buildlog: [
                
            ]
          
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
      saveBuildItems(state, data) { 
        state.items = data.items;
      },
      savePaging(state, paging) {
        state.paging = normPaging(paging);
      },
    },
    actions: {
        // First page (newest 100) for every consumer: Header, Notifications,
        // DeviceDetail, the dashboard and History (D-02, D-04).
        async fetchBuildLog({ state, commit }) {
          const result = await this.$api.$get(pagedPath(BUILD_PATH, null));
          if (result.success) {
            commit('saveBuildItems', { items: normalizeBuildItems(result.response) });
            commit('savePaging', normPaging(result.paging));
          }
          return state.items;
        },
        // One further page, normalized like the first. Never mutates state and
        // never throws: the caller owns the appended list.
        async fetchBuildPage(ctx, { cursor } = {}) {
          try {
            const result = await this.$api.$get(pagedPath(BUILD_PATH, cursor));
            if (!result || !result.success) return { ok: false };
            return {
              ok: true,
              items: normalizeBuildItems(result.response),
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

function normalizeBuildItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item, index) => {
    const latestLog = Array.isArray(item.log) && item.log.length ? item.log[item.log.length - 1] : {};
    const entries = Array.isArray(latestLog.log) ? latestLog.log : [];
    const latestEntry = entries.length ? entries[entries.length - 1] : {};

    return {
      id: item._id || latestLog.build_id || latestLog.udid || String(index),
      build_id: latestLog.build_id || item._id || '',
      // Flat builds come back as {date, udid} (Buildlog.toBuildListItem), so fall back to those.
      udid: latestLog.udid || latestEntry.udid || item.udid || '',
      date: latestEntry.last_update || latestLog.last_update || latestLog.timestamp || item.last_update || item.date || '',
      name: item.name || latestLog.alias || latestEntry.alias || '',
      status: normalizeStatus(item.state || latestLog.state || latestEntry.state || latestEntry.message),
      log: entries
        .map(entry => entry.contents || entry.message)
        .filter(Boolean),
      raw: item,
    };
  });
}

function normalizeStatus(value) {
  const status = (value || '').toString().trim().toUpperCase();
  if (!status) {
    return 'UNKNOWN';
  }
  if (status === 'COMPLETED' || status === 'SUCCESS') {
    return 'OK';
  }
  if (status === 'CREATED' || status === 'BUILDING') {
    return 'RUNNING';
  }
  return status;
}

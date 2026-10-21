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
        async fetchBuildDetail(ctx, buildId) {
          if (!buildId) return { success: false };
          return this.$api.$get('/logs/build/' + encodeURIComponent(buildId));
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

export function normalizeBuildItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => {
    const logs = Array.isArray(item.log) ? item.log.filter(Boolean) : [];
    const latestLog = logs.length ? logs[logs.length - 1] : {};
    const entries = Array.isArray(latestLog.log) ? latestLog.log : logs;
    const latestEntry = entries.length ? entries[entries.length - 1] : {};
    const started = item.start_time || latestLog.start_time || item.timestamp || latestLog.timestamp || item.date;
    return {
      id: item._id || item.build_id || latestLog.build_id || String(index),
      build_id: item.build_id || latestLog.build_id || item._id || '',
      udid: item.udid || latestLog.udid || latestEntry.udid || '',
      date: item.last_update || latestEntry.last_update || latestLog.last_update || item.timestamp || latestLog.timestamp || item.date || '',
      name: item.name || item.alias || latestLog.alias || latestEntry.alias || '',
      status: normalizeStatus(item.state || latestLog.state || latestEntry.state || latestEntry.message, started),
      log: entries.map(entry => entry.contents || entry.message).filter(Boolean),
      raw: item,
    };
  });
}

export function normalizeStatus(value, started, now = Date.now()) {
  const status = (value || '').toString().trim().toUpperCase();
  if (!status) return 'UNKNOWN';
  if (/TIME[ -]?OUT|TIMED[ -]?OUT|ETIMEDOUT/.test(status)) return 'TIMEOUT';
  if (['COMPLETED', 'SUCCESS', 'OK'].includes(status)) return 'OK';
  if (['CREATED', 'BUILDING', 'RUNNING', 'STARTED', 'START'].includes(status)) {
    // queue_action.js expires a running build after 20 minutes. Old build
    // documents can retain their initial state when a worker never reports back.
    const timestamp = new Date(started).getTime();
    return Number.isFinite(timestamp) && now - timestamp >= 20 * 60 * 1000 ? 'TIMEOUT' : 'RUNNING';
  }
  return status;
}

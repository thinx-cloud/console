
export default {
    namespaced: true,
    state: {
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
    },
    actions: {
        async fetchBuildLog({ state, commit }) {
          const result = await this.$api.$get('/logs/build');
          if (result.success) {
            commit('saveBuildItems', { items: normalizeBuildItems(result.response) });
          }
          return state.items;
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
      udid: latestLog.udid || latestEntry.udid || '',
      date: latestEntry.last_update || latestLog.last_update || latestLog.timestamp || item.last_update || '',
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

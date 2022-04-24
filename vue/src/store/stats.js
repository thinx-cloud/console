import api from '../core/api';

export default {
    namespaced: true,
    state: {
        stats: null,
    },
    mutations: {
        saveStats(state, data) {
          state.stats = data;
        },
      },
    actions: {
        async fetchStats({ state, commit, rootState }) {
            const response = await api.$get('/../user/stats', rootState.auth.accessToken);
            if (result.success) {
                commit('saveStats', { data: response.result });
            }
            return state.stats;
        },
    },
    getters: {
        getStats(state) {
            return !state.accessToken;
        },
    },
  };
  
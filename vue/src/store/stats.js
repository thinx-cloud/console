
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
        async fetchStats({ state, commit }) {
            const result = await this.$api.$get('/../user/stats');
            if (result.success) {
                commit('saveStats', { data: result.response });
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
  
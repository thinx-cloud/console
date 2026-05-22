
export default {
    namespaced: true,
    state: {
        stats: null,
        today: null,
    },
    mutations: {
        saveStats(state, data) {
          state.stats = data;
        },
        saveToday(state, data) {
          state.today = data;
        },
    },
    actions: {
        async fetchStats({ state, commit }) {
            const result = await this.$api.$get('/stats');
            if (result.success) {
                commit('saveStats', result.response);
            }
            return state.stats;
        },
        async fetchToday({ state, commit }) {
            const result = await this.$api.$get('/stats/today');
            if (result.success) {
                commit('saveToday', result.response);
            }
            return state.today;
        },
        async fetchDashboard({ dispatch }) {
            await Promise.allSettled([
                dispatch('fetchStats'),
                dispatch('auditlog/fetchAuditlog', null, { root: true }),
                dispatch('buildlog/fetchBuildLog', null, { root: true }),
            ]);
        },
    },
    getters: {
        getStats(state) {
            return state.stats;
        },
        getToday(state) {
            return state.today;
        },
        getTimeline(state) {
            return state.stats && state.stats.timeline ? state.stats.timeline : null;
        },
    },
  };

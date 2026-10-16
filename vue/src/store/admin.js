export default {
  namespaced: true,
  state: { users: [] },
  mutations: {
    setUsers(state, users) { state.users = users; },
  },
  actions: {
    // A network failure throws, so AdminUsers.vue shows 'Failed to load users.' instead of
    // an empty list (48-REVIEW CR-01).
    async fetchUsers({ commit }) {
      const result = await this.$api.$get('/admin/users');
      if (result.success) commit('setUsers', result.response);
      else if (result.networkError) throw new Error('Could not reach the server.');
      return result;
    },
    async revokeSession(_, { owner }) {
      return await this.$api.$delete('/admin/session/' + owner);
    },
    async impersonate(_, { owner }) {
      return await this.$api.$post('/admin/impersonate', JSON.stringify({ owner }));
    },
  },
  getters: {
    getUsers(state) { return state.users; },
  },
};

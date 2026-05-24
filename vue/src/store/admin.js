export default {
  namespaced: true,
  state: { users: [] },
  mutations: {
    setUsers(state, users) { state.users = users; },
  },
  actions: {
    async fetchUsers({ commit }) {
      const result = await this.$api.$get('/admin/users');
      if (result.success) commit('setUsers', result.response);
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

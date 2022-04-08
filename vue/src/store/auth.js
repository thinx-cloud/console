export default {
    state: {
        user: null,
        accessToken: null,
    },
    mutations: {
        setUser(state, user) {
          state.user = user;
        },
        setAccessToken(state, token) {
          state.accessToken = token;
        },
      },
    actions: {},
    getters: {
        isLoggedIn(state) {
            return !!state.accessToken;
        },
        getAccessToken(state) {
          return state.accessToken;
        }
    },
  };
  
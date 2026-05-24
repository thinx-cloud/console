import VueJwtDecode from "vue-jwt-decode";

export default {
    namespaced: true,
    state: {
        user: null,
        accessToken: null,
        refreshToken: null,
    },
    mutations: {
        setUser(state, user) {
          state.user = user;
        },
        setAccessToken(state, token) {
          // TODO use validation
          state.accessToken = token;
          this.$api.setAccessToken(state.accessToken);
        },
        setRefreshToken(state, token) {
          // TODO use validation
          state.refreshToken = token;
          this.$api.setRefreshToken(state.refreshToken);
        },
      },
    actions: {
      removeAccessToken(state) {
        window.localStorage.removeItem('accessToken');
        state.accessToken = undefined;
      },
      removeRefreshToken(state) {
        window.localStorage.removeItem('refreshToken');
        state.refreshToken = undefined;
      },
      isTokenValid(_, token) {
        try {
            const nowUnixtime = Math.floor(Date.now() / 1000);
            let decoded = VueJwtDecode.decode(token);
            return decoded.exp <= nowUnixtime ? false : true;
        } catch (error) {
            return false
        }
      },
      async requestPasswordReset(_, { email }) {
        return await this.$api.$post('/password/reset', JSON.stringify({ email }));
      },
      async confirmPasswordReset(_, { owner, reset_key, activation, password, rpassword }) {
        const body = { password, rpassword, owner };
        if (reset_key) body.reset_key = reset_key;
        if (activation) body.activation = activation;
        return await this.$api.$post('/password/set', JSON.stringify(body));
      },
    },
    getters: {
        isAuthenticated(state) {
            return !!state.accessToken;
        },
        getAccessToken(state) {
          return state.accessToken;
        }
    },
  };
  

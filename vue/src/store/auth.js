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
            console.log('TOKEN', decoded.exp <= nowUnixtime ? 'EXPIRED' : 'VALID');
            return decoded.exp <= nowUnixtime ? false : true;
        } catch (error) {
            console.log(error, 'error from decoding token')
            return false
        }
      }
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
  
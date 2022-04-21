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
          try {
            const nowUnixtime = Date.now() / 1000;
            let decoded = VueJwtDecode.decode(token);
            console.log('TOKEN', decoded.exp <= nowUnixtime ? 'EXPIRED' : 'VALID');
          } catch (error) {
            console.log(error, 'error from decoding token')
          }
          state.accessToken = token;
        },
        setRefreshToken(state, token) {
          try {
            const nowUnixtime = Date.now() / 1000;
            let decoded = VueJwtDecode.decode(token);
            console.log('TOKEN', decoded.exp <= nowUnixtime ? 'EXPIRED' : 'VALID');
          } catch (error) {
            console.log(error, 'error from decoding token')
          }
          state.refreshToken = token;
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
    },
    getters: {
        isLoggedIn(state) {
            return !!state.accessToken;
        },
        getAccessToken(state) {
          return state.accessToken;
        }
    },
  };
  
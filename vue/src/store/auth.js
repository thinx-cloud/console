import VueJwtDecode from "vue-jwt-decode";

export default {
    namespaced: true,
    state: {
        user: null,
        accessToken: null,
    },
    mutations: {
        setUser(state, user) {
          state.user = user;
        },
        setAccessToken(state, token) {

          try {
            const nowUnixtime = Date.now() / 1000;
            let decoded = VueJwtDecode.decode(token);
            console.log(decoded, 'decoded accessToken');
            console.log(new Date(decoded.exp * 1000).toString(), 'exp');
            console.log(new Date(decoded.iat * 1000).toString(), 'iat');
            console.log(new Date(nowUnixtime * 1000).toString(), 'now');
            console.log('TOKEN', decoded.exp <= nowUnixtime ? 'EXPIRED' : 'VALID');
          } catch (error) {
            console.log(error, 'error from decoding token')
          }

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
  
import VueJwtDecode from "vue-jwt-decode";

// Module-private setTimeout id for the session-expiry watcher (AUTH-03).
// Kept outside Vuex state so we can clear/replace it across action dispatches
// without triggering reactivity overhead or committing a mutation.
let expiryTimerId = null;

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
      clearSession({ commit }) {
        if (expiryTimerId) {
          clearTimeout(expiryTimerId);
          expiryTimerId = null;
        }
        window.localStorage.removeItem('accessToken');
        window.localStorage.removeItem('refreshToken');
        window.localStorage.removeItem('authenticated');
        commit('setAccessToken', null);
        commit('setRefreshToken', null);
        commit('setUser', null);
      },
      scheduleExpiry({ dispatch }, token) {
        if (expiryTimerId) {
          clearTimeout(expiryTimerId);
          expiryTimerId = null;
        }
        if (!token) return;
        try {
          const decoded = VueJwtDecode.decode(token);
          if (!decoded || typeof decoded.exp !== 'number') return;
          const msUntilExpiry = decoded.exp * 1000 - Date.now();
          if (msUntilExpiry <= 0) {
            dispatch('clearSession');
            if (typeof window !== 'undefined') window.location.hash = '#/login';
            return;
          }
          expiryTimerId = setTimeout(() => {
            dispatch('clearSession');
            if (typeof window !== 'undefined') window.location.hash = '#/login';
          }, msUntilExpiry);
        } catch (e) {
          // Bad token shape — let the normal auth flow (next API call → 401) handle it.
          // No need to dispatch clearSession here; the user has not yet logged in or the rehydrate
          // path is about to bail anyway.
          // eslint-disable-next-line no-console
          console.warn('[auth] scheduleExpiry decode failed', e);
        }
      },
      async requestPasswordReset(_, { email }) {
        // AUTH-RESET-ORIGIN: tag the request so the API redirects the reset link
        // back to the Vue console hash route (/#/password-reset) rather than the
        // legacy /password.html page. Both consoles share the same host.
        return await this.$api.$post('/password/reset', JSON.stringify({ email, client: 'vue' }));
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
  

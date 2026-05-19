import VueJwtDecode from "vue-jwt-decode";

/**
 * @typedef {Object} AuthState
 * @property {Object|null} user - Decoded user profile, or `null` when not logged in.
 * @property {string|null} accessToken - JWT access token.
 * @property {string|null} refreshToken - JWT refresh token.
 */

/**
 * Vuex module for authentication state.
 * Manages access/refresh tokens and exposes an `isAuthenticated` getter.
 */
export default {
    namespaced: true,
    /** @type {AuthState} */
    state: {
        user: null,
        accessToken: null,
        refreshToken: null,
    },
    mutations: {
        /**
         * Replaces the stored user profile.
         * @param {AuthState} state
         * @param {Object} user - Decoded user object.
         */
        setUser(state, user) {
          state.user = user;
        },
        /**
         * Stores the access token and syncs it to the Api client.
         * @param {AuthState} state
         * @param {string} token - JWT access token.
         */
        setAccessToken(state, token) {
          // TODO use validation
          state.accessToken = token;
          this.$api.setAccessToken(state.accessToken);
        },
        /**
         * Stores the refresh token and syncs it to the Api client.
         * @param {AuthState} state
         * @param {string} token - JWT refresh token.
         */
        setRefreshToken(state, token) {
          // TODO use validation
          state.refreshToken = token;
          this.$api.setRefreshToken(state.refreshToken);
        },
      },
    actions: {
      /**
       * Removes the access token from localStorage and clears it from state.
       * @param {AuthState} state
       */
      removeAccessToken(state) {
        window.localStorage.removeItem('accessToken');
        state.accessToken = undefined;
      },
      /**
       * Removes the refresh token from localStorage and clears it from state.
       * @param {AuthState} state
       */
      removeRefreshToken(state) {
        window.localStorage.removeItem('refreshToken');
        state.refreshToken = undefined;
      },
      /**
       * Decodes a JWT and checks whether it is still within its expiry window.
       * @param {*} _ - Unused store context.
       * @param {string} token - JWT string to validate.
       * @returns {boolean} `true` if the token is present and not yet expired.
       */
      isTokenValid(_, token) {
        try {
            const nowUnixtime = Math.floor(Date.now() / 1000);
            let decoded = VueJwtDecode.decode(token);
            return decoded.exp <= nowUnixtime ? false : true;
        } catch (error) {
            return false
        }
      }
    },
    getters: {
        /**
         * @param {AuthState} state
         * @returns {boolean} `true` when an access token is present.
         */
        isAuthenticated(state) {
            return !!state.accessToken;
        },
        /**
         * @param {AuthState} state
         * @returns {string|null} The current access token.
         */
        getAccessToken(state) {
          return state.accessToken;
        }
    },
  };


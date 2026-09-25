import VueJwtDecode from "vue-jwt-decode";
import { clearLegacyAuthStorage } from "./auth-storage";
import { ensureCsrfToken } from "../utils/cookies";

// Module-private setTimeout id for the session-expiry watcher (AUTH-03).
// Kept outside Vuex state so we can clear/replace it across action dispatches
// without triggering reactivity overhead or committing a mutation.
let expiryTimerId = null;

// In-flight cookie -> token exchange, shared so the router guard, App.vue and
// Login.vue hitting it at once on a cold reload issue a single request.
let hydratePromise = null;

function isJwtValid(token) {
  if (!token) return false;
  try {
    const nowUnixtime = Math.floor(Date.now() / 1000);
    const decoded = VueJwtDecode.decode(token);
    return decoded.exp > nowUnixtime;
  } catch (error) {
    return false;
  }
}

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
          state.accessToken = token || null;
          this.$api.setAccessToken(state.accessToken);
        },
        setRefreshToken(state, token) {
          // TODO use validation
          state.refreshToken = token || null;
          this.$api.setRefreshToken(state.refreshToken);
        },
      },
    actions: {
      removeAccessToken({ commit }) {
        commit('setAccessToken', null);
      },
      removeRefreshToken({ commit }) {
        commit('setRefreshToken', null);
      },
      isTokenValid(_, token) {
        return isJwtValid(token);
      },
      persistSession({ commit, dispatch }, { accessToken, refreshToken = null }) {
        if (!accessToken) {
          dispatch('clearSession');
          return false;
        }
        // Memory only — see auth-storage.js. Scrub anything an older build left.
        clearLegacyAuthStorage();
        commit('setAccessToken', accessToken);
        commit('setRefreshToken', refreshToken);
        dispatch('scheduleExpiry', accessToken);
        return true;
      },
      // Restore the in-memory access token after a reload by exchanging the
      // httpOnly session cookie for a fresh one. Resolves true when authenticated.
      hydrateSession({ state, dispatch }) {
        clearLegacyAuthStorage();
        if (isJwtValid(state.accessToken)) return Promise.resolve(true);
        if (!hydratePromise) {
          hydratePromise = (async () => {
            try {
              // Shared single-flight prime (no-op when the cookie exists); $post
              // also retries once on csrf_token_invalid. See utils/cookies.js.
              await ensureCsrfToken(this.$api.csrfBase());
              const result = await this.$api.$post('/session/token');
              const accessToken = result && result.success ? result.response : null;
              if (!isJwtValid(accessToken)) return false;
              return await dispatch('persistSession', { accessToken });
            } catch (_error) {
              return false;
            } finally {
              hydratePromise = null;
            }
          })();
        }
        return hydratePromise;
      },
      clearSession({ commit }) {
        if (expiryTimerId) {
          clearTimeout(expiryTimerId);
          expiryTimerId = null;
        }
        clearLegacyAuthStorage();
        commit('setAccessToken', null);
        commit('setRefreshToken', null);
        commit('setUser', null);
      },
      // Explicit sign-out: also destroy the server session cookie, otherwise the
      // next hydrateSession would silently sign the user back in.
      async logout({ dispatch }) {
        try {
          await fetch(this.$api.composePath('/logout'), {
            method: 'GET',
            credentials: 'include',
            redirect: 'manual',
          });
        } catch (_error) {
          // Server unreachable — still drop the local session.
        }
        await dispatch('clearSession');
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
          const expire = async () => {
            dispatch('clearSession');
            // The session cookie usually outlives the 1h token: renew silently.
            if (await dispatch('hydrateSession')) return;
            if (typeof window !== 'undefined') window.location.hash = '#/login';
          };
          if (msUntilExpiry <= 0) {
            expire();
            return;
          }
          expiryTimerId = setTimeout(expire, msUntilExpiry);
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
  

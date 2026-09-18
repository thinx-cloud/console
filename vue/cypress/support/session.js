// Session seeding for the stub-backed specs.
//
// The auth mechanism on this commit (verified by reading source, not assumed —
// a previous pass on this file got this wrong because its branch had been cut
// from an older commit with a different auth model; that has since been fixed):
//
//   - src/store/auth-storage.js persists tokens under sessionStorage keys
//     `accessToken` / `refreshToken` (getPersistedAuthTokens() reads
//     sessionStorage first; it also has a legacy localStorage fallback that it
//     migrates into sessionStorage and then clears — relevant only for carrying
//     forward a pre-existing session, not for a fresh Cypress visit).
//   - src/App.vue#created awaits `auth/hydrateSession` on every hard load. That
//     action (src/store/auth.js) calls getPersistedAuthTokens() and validates
//     the access token with isJwtValid(): VueJwtDecode.decode(token) — plain
//     JSON.parse(atob(segment)) — checked against `decoded.exp > now`.
//   - hydrateSession rejects the WHOLE session if a PRESENT refreshToken fails
//     validation, but an ABSENT refreshToken is fine. So we deliberately never
//     write a refreshToken below: writing a garbage one would fail a session
//     that omitting it entirely keeps valid.
//   - src/Routes.js has a `beforeEach` guard that separately allows `/app/*`
//     when either the in-memory `store.state.auth.accessToken` or
//     `getPersistedAuthTokens().accessToken` is set, so seeding sessionStorage
//     before the app boots is sufficient without touching Vuex directly.
//
// The token is forged with plain `btoa(JSON.stringify(...))`, NOT base64url.
// vue-jwt-decode's decode() is plain `JSON.parse(atob(segment))`, and
// src/core/api.js does the same — neither maps base64url ('-'/'_', stripped
// padding) back to standard base64, so a base64url-encoded segment would fail
// to decode as JSON and isJwtValid() would (correctly) reject it.
function encodeSegment(value) {
  return btoa(JSON.stringify(value));
}

export function forgeJwt({ owner = 'test-owner-0000', expiresInSeconds = 3600 } = {}) {
  const issuedAt = Math.floor(Date.now() / 1000);
  return [
    encodeSegment({ alg: 'HS256', typ: 'JWT' }),
    encodeSegment({ owner, iat: issuedAt, exp: issuedAt + expiresInSeconds }),
    'test-signature',
  ].join('.');
}

// Visit a route with the session in a known state.
//
//   cy.visitApp('/#/app/devices')                              // logged out
//   cy.visitApp('/#/app/devices', { session: true })           // valid 1h token
//   cy.visitApp('/#/app/dashboard', { session: { expiresInSeconds: 2 } })
//
// Always writing OR clearing (never leaving storage alone) is deliberate:
// Cypress 9 does not clear sessionStorage/localStorage between tests of the
// same spec and offers no built-in per-test reset wired into this suite, so a
// session seeded in one test would otherwise leak into the next — the same
// class of bug 5970c2e fixed for cy.login() (there via an explicit
// startLoggedOut() clear+reload before every login; here by making every
// visitApp call itself authoritative over the token keys on every visit).
//
// Both sessionStorage (the live read path) and localStorage (the legacy
// fallback getPersistedAuthTokens() still checks) are cleared on every call,
// so a stray key from an earlier test can't leak through the fallback path
// either. Only sessionStorage is written for a logged-in session, since that
// is what auth-storage.js treats as authoritative today.
Cypress.Commands.add('visitApp', (url, options = {}) => {
  const { session, onBeforeLoad: userOnBeforeLoad, ...visitOptions } = options;
  const token = session ? forgeJwt(session === true ? {} : session) : null;

  return cy.visit(url, {
    ...visitOptions,
    onBeforeLoad(win) {
      win.sessionStorage.removeItem('accessToken');
      win.sessionStorage.removeItem('refreshToken');
      win.localStorage.removeItem('accessToken');
      win.localStorage.removeItem('refreshToken');
      win.localStorage.removeItem('authenticated');

      if (token) {
        win.sessionStorage.setItem('accessToken', token);
      }
      // refreshToken is deliberately never written — see the block comment
      // above: hydrateSession() only fails on a PRESENT-but-invalid
      // refreshToken, so omitting it entirely keeps the seeded session valid.

      if (userOnBeforeLoad) userOnBeforeLoad(win);
    },
  });
});

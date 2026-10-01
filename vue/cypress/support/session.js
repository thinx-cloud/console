// Session seeding for the stub-backed specs.
//
// The auth mechanism on this commit (verified by reading source, not assumed):
//
//   - Auth tokens live in memory only (Vuex + the API client). The console never
//     writes them to sessionStorage/localStorage; src/store/auth-storage.js only
//     scrubs keys that older builds persisted (clearLegacyAuthStorage()).
//   - src/App.vue#created awaits `auth/hydrateSession` on every hard load, and
//     the src/Routes.js `beforeEach` guard does the same for any `/app/*` route
//     when Vuex holds no token. hydrateSession (src/store/auth.js) primes the
//     CSRF cookie through GET /api/v2/csrf-token and then exchanges the httpOnly
//     session cookie for an access token through POST /api/v2/session/token. The
//     returned token is validated with isJwtValid(): VueJwtDecode.decode(token)
//     — plain JSON.parse(atob(segment)) — checked against `decoded.exp > now`.
//   - So a stubbed session is a stubbed token exchange: visitApp() registers an
//     intercept for POST /api/v2/session/token that answers with a forged token
//     (below). It is registered AFTER cy.stubThinxApi()'s catch-all (specs call
//     stubThinxApi() in beforeEach, visitApp() later), so it outranks it. A
//     logged-out visit registers nothing, the catch-all answers 500, and
//     hydrateSession resolves false — exactly what a real expired cookie does.
//
// The token is forged with plain `btoa(JSON.stringify(...))`, NOT base64url.
// Plain `btoa` is used because vue-jwt-decode's decode() (and src/core/api.js,
// which does the same thing) is just `JSON.parse(atob(segment))` with no
// base64url mapping ('-'/'_', stripped padding) back to standard base64 — but
// for this payload shape either encoding happens to decode cleanly through
// `atob` every time, so a passing test here is not proof the encoding choice
// itself is correct.
function encodeSegment(value) {
  return btoa(JSON.stringify(value));
}

export function forgeJwt({ owner = 'test-owner-0000', expiresInSeconds = 3600 } = {}) {
  // Math.ceil, not Math.floor: flooring discards up to 0.999s of the caller's
  // requested lifetime, which matters when a spec (auth-extras.spec.js's
  // AUTH-03) deliberately forges a short-lived token to race a redirect.
  const issuedAt = Math.ceil(Date.now() / 1000);
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
// For a logged-in visit the session-token exchange is stubbed (alias
// `@sessionToken`) BEFORE cy.visit, so hydrateSession receives the forged token
// on the very first load. Re-registering it on every visit is what makes each
// visitApp() call authoritative over the session for that test: Cypress drops
// intercepts between tests, and a logged-out visit simply registers none.
//
// Legacy token keys are still cleared from both storages on every visit. The
// app scrubs them itself on hydrate, so this is belt and braces: no stray key
// from an older build or an earlier test can influence a run.
Cypress.Commands.add('visitApp', (url, options = {}) => {
  const { session, onBeforeLoad: userOnBeforeLoad, ...visitOptions } = options;
  const token = session ? forgeJwt(session === true ? {} : session) : null;

  if (token) {
    cy.intercept(
      { method: 'POST', pathname: '/api/v2/session/token' },
      { statusCode: 200, body: { success: true, response: token } },
    ).as('sessionToken');
  }

  return cy.visit(url, {
    ...visitOptions,
    onBeforeLoad(win) {
      win.sessionStorage.removeItem('accessToken');
      win.sessionStorage.removeItem('refreshToken');
      win.localStorage.removeItem('accessToken');
      win.localStorage.removeItem('refreshToken');
      win.localStorage.removeItem('authenticated');

      if (userOnBeforeLoad) userOnBeforeLoad(win);
    },
  });
});

// Enter the app at a route other than the dashboard.
//
//   cy.visitAppRoute('/app/history', { session: true })
//   cy.visitAppRoute('/app/device/udid-z', { session: true, onBeforeLoad(win) { ... } })
//
// A hard load of a deep link such as `/#/app/history` currently lands on the
// dashboard: after hydrateSession, src/App.vue reads
// `$router.history.current.path` before the initial navigation has confirmed,
// sees `/`, and pushes /app/dashboard. That is a pre-existing app bug, recorded
// as a follow-up and deliberately NOT fixed from the test harness. This command
// works around it without touching the app: it loads the dashboard (the route
// the app settles on anyway), waits until it has rendered, then navigates in
// app by setting the hash, which the hash-mode router handles like a link.
//
// Side effect: the dashboard requests the first audit and build pages (and the
// devices, stats and profile) before the target route mounts. A
// cy.wait('@alias') after this command may therefore match the dashboard's
// request, not the target page's — assert on the target page's rendered rows.
Cypress.Commands.add('visitAppRoute', (route, options = {}) => {
  cy.visitApp('/#/app/dashboard', options);
  cy.get('.page-title').should('contain', 'Dashboard');
  return cy.window().then((win) => {
    win.location.hash = '#' + route;
  });
});

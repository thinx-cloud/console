// Session seeding for the stub-backed specs.
//
// DEVIATION FROM THE BRIEF (load-bearing; recorded here rather than only in
// the task report because later readers of this file need it too):
//
// The brief specified writing a single `accessToken` key to sessionStorage,
// on the assumption that the app reads its session via an
// App.vue#hydrateSession function backed by store/auth-storage.js, and that
// isJwtValid()/exp gate cold-load authentication. None of that exists on
// this branch (`grep -rn sessionStorage src/`, `grep -rn hydrateSession
// src/`, and `ls src/store/auth-storage.js` all come back empty), and it was
// verified empirically, not just by reading: writing a valid forged token to
// sessionStorage.accessToken left the smoke spec on #/login.
//
// What this branch's app actually does on a hard load of a deep link like
// /#/app/dashboard (traced through App.vue, Routes.js and Login.vue):
//   1. App.vue's created() reads the `auth/isAuthenticated` Vuex getter, which
//      is backed by in-memory store state that is always empty on a fresh
//      page load (no Vuex-persistence plugin). So on EVERY hard load it
//      treats the session as absent and force-navigates any non-public path
//      to /login, before it has looked at localStorage at all.
//   2. Login.vue's OWN created() then runs (we just landed on /login) and
//      checks two localStorage keys directly: `authenticated === 'true'`
//      (string) and a truthy `accessToken`. If both are present it calls
//      setAccessToken/setRefreshToken/scheduleExpiry and pushes back to
//      /app/dashboard. This second navigation is an in-SPA `router.push`, not
//      a hard reload, so App.vue's created() does not fire again and the
//      bounce-back sticks.
// Neither step decodes or validates the token: Login.vue's check is pure
// presence/equality on the two localStorage keys. Confirmed by direct
// experiment: `localStorage.setItem('accessToken', 'not-a-jwt-at-all')` with
// `authenticated: 'true'` still lands on the dashboard. So — unlike what the
// brief assumes — JWT decodability is NOT what gates cy.visitApp's session
// here; the `authenticated` flag is. See task-1-report.md for the Step 12
// consequence of this: the brief's literal base64url probe
// (btoa(...).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')) is a
// no-op for this fixed {alg,typ}/{owner,iat,exp} JSON (it never contains '+'
// or '/', and this runtime's atob tolerates missing '=' padding) and does not
// turn the suite red; the red-state check that actually exercises this
// command's own logic is breaking the `authenticated` flag write instead.
//
// The token is still forged with plain btoa (never base64url) as a general
// hygiene rule for any future consumer that DOES decode it — e.g. a
// header/profile display reading the `owner` claim — even though nothing on
// the cy.visitApp cold-load path currently does.
//
// None of this changes the public cy.visitApp/cy.stubThinxApi interface
// (signature, alias names, fixture shapes) that Tasks 2-8 consume — only the
// Storage object and key set an internal implementation detail writes to.
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
// Always writing OR clearing (never leaving it alone) is deliberate: Cypress 9
// does not clear localStorage between tests of the same spec and offers no
// built-in per-test reset wired into this suite, so a session seeded in one
// test would otherwise leak into the next — the same failure 5970c2e fixed for
// cy.login().
Cypress.Commands.add('visitApp', (url, options = {}) => {
  const { session, onBeforeLoad: userOnBeforeLoad, ...visitOptions } = options;
  const token = session ? forgeJwt(session === true ? {} : session) : null;

  return cy.visit(url, {
    ...visitOptions,
    onBeforeLoad(win) {
      if (token) {
        win.localStorage.setItem('accessToken', token);
        win.localStorage.setItem('authenticated', 'true');
      } else {
        win.localStorage.removeItem('accessToken');
        win.localStorage.removeItem('authenticated');
      }
      // refreshToken is deliberately never written: the cold-load path this
      // command exercises (App.vue redirect -> Login.vue created() bounce
      // back, see the block comment above) never reads it.
      win.localStorage.removeItem('refreshToken');
      if (userOnBeforeLoad) userOnBeforeLoad(win);
    },
  });
});

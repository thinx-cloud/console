// Network stubs for the spec files that do not use live credentials.
//
// Intercepts match on `pathname`, not a full URL. `test` and `test:ci` start the
// dev server with VUE_APP_API_HOSTNAME= (empty), so the app falls back to
// window.location.origin and calls the dev server's own origin (D-04); a run
// with a remote API host still matches because only the path is compared.
//
// Fixture-to-spec map, and the load-bearing properties of each fixture that
// specs actually depend on (change these values and something below silently
// diverges rather than failing loudly):
//   - devices.json      — devices.spec.js + device-detail.spec.js. One device
//     is mongoose and three are platforms outside PLATFORMS (esp32, esp8266),
//     so the pills are All, MongooseOS and unknown (DEVI-01); no device has a
//     keyhash, so every row shows the API-key marker (D-14); two aliases
//     contain "node" (DEVI-03 search), and the alias-ascending order (DEVI-02)
//     is the REVERSE of the default lastupdate-descending order — a fixture
//     that happened to already be alias-sorted would hide a broken sort.
//   - build-log.json    — dashboard.spec.js + history.spec.js +
//     device-detail.spec.js. build-1's log contents must exceed ~400 chars or
//     HIST-03's Expand/Collapse button never renders (History.vue only shows
//     it past a length threshold).
//   - audit-log.json    — dashboard.spec.js + history.spec.js. Exactly one
//     entry carries the `danger` flag, and the oldest entry is 2026-09-10 —
//     both are asserted on directly by name/count, not just "some rows exist".
//   - admin-users.json  — deep-link.spec.js. Three rows, exactly one admin row
//     (cypress-test, the profile-admin.json owner); asserted by row count.
//   - rsakeys.json      — rsakeys.spec.js (48.1-03). Two keys, newest first by
//     `date` (Firmware repo key 2026-09-18 before Staging key 2026-09-10); the
//     filenames fixture-key-one and fixture-key-two are what the PATCH and
//     DELETE request bodies carry. Fictional pubkeys (FIXTURE-PUBKEY-*), low-
//     entropy fingerprints, example.test addresses only.
//   - rsakeys-after-rename.json — rsakeys.spec.js. The same list; only the
//     first name differs (Renamed key). Served by a bespoke intercept after the
//     rename so the page's reload shows the new name.
//   - rsakeys-after-delete.json — rsakeys.spec.js. The list without the first
//     key (Staging key only). Served after the delete.
//   - profile-transformers.json — transformers.spec.js (48.1-03), passed as the
//     `profile` override. The non-admin profile with three transformers whose
//     utids and aliases the spec asserts: utid-1 passthrough, utid-2 battery,
//     utid-3 sigfox (same body string). devices.json lets exactly one device,
//     udid-z, use utid-1, so deleting passthrough and battery yields the usage
//     sentence "1 device will stop applying them."
//   - profile-transformers-after-delete.json — transformers.spec.js. The same
//     profile keeping only utid-3 (sigfox); served by the spec's stateful GET
//     /profile handler once its POST /profile handler has seen the write.
//   - sources.json      — repositories.spec.js (48.1-03), through the opt-in
//     cy.stubSources(). Four rows whose platform cells are asserted as the
//     bullets Arduino (arduino:esp8266), Platform.io (platformio), MongooseOS
//     (mongoose) and unknown (unknown_platform); example.test git hosts only.
//   - build-log-detail.json — build-log-search.spec.js (48.1-03), served by a
//     bespoke GET /logs/build/build-1 intercept inside the spec. 120 lines
//     "[step N] compiling module N of 120"; exactly three lines match the term
//     `error` case-insensitively, at lines 3, 60 and 112 (ERROR, error, Error),
//     and the last is deep enough to scroll the 70vh log box.

import { forgeJwt } from './session';

const API = '/api/v2';

const DEFAULT_FIXTURES = {
  profile: 'api/profile.json',
  devices: 'api/devices.json',
  env: 'api/env.json',
  stats: 'api/stats.json',
  statsToday: 'api/stats-today.json',
  auditLog: 'api/audit-log.json',
  buildLog: 'api/build-log.json',
  adminUsers: 'api/admin-users.json',
  rsakeys: 'api/rsakeys.json',
};

const ok = (response) => ({ statusCode: 200, body: { success: true, response } });

Cypress.Commands.add('stubThinxApi', (overrides = {}) => {
  const fixtures = { ...DEFAULT_FIXTURES, ...overrides };

  // Registered FIRST so that every intercept below outranks it — Cypress matches
  // the most recently defined route first. This is the load-bearing piece: any
  // /api/v2 call not stubbed below lands here instead of reaching production,
  // which is what makes "these specs never touch the real API" an enforced
  // property rather than an intention.
  //
  // Calling cy.stubThinxApi() a second time (e.g. profile.spec.js's PROF-04,
  // which re-stubs with a different profile fixture) re-registers this WHOLE
  // route set, including a fresh catch-all. Because that fresh catch-all is
  // now the most recently defined route, it silently outranks — and swallows
  // — any bespoke cy.intercept() a test registered between the two
  // cy.stubThinxApi() calls, with no error to indicate why the bespoke stub
  // stopped matching.
  cy.intercept(/\/api\/v2\//, {
    statusCode: 500,
    body: { success: false, response: 'unstubbed_endpoint' },
  }).as('unstubbed');

  // Reads
  cy.intercept({ method: 'GET', pathname: `${API}/csrf-token` }, ok('test-csrf')).as('csrfToken');
  cy.intercept({ method: 'GET', pathname: `${API}/profile` }, { fixture: fixtures.profile }).as('getProfile');
  cy.intercept({ method: 'GET', pathname: `${API}/device` }, { fixture: fixtures.devices }).as('getDevices');
  cy.intercept({ method: 'GET', pathname: `${API}/env` }, { fixture: fixtures.env }).as('getEnv');
  cy.intercept({ method: 'GET', pathname: `${API}/stats` }, { fixture: fixtures.stats }).as('getStats');
  cy.intercept({ method: 'GET', pathname: `${API}/stats/today` }, { fixture: fixtures.statsToday }).as('getStatsToday');
  cy.intercept({ method: 'GET', pathname: `${API}/logs/audit` }, { fixture: fixtures.auditLog }).as('getAuditLog');
  cy.intercept({ method: 'GET', pathname: `${API}/logs/build` }, { fixture: fixtures.buildLog }).as('getBuildLog');
  cy.intercept({ method: 'GET', pathname: `${API}/admin/users` }, { fixture: fixtures.adminUsers }).as('getAdminUsers');
  cy.intercept({ method: 'GET', pathname: `${API}/rsakey` }, { fixture: fixtures.rsakeys }).as('getRsakeys');

  // Writes. Specs assert request.body; the side effect never happens.
  cy.intercept({ method: 'DELETE', pathname: `${API}/device` }, ok('devices_revoked')).as('revokeDevices');
  cy.intercept({ method: 'POST', pathname: `${API}/device/configuration` }, ok('configuration_pushed')).as('pushConfiguration');
  cy.intercept({ method: 'POST', pathname: `${API}/build` }, ok('build_started')).as('buildFirmware');
  cy.intercept({ method: 'POST', pathname: `${API}/transfer/request` }, ok('transfer_requested')).as('transferDevices');
  cy.intercept({ method: 'PUT', pathname: `${API}/device` }, ok('device_updated')).as('updateDevice');
  // One alias for all three POST /profile callers — updateProfile,
  // saveNotifications and uploadAvatar share the route (store/profile.js:93,98).
  cy.intercept({ method: 'POST', pathname: `${API}/profile` }, ok('profile_updated')).as('postProfile');
  cy.intercept({ method: 'DELETE', pathname: `${API}/user` }, ok('user_deleted')).as('deleteAccount');
  // Deploy keys (48.1-03, KEY-04/KEY-05): rename is PATCH { filename, name }, delete is
  // DELETE { filenames }. The page reloads GET /rsakey itself after either.
  cy.intercept({ method: 'PATCH', pathname: `${API}/rsakey` }, ok('key_renamed')).as('renameRsakey');
  cy.intercept({ method: 'DELETE', pathname: `${API}/rsakey` }, ok('key_deleted')).as('deleteRsakeys');
  // Environment globals (48.1-03, ENV-01): one PUT { key, value } replaces a value; the
  // store re-reads GET /env afterwards (store/enviros.js refreshAfter).
  cy.intercept({ method: 'PUT', pathname: `${API}/env` }, ok('env_saved')).as('putEnv');
});

// Repositories (48.1-03, REPO-01): GET /api/v2/source is OPT-IN, not a default stub,
// because DeviceDetail.vue also reads it and the existing device specs rely on the
// catch-all answering it with HTTP 500. Call this AFTER cy.stubThinxApi() so it
// outranks the catch-all.
//   cy.stubSources()                          // four rows from api/sources.json
//   cy.stubSources('api/other-sources.json')  // another fixture
Cypress.Commands.add('stubSources', (fixture = 'api/sources.json') => {
  cy.intercept({ method: 'GET', pathname: `${API}/source` }, { fixture }).as('getSource');
});

// The CI login (D-02): the Vue login form posts { username, password } to
// /api/v2/login (pages/Login/Login.vue), the endpoint CONTEXT D-02 calls
// /api/login. Call this AFTER cy.stubThinxApi() so it outranks the catch-all.
//   cy.stubLogin()                     // 200, forged access and refresh tokens
//   cy.stubLogin({ success: false })   // 403, the app shows "Login failed: …"
// Any credentials are accepted; no real account is involved.
Cypress.Commands.add('stubLogin', ({ success = true } = {}) => {
  const reply = success
    ? {
      statusCode: 200,
      body: {
        success: true,
        access_token: forgeJwt(),
        refresh_token: forgeJwt({ expiresInSeconds: 86400 }),
      },
    }
    : { statusCode: 403, body: { success: false, message: 'invalid credentials (stub)' } };
  cy.intercept({ method: 'POST', pathname: `${API}/login` }, reply).as('login');
});

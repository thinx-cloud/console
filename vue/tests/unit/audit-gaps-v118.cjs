// Unit test for the v1.18 Phase 48.1 audit-gap closure (NOTIF-04, CI-07; audit gaps W1-W3).
//
// Plain-node checks, by prefix:
//   G  src/Routes.js admin guard: the profile is loaded before the admin check on a cold
//      reload, the guard fails closed, and no other route issues a request (W1, PD-01..PD-03);
//   Y  Cypress spec hygiene: stubs only, no skip/only/retries/numeric wait, no credentials;
//   S  store network contract (48.1-02);
//   P  page load errors (48.1-02);
//   K  fetchProfile callers (48.1-02).
//
// The harness (check/checkAsync, lazy, read, tick, settledWithin, the run loop) is copied from
// close-out-v118.cjs, not required from it; later plans copy more loaders into this file.
//
// Plain node, offline, no browser: npm run test:unit

const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const compiler = require('vue-template-compiler');
const Vue = require('vue/dist/vue.runtime.common.js');

Vue.config.productionTip = false;
Vue.config.devtools = false;
Vue.config.ignoredElements = [/^b-/];
let renderError = null;
Vue.config.errorHandler = (err) => { renderError = err; };
void compiler;
void renderError;

const SRC = path.join(__dirname, '..', '..', 'src');

let failures = 0;

function check(name, fn) {
  try {
    const detail = fn();
    console.log('ok   ' + name + (typeof detail === 'string' ? ' (' + detail + ')' : ''));
  } catch (err) {
    failures++;
    console.log('FAIL ' + name + ' (' + String(err && err.message ? err.message : err).split('\n')[0] + ')');
  }
}

// Async checks run in order after every synchronous check.
const asyncChecks = [];
function checkAsync(name, fn) { asyncChecks.push([name, fn]); }

function lazy(fn) {
  let done = false;
  let value;
  return () => {
    if (!done) { value = fn(); done = true; }
    return value;
  };
}

const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');

const tick = () => new Promise((resolve) => setImmediate(resolve));

// Resolves to 'pending' when the promise has not settled within a few event-loop turns.
async function settledWithin(promise, turns = 20) {
  let state = 'pending';
  promise.then(() => { state = 'resolved'; }, () => { state = 'rejected'; });
  for (let i = 0; i < turns && state === 'pending'; i++) await tick();
  return state;
}

// ---------------------------------------------------------------- Routes.js guard harness (G)

const routesSource = lazy(() => read('Routes.js'));

// Evaluate src/Routes.js with its imports replaced by stubs. The `Router` stub keeps the
// constructor options and exposes the function passed to `beforeEach` as `guard`; every
// default-imported page or component is an empty object; `Vue.use` is a no-op.
//
//   token        initial store.state.auth.accessToken (null = cold reload)
//   profile      initial store.state.profile.profile ({} = nothing loaded yet)
//   hydrate      what `auth/hydrateSession` resolves; true also sets a token
//   loadProfile  what `profile/fetchProfile` does: (state) => may set state.profile.profile,
//                or throw / return a rejected promise
function guardHarness({ token = null, profile = {}, hydrate = false, loadProfile = () => {} } = {}) {
  const text = routesSource();
  const importRe = /^import\s+(?:(\w+)|\{[^}]*\})\s+from\s+['"][^'"]+['"];?\s*$/gm;
  const names = [];
  let m;
  while ((m = importRe.exec(text)) !== null) if (m[1]) names.push(m[1]);
  assert.ok(names.includes('Vue') && names.includes('Router') && names.includes('store'), 'Routes.js imports Vue, Router and store');
  const body = text
    .replace(importRe, '')
    .replace(/^export\s+default\s+(\w+);?\s*$/m, 'return $1;');
  assert.ok(/return router;/.test(body), 'Routes.js has a default export to return');

  const dispatches = [];
  const state = { auth: { accessToken: token }, profile: { profile } };
  const store = {
    state,
    dispatch(type) {
      dispatches.push(type);
      if (type === 'auth/hydrateSession') {
        if (hydrate) state.auth.accessToken = 'hydrated-token';
        return Promise.resolve(!!hydrate);
      }
      if (type === 'profile/fetchProfile') {
        return Promise.resolve().then(() => loadProfile(state)).then(() => state.profile.profile);
      }
      return Promise.resolve();
    },
  };
  class RouterStub {
    constructor(options) { this.options = options; }
    beforeEach(fn) { this.guard = fn; }
  }
  const VueStub = { use() {} };
  const args = names.map((n) => (n === 'Vue' ? VueStub : n === 'Router' ? RouterStub : n === 'store' ? store : {}));
  const router = new Function(...names, body)(...args); // eslint-disable-line no-new-func
  assert.equal(typeof router.guard, 'function', 'Routes.js registers a beforeEach guard');

  // Call the guard for one path; return the dispatch log, the next() calls and how the
  // returned promise settled ('resolved' | 'rejected' | 'pending').
  async function run(routePath) {
    const nextCalls = [];
    const next = (...a) => { nextCalls.push(a); };
    const result = router.guard({ path: routePath }, {}, next);
    const settled = await settledWithin(Promise.resolve(result));
    return { dispatches: dispatches.slice(), nextCalls, settled, state };
  }
  return { run, state, dispatches };
}

const ADMIN_URL = '/app/admin/users';

checkAsync('G1 cold admin reload: hydrateSession then fetchProfile, admin profile stays on the page', async () => {
  const h = guardHarness({
    token: null,
    profile: {},
    hydrate: true,
    loadProfile: (state) => { state.profile.profile = { admin: true, username: 'cypress-test' }; },
  });
  const r = await h.run(ADMIN_URL);
  assert.equal(r.settled, 'resolved', 'guard promise resolves');
  assert.deepEqual(r.dispatches, ['auth/hydrateSession', 'profile/fetchProfile'], 'dispatch log');
  assert.deepEqual(r.nextCalls, [[]], 'next() called once with no argument');
  return r.dispatches.join(' -> ');
});

checkAsync('G2 not admin after the fetch (admin false, no admin key, admin as a string) goes to the dashboard once', async () => {
  const profiles = [{ admin: false }, { username: 'plain' }, { admin: 'true' }];
  for (const loaded of profiles) {
    const h = guardHarness({ token: 'tok', profile: {}, loadProfile: (state) => { state.profile.profile = loaded; } });
    const r = await h.run(ADMIN_URL);
    const label = JSON.stringify(loaded);
    assert.equal(r.settled, 'resolved', label + ': guard promise resolves');
    assert.deepEqual(r.dispatches, ['profile/fetchProfile'], label + ': the profile was fetched');
    assert.deepEqual(r.nextCalls, [['/app/dashboard']], label + ': next(/app/dashboard) once');
  }
  return profiles.length + ' profiles';
});

checkAsync('G3 fail closed: a rejected fetchProfile or a refused reply (profile stays empty) goes to the dashboard', async () => {
  const rejecting = guardHarness({ token: 'tok', profile: {}, loadProfile: () => { throw new Error('network'); } });
  const r1 = await rejecting.run(ADMIN_URL);
  assert.equal(r1.settled, 'resolved', 'rejection: the guard promise resolves (never rejects)');
  assert.deepEqual(r1.dispatches, ['profile/fetchProfile'], 'rejection: the profile was fetched');
  assert.deepEqual(r1.nextCalls, [['/app/dashboard']], 'rejection: next(/app/dashboard) once');

  const refused = guardHarness({ token: 'tok', profile: {}, loadProfile: () => {} });
  const r2 = await refused.run(ADMIN_URL);
  assert.equal(r2.settled, 'resolved', 'refused: the guard promise resolves');
  assert.deepEqual(r2.dispatches, ['profile/fetchProfile'], 'refused: the profile was fetched');
  assert.deepEqual(r2.state.profile.profile, {}, 'refused: the store still holds the empty object');
  assert.deepEqual(r2.nextCalls, [['/app/dashboard']], 'refused: next(/app/dashboard) once');
});

checkAsync('G4 already loaded: an admin profile passes and a non-admin profile redirects, both without a fetch', async () => {
  const admin = guardHarness({ token: 'tok', profile: { admin: true }, loadProfile: () => { throw new Error('must not fetch'); } });
  const r1 = await admin.run(ADMIN_URL);
  assert.equal(r1.settled, 'resolved');
  assert.deepEqual(r1.dispatches, [], 'admin: no dispatch');
  assert.deepEqual(r1.nextCalls, [[]], 'admin: next() once');

  const user = guardHarness({ token: 'tok', profile: { admin: false }, loadProfile: () => { throw new Error('must not fetch'); } });
  const r2 = await user.run(ADMIN_URL);
  assert.equal(r2.settled, 'resolved');
  assert.deepEqual(r2.dispatches, [], 'non-admin: no dispatch');
  assert.deepEqual(r2.nextCalls, [['/app/dashboard']], 'non-admin: next(/app/dashboard) once');
});

checkAsync('G5 logged out: hydrateSession false on the admin path goes to /login without a profile fetch', async () => {
  const h = guardHarness({ token: null, profile: {}, hydrate: false, loadProfile: () => { throw new Error('must not fetch'); } });
  const r = await h.run(ADMIN_URL);
  assert.equal(r.settled, 'resolved');
  assert.deepEqual(r.dispatches, ['auth/hydrateSession'], 'only the session hydration');
  assert.deepEqual(r.nextCalls, [['/login']], 'next(/login) once');
});

checkAsync('G6 no extra requests: other /app routes, public paths and non-app paths dispatch nothing', async () => {
  const udid = 'a'.repeat(64);
  const appPaths = ['/app/dashboard', '/app/history/audit', '/app/profile', '/app/device/' + udid];
  for (const p of appPaths) {
    const h = guardHarness({ token: 'tok', profile: {}, loadProfile: () => { throw new Error('must not fetch'); } });
    const r = await h.run(p);
    assert.equal(r.settled, 'resolved', p + ': resolves');
    assert.deepEqual(r.dispatches, [], p + ': no dispatch');
    assert.deepEqual(r.nextCalls, [[]], p + ': next() once');
  }
  const otherPaths = ['/login', '/password-reset', '/error', '/oauth-return', '/', '/foo'];
  for (const p of otherPaths) {
    const h = guardHarness({ token: null, profile: {}, hydrate: false, loadProfile: () => { throw new Error('must not fetch'); } });
    const r = await h.run(p);
    assert.equal(r.settled, 'resolved', p + ': resolves');
    assert.deepEqual(r.dispatches, [], p + ': no dispatch at all');
    assert.deepEqual(r.nextCalls, [[]], p + ': next() once');
  }
  return (appPaths.length + otherPaths.length) + ' paths';
});

// ---------------------------------------------------------------- Cypress spec hygiene (Y)

const CYPRESS = path.join(__dirname, '..', '..', 'cypress');
const readSpec = (rel) => fs.readFileSync(path.join(CYPRESS, rel), 'utf8');

// Markers a gating spec must not carry (T-48.1-02, T-48.1-04): skipped or focused tests,
// retries, numeric waits, the live login helpers, Cypress.env and absolute URLs. Written as
// data so 48.1-03 can run the same function over its new specs.
const SPEC_FORBIDDEN = [
  [/\.skip\(/, 'skip'],
  [/\.only\(/, 'only'],
  [/\bxit\(/, 'xit'],
  [/\bxdescribe\(/, 'xdescribe'],
  [/\bretries\b/, 'retries'],
  [/cy\.wait\(\s*\d/, 'numeric wait'],
  [/loginAsAdmin/, 'loginAsAdmin'],
  [/cy\.login\(/, 'cy.login'],
  [/Cypress\.env\(/, 'Cypress.env'],
  [/https?:\/\//, 'absolute URL'],
];

// A stub-only spec: calls cy.stubThinxApi(, carries none of SPEC_FORBIDDEN, and holds
// exactly `tests` it( tests.
function specHygiene(rel, { tests }) {
  const text = readSpec(rel);
  assert.ok(text.includes('cy.stubThinxApi('), rel + ' stubs the API');
  for (const [re, label] of SPEC_FORBIDDEN) assert.ok(!re.test(text), rel + ' has no ' + label);
  const count = (text.match(/^[ \t]*it\(/gm) || []).length;
  assert.equal(count, tests, rel + ' holds exactly ' + tests + ' tests');
  return count + ' tests';
}

check('Y1 deep-link.spec.js is stub-only, has no skip/only/retries/numeric wait/credentials, 8 tests', () =>
  specHygiene('integration/deep-link.spec.js', { tests: 8 }));

// ---------------------------------------------------------------- run

// An async check that never settles would otherwise let node drain its event loop
// and exit 0 with the remaining checks unreported.
let running = null;
process.on('beforeExit', () => {
  if (running === null) return;
  console.log('FAIL ' + running + ' (never settled)');
  process.exit(1);
});

(async () => {
  for (const [name, fn] of asyncChecks) {
    running = name;
    try {
      const detail = await fn();
      console.log('ok   ' + name + (typeof detail === 'string' ? ' (' + detail + ')' : ''));
    } catch (err) {
      failures++;
      console.log('FAIL ' + name + ' (' + String(err && err.message ? err.message : err).split('\n')[0] + ')');
    }
  }
  running = null;
  process.exit(failures ? 1 : 0);
})();

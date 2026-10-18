// Unit test for the v1.18 Phase 48.1 audit-gap closure (NOTIF-04, CI-07; audit gaps W1-W3).
//
// Plain-node checks, by prefix:
//   G  src/Routes.js admin guard: the profile is loaded before the admin check on a cold
//      reload, the guard fails closed, and no other route issues a request (W1, PD-01..PD-03);
//      auth/logout and the two sign-in pages reset the profile, so the guard's "decide from
//      the store" shortcut never reuses a previous account (48.1-REVIEW WR-01, G7/G8);
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
let reported = 0;

// Default output is one `ok   name (detail)` or `FAIL name (reason)` line per check, which
// test:unit and the plan verifies grep. `--tap` prints the same results as TAP version 13
// (`ok N - name` / `not ok N - name`, detail as a comment, a trailing plan), the report
// format the TDD RED-evidence classifier reads (48.1-02).
const TAP = process.argv.includes('--tap');
if (TAP) console.log('TAP version 13');
function report(ok, name, detail) {
  reported++;
  if (!ok) failures++;
  if (TAP) {
    console.log((ok ? 'ok ' : 'not ok ') + reported + ' - ' + name);
    if (detail) console.log('# ' + detail);
  } else {
    console.log((ok ? 'ok   ' : 'FAIL ') + name + (detail ? ' (' + detail + ')' : ''));
  }
}
const firstLine = (err) => String(err && err.message ? err.message : err).split('\n')[0];

function check(name, fn) {
  try {
    const detail = fn();
    report(true, name, typeof detail === 'string' ? detail : '');
  } catch (err) {
    report(false, name, firstLine(err));
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

// 48.1-REVIEW WR-01: the G4 shortcut (a non-empty profile is decided without a request) is only
// safe while the store never holds a previous account. An in-tab sign-out (Header.logout pushes
// /login without a reload) must therefore reset the profile, and the sign-in pages must reset it
// before their read, so a read that fails leaves {} rather than the other account's admin: true.
// clearSession itself must keep the profile: scheduleExpiry.expire calls it and then silently
// re-hydrates the same account, and the Header does not refetch.

// src/store/auth.js with its three imports stubbed (the token decoder, the legacy-storage
// scrub and the CSRF prime are not under test here).
const authStore = () => {
  const deps = {
    VueJwtDecode: { decode: () => ({ exp: Math.floor(Date.now() / 1000) + 3600 }) },
    clearLegacyAuthStorage: () => {},
    ensureCsrfToken: async () => '',
  };
  const code = read('store/auth.js').replace(/^import .*;?$/gm, '').replace(/export default /, 'return ');
  return new Function(...Object.keys(deps), code)(...Object.values(deps)); // eslint-disable-line no-new-func
};

const FIRST_ACCOUNT = () => ({ admin: true, username: 'first-account' });
const SECOND_ACCOUNT = () => ({ admin: false, username: 'second-account' });

checkAsync('G7 sign-out: auth/logout resets the profile to {} (clearSession alone keeps it), so the admin guard fetches the next account instead of reusing admin: true', async () => {
  const auth = authStore();
  const $api = { composePath: (p) => 'https://api.test/api/v2' + p, setAccessToken() {}, setRefreshToken() {} };
  const root = {
    auth: Object.assign({}, auth.state, { accessToken: 'tok', user: FIRST_ACCOUNT() }),
    profile: { profile: FIRST_ACCOUNT() },
  };
  const rootCommits = [];
  const ctx = {
    state: root.auth,
    commit: (type, payload, options) => {
      if (options && options.root) {
        rootCommits.push([type, payload]);
        assert.equal(type, 'profile/saveProfile', 'the only root commit is profile/saveProfile');
        root.profile.profile = payload;
        return;
      }
      auth.mutations[type].call({ $api }, root.auth, payload);
    },
    dispatch: (type, payload) => auth.actions[type].call({ $api }, ctx, payload),
  };
  const requests = [];
  const saved = globalThis.fetch;
  globalThis.fetch = (url, opts) => { requests.push([url, opts]); return Promise.resolve(fakeResponse(200, { success: true })); };
  try {
    // The expiry path: clearSession, then hydrateSession re-signs the same account.
    await ctx.dispatch('clearSession');
    assert.deepEqual(root.profile.profile, FIRST_ACCOUNT(), 'clearSession keeps the profile');
    assert.deepEqual(rootCommits, [], 'clearSession commits nothing at the root');
    root.auth.accessToken = 'tok';
    root.auth.user = FIRST_ACCOUNT();
    // The explicit sign-out.
    await ctx.dispatch('logout');
  } finally {
    globalThis.fetch = saved;
  }
  assert.equal(requests.length, 1, 'one logout request');
  assert.equal(requests[0][0], 'https://api.test/api/v2/logout', 'GET /logout');
  assert.equal(root.auth.accessToken, null, 'access token dropped');
  assert.equal(root.auth.user, null, 'user dropped');
  assert.deepEqual(root.profile.profile, {}, 'logout resets the profile to {}');
  assert.deepEqual(rootCommits, [['profile/saveProfile', {}]], 'one root commit of profile/saveProfile {}');

  // The second account signs in, and the guard decides from its own profile.
  const h = guardHarness({ token: 'tok', profile: root.profile.profile, loadProfile: (state) => { state.profile.profile = SECOND_ACCOUNT(); } });
  const r = await h.run(ADMIN_URL);
  assert.equal(r.settled, 'resolved', 'guard promise resolves');
  assert.deepEqual(r.dispatches, ['profile/fetchProfile'], 'the guard fetched the second account');
  assert.deepEqual(r.nextCalls, [['/app/dashboard']], 'the non-admin second account goes to the dashboard');
  return 'clearSession keeps, logout resets, guard fetches';
});

checkAsync('G8 sign-in: Login login() and OAuthReturn complete() reset the profile before the read, so a rejecting read hands {} to setUser and the admin guard fetches instead of reusing the previous account', async () => {
  // A profile store stand-in shared by the page stubs: what fetchProfile saw when it ran,
  // every profile/saveProfile commit, and the current value getProfile returns.
  const profileStore = () => {
    const s = { profile: FIRST_ACCOUNT(), reads: [], saves: [] };
    s.commit = (type, payload) => {
      if (type === 'profile/saveProfile') { s.saves.push(clone(payload)); s.profile = payload; return true; }
      return false;
    };
    s.fetchProfile = () => { s.reads.push(clone(s.profile)); return Promise.reject(new Error('Could not reach the server.')); };
    s.getProfile = () => s.profile;
    return s;
  };

  const login = profileStore();
  const loginCommits = [];
  const loginVm = pageVm(loginPage().def, {
    $refs: { username: { value: 'cypress-test' }, password: { value: 'secret' } },
    $hostnames: { API: 'https://api.test/api/v2' },
    $rollbar: null,
    isTokenValid: async () => true,
    persistSession: async () => {},
    isAuthenticated: () => true,
    fetchProfile: login.fetchProfile,
    getProfile: login.getProfile,
    $store: { commit: (t, p) => { if (!login.commit(t, p)) loginCommits.push([t, clone(p)]); } },
    pushIfNeeded: async () => {},
  });
  const r1 = await withUnhandled(() => loginPage().def.methods.login.call(loginVm, { preventDefault() {} }));
  assert.equal(r1.settled, 'resolved', 'Login: login() resolves');
  assert.deepEqual(r1.unhandled, [], 'Login: no unhandled rejection');
  assert.deepEqual(login.saves, [{}], 'Login: one profile/saveProfile {} commit');
  assert.deepEqual(login.reads, [{}], 'Login: fetchProfile ran after the reset (saw {})');
  assert.deepEqual(loginCommits, [['auth/setUser', {}]], 'Login: auth/setUser gets {}, not the previous account');

  const oauth = profileStore();
  const users = [];
  const oauthVm = pageVm(oauthReturnPage().def, {
    $route: { query: { t: 'one-shot-token' } },
    $hostnames: { API: 'https://api.test/api/v2' },
    isTokenValid: async () => true,
    persistSession: async () => {},
    isAuthenticated: () => true,
    fetchProfile: oauth.fetchProfile,
    getProfile: oauth.getProfile,
    setUser: (p) => users.push(clone(p)),
    $store: { commit: (t, p) => { assert.ok(oauth.commit(t, p), 'OAuthReturn: only profile/saveProfile is committed through $store, got ' + t); } },
    $router: { push: () => Promise.resolve() },
  });
  const r2 = await withUnhandled(() => oauthReturnPage().def.methods.complete.call(oauthVm));
  assert.equal(r2.settled, 'resolved', 'OAuthReturn: complete() resolves');
  assert.deepEqual(r2.unhandled, [], 'OAuthReturn: no unhandled rejection');
  assert.deepEqual(oauth.saves, [{}], 'OAuthReturn: one profile/saveProfile {} commit');
  assert.deepEqual(oauth.reads, [{}], 'OAuthReturn: fetchProfile ran after the reset (saw {})');
  assert.deepEqual(users, [{}], 'OAuthReturn: setUser gets {}, not the previous account');

  // Either store now holds {}: the guard fetches the signed-in account and fails closed.
  for (const [label, s] of [['Login', login], ['OAuthReturn', oauth]]) {
    const h = guardHarness({ token: 'tok', profile: s.profile, loadProfile: () => { throw new Error('network'); } });
    const r = await h.run(ADMIN_URL);
    assert.deepEqual(r.dispatches, ['profile/fetchProfile'], label + ': the guard fetched');
    assert.deepEqual(r.nextCalls, [['/app/dashboard']], label + ': fails closed to the dashboard');
  }
  return 'Login, OAuthReturn';
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
// exactly `tests` it( tests. With `unstubbed` (48.1-03, PD-08) every test must also assert
// that the catch-all recorded nothing (`@unstubbed.all` has length 0), so a request that
// would otherwise reach the dev-server proxy fails the spec; deep-link.spec.js keeps it off
// because its logged-out tests legitimately reach the catch-all.
function specHygiene(rel, { tests, unstubbed = false }) {
  const text = readSpec(rel);
  assert.ok(text.includes('cy.stubThinxApi('), rel + ' stubs the API');
  for (const [re, label] of SPEC_FORBIDDEN) assert.ok(!re.test(text), rel + ' has no ' + label);
  const count = (text.match(/^[ \t]*it\(/gm) || []).length;
  assert.equal(count, tests, rel + ' holds exactly ' + tests + ' tests');
  if (unstubbed) {
    const bodies = text.split(/^[ \t]*it\(/m).slice(1);
    bodies.forEach((body, i) => {
      assert.ok(/@unstubbed\.all'\)\.should\('have\.length',\s*0\)/.test(body), rel + ' test ' + (i + 1) + ' asserts @unstubbed.all has length 0');
    });
  }
  return count + ' tests' + (unstubbed ? ', each asserting an empty catch-all' : '');
}

// Fixtures the 48.1-03 specs add (T-48.1-11): each parses as JSON and none carries key
// material, a token header or an e-mail address outside example.test.
const FIXTURE_FORBIDDEN = [
  [/PRIVATE KEY/, 'PRIVATE KEY'],
  [/BEGIN/, 'BEGIN'],
  [/Bearer/, 'Bearer'],
  [/Authorization/, 'Authorization'],
];
function fixtureHygiene(files) {
  for (const rel of files) {
    const text = readSpec(path.join('fixtures', 'api', rel));
    JSON.parse(text);
    for (const [re, label] of FIXTURE_FORBIDDEN) assert.ok(!re.test(text), rel + ' has no ' + label);
    const emails = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
    for (const address of emails) {
      assert.equal(address.slice(address.indexOf('@') + 1), 'example.test', rel + ': e-mail domain of ' + address);
    }
  }
  return files.length + ' fixtures';
}

check('Y1 deep-link.spec.js is stub-only, has no skip/only/retries/numeric wait/credentials, 8 tests', () =>
  specHygiene('integration/deep-link.spec.js', { tests: 8 }));

// 48.1-03 (audit W3): the specs that cover the Phase 45-47 pages in the gating suite, with
// their pinned test counts (plan 48.1-03 interface contract).
const W3_SPECS = [
  ['integration/rsakeys.spec.js', 3],
  ['integration/transformers.spec.js', 2],
  ['integration/enviros.spec.js', 2],
  ['integration/repositories.spec.js', 2],
  ['integration/build-log-search.spec.js', 3],
];
for (const [rel, tests] of W3_SPECS) {
  check('Y1 ' + path.basename(rel) + ' is stub-only, has no skip/only/retries/numeric wait/credentials, ' + tests + ' tests, each asserting an empty catch-all', () =>
    specHygiene(rel, { tests, unstubbed: true }));
}

// The default stubs and the opt-in command 48.1-03 adds to api-stubs.js, and the fixtures
// its header comment map must name.
const W3_STUB_ALIASES = ['getRsakeys', 'renameRsakey', 'deleteRsakeys', 'putEnv'];
const W3_STUB_COMMANDS = ['stubSources'];
const W3_FIXTURES = [
  'rsakeys.json', 'rsakeys-after-rename.json', 'rsakeys-after-delete.json',
  'profile-transformers.json', 'profile-transformers-after-delete.json',
  'sources.json', 'build-log-detail.json',
];

check('Y2 api-stubs.js registers the 48.1-03 aliases and commands and its comment map names every 48.1-03 fixture', () => {
  const text = readSpec('support/api-stubs.js');
  const header = text.slice(0, text.indexOf('\nimport '));
  for (const alias of W3_STUB_ALIASES) assert.ok(text.includes(".as('" + alias + "')"), 'alias ' + alias);
  for (const command of W3_STUB_COMMANDS) assert.ok(text.includes("Cypress.Commands.add('" + command + "'"), 'command ' + command);
  for (const fixture of W3_FIXTURES) assert.ok(header.includes(fixture), 'comment map names ' + fixture);
  return W3_STUB_ALIASES.concat(W3_STUB_COMMANDS).join(', ') + '; ' + W3_FIXTURES.length + ' fixtures mapped';
});

check('Y3 the 48.1-03 fixtures parse as JSON and hold no key material, token header or e-mail outside example.test', () =>
  fixtureHygiene(W3_FIXTURES));

// ---------------------------------------------------------------- loaders (48.1-02)
// Copied from close-out-v118.cjs, not required from it.

// Load an SFC: the template must compile without errors; the script is evaluated
// with its import lines stripped and the named dependencies in scope. The compiled
// render functions are attached so the definition can be mounted as a component.
function loadSfc(rel, deps = {}) {
  const source = read(rel);
  const sfc = compiler.parseComponent(source);
  const template = sfc.template.content;
  assert.deepEqual(compiler.compile(template, { whitespace: 'condense' }).errors, [], rel + ' template compiles');
  const code = sfc.script.content
    .replace(/^import .*;?$/gm, '')
    .replace(/export default /g, 'module.exports.default = ');
  const all = {
    mapGetters: () => ({}),
    mapActions: () => ({}),
    ...deps,
  };
  const mod = { exports: {} };
  new Function('module', ...Object.keys(all), code)(mod, ...Object.values(all)); // eslint-disable-line no-new-func
  const def = mod.exports.default;
  const compiled = compiler.compileToFunctions(template, { whitespace: 'condense' });
  def.render = compiled.render;
  def.staticRenderFns = compiled.staticRenderFns;
  return { def, source, template };
}

// Evaluate a plain ES module from src/ and return its named exports.
function loadModule(rel, transform = (s) => s) {
  const names = [];
  const code = transform(read(rel))
    .replace(/^import .*;?$/gm, '')
    .replace(/export (const|let|function|async function) (\w+)/g, (m, kind, name) => { names.push(name); return kind + ' ' + name; });
  return new Function(code + '\nreturn { ' + names.join(', ') + ' };')(); // eslint-disable-line no-new-func
}
void loadModule;

// A store module's default export (a fresh object per call).
const loadStore = (rel) => new Function(read(rel).replace(/^import .*;?$/gm, '').replace(/export default /, 'return '))(); // eslint-disable-line no-new-func

function withWarnings(fn) {
  const warnings = [];
  const prev = Vue.config.warnHandler;
  Vue.config.warnHandler = (msg) => warnings.push(msg);
  renderError = null;
  let out;
  try { out = fn(); } finally { Vue.config.warnHandler = prev; }
  const err = renderError;
  renderError = null;
  return { out, warnings, error: err };
}

// Render a page definition with the given state and component overrides.
function renderPage(def, state = {}, components = {}) {
  const vm = new Vue({
    render: def.render,
    staticRenderFns: def.staticRenderFns,
    data: def.data,
    computed: def.computed,
    methods: def.methods,
    filters: def.filters,
    watch: def.watch,
    components: Object.assign({}, def.components, components),
  });
  vm.$route = { params: {} };
  Object.assign(vm, { loading: false }, state);
  const { out, warnings, error } = withWarnings(() => vm._render());
  return { vm, vnode: out, warnings, error };
}

// ---------------------------------------------------------------- vnode walkers

function nodesOf(top) {
  const out = [];
  (function walk(n) {
    if (!n) return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    out.push(n);
    (n.children || []).forEach(walk);
    const slots = n.data && n.data.scopedSlots;
    if (slots && !n.componentOptions) {
      Object.keys(slots).filter((k) => k[0] !== '$' && typeof slots[k] === 'function').forEach((k) => walk(slots[k]({})));
    }
  })(top);
  return out;
}

// b-button is a plain element here; mirror bootstrap-vue 2.21.2 BButton computeAttrs for
// aria-pressed (48-05, D-14). Every other element reports the attrs the template passed.
const attrsOf = (n) => {
  const attrs = (n && n.data && n.data.attrs) || {};
  if (!n || n.tag !== 'b-button') return attrs;
  const out = Object.assign({}, attrs);
  delete out['aria-pressed'];
  if (typeof attrs.pressed === 'boolean') out['aria-pressed'] = String(attrs.pressed);
  return out;
};
const cyOf = (n) => attrsOf(n)['data-cy'] || null;
const byCy = (top, cy) => nodesOf(top).filter((n) => cyOf(n) === cy);

function classList(n) {
  const out = [];
  const add = (c) => {
    if (!c) return;
    if (typeof c === 'string') c.split(/\s+/).filter(Boolean).forEach((x) => out.push(x));
    else if (Array.isArray(c)) c.forEach(add);
    else if (typeof c === 'object') Object.keys(c).filter((k) => c[k]).forEach((k) => out.push(k));
  };
  if (n && n.data) { add(n.data.staticClass); add(n.data.class); }
  return out;
}
void classList;

const isComponent = (n, name) => !!(n && n.componentOptions && n.componentOptions.Ctor.options.name === name);
const componentsOf = (top, name) => nodesOf(top).filter((n) => isComponent(n, name));
const textOf = (top) => nodesOf(top).filter((n) => !n.tag && n.text).map((n) => n.text).join(' ').replace(/\s+/g, ' ').trim();
const propsOf = (n) => (n && n.componentOptions && n.componentOptions.propsData) || {};
// Danger alerts of the page itself: a b-alert inside a b-modal (the create dialog's own
// alert) is not the page's load error and is not counted.
function dangerAlerts(top) {
  const out = [];
  (function walk(n) {
    if (!n) return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n.tag === 'b-modal') return;
    if (n.tag === 'b-alert' && attrsOf(n).variant === 'danger') out.push(n);
    (n.children || []).forEach(walk);
  })(top);
  return out;
}
const insideModal = (top) => nodesOf(top).filter((n) => n.tag === 'b-modal').flatMap((m) => nodesOf(m.children || []));

// core/api.js with the real utils/cookies.js inlined, so the CSRF prime and retry are the
// shipped code. Each call returns a fresh module (its own in-flight prime).
function apiWithCookies() {
  const strip = (s) => s
    .replace(/^import .*;?$/gm, '')
    .replace(/^export default \{[^}]*\};?$/m, '')
    .replace(/export (const|let|function|async function) (\w+)/g, '$1 $2');
  const code = strip(read('utils/cookies.js')) + '\n'
    + strip(read('core/api.js')).replace('export default class Api', 'const Api = class Api')
    + '\nreturn Api;';
  return new Function(code)(); // eslint-disable-line no-new-func
}

// A fetch Response stand-in with the members api.js and cookies.js read.
function fakeResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
    clone() { return fakeResponse(status, body); },
  };
}

const clone = (v) => JSON.parse(JSON.stringify(v));
const NETWORK_FAIL = () => Promise.reject(new TypeError('Failed to fetch'));
const REPLY = (status, body) => async () => fakeResponse(status, body);

// Run one store action against the real Api (core/api.js with utils/cookies.js inlined) over
// a temporarily replaced globalThis.fetch. commit goes to the module's mutations and dispatch
// to the module's own actions with the same context, so a follow-up read inside an action
// runs the shipped code path. fetch is always restored. Returns the module state and how the
// action settled: { value } or { error }.
async function storeRun(rel, action, { fetchImpl, state: seed = {}, args = [] } = {}) {
  const Api = apiWithCookies();
  const mod = loadStore(rel);
  const state = typeof mod.state === 'function' ? mod.state() : mod.state;
  Object.assign(state, seed);
  const $api = new Api('https://api.test');
  const ctx = {
    state,
    commit: (type, payload) => mod.mutations[type](state, payload),
    dispatch: (type, payload) => mod.actions[type].call({ $api }, ctx, payload),
  };
  const saved = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    const outcome = await mod.actions[action].call({ $api }, ctx, ...args).then((v) => ({ value: v }), (e) => ({ error: e }));
    return { state, outcome, mod };
  } finally {
    globalThis.fetch = saved;
  }
}

// Run fn while listening for unhandled rejections; report how its return value settled and
// every rejection nobody handled within a few event-loop turns. The listener is removed
// afterwards, so a later unhandled rejection still ends the process as usual.
async function withUnhandled(fn) {
  const unhandled = [];
  const onUnhandled = (reason) => { unhandled.push(reason); };
  process.on('unhandledRejection', onUnhandled);
  try {
    const returned = fn();
    const settled = await settledWithin(Promise.resolve(returned));
    for (let i = 0; i < 5; i++) await tick();
    return { returned, settled, unhandled };
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
}

// A page instance for driving methods: the page's data() plus its methods plus overrides
// (store getter/action stubs and recorders), so `this.x()` inside a method finds `x`.
const pageVm = (def, over = {}) => Object.assign(def.data(), def.methods, over);

// ---------------------------------------------------------------- store network contract (S) and page load errors (P)
//
// Audit gap W2 (48.1-02, PD-04, PD-05, PD-09): a request that never got a response
// (result.networkError) throws `Could not reach the server.` out of the store's fetch action
// and leaves the store state untouched; a refused reply or an empty success envelope resolves
// as before. The page shows exactly one load-error alert and no stale rows. A write the
// server stored stays a success when only its follow-up read fails (refreshed: false).
// The checks are table-driven: each title lists the subjects it covers.

const LIST_STUB = { List: { name: 'List', props: ['datasource', 'dataheaders', 'showLoading'], render: (h) => h('div') } };

const LIST_SUBJECTS = [
  {
    name: 'apikeys',
    store: 'store/apikeys.js',
    fetch: 'fetchItems',      // the action that throws on a network failure
    refresh: 'fetchItems',    // the follow-up read a stored write dispatches
    key: 'items',
    empty: [],
    rows: () => [
      { id: '0', display: '…' + 'a'.repeat(10), name: 'a'.repeat(20), hash: 'h'.repeat(64), alias: 'one' },
      { id: '1', display: '…' + 'b'.repeat(10), name: 'b'.repeat(20), hash: 'i'.repeat(64), alias: 'two' },
    ],
    writes: [
      { action: 'createItem', arg: 'alias' },
      { action: 'deleteItems', arg: ['h'.repeat(64)] },
    ],
    page: 'pages/Apikeys/Apikeys.vue',
    pageDeps: {},
    cy: 'apikeys-load-error',
    copy: 'Could not load API keys. Refresh to retry.',
    deleteFailure: 'Failed to delete API keys.',
    deleteArg: (row) => row.hash,
  },
  {
    name: 'channels',
    store: 'store/channels.js',
    fetch: 'fetchItems',
    refresh: 'fetchItems',
    key: 'items',
    empty: [],
    rows: () => [
      { id: '0', mesh_id: 'living-room', alias: 'Living Room' },
      { id: '1', mesh_id: 'garage', alias: 'Garage' },
    ],
    writes: [
      { action: 'createItem', arg: { mesh_id: 'attic', alias: 'Attic' } },
      { action: 'deleteItems', arg: ['living-room'] },
    ],
    page: 'pages/Channels/Channels.vue',
    pageDeps: {},
    cy: 'channels-load-error',
    copy: 'Could not load mesh channels. Refresh to retry.',
    deleteFailure: 'Failed to delete mesh channels.',
    deleteArg: (row) => row.mesh_id,
  },
  {
    name: 'repositories',
    store: 'store/repositories.js',
    fetch: 'fetchRepositories',
    alias: 'fetchItems',            // delegates through dispatch('fetchRepositories')
    refresh: 'fetchRepositories',
    key: 'items',
    empty: [],
    rows: () => [
      { id: 'r'.repeat(64), alias: 'firmware', url: 'https://example.invalid/firmware.git', branch: 'origin/master', platform: 'arduino:esp8266' },
      { id: 's'.repeat(64), alias: 'sensors', url: 'https://example.invalid/sensors.git', branch: 'origin/main', platform: 'unknown_platform' },
    ],
    writes: [
      { action: 'createItem', arg: { url: 'https://example.invalid/new.git', alias: 'new', branch: 'origin/master', is_private: false } },
      { action: 'deleteItems', arg: ['r'.repeat(64)] },
    ],
    page: 'pages/Repositories/Repositories.vue',
    pageDeps: { PlatformBullet: { name: 'PlatformBullet', props: ['platform'], render: (h) => h('span') } },
    cy: 'repositories-load-error',
    copy: 'Could not load repositories. Refresh to retry.',
    deleteFailure: 'Failed to delete repositories.',
    deleteArg: (row) => row.id,
    platformSlot: true,             // the List keeps its #cell(platform) PlatformBullet slot
    modalAlert: true,               // the create dialog carries its own danger alert
  },
];
LIST_SUBJECTS.forEach((s) => { s.load = lazy(() => loadSfc(s.page, Object.assign({}, LIST_STUB, s.pageDeps))); });

const subjectsOf = (list) => list.map((s) => s.name).join(', ');
// The profile store joins the S checks: one object instead of a list, the same contract.
const PROFILE = () => ({
  owner: 'o'.repeat(64), username: 'cypress-test', avatar: '', admin: false,
  info: { first_name: 'Ada', last_name: 'Lovelace', mobile_phone: '+1 555 0100', timezone_abbr: 'Europe/Prague', notifications: { all: false, important: true, info: false } },
});
const PROFILE_SUBJECT = {
  name: 'profile',
  store: 'store/profile.js',
  fetch: 'fetchProfile',
  refresh: 'fetchProfile',
  key: 'profile',
  empty: {},                      // an empty success envelope saves result.response || {}
  rows: PROFILE,
  writes: [
    { action: 'updateProfile', arg: { first_name: 'Grace' } },
    { action: 'uploadAvatar', arg: 'QUJD' },
  ],
};
const STORE_SUBJECTS = LIST_SUBJECTS.concat([PROFILE_SUBJECT]);

checkAsync('S1 a network failure throws Could not reach the server. and leaves the store state untouched: ' + subjectsOf(STORE_SUBJECTS), async () => {
  for (const s of STORE_SUBJECTS) {
    const seeded = s.rows();
    const { state, outcome } = await storeRun(s.store, s.fetch, { fetchImpl: NETWORK_FAIL, state: { [s.key]: clone(seeded) } });
    assert.ok(outcome.error instanceof Error, s.name + '/' + s.fetch + ' rejects on a network failure (resolved with ' + JSON.stringify(outcome.value) + ')');
    assert.equal(outcome.error.message, 'Could not reach the server.', s.name + ': the message');
    assert.deepEqual(state[s.key], seeded, s.name + ': the state is untouched');
  }
  return subjectsOf(STORE_SUBJECTS);
});

checkAsync('S1b repositories/fetchItems rejects when its dispatch to fetchRepositories rejects and resolves the list when it works', async () => {
  const s = LIST_SUBJECTS.find((x) => x.alias);
  const seeded = s.rows();
  const off = await storeRun(s.store, s.alias, { fetchImpl: NETWORK_FAIL, state: { [s.key]: clone(seeded) } });
  assert.ok(off.outcome.error instanceof Error, s.name + '/' + s.alias + ' rejects on a network failure (resolved with ' + JSON.stringify(off.outcome.value) + ')');
  assert.equal(off.outcome.error.message, 'Could not reach the server.', 'the message');
  assert.deepEqual(off.state[s.key], seeded, 'the state is untouched');
  const ok = await storeRun(s.store, s.alias, { fetchImpl: REPLY(200, { success: true, response: [{ id: 'x', alias: 'x' }] }), state: { [s.key]: [] } });
  assert.ok(!ok.outcome.error, 'a working read resolves');
  assert.equal(ok.state[s.key].length, 1, 'the list was saved');
  return s.name + '/' + s.alias;
});

checkAsync('S2 a refused reply (502 JSON) resolves and keeps the state, an empty success envelope resolves: ' + subjectsOf(STORE_SUBJECTS), async () => {
  for (const s of STORE_SUBJECTS) {
    const seeded = s.rows();
    const refused = await storeRun(s.store, s.fetch, { fetchImpl: REPLY(502, { error: 'bad gateway' }), state: { [s.key]: clone(seeded) } });
    assert.ok(!refused.outcome.error, s.name + ': a 502 reply resolves (' + (refused.outcome.error && refused.outcome.error.message) + ')');
    assert.deepEqual(refused.state[s.key], seeded, s.name + ': a 502 reply keeps the state');
    const empty = await storeRun(s.store, s.fetch, { fetchImpl: REPLY(200, { success: true }), state: { [s.key]: clone(seeded) } });
    assert.ok(!empty.outcome.error, s.name + ': an empty success envelope resolves (' + (empty.outcome.error && empty.outcome.error.message) + ')');
    assert.deepEqual(empty.state[s.key], s.empty, s.name + ': an empty envelope leaves ' + JSON.stringify(s.empty));
  }
  return subjectsOf(STORE_SUBJECTS);
});

checkAsync('S3 a stored write with a failing follow-up read resolves with refreshed: false; a working follow-up and a failed write return the result unchanged: ' + subjectsOf(STORE_SUBJECTS), async () => {
  const covered = [];
  for (const s of STORE_SUBJECTS) {
    const mod = loadStore(s.store);
    const state = typeof mod.state === 'function' ? mod.state() : mod.state;
    for (const w of s.writes) {
      const label = s.name + '/' + w.action;
      const WRITE_OK = { success: true, response: { ok: true } };
      const WRITE_FAIL = { success: false, message: 'refused' };
      const run = async (write, followUp) => {
        const dispatched = [];
        const ctx = { state, commit() {}, dispatch: (type) => { dispatched.push(type); return followUp(); } };
        const reply = async () => clone(write);
        const $api = { $get: reply, $post: reply, $put: reply, $delete: reply };
        let result;
        try {
          result = await mod.actions[w.action].call({ $api }, ctx, w.arg);
        } catch (err) {
          throw new Error(label + ' rejects (' + (err && err.message) + ') instead of resolving the write result');
        }
        return { result, dispatched };
      };
      const ok = await run(WRITE_OK, () => Promise.resolve());
      assert.deepEqual(ok.result, WRITE_OK, label + ': a working follow-up returns the write result unchanged');
      assert.deepEqual(ok.dispatched, [s.refresh], label + ': one follow-up ' + s.refresh);
      const off = await run(WRITE_OK, () => Promise.reject(new Error('Could not reach the server.')));
      assert.deepEqual(off.result, Object.assign({}, WRITE_OK, { refreshed: false }), label + ': a failed follow-up resolves the result plus refreshed: false');
      assert.deepEqual(off.dispatched, [s.refresh], label + ': the follow-up was attempted once');
      const failed = await run(WRITE_FAIL, () => Promise.resolve());
      assert.deepEqual(failed.result, WRITE_FAIL, label + ': a failed write returns its result unchanged');
      assert.deepEqual(failed.dispatched, [], label + ': no follow-up after a failed write');
      covered.push(label);
    }
  }
  return covered.join(', ');
});

checkAsync('P1 loadData with a rejecting fetch resolves, clears rows, selection and action error, sets loadFailed and clears loading: ' + subjectsOf(LIST_SUBJECTS), async () => {
  for (const s of LIST_SUBJECTS) {
    const { def } = s.load();
    const stale = s.rows();
    const vm = pageVm(def, {
      items: clone(stale), selectedIds: [stale[0].id], isSelected: true, selectedCount: 1, error: s.deleteFailure, loading: false,
      fetchItems: () => Promise.reject(new Error('Could not reach the server.')),
      getItems: () => stale,
      getHeaders: () => [],
    });
    const { settled, unhandled } = await withUnhandled(() => def.methods.loadData.call(vm));
    assert.deepEqual(unhandled.map((e) => String(e && e.message)), [], s.name + ': no unhandled rejection');
    assert.equal(settled, 'resolved', s.name + ': loadData resolves');
    assert.deepEqual(vm.items, [], s.name + ': rows cleared');
    assert.deepEqual(vm.selectedIds, [], s.name + ': selection cleared');
    assert.equal(vm.isSelected, false, s.name + ': isSelected false');
    assert.equal(vm.selectedCount, 0, s.name + ': selectedCount 0');
    assert.equal(vm.loadFailed, true, s.name + ': loadFailed true');
    assert.equal(vm.loading, false, s.name + ': loading false');
    assert.equal(vm.error, null, s.name + ': action error cleared');
  }
  return subjectsOf(LIST_SUBJECTS);
});

checkAsync('P2 loadData with a working fetch fills items and headers from the getters and clears loadFailed, on a first load and on a retry after a failed load: ' + subjectsOf(LIST_SUBJECTS), async () => {
  for (const s of LIST_SUBJECTS) {
    const { def } = s.load();
    const fresh = s.rows();
    const headers = [{ title: 'Alias', prop: 'alias', pos: 0 }];
    const first = pageVm(def, { fetchItems: () => Promise.resolve(fresh), getItems: () => fresh, getHeaders: () => headers });
    await def.methods.loadData.call(first);
    assert.deepEqual(first.items, fresh, s.name + ': first load fills items');
    assert.deepEqual(first.headers, headers, s.name + ': first load fills headers');
    assert.equal(first.loadFailed, false, s.name + ': first load loadFailed false');
    assert.equal(first.loading, false, s.name + ': first load loading false');

    let fail = true;
    const retry = pageVm(def, {
      fetchItems: () => (fail ? Promise.reject(new Error('Could not reach the server.')) : Promise.resolve(fresh)),
      getItems: () => fresh,
      getHeaders: () => headers,
    });
    await withUnhandled(() => def.methods.loadData.call(retry));
    assert.equal(retry.loadFailed, true, s.name + ': the failed load set loadFailed');
    fail = false;
    await def.methods.loadData.call(retry);
    assert.deepEqual(retry.items, fresh, s.name + ': the retry fills items');
    assert.deepEqual(retry.headers, headers, s.name + ': the retry fills headers');
    assert.equal(retry.loadFailed, false, s.name + ': the retry clears loadFailed');
    assert.equal(retry.loading, false, s.name + ': the retry clears loading');
  }
  return subjectsOf(LIST_SUBJECTS);
});

checkAsync('P3 render: loadFailed shows exactly one load-error alert with the fixed copy and no List; otherwise one List with the rows and no alert: ' + subjectsOf(LIST_SUBJECTS), async () => {
  for (const s of LIST_SUBJECTS) {
    const { def } = s.load();
    const stale = s.rows();
    const failed = renderPage(def, { loadFailed: true, items: clone(stale), headers: [], error: null, loading: false });
    assert.equal(failed.error, null, s.name + ': the failed page renders without error');
    assert.deepEqual(failed.warnings, [], s.name + ': the failed page renders without Vue warnings');
    const alerts = byCy(failed.vnode, s.cy);
    assert.equal(alerts.length, 1, s.name + ': exactly one ' + s.cy + ' element');
    assert.equal(attrsOf(alerts[0]).variant, 'danger', s.name + ': the alert is a danger alert');
    assert.equal(textOf(alerts[0]), s.copy, s.name + ': the alert copy');
    assert.equal(componentsOf(failed.vnode, 'List').length, 0, s.name + ': no List while loadFailed');
    assert.equal(dangerAlerts(failed.vnode).length, 1, s.name + ': no other danger alert');

    const ok = renderPage(def, { loadFailed: false, items: clone(stale), headers: [], error: null, loading: false });
    assert.equal(ok.error, null, s.name + ': the loaded page renders without error');
    assert.deepEqual(ok.warnings, [], s.name + ': the loaded page renders without Vue warnings');
    const lists = componentsOf(ok.vnode, 'List');
    assert.equal(lists.length, 1, s.name + ': one List');
    assert.deepEqual(propsOf(lists[0]).datasource, stale, s.name + ': the List shows the rows');
    assert.equal(byCy(ok.vnode, s.cy).length, 0, s.name + ': no load-error alert');
  }
  return subjectsOf(LIST_SUBJECTS);
});

checkAsync('P3b Repositories keeps the PlatformBullet #cell(platform) slot on its List when the load worked', async () => {
  const s = LIST_SUBJECTS.find((x) => x.platformSlot);
  const { def } = s.load();
  const ok = renderPage(def, { loadFailed: false, items: clone(s.rows()), headers: [], error: null, loading: false });
  assert.equal(ok.error, null, 'renders without error');
  const lists = componentsOf(ok.vnode, 'List');
  assert.equal(lists.length, 1, 'one List');
  const slots = (lists[0].data && lists[0].data.scopedSlots) || {};
  assert.ok(typeof slots['cell(platform)'] === 'function', 'the List has a cell(platform) scoped slot');
  const cell = slots['cell(platform)']({ value: 'arduino:esp8266' });
  const bullets = componentsOf(cell, 'PlatformBullet');
  assert.equal(bullets.length, 1, 'the slot renders one PlatformBullet');
  assert.equal(propsOf(bullets[0]).platform, 'arduino:esp8266', 'with the cell value as its platform');
  return s.name;
});

checkAsync('P3c Repositories: the create-dialog alert inside the modal is not the load error; only the repositories-load-error marker is', async () => {
  const s = LIST_SUBJECTS.find((x) => x.modalAlert);
  const { def } = s.load();
  const failed = renderPage(def, { loadFailed: true, items: [], headers: [], error: null, loading: false });
  assert.equal(failed.error, null, 'renders without error');
  const modalAlerts = insideModal(failed.vnode).filter((n) => n.tag === 'b-alert');
  assert.equal(modalAlerts.length, 1, 'the create dialog keeps its own alert');
  assert.equal(cyOf(modalAlerts[0]), null, 'the dialog alert carries no load-error marker');
  assert.equal(byCy(failed.vnode, s.cy).length, 1, 'exactly one ' + s.cy + ' element on the page');
  assert.ok(!insideModal(failed.vnode).some((n) => cyOf(n) === s.cy), 'the load error is outside the modal');
  return s.name;
});

checkAsync('P4 deleteSelected: a stored delete re-syncs the rows from the store without loadData, refreshed: false calls loadData once, a failed delete keeps the rows and shows the failure; the selection is cleared each time: ' + subjectsOf(LIST_SUBJECTS), async () => {
  for (const s of LIST_SUBJECTS) {
    const { def } = s.load();
    const stale = s.rows();
    const fresh = [stale[1]];
    const run = async (result, label) => {
      const loads = [];
      const deleted = [];
      const vm = pageVm(def, {
        items: clone(stale), selectedIds: [stale[0].id], isSelected: true, selectedCount: 1, error: null, loading: false, loadFailed: false,
        deleteItems: async (ids) => { deleted.push(ids); return clone(result); },
        getItems: () => fresh,
        getHeaders: () => [],
        loadData: async () => { loads.push(1); },
      });
      await def.methods.deleteSelected.call(vm);
      assert.deepEqual(deleted, [[s.deleteArg(stale[0])]], s.name + ' ' + label + ': deletes the selected row');
      assert.deepEqual(vm.selectedIds, [], s.name + ' ' + label + ': selection cleared');
      assert.equal(vm.isSelected, false, s.name + ' ' + label + ': isSelected false');
      assert.equal(vm.selectedCount, 0, s.name + ' ' + label + ': selectedCount 0');
      return { vm, loads };
    };
    const ok = await run({ success: true }, 'success');
    assert.deepEqual(ok.vm.items, fresh, s.name + ' success: rows re-synced from the store');
    assert.deepEqual(ok.loads, [], s.name + ' success: no loadData');
    assert.equal(ok.vm.error, null, s.name + ' success: no error');
    const off = await run({ success: true, refreshed: false }, 'refreshed: false');
    assert.deepEqual(off.loads, [1], s.name + ' refreshed: false: one loadData');
    assert.equal(off.vm.error, null, s.name + ' refreshed: false: no error');
    const failed = await run({ success: false }, 'failure');
    assert.deepEqual(failed.vm.items, stale, s.name + ' failure: rows kept');
    assert.equal(failed.vm.error, s.deleteFailure, s.name + ' failure: the fixed failure text');
    assert.deepEqual(failed.loads, [], s.name + ' failure: no loadData');
    const message = await run({ success: false, message: 'server says' }, 'failure with message');
    assert.equal(message.vm.error, 'server says', s.name + ' failure with message: the result message');
  }
  return subjectsOf(LIST_SUBJECTS);
});

// ---------------------------------------------------------------- Profile page (P5) and fetchProfile callers (K)
//
// profile/fetchProfile can now reject (PD-04), so every caller must absorb it (PD-06): the
// Profile page shows one load error, Header keeps a blank name and retries on the next mount,
// Login and OAuthReturn still reach the dashboard (an unhandled rejection from the Header's
// fetchProfile is what ended deep-link test 4 in 48-08), DeviceDetail reads repositories through
// allSettled.

const profilePage = lazy(() => loadSfc('pages/Profile/Profile.vue', {
  avatarDataUri: () => null,
  require: () => 'default_avatar_sm.png',
}));

checkAsync('P5 Profile: a failed read resolves loadProfile with a blank form and one profile-load-error alert in place of the tabs; a working read fills the form; saveProfile and saveAvatar reload on refreshed: false and keep the store copy otherwise', async () => {
  const { def } = profilePage();
  const COPY = 'Could not load your profile. Refresh to retry.';
  const blankForm = { first_name: '', last_name: '', mobile_phone: '', timezone_abbr: '' };

  const failed = pageVm(def, { fetchProfile: () => Promise.reject(new Error('Could not reach the server.')), getProfile: () => ({}) });
  failed.profile = PROFILE();
  Object.assign(failed.form, { first_name: 'stale', last_name: 'stale', mobile_phone: 'stale', timezone_abbr: 'stale' });
  Object.assign(failed.notifForm, { all: false, important: true, info: true });
  failed.error = 'Failed to update profile.';
  const r = await withUnhandled(() => def.methods.loadProfile.call(failed));
  assert.deepEqual(r.unhandled.map((e) => String(e && e.message)), [], 'failed read: no unhandled rejection');
  assert.equal(r.settled, 'resolved', 'failed read: loadProfile resolves');
  assert.equal(failed.loadFailed, true, 'failed read: loadFailed true');
  assert.equal(failed.loading, false, 'failed read: loading false');
  assert.equal(failed.profile, null, 'failed read: profile null');
  assert.deepEqual(failed.form, blankForm, 'failed read: the form is blank');
  assert.deepEqual(failed.notifForm, { all: false, important: false, info: false }, 'failed read: notification flags cleared');
  assert.equal(failed.error, null, 'failed read: action error cleared');

  const page = renderPage(def, { loading: false, loadFailed: true, profile: null, error: null, message: null });
  assert.equal(page.error, null, 'failed page renders without error');
  assert.deepEqual(page.warnings, [], 'failed page renders without Vue warnings');
  const alerts = byCy(page.vnode, 'profile-load-error');
  assert.equal(alerts.length, 1, 'exactly one profile-load-error element');
  assert.equal(attrsOf(alerts[0]).variant, 'danger', 'the alert is a danger alert');
  assert.equal(textOf(alerts[0]), COPY, 'the alert copy');
  assert.equal(nodesOf(page.vnode).filter((n) => n.tag === 'b-tabs').length, 0, 'no tabs while loadFailed');
  assert.equal(dangerAlerts(page.vnode).length, 1, 'no other danger alert');

  const ok = pageVm(def, { fetchProfile: () => Promise.resolve(PROFILE()), getProfile: () => PROFILE() });
  await def.methods.loadProfile.call(ok);
  assert.deepEqual(ok.profile, PROFILE(), 'working read: profile from the store');
  assert.deepEqual(ok.form, { first_name: 'Ada', last_name: 'Lovelace', mobile_phone: '+1 555 0100', timezone_abbr: 'Europe/Prague' }, 'working read: the form fills from profile.info');
  assert.deepEqual(ok.notifForm, { all: false, important: true, info: false }, 'working read: notification flags');
  assert.equal(ok.loadFailed, false, 'working read: loadFailed false');
  assert.equal(ok.loading, false, 'working read: loading false');
  const okPage = renderPage(def, { loading: false, loadFailed: false, profile: PROFILE(), error: null, message: null });
  assert.equal(okPage.error, null, 'loaded page renders without error');
  assert.equal(nodesOf(okPage.vnode).filter((n) => n.tag === 'b-tabs').length, 1, 'loaded page shows the tabs');
  assert.equal(byCy(okPage.vnode, 'profile-load-error').length, 0, 'loaded page has no load-error alert');

  const saves = [
    ['saveProfile', () => {}, 'Profile updated.', 'Failed to update profile.'],
    ['saveAvatar', (vm) => { vm.avatarB64 = 'QUJD'; }, 'Avatar updated.', 'Failed to upload avatar.'],
  ];
  for (const [method, setup, successMessage, failureMessage] of saves) {
    const run = async (result) => {
      const loads = [];
      const vm = pageVm(def, {
        profile: PROFILE(),
        updateProfile: async () => clone(result),
        uploadAvatar: async () => clone(result),
        getProfile: () => ({ fromStore: true }),
        loadProfile: async () => { loads.push(1); },
      });
      setup(vm);
      await def.methods[method].call(vm);
      return { vm, loads };
    };
    const plain = await run({ success: true });
    assert.deepEqual(plain.loads, [], method + ' success: no loadProfile');
    assert.deepEqual(plain.vm.profile, { fromStore: true }, method + ' success: profile from the store');
    assert.equal(plain.vm.message, successMessage, method + ' success: the message');
    const off = await run({ success: true, refreshed: false });
    assert.deepEqual(off.loads, [1], method + ' refreshed: false: one loadProfile');
    assert.equal(off.vm.message, successMessage, method + ' refreshed: false: the success message');
    assert.equal(off.vm.error, null, method + ' refreshed: false: no error');
    const refused = await run({ success: false });
    assert.equal(refused.vm.error, failureMessage, method + ' failure: the failure message');
    assert.deepEqual(refused.loads, [], method + ' failure: no loadProfile');
  }
  return 'loadProfile, render, saveProfile, saveAvatar';
});

const headerPage = lazy(() => loadSfc('components/Header/Header.vue', {
  mapState: () => ({}),
  Notifications: { name: 'Notifications', render: (h) => h('div') },
  avatarDataUri: () => null,
  require: () => 'default_avatar_sm.png',
}));

checkAsync('K1 Header mounted absorbs a rejected fetchProfile (no unhandled rejection, profile stays {}) and still fetches the build log; a working read fills profile', async () => {
  const { def } = headerPage();
  const run = async (fetchProfile) => {
    const dispatched = [];
    const vm = pageVm(def, { fetchProfile, getProfile: () => PROFILE(), $store: { dispatch: (t) => { dispatched.push(t); return Promise.resolve(); } } });
    const r = await withUnhandled(() => def.mounted.call(vm));
    return { vm, dispatched, r };
  };
  const off = await run(() => Promise.reject(new Error('Could not reach the server.')));
  assert.deepEqual(off.r.unhandled.map((e) => String(e && e.message)), [], 'rejected read: no unhandled rejection');
  assert.deepEqual(off.vm.profile, {}, 'rejected read: profile stays {}');
  assert.deepEqual(off.dispatched, ['buildlog/fetchBuildLog'], 'rejected read: the build log is still fetched');
  const ok = await run(() => Promise.resolve(PROFILE()));
  assert.deepEqual(ok.r.unhandled, [], 'working read: no unhandled rejection');
  assert.deepEqual(ok.vm.profile, PROFILE(), 'working read: profile from the store');
  assert.deepEqual(ok.dispatched, ['buildlog/fetchBuildLog'], 'working read: the build log is fetched');
});

const SIGN_IN_REPLY = { success: true, access_token: 'a'.repeat(40), refresh_token: 'r'.repeat(40) };
const PROFILE_READS = [
  ['rejecting', () => Promise.reject(new Error('Could not reach the server.'))],
  ['resolving', () => Promise.resolve(PROFILE())],
];

const loginPage = lazy(() => loadSfc('pages/Login/Login.vue', {
  Widget: { name: 'Widget', render: (h) => h('div') },
  AppFooter: { name: 'AppFooter', render: (h) => h('div') },
  hostnameMixin: {},
  fetchWithCsrf: async () => fakeResponse(200, SIGN_IN_REPLY),
  isCsrfRejection: () => false,
  reportCsrfRejection: () => {},
  CSRF_REJECTED_MESSAGE: 'csrf',
}));

checkAsync('K2 Login login() with a successful reply still commits auth/setUser and reaches /app/dashboard when fetchProfile rejects, as when it resolves', async () => {
  const { def } = loginPage();
  for (const [label, fetchProfile] of PROFILE_READS) {
    const commits = [];
    const pushes = [];
    const vm = pageVm(def, {
      $refs: { username: { value: 'cypress-test' }, password: { value: 'secret' } },
      $hostnames: { API: 'https://api.test/api/v2' },
      $rollbar: null,
      isTokenValid: async () => true,
      persistSession: async () => {},
      isAuthenticated: () => true,
      fetchProfile,
      getProfile: () => PROFILE(),
      $store: { commit: (t, p) => commits.push([t, p]) },
      pushIfNeeded: async (location) => { pushes.push(location); },
    });
    const r = await withUnhandled(() => def.methods.login.call(vm, { preventDefault() {} }));
    assert.equal(r.settled, 'resolved', label + ': login() resolves');
    assert.deepEqual(r.unhandled, [], label + ': no unhandled rejection');
    assert.deepEqual(commits, [['profile/saveProfile', {}], ['auth/setUser', PROFILE()]], label + ': profile reset (WR-01), then auth/setUser committed with getProfile()');
    assert.deepEqual(pushes, ['/app/dashboard'], label + ': /app/dashboard pushed');
    assert.equal(vm.errorMessage, null, label + ': no error message');
  }
  return PROFILE_READS.map((p) => p[0]).join(', ');
});

const oauthReturnPage = lazy(() => loadSfc('pages/OAuthReturn/OAuthReturn.vue', {
  mapMutations: () => ({}),
  hostnameMixin: {},
  ensureCsrfToken: async () => '',
  fetchWithCsrf: async () => fakeResponse(200, SIGN_IN_REPLY),
}));

checkAsync('K3 OAuthReturn complete() with a valid sign-in reply still calls setUser and pushes /app/dashboard when fetchProfile rejects, as when it resolves', async () => {
  const { def } = oauthReturnPage();
  for (const [label, fetchProfile] of PROFILE_READS) {
    const users = [];
    const pushes = [];
    const commits = [];
    const vm = pageVm(def, {
      $route: { query: { t: 'one-shot-token' } },
      $hostnames: { API: 'https://api.test/api/v2' },
      isTokenValid: async () => true,
      persistSession: async () => {},
      isAuthenticated: () => true,
      fetchProfile,
      getProfile: () => PROFILE(),
      setUser: (p) => users.push(p),
      $store: { commit: (t, p) => commits.push([t, p]) },
      $router: { push: (location) => { pushes.push(location); return Promise.resolve(); } },
    });
    const r = await withUnhandled(() => def.methods.complete.call(vm));
    assert.equal(r.settled, 'resolved', label + ': complete() resolves');
    assert.deepEqual(r.unhandled, [], label + ': no unhandled rejection');
    assert.deepEqual(commits, [['profile/saveProfile', {}]], label + ': the profile is reset before the read (WR-01)');
    assert.deepEqual(users, [PROFILE()], label + ': setUser(getProfile()) once');
    assert.deepEqual(pushes, ['/app/dashboard'], label + ': /app/dashboard pushed');
    assert.equal(vm.errorMessage, null, label + ': no error message');
  }
  return PROFILE_READS.map((p) => p[0]).join(', ');
});

const deviceDetailPage = lazy(() => loadSfc('pages/Devices/DeviceDetail.vue', {
  BuildLogDialog: { name: 'BuildLogDialog', render: (h) => h('div') },
  moment: () => ({ format: () => '', fromNow: () => '' }),
  parseEnvironmentJSON: () => ({ ok: true }),
  buildStatusVariant: () => 'secondary',
  hasBuildLog: () => false,
  confirmLeave: async () => true,
}));

checkAsync('K4 DeviceDetail loadDevice() resolves and shows the generic banner when only the repositories read (real store, network failure) rejects', async () => {
  const { def } = deviceDetailPage();
  const udid = 'd'.repeat(64);
  const device = { udid, alias: 'dev', description: '', transformers: [] };
  const vm = pageVm(def, {
    $route: { params: { udid } },
    transformersDirty: false,
    loadDevices: async () => [device],
    fetchBuildLog: async () => {},
    fetchTransformers: async () => [],
    fetchRepositories: () => storeRun('store/repositories.js', 'fetchItems', { fetchImpl: NETWORK_FAIL })
      .then((r) => { if (r.outcome.error) throw r.outcome.error; return r.outcome.value; }),
    getByUdid: () => (id) => (id === udid ? device : null),
    getBuildItems: () => [],
  });
  const r = await withUnhandled(() => def.methods.loadDevice.call(vm));
  assert.equal(r.settled, 'resolved', 'loadDevice resolves');
  assert.deepEqual(r.unhandled, [], 'no unhandled rejection');
  assert.equal(vm.error, 'Some device details could not be loaded. Refresh to retry.', 'the generic banner');
  assert.deepEqual(vm.device, device, 'the device is shown');
  assert.equal(vm.loading, false, 'loading cleared');
});

// ---------------------------------------------------------------- run

// An async check that never settles would otherwise let node drain its event loop
// and exit 0 with the remaining checks unreported.
let running = null;
process.on('beforeExit', () => {
  if (running === null) return;
  report(false, running, 'never settled');
  if (TAP) console.log('1..' + reported);
  process.exit(1);
});

(async () => {
  for (const [name, fn] of asyncChecks) {
    running = name;
    try {
      const detail = await fn();
      report(true, name, typeof detail === 'string' ? detail : '');
    } catch (err) {
      report(false, name, firstLine(err));
    }
  }
  running = null;
  if (TAP) console.log('1..' + reported);
  process.exit(failures ? 1 : 0);
})();

// Unit test for the Phase 48 close-out (v1.18 Phase 48: NOTIF-04, POL-01, FIX-01;
// UI-SPEC UI-C01..UI-C20).
//
// Plain-node checks for:
//   A  src/App.vue: the default-route decision reads the confirmed initial route
//      (router.onReady), so a reloaded deep link stays on its page (NOTIF-04, D-07);
//   I  src/core/api.js parseResult: an envelope with no data key gives an undefined
//      response again, and the audited callers keep their empty state (35 IN-01, D-12);
//   H  Header logout and the auth store logout (35 IN-08, D-13);
//   N  Notifications build rows (35 IN-08);
//   R  History build rows (35 IN-08, 47-REVIEW IN-10);
//   E  citations of existing coverage for the other 35 IN-08 bullets.
// 48-03 extends this file with F (Build Firmware), W (content column), M (account menu),
// C (theme contrast) and L (device list).
//
// SFC templates are compiled with vue-template-compiler (whitespace: 'condense', as
// vue-cli does) and rendered with vue.runtime.common; bootstrap-vue elements (b-*) stay
// plain vnodes. The harness is copied from transformers-enviros.cjs (not required from it).
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

// ---------------------------------------------------------------- loaders

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
  new Function('module', ...Object.keys(all), code)(mod, ...Object.values(all));
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
  return new Function(code + '\nreturn { ' + names.join(', ') + ' };')();
}

// A store module's default export.
const loadStore = (rel) => new Function(read(rel).replace(/^import .*;?$/gm, '').replace(/export default /, 'return '))();

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

// Render an existing vm again after its state changed.
function rerender(vm) {
  const { out, warnings, error } = withWarnings(() => vm._render());
  assert.equal(error, null, 'page re-renders without error');
  assert.deepEqual(warnings, [], 'page re-renders without Vue warnings');
  return out;
}

// Render a component vnode one level down, resolving props, $attrs and scoped slots.
function expand(vnode, parentVm) {
  const opts = vnode.componentOptions;
  assert.ok(opts, 'not a component vnode');
  const child = new opts.Ctor({ propsData: opts.propsData, _parentVnode: vnode, _parentListeners: opts.listeners, parent: parentVm });
  const { out, warnings, error } = withWarnings(() => child._render());
  return { vm: child, vnode: out, warnings, error };
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

const attrsOf = (n) => (n && n.data && n.data.attrs) || {};
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

const byClass = (top, cls) => nodesOf(top).filter((n) => classList(n).includes(cls));
const byTag = (top, tag) => nodesOf(top).filter((n) => n.tag === tag);
const isComponent = (n, name) => !!(n && n.componentOptions && n.componentOptions.Ctor.options.name === name);
const componentsOf = (top, name) => nodesOf(top).filter((n) => isComponent(n, name));
const textOf = (top) => nodesOf(top).filter((n) => !n.tag && n.text).map((n) => n.text).join(' ').replace(/\s+/g, ' ').trim();
const propsOf = (n) => (n && n.componentOptions && n.componentOptions.propsData) || {};
const cellsOf = (row) => (row.children || []).filter((n) => n.tag === 'td' || n.tag === 'th');

// Call the click handler bound on an element vnode or a component vnode.
function click(n, evt = {}) {
  const on = n.componentOptions ? n.componentOptions.listeners : (n.data && n.data.on);
  const handler = on && on.click;
  assert.ok(handler, 'element has a click handler');
  (Array.isArray(handler) ? handler : [handler]).forEach((fn) => fn(evt));
}

// A promise whose settlement the test controls.
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

// Resolves to 'pending' when the promise has not settled within a few event-loop turns.
async function settledWithin(promise, turns = 20) {
  let state = 'pending';
  promise.then(() => { state = 'resolved'; }, () => { state = 'rejected'; });
  for (let i = 0; i < turns && state === 'pending'; i++) await tick();
  return state;
}

// Parse the first `const PUBLIC_PATHS = [...]` array literal of a source text.
function publicPathsOf(text, label) {
  const m = /const\s+PUBLIC_PATHS\s*=\s*\[([^\]]*)\]/.exec(text);
  assert.ok(m, label + ' declares PUBLIC_PATHS');
  return m[1].split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/^['"]|['"]$/g, ''));
}

// ---------------------------------------------------------------- compiled theme (48-03)

const sass = require('sass');

const compiledCss = lazy(() => sass.compileString('@import "theme";\n', {
  loadPaths: [path.join(SRC, 'styles')],
  style: 'compressed',
  quietDeps: true,
  logger: sass.Logger.silent,
}).css);

// Flat list of { media, selectors, body } for every style rule.
function cssRules(text) {
  const rules = [];
  (function parse(chunk, media) {
    let i = 0;
    while (i < chunk.length) {
      const open = chunk.indexOf('{', i);
      if (open === -1) break;
      const prelude = chunk.slice(i, open).replace(/^[;\s]+/, '').trim();
      let depth = 0;
      let end = open;
      for (; end < chunk.length; end++) {
        const ch = chunk[end];
        if (ch === '"' || ch === "'") { const q = ch; end++; while (end < chunk.length && chunk[end] !== q) { if (chunk[end] === '\\') end++; end++; } continue; }
        if (ch === '{') depth++;
        else if (ch === '}') { depth--; if (depth === 0) break; }
      }
      const body = chunk.slice(open + 1, end);
      if (/^@media/.test(prelude)) parse(body, prelude);
      else if (prelude[0] !== '@') rules.push({ media, selectors: prelude.split(',').map((x) => x.trim()), body });
      i = end + 1;
    }
  }(text, ''));
  return rules;
}

const allRules = lazy(() => cssRules(compiledCss()));

const loose = (sel) => sel.replace(/\s*([>+~])\s*/g, '$1').replace(/\s+/g, ' ').trim();
function decls(selector, media = '') {
  const want = loose(selector);
  return allRules().filter((r) => r.media === media && r.selectors.some((s) => loose(s) === want)).map((r) => r.body);
}

function value(bodies, prop) {
  let found;
  bodies.forEach((body) => body.split(';').forEach((d) => {
    const at = d.indexOf(':');
    if (at !== -1 && d.slice(0, at).trim() === prop) found = d.slice(at + 1).trim();
  }));
  return found;
}

function expectDecls(selector, want) {
  const bodies = decls(selector);
  assert.ok(bodies.length, selector + ' has a rule');
  Object.keys(want).forEach((p) => assert.equal(value(bodies, p), want[p], selector + ' ' + p));
  return bodies;
}

// ================================================================ A: App.vue deep link (NOTIF-04, D-07)

const app = lazy(() => loadSfc('App.vue', { mapActions: () => ({}) }));

// Drive App.vue created() on a plain object that carries the component's methods, a stub
// router and a hydrateSession recorder. Like vue-router 3, the router's current route is
// its start route `/` until the initial navigation confirms; `ready()` confirms it at
// `resolved` and fires the stored onReady success callback, `fail()` fires the error one.
function appHarness({ resolved, authenticated = true, query = {} } = {}) {
  const { def } = app();
  const calls = { hydrate: [], push: [], onReady: 0 };
  let route = { path: '/', fullPath: '/', query: {} };
  let onOk = null;
  let onErr = null;
  const router = {
    get currentRoute() { return route; },
    // vue-router 3 keeps the same object as history.current; the old App.vue read it.
    history: { get current() { return route; } },
    onReady(ok, err) { calls.onReady++; onOk = ok; onErr = err; },
    push(location) {
      calls.push.push(location);
      route = { path: location, fullPath: location, query: {} };
      return Promise.resolve(route);
    },
  };
  const vm = {
    $router: router,
    get $route() { return route; },
    hydrateSession(opts) {
      calls.hydrate.push(opts);
      return Promise.resolve(authenticated);
    },
  };
  Object.keys(def.methods || {}).forEach((k) => { vm[k] = def.methods[k].bind(vm); });
  const confirm = (path) => {
    const p = path === undefined ? resolved : path;
    const qs = Object.keys(query).map((k) => k + '=' + query[k]).join('&');
    route = { path: p, fullPath: p + (qs ? '?' + qs : ''), query };
  };
  const done = def.created.call(vm);
  return {
    vm,
    calls,
    done,
    ready() { confirm(); if (onOk) onOk(route); },
    fail(path) { confirm(path); if (onErr) onErr(new Error('initial navigation failed')); },
  };
}

// Run created() with the initial route resolving at `resolved` and return the calls.
async function runApp(opts) {
  const h = appHarness(opts);
  await tick();
  const early = h.calls.hydrate.length;
  h.ready();
  assert.equal(await settledWithin(h.done), 'resolved', 'created() settles after onReady');
  return { ...h, early };
}

const UDID_64 = 'a1b2c3d4'.repeat(8);

check('A1 App.vue reads the confirmed route: no router history, waitForInitialRoute before hydrateSession, onReady with both callbacks', () => {
  const { def, source } = app();
  const script = compiler.parseComponent(source).script.content;
  assert.ok(!script.includes('history.current'), 'App.vue never reads the router internal history object');
  assert.equal(typeof (def.methods || {}).waitForInitialRoute, 'function', 'waitForInitialRoute is a method');
  const created = script.slice(script.indexOf('async created()'));
  const wait = created.indexOf('waitForInitialRoute()');
  const hydrate = created.indexOf('hydrateSession(');
  assert.ok(wait !== -1 && hydrate !== -1 && wait < hydrate, 'created() awaits waitForInitialRoute() before its first hydrateSession call');
  const waitBody = def.methods.waitForInitialRoute.toString();
  assert.match(waitBody, /onReady\(\s*[^,()]+,\s*[^,()]+\)/, 'waitForInitialRoute registers an onReady success and error callback');
});

checkAsync('A2 logged in, deep link: no hydrate before onReady, then one hydrate { forcePrime: false } and no push', async () => {
  const paths = ['/app/history/audit', '/app/devices', '/app/profile', '/app/device/' + UDID_64];
  for (const resolved of paths) {
    const r = await runApp({ resolved, authenticated: true });
    assert.equal(r.early, 0, resolved + ': hydrateSession is not called before the initial route confirms');
    assert.deepEqual(r.calls.hydrate, [{ forcePrime: false }], resolved + ': one hydrate without force prime');
    assert.deepEqual(r.calls.push, [], resolved + ': the deep link stays');
    assert.equal(r.vm.$route.path, resolved, resolved + ': still on the resolved route');
  }
  return paths.length + ' deep links';
});

checkAsync('A3 logged in, / and /app go to the dashboard once; pushIfNeeded skips the current route', async () => {
  for (const resolved of ['/', '/app']) {
    const r = await runApp({ resolved, authenticated: true });
    assert.equal(r.early, 0, resolved + ': no hydrate before onReady');
    assert.deepEqual(r.calls.push, ['/app/dashboard'], resolved + ': one push of /app/dashboard');
  }
  const h = appHarness({ resolved: '/app/dashboard' });
  h.ready();
  await settledWithin(h.done);
  assert.deepEqual(h.calls.push, [], 'already on /app/dashboard: no push');
  await h.vm.pushIfNeeded('/app/dashboard');
  assert.deepEqual(h.calls.push, [], 'pushIfNeeded does not push the current fullPath');
});

checkAsync('A4 logged out: non-public paths go to /login once, public paths stay', async () => {
  for (const resolved of ['/app/devices', '/foo']) {
    const r = await runApp({ resolved, authenticated: false });
    assert.equal(r.early, 0, resolved + ': no hydrate before onReady');
    assert.deepEqual(r.calls.push, ['/login'], resolved + ': one push of /login');
  }
  for (const resolved of ['/login', '/password-reset', '/error']) {
    const r = await runApp({ resolved, authenticated: false });
    assert.deepEqual(r.calls.push, [], resolved + ': a public path stays');
  }
});

checkAsync('A5 /oauth-return hydrates with { forcePrime: true } and pushes nothing, logged in or out', async () => {
  for (const authenticated of [true, false]) {
    const r = await runApp({ resolved: '/oauth-return', authenticated, query: { t: 'x', g: 'true' } });
    assert.equal(r.early, 0, 'no hydrate before onReady');
    assert.deepEqual(r.calls.hydrate, [{ forcePrime: true }], 'force prime on /oauth-return (authenticated=' + authenticated + ')');
    assert.deepEqual(r.calls.push, [], 'nothing pushed (authenticated=' + authenticated + ')');
  }
});

checkAsync('A6 an initial navigation error still lets created() finish on the route at that moment', async () => {
  const h = appHarness({ authenticated: false });
  await tick();
  assert.equal(h.calls.hydrate.length, 0, 'no hydrate before either onReady callback');
  h.fail('/app/x');
  assert.equal(await settledWithin(h.done), 'resolved', 'created() settles after the onReady error callback');
  assert.deepEqual(h.calls.push, ['/login'], 'logged out /app/x goes to /login');
  const ok = appHarness({ resolved: '/app/devices' });
  ok.ready();
  assert.equal(await settledWithin(ok.done), 'resolved', 'created() settles after the onReady success callback');
  assert.equal(ok.calls.onReady, 1, 'onReady registered once');
});

check('A7 PUBLIC_PATHS in App.vue and Routes.js are the same list', () => {
  const want = ['/login', '/password-reset', '/error', '/oauth-return'];
  const fromApp = publicPathsOf(read('App.vue'), 'App.vue');
  const fromRoutes = publicPathsOf(read('Routes.js'), 'Routes.js');
  assert.deepEqual(fromApp, want, 'App.vue PUBLIC_PATHS');
  assert.deepEqual(fromRoutes, want, 'Routes.js PUBLIC_PATHS');
});

checkAsync('A8 pushIfNeeded swallows NavigationDuplicated and rethrows any other error', async () => {
  const h = appHarness({ resolved: '/app/devices' });
  h.ready();
  await settledWithin(h.done);
  h.vm.$router.push = () => Promise.reject(Object.assign(new Error('dup'), { name: 'NavigationDuplicated' }));
  await h.vm.pushIfNeeded('/app/history');
  const boom = new Error('boom');
  h.vm.$router.push = () => Promise.reject(boom);
  await assert.rejects(h.vm.pushIfNeeded('/app/history'), (err) => err === boom, 'other errors are rethrown');
});

// ================================================================ I: parseResult (35 IN-01, D-12)

// core/api.js with its cookies import stubbed; the class is the default export.
const apiModule = lazy(() => loadModule('core/api.js', (s) => [
  "const getCsrfToken = () => '';",
  "const fetchWithCsrf = () => Promise.reject(new Error('offline'));",
  s.replace('export default class Api', 'export const Api = class Api'),
].join('\n')));
const parse = (envelope) => new (apiModule().Api)('https://api.test').parseResult(envelope);

check('I1 an envelope with no data key gives an undefined response', () => {
  const out = parse({ success: true });
  assert.equal(out.success, true, 'success kept');
  assert.equal(out.response, undefined, 'response is undefined, never {}');
});

check('I2 paging alone is not data: response undefined, paging kept', () => {
  const out = parse({ success: true, paging: { has_more: false, cursor: null } });
  assert.equal(out.response, undefined, 'response is undefined');
  assert.deepEqual(out.paging, { has_more: false, cursor: null }, 'paging passes through');
});

check('I3 one data key gives that key value', () => {
  assert.deepEqual(parse({ success: true, devices: [1, 2] }).response, [1, 2]);
  assert.equal(parse({ success: true, build_id: 'b1' }).response, 'b1');
});

check('I4 two or more data keys give an object of exactly those keys', () => {
  const out = parse({ success: true, a: 1, b: 2, paging: { has_more: true, cursor: 'c' } });
  assert.deepEqual(out.response, { a: 1, b: 2 }, 'no success or paging key inside');
});

check('I5 an own response key wins, also when it is null or 0', () => {
  assert.equal(parse({ success: true, response: null }).response, null);
  assert.equal(parse({ success: true, response: 0, x: 1 }).response, 0);
});

check('I6 a non-success envelope is returned unchanged; null and undefined give { success: false }', () => {
  const env = { success: false, response: 'x' };
  assert.equal(parse(env), env, 'same object');
  assert.deepEqual(parse(null), { success: false });
  assert.deepEqual(parse(undefined), { success: false });
});

const logUtils = lazy(() => loadModule('utils/buildLog.js'));
const iconButton = lazy(() => loadSfc('components/IconButton/IconButton.vue'));
const buildLogDialog = lazy(() => loadSfc('components/BuildLogDialog/BuildLogDialog.vue', {
  buildLogText: logUtils().buildLogText,
  buildLogSearch: logUtils().buildLogSearch,
  hasBuildLog: logUtils().hasBuildLog,
  IconButton: iconButton().def,
}));

const STRAY_TEXT = ['undefined', '[object Object]', '{}'];
function assertNoStrayText(vnode, label) {
  nodesOf(vnode).filter((n) => !n.tag && typeof n.text === 'string').forEach((n) => {
    assert.ok(!STRAY_TEXT.includes(n.text.trim()), label + ' renders no "' + n.text.trim() + '" text');
  });
}

checkAsync('I7 an empty build log envelope shows the dialog empty state, never undefined or {}', async () => {
  const { def } = buildLogDialog();
  const vm = new Vue({
    render: def.render,
    staticRenderFns: def.staticRenderFns,
    data: def.data,
    computed: def.computed,
    methods: def.methods,
    watch: def.watch,
    components: Object.assign({}, def.components),
  });
  vm.$refs.modal = { show() {} };
  vm.$store = { dispatch: () => Promise.resolve(parse({ success: true })) };
  await vm.open({ build_id: 'b1' });
  const vnode = rerender(vm);
  const empty = byCy(vnode, 'build-log-empty');
  assert.equal(empty.length, 1, 'one build-log-empty line');
  assert.equal(textOf(empty[0]), 'No log output is available for this build yet.');
  assert.equal(byCy(vnode, 'build-log-search-bar').length, 0, 'no search bar');
  assert.equal(byCy(vnode, 'full-build-log').length, 0, 'no log block');
  assertNoStrayText(vnode, 'the dialog');
});

// Run one store action against a stub $api whose GET answers `envelope` through parseResult.
async function runStore(rel, action, envelope) {
  const mod = loadStore(rel);
  const state = mod.state;
  const ctx = {
    state,
    commit: (type, payload) => mod.mutations[type](state, payload),
    dispatch: () => Promise.resolve(),
  };
  const $api = { $get: () => Promise.resolve(parse(envelope)) };
  await mod.actions[action].call({ $api }, ctx);
  return { state, getters: mod.getters };
}

const header = lazy(() => loadSfc('components/Header/Header.vue', {
  mapState: () => ({}),
  Notifications: { name: 'Notifications', render: (h) => h('div') },
  avatarDataUri: () => null,
  require: () => 'default_avatar_sm.png',
}));
const visits = lazy(() => loadSfc('pages/Visits/Visits.vue', {
  buildStatusVariant: () => 'secondary',
  hasBuildLog: (b) => !!(b && typeof b.build_id === 'string' && b.build_id.trim()),
  BuildLogDialog: { name: 'BuildLogDialog', render: (h) => h('div') },
  CheckinsTimeline: { name: 'CheckinsTimeline', render: (h) => h('div') },
  hostnameMixin: {},
}));
const adminUsers = lazy(() => loadSfc('pages/AdminUsers/AdminUsers.vue'));

checkAsync('I8 audited callers take an empty envelope without throwing and keep their empty state', async () => {
  const EMPTY = { success: true };
  const done = [];

  // stats store -> Visits.vue metric cards (Visits.vue:245-246 reads getStats/getToday).
  const stats = await runStore('store/stats.js', 'fetchStats', EMPTY);
  await (async () => {
    const mod = loadStore('store/stats.js');
    const ctx = { state: stats.state, commit: (t, p) => mod.mutations[t](stats.state, p) };
    await mod.actions.fetchToday.call({ $api: { $get: () => Promise.resolve(parse(EMPTY)) } }, ctx);
  })();
  const { def: visitsDef } = visits();
  const cards = visitsDef.computed.metricCards.call({
    statsData: stats.getters.getStats(stats.state),
    todayData: stats.getters.getToday(stats.state),
    deviceCount: 0,
    extractMetric: visitsDef.methods.extractMetric,
  });
  assert.ok(Array.isArray(cards) && cards.length > 0, 'Visits metric cards render');
  cards.forEach((c) => ['today', 'week', 'month'].forEach((k) => {
    if (k in c) assert.equal(c[k], 0, c.label + ' ' + k + ' is 0');
  }));
  assert.ok(!stats.getters.getTimeline(stats.state), 'no timeline');
  done.push('stats');

  // profile store -> Header name (Header.vue:26 reads profile.first_name).
  const profile = await runStore('store/profile.js', 'fetchProfile', EMPTY);
  const h = renderPage(header().def, { profile: profile.getters.getProfile(profile.state) });
  assert.equal(h.error, null, 'Header renders without error');
  assertNoStrayText(h.vnode, 'the Header');
  done.push('profile');

  // admin store -> AdminUsers "No users." row.
  const admin = await runStore('store/admin.js', 'fetchUsers', EMPTY);
  const a = renderPage(adminUsers().def, { getUsers: () => admin.getters.getUsers(admin.state) });
  assert.equal(a.error, null, 'AdminUsers renders without error');
  assert.ok(textOf(a.vnode).includes('No users.'), 'AdminUsers shows No users.');
  done.push('admin');

  // List stores feeding Devices, Environment Globals, API Keys, Channels and Repositories.
  const lists = [
    ['store/devices.js', 'fetchItems'],
    ['store/enviros.js', 'fetchItems'],
    ['store/apikeys.js', 'fetchItems'],
    ['store/channels.js', 'fetchItems'],
    ['store/repositories.js', 'fetchRepositories'],
  ];
  for (const [rel, action] of lists) {
    let out;
    try {
      out = await runStore(rel, action, EMPTY);
    } catch (err) {
      throw new Error(rel + ' ' + action + ' throws on an empty envelope: ' + err.message);
    }
    assert.deepEqual(out.state.items, [], rel + ' keeps an empty list');
    done.push(rel.replace(/^store\/|\.js$/g, ''));
  }
  return done.join(', ');
});

// ================================================================ H: Header and auth logout (35 IN-08, D-13)

checkAsync('H1 Header logout() dispatches auth/logout once and pushes /login only after it resolves', async () => {
  const { def } = header();
  const gate = deferred();
  const calls = { dispatch: [], push: [] };
  const vm = {
    $store: { dispatch: (...args) => { calls.dispatch.push(args); return gate.promise; } },
    $router: { push: (location) => { calls.push.push(location); return Promise.resolve(); } },
  };
  const done = def.methods.logout.call(vm);
  await tick();
  assert.deepEqual(calls.dispatch, [['auth/logout']], 'one auth/logout dispatch');
  assert.deepEqual(calls.push, [], 'no push while the logout is pending');
  gate.resolve();
  await done;
  assert.deepEqual(calls.push, ['/login'], 'one push of /login after the logout resolved');
  assert.equal(calls.dispatch.length, 1, 'still one dispatch');
});

checkAsync('H2 auth/logout with a failing fetch still resolves and clears the session once', async () => {
  const auth = loadStore('store/auth.js');
  const prevFetch = global.fetch;
  const requests = [];
  global.fetch = (url, opts) => { requests.push([url, opts]); return Promise.reject(new Error('offline')); };
  const dispatched = [];
  try {
    await auth.actions.logout.call(
      { $api: { composePath: (p) => 'https://api.test/api/v2' + p } },
      { dispatch: (...args) => { dispatched.push(args); return Promise.resolve(); } },
    );
  } finally {
    global.fetch = prevFetch;
  }
  assert.equal(requests.length, 1, 'one logout request');
  assert.equal(requests[0][0], 'https://api.test/api/v2/logout');
  assert.equal(requests[0][1].credentials, 'include', 'the session cookie is sent');
  assert.deepEqual(dispatched, [['clearSession']], 'clearSession dispatched once');
});

// ================================================================ N: Notifications rows (35 IN-08)

const readTest = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');

// A citation: the named check strings must still exist in the other test file.
function cites(file, strings) {
  const text = readTest(file);
  strings.forEach((s) => assert.ok(text.includes(s), file + ' still asserts: ' + s));
  return 'cited ' + file;
}

check('N1 a Notifications row with a build id opens the dialog once and a row without one is static', () => cites('build-log-search.cjs', [
  "check('N1 navbar rows: buttons with a click listener only with a build id; a row without one is static and inert'",
  "assert.equal(opened.length, 2, 'two opens')",
  "the row without a build id has no listener (on and nativeOn empty)",
]));

// ================================================================ R: History build rows (35 IN-08, 47-REVIEW IN-10)

const historyPage = lazy(() => loadSfc('pages/History/History.vue', {
  BuildLogDialog: { name: 'BuildLogDialog', render: (h) => h('div') },
  normPaging: loadModule('store/logPaging.js').normPaging,
  buildStatusVariant: logUtils().buildStatusVariant,
  hasBuildLog: logUtils().hasBuildLog,
}));

check('R1 History rowListeners: exactly click for a build log row, none otherwise', () => {
  const { def } = historyPage();
  const ctx = { onBuildRowClick: () => {} };
  assert.deepEqual(Object.keys(def.methods.rowListeners.call(ctx, { build_id: 'b1' })), ['click'], 'b1: exactly click');
  [{ build_id: '' }, { build_id: 42 }, {}].forEach((build) => {
    assert.deepEqual(def.methods.rowListeners.call(ctx, build), {}, JSON.stringify(build) + ': no listener');
  });
});

check('R2 History row click: an inner button target (keyboard activation of Expand or View) never opens through the row', () => {
  const { def } = historyPage();
  const opened = [];
  const ctx = { openBuildLog: (b) => opened.push(b) };
  const build = { build_id: 'b1' };
  const prevWindow = global.window;
  global.window = { getSelection: () => '' };
  try {
    const listeners = def.methods.rowListeners.call({ onBuildRowClick: (b, e) => def.methods.onBuildRowClick.call(ctx, b, e) }, build);
    const asked = [];
    const inner = { closest: (sel) => { asked.push(sel); return { tagName: 'BUTTON' }; } };
    listeners.click({ target: inner });
    assert.equal(opened.length, 0, 'a click whose target is inside an inner button does not open the log');
    assert.ok(/\bbutton\b/.test(asked[0] || ''), 'the row asks closest() for a button');
    listeners.click({ target: { closest: () => null } });
    assert.deepEqual(opened, [build], 'a plain cell click opens the build once');
  } finally {
    global.window = prevWindow;
  }
});

// ================================================================ T: Device Detail Create & Assign (35 IN-08)

const deviceDetailPage = lazy(() => loadSfc('pages/Devices/DeviceDetail.vue', {
  BuildLogDialog: { name: 'BuildLogDialog', render: (h) => h('div') },
  moment: () => ({ fromNow: () => '' }),
  parseEnvironmentJSON: () => ({ ok: true }),
  buildStatusVariant: logUtils().buildStatusVariant,
  hasBuildLog: logUtils().hasBuildLog,
  confirmLeave: async () => true,
}));

checkAsync('T1 Create & Assign: a failed assignment write reports it, keeps the modal open and resets the saving flag', async () => {
  const { def } = deviceDetailPage();
  const calls = { update: [], hide: 0, load: 0 };
  const vm = Object.assign(def.data.call({}), {
    device: { udid: 'd', transformers: ['existing'] },
    editForm: { transformers: ['existing', 'unsaved'] },
    transformerForm: { alias: 'New', body: 'return status;' },
    getTransformers: () => [],
    createTransformerItem: async () => ({ success: true, utid: 'new' }),
    updateDevice: async (x) => { calls.update.push(x); return { success: false }; },
    loadDevice: async () => { calls.load++; },
    $bvModal: { hide: () => { calls.hide++; } },
  });
  await def.methods.createTransformer.call(vm, { preventDefault() {} });
  assert.equal(calls.update.length, 1, 'one assignment write');
  assert.deepEqual(calls.update[0].changes.transformers, ['existing', 'new'], 'stored plus new');
  assert.equal(vm.transformerError, 'Transformer created, but assignment failed. Tick it in the list and save to retry.');
  assert.equal(calls.hide, 0, 'the modal stays open');
  assert.equal(calls.load, 0, 'no reload');
  assert.equal(vm.transformerSaving, false, 'saving flag reset');
  assert.deepEqual(vm.device.transformers, ['existing'], 'the stored list is unchanged');
  assert.ok(!vm.message, 'no success message');
});

// ================================================================ E: existing coverage (35 IN-08 citations)

check('E1 TransformerEditor failed-load save is covered (milestone-v116.cjs 35 CR-01)', () => cites('milestone-v116.cjs', [
  '35 CR-01: the editor refuses to save after a failed load',
  "'save after a failed load does not write'",
]));

check('E2 assignment from the stored selection is covered (transformers-enviros.cjs K6, milestone-v116.cjs 35 WR-02)', () => {
  cites('transformers-enviros.cjs', ["'stored plus new, never the unsaved tick'"]);
  return cites('milestone-v116.cjs', ['device.methods.createTransformer.call', "'unsaved selection is not written'"]);
});

check('E3 History build row without keydown is covered (milestone-v116.cjs 35 WR-01)', () => cites('milestone-v116.cjs', [
  "'build row has no ' + attr",
  "'click on an inner button does not open the dialog'",
]));

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

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
//   E  citations of existing coverage for the other 35 IN-08 bullets;
//   F  Device Detail Build Firmware in-flight state (POL-01, D-17);
//   W  Device Detail content column (POL-01, D-18);
//   M  header account menu (POL-01, D-16);
//   C  danger alert contrast in the compiled theme (D-14);
//   L  device list toggles, markers, platform sort and checkbox ids (D-14).
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

// b-button is a plain element here, so its attrs are what the template passed, not what BButton
// renders. Mirror bootstrap-vue 2.21.2 BButton computeAttrs (button.js): a boolean `pressed` prop
// is toggle mode and renders aria-pressed="true|false"; otherwise no aria-pressed is rendered, and a
// passed-through aria-pressed is overwritten either way (48-05, D-14).
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
  return new Function(code)();
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

// 48-08 (CI-07, NOTIF-04): a request that fails in the network (Cypress failing an in-flight
// request at a test boundary, a page unload, an offline client) used to reject out of
// Api.request() with TypeError: Failed to fetch, and a caller without a catch (Header.vue
// mounted fetchProfile) left an unhandled rejection that ended the next deep-link test.
checkAsync('I9 a rejected fetch resolves { success: false, status: 0, response: null, networkError: true } for $get and $post, a failed body read resolves too; a response and the csrf_token_invalid retry are unchanged', async () => {
  const Api = apiWithCookies();
  const saved = globalThis.fetch;
  try {
    globalThis.fetch = () => Promise.reject(new TypeError('Failed to fetch'));
    const api = new Api('https://api.test');
    for (const [label, call] of [['$get', () => api.$get('/profile')], ['$post', () => api.$post('/session/token')]]) {
      let out;
      try {
        out = await call();
      } catch (err) {
        throw new Error(label + ' rejects with ' + (err && err.message) + ' instead of resolving { success: false }');
      }
      assert.deepEqual(out, { success: false, status: 0, response: null, networkError: true }, label + ' resolves the failure envelope');
    }

    globalThis.fetch = async () => fakeResponse(200, { success: true, response: { owner: 'o' } });
    assert.deepEqual(await new Api('https://api.test').$get('/profile'), { success: true, response: { owner: 'o' } }, 'a response keeps its envelope');
    // A refused reply is not a network failure (48-REVIEW CR-01).
    globalThis.fetch = async () => fakeResponse(502, { error: 'bad gateway' });
    assert.equal((await new Api('https://api.test').$get('/profile')).networkError, undefined, 'a 502 reply carries no networkError');
    // A body that fails after the headers arrived resolves the same way (48-REVIEW WR-01).
    globalThis.fetch = async () => Object.assign(fakeResponse(200, {}), { text: () => Promise.reject(new TypeError('network error')) });
    let aborted;
    try {
      aborted = await new Api('https://api.test').$get('/profile');
    } catch (err) {
      throw new Error('a failed body read rejects with ' + (err && err.message) + ' instead of resolving');
    }
    assert.deepEqual(aborted, { success: false, status: 200, response: null, networkError: true }, 'a failed body read resolves the failure envelope');

    const calls = [];
    let posts = 0;
    globalThis.fetch = async (url, init) => {
      calls.push(((init && init.method) || 'GET') + ' ' + String(url).replace('https://api.test/api/v2', ''));
      if (String(url).endsWith('/csrf-token')) return fakeResponse(200, { success: true, csrf_token: 't' + calls.length });
      posts += 1;
      return posts === 1
        ? fakeResponse(403, { success: false, response: 'csrf_token_invalid' })
        : fakeResponse(200, { success: true, response: 'ok' });
    };
    assert.deepEqual(await Api.prototype.$post.call(new Api('https://api.test'), '/device', '{}'), { success: true, response: 'ok' }, 'the retried POST result');
    assert.deepEqual(calls, ['GET /csrf-token', 'POST /device', 'GET /csrf-token', 'POST /device'], 'one re-prime and one retry');
  } finally {
    globalThis.fetch = saved;
  }
});

// 48-REVIEW CR-01: the non-rejecting client marks a request that never got a response with
// networkError, and the callers whose only error path was the old rejection act on it again.
// Each store action runs against the real Api with a fetch that rejects.
async function runStoreOffline(rel, action, items) {
  const Api = apiWithCookies();
  const mod = loadStore(rel);
  const state = mod.state;
  if (items) state.items = items;
  const ctx = {
    state,
    commit: (type, payload) => mod.mutations[type](state, payload),
    dispatch: (type) => mod.actions[type].call({ $api }, ctx),
  };
  const $api = new Api('https://api.test');
  const saved = globalThis.fetch;
  globalThis.fetch = () => Promise.reject(new TypeError('Failed to fetch'));
  try {
    return { state, outcome: await mod.actions[action].call({ $api }, ctx).then((v) => ({ value: v }), (e) => ({ error: e })) };
  } finally {
    globalThis.fetch = saved;
  }
}

checkAsync('I10 a network failure throws from devices/fetchItems, enviros/fetchItems and admin/fetchUsers; a refused reply still does not', async () => {
  const kept = [{ udid: 'd1', id: 'd1' }];
  for (const [rel, action] of [['store/devices.js', 'fetchItems'], ['store/enviros.js', 'fetchItems'], ['store/admin.js', 'fetchUsers']]) {
    const { state, outcome } = await runStoreOffline(rel, action, rel === 'store/admin.js' ? null : kept.slice());
    assert.ok(outcome.error instanceof Error, rel + ' ' + action + ' rejects on a network failure');
    if (rel !== 'store/admin.js') assert.deepEqual(state.items, kept, rel + ' keeps the current list');
  }
  for (const rel of ['store/devices.js', 'store/enviros.js']) {
    const out = await runStore(rel, 'fetchItems', { success: false, status: 502, response: null });
    assert.deepEqual(out.state.items, [], rel + ' resolves a refused reply with the current list');
  }
  const mod = loadStore('store/admin.js');
  const refused = await mod.actions.fetchUsers.call({ $api: { $get: async () => ({ success: false, status: 403, response: 'forbidden' }) } }, { commit() {} });
  assert.equal(refused.success, false, 'admin/fetchUsers resolves a refused reply');
});

checkAsync('I11 devices/revokeDevices stays a success when only the follow-up list read hits a network failure', async () => {
  const mod = loadStore('store/devices.js');
  const state = mod.state;
  const ctx = {
    state,
    commit: (type, payload) => mod.mutations[type](state, payload),
    dispatch: () => Promise.reject(new Error('Could not reach the server.')),
  };
  const result = await mod.actions.revokeDevices.call({ $api: { $delete: async () => ({ success: true, response: 'ok' }) } }, ctx, ['d1']);
  assert.equal(result.success, true, 'the revoke is still reported as done');
  assert.equal(result.refreshed, false, 'refreshed: false');
});

checkAsync('I12 Devices.vue shows LOAD_ERROR and AdminUsers.vue shows Failed to load users. on a network failure', async () => {
  const { def } = devicesPage();
  const offline = () => runStoreOffline('store/devices.js', 'fetchItems').then((r) => { if (r.outcome.error) throw r.outcome.error; return r.outcome.value; });
  const vm = {
    error: null,
    loading: false,
    fetchItems: offline,
    fetchEnviros: () => Promise.resolve([]),
    fetchBuildLog: () => Promise.resolve(),
    getItems: () => [],
    getEnviros: () => [],
    getBuildItems: () => [],
  };
  await def.methods.loadData.call(vm);
  assert.equal(vm.error, 'Could not load devices. Refresh to retry.', 'Devices shows its load error');
  assert.equal(vm.loading, false, 'Loading is cleared');

  const admin = adminUsers().def;
  const avm = { error: '', loading: true, fetchUsers: () => runStoreOffline('store/admin.js', 'fetchUsers').then((r) => { if (r.outcome.error) throw r.outcome.error; return r.outcome.value; }) };
  await admin.created.call(avm);
  assert.equal(avm.error, 'Failed to load users.', 'AdminUsers shows its load error');
  assert.equal(avm.loading, false, 'Loading is cleared');
});

const passwordReset = lazy(() => loadSfc('pages/PasswordReset/PasswordReset.vue', {
  Widget: { name: 'Widget', render: (h) => h('div') },
  AppFooter: { name: 'AppFooter', render: (h) => h('div') },
  hostnameMixin: {},
  ensureCsrfToken: () => Promise.resolve(''),
  isCsrfRejectedPayload: (r) => !!(r && r.response === 'csrf_token_invalid'),
  reportCsrfRejection: () => {},
  CSRF_REJECTED_MESSAGE: 'csrf',
}));

checkAsync('I13 PasswordReset shows Network error. Please try again. for a network failure and the server copy for a refused reply', async () => {
  const { def } = passwordReset();
  const NETWORK = { success: false, status: 0, response: null, networkError: true };
  const REFUSED = { success: false, status: 502, response: null };
  const run = async (method, reply) => {
    const vm = {
      email: 'a@b.c', password: 'secret', rpassword: 'secret', errorMessage: '', successMessage: '', submitting: false,
      $route: { query: { owner: 'o', reset_key: 'k' } },
      $rollbar: null,
      requestPasswordReset: async () => reply,
      confirmPasswordReset: async () => reply,
    };
    await def.methods[method].call(vm);
    assert.equal(vm.submitting, false, method + ' clears submitting');
    return vm.errorMessage;
  };
  assert.equal(await run('submitInitiate', NETWORK), 'Network error. Please try again.');
  assert.equal(await run('submitInitiate', REFUSED), 'Could not initiate reset.');
  assert.equal(await run('submitConfirm', NETWORK), 'Network error. Please try again.');
  assert.equal(await run('submitConfirm', REFUSED), 'Could not set password.');
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

checkAsync('H2 auth/logout with a failing fetch still resolves, clears the session once and resets the profile', async () => {
  const auth = loadStore('store/auth.js');
  const prevFetch = global.fetch;
  const requests = [];
  global.fetch = (url, opts) => { requests.push([url, opts]); return Promise.reject(new Error('offline')); };
  const dispatched = [];
  const committed = [];
  try {
    await auth.actions.logout.call(
      { $api: { composePath: (p) => 'https://api.test/api/v2' + p } },
      {
        dispatch: (...args) => { dispatched.push(args); return Promise.resolve(); },
        commit: (...args) => { committed.push(args); },
      },
    );
  } finally {
    global.fetch = prevFetch;
  }
  assert.equal(requests.length, 1, 'one logout request');
  assert.equal(requests[0][0], 'https://api.test/api/v2/logout');
  assert.equal(requests[0][1].credentials, 'include', 'the session cookie is sent');
  assert.deepEqual(dispatched, [['clearSession']], 'clearSession dispatched once');
  // 48.1-REVIEW WR-01: the next account must not inherit this one's profile (G7 in audit-gaps-v118).
  assert.deepEqual(committed, [['profile/saveProfile', {}, { root: true }]], 'the profile is reset at the root');
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

// ================================================================ F: Build Firmware in flight (POL-01, D-17, UI-C04, UI-C05)

const F_DEVICE = { udid: 'udid-foxtrot', alias: 'foxtrot-01', source: 'src-foxtrot', transformers: [], environment: {} };

// A rendered Device Detail on F_DEVICE with the getters it reads replaced.
function detailPage(state = {}) {
  const r = renderPage(deviceDetailPage().def, Object.assign({
    device: JSON.parse(JSON.stringify(F_DEVICE)),
    editForm: { alias: F_DEVICE.alias, description: '', transformers: [] },
    getTransformers: () => [],
    getRepositories: () => [],
  }, state));
  assert.equal(r.error, null, 'DeviceDetail renders without error');
  assert.deepEqual(r.warnings, [], 'DeviceDetail renders without Vue warnings');
  return r;
}

const one = (list, label) => { assert.equal(list.length, 1, 'exactly one ' + label); return list[0]; };
const elementsOf = (n) => (n.children || []).filter((c) => c.tag);
const strayTextOf = (n) => (n.children || []).filter((c) => !c.tag && typeof c.text === 'string' && c.text.trim() !== '');
const buildButtonOf = (vnode) => one(byCy(vnode, 'action-build'), 'action-build button');
const buildStatusOf = (vnode) => one(byCy(vnode, 'action-build-status'), 'action-build-status');

check('F1 idle Build Firmware: primary, enabled, ref buildButton, cog glyph and label, empty status next to it', () => {
  const { vnode } = detailPage();
  const button = buildButtonOf(vnode);
  assert.equal(button.tag, 'b-button', 'a b-button');
  assert.equal(attrsOf(button).variant, 'primary', 'variant primary');
  assert.deepEqual(classList(button), ['mr-2', 'mb-2'], 'class mr-2 mb-2');
  assert.equal(attrsOf(button).disabled, false, 'not disabled');
  assert.equal(button.data.ref, 'buildButton', 'ref buildButton');
  assert.deepEqual(strayTextOf(button), [], 'no loose text in the button');
  const [glyph, label, ...rest] = elementsOf(button);
  assert.deepEqual(rest, [], 'two children');
  assert.equal(glyph.tag, 'i', 'glyph is an i');
  assert.deepEqual(classList(glyph), ['fa', 'fa-cogs'], 'fa fa-cogs, no margin utility');
  assert.equal(attrsOf(glyph)['aria-hidden'], 'true', 'glyph aria-hidden');
  assert.equal(label.tag, 'span', 'label is a span');
  assert.deepEqual(classList(label), ['button-text'], 'span.button-text');
  assert.equal(textOf(label), 'Build Firmware');
  assert.equal(byTag(button, 'b-spinner').length, 0, 'no spinner');
  const status = buildStatusOf(vnode);
  assert.equal(status.tag, 'span', 'status is a span');
  assert.deepEqual(classList(status), ['sr-only'], 'visually hidden');
  assert.equal(attrsOf(status).role, 'status', 'role status');
  assert.equal(textOf(status), '', 'status empty while idle');
  const card = one(byCy(vnode, 'card-actions'), 'card-actions');
  const kids = elementsOf(card);
  assert.equal(kids.indexOf(status), kids.indexOf(button) + 1, 'the status sits right after the button');
});

check('F2 pending Build Firmware: disabled, small aria-hidden spinner instead of the cog, same label, status Requesting build…', () => {
  const { vnode } = detailPage({ buildPending: true });
  const button = buildButtonOf(vnode);
  assert.equal(attrsOf(button).disabled, true, 'disabled while pending');
  const [spinner, label, ...rest] = elementsOf(button);
  assert.deepEqual(rest, [], 'two children');
  assert.equal(spinner.tag, 'b-spinner', 'a b-spinner first');
  assert.ok('small' in attrsOf(spinner), 'spinner is small');
  assert.equal(attrsOf(spinner)['aria-hidden'], 'true', 'spinner aria-hidden');
  assert.equal(cyOf(spinner), 'action-build-spinner', 'spinner hook');
  assert.equal(byClass(button, 'fa-cogs').length, 0, 'no cog while pending');
  assert.deepEqual(classList(label), ['button-text'], 'span.button-text');
  assert.equal(textOf(label), 'Build Firmware', 'the label does not change');
  assert.equal(textOf(buildStatusOf(vnode)), 'Requesting build…', 'status announces the request');
});

checkAsync('F3 a second buildDevice() while the first is in flight sends nothing and touches no alert', async () => {
  const { vm } = detailPage();
  const calls = [];
  const gate = deferred();
  vm.buildFirmware = (x) => { calls.push(x); return gate.promise; };
  const first = vm.buildDevice();
  assert.equal(vm.buildPending, true, 'pending after the click');
  vm.error = 'kept error';
  vm.message = 'kept message';
  assert.equal(await settledWithin(vm.buildDevice()), 'resolved', 'the second call returns at once');
  assert.equal(calls.length, 1, 'one buildFirmware call');
  assert.deepEqual(calls[0], { udid: F_DEVICE.udid, source_id: F_DEVICE.source }, 'udid and source_id');
  assert.equal(vm.error, 'kept error', 'the second call leaves error alone');
  assert.equal(vm.message, 'kept message', 'the second call leaves message alone');
  gate.resolve({ success: true });
  await first;
  assert.equal(vm.buildPending, false, 'pending ends when the request settles');
});

// Run one buildDevice() against a buildFirmware that answers `outcome` (a function result or a throw).
async function runBuild(vm, outcome) {
  vm.buildFirmware = () => (outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome));
  await vm.buildDevice();
  return vm;
}

checkAsync('F4 accepted, refused and thrown requests all end the pending state with the right alert', async () => {
  const cases = [
    [{ success: true }, 'Build triggered.', null],
    [{ success: false, response: 'no_source' }, null, 'no_source'],
    [{ success: false }, null, 'Build failed.'],
    [new Error('network down'), null, 'Build failed.'],
  ];
  for (const [outcome, message, error] of cases) {
    const label = outcome instanceof Error ? 'thrown' : JSON.stringify(outcome);
    const vm = await runBuild(detailPage().vm, outcome);
    assert.equal(vm.buildPending, false, label + ': buildPending false');
    assert.equal(vm.message, message, label + ': message');
    assert.equal(vm.error, error, label + ': error');
  }
  return cases.length + ' outcomes';
});

checkAsync('F5 empty and non-string reasons give Build failed.; a usable reason is shown verbatim as text', async () => {
  const blank = [undefined, null, { success: false, response: '' }, { success: false, response: ' \t\n' },
    { success: false, message: 42 }, { success: false, response: { code: 1 } }];
  for (const outcome of blank) {
    const vm = await runBuild(detailPage().vm, outcome);
    assert.equal(vm.error, 'Build failed.', JSON.stringify(outcome) + ': Build failed.');
    assert.equal(vm.message, null, JSON.stringify(outcome) + ': no success message');
  }
  const quota = await runBuild(detailPage().vm, { success: false, message: 'Quota reached' });
  assert.equal(quota.error, 'Quota reached', 'a message reason is shown');
  const markup = '<img src=x onerror=alert(1)>';
  const r = detailPage();
  await runBuild(r.vm, { success: false, response: markup });
  // The page alert; the Transformer Assignment card's own danger alert carries data-cy.
  const alert = one(byTag(rerender(r.vm), 'b-alert').filter((n) => attrsOf(n).variant === 'danger' && !cyOf(n)), 'page danger alert');
  assert.equal(textOf(alert), markup, 'the reason reaches the alert as text');
  assert.ok(!(alert.data.domProps && 'innerHTML' in alert.data.domProps), 'never as HTML');
});

checkAsync('F6 each result clears the other alert first', async () => {
  const vm = detailPage().vm;
  await runBuild(vm, { success: false, response: 'no_source' });
  assert.equal(vm.error, 'no_source');
  await runBuild(vm, { success: true });
  assert.equal(vm.error, null, 'a success clears the error');
  assert.equal(vm.message, 'Build triggered.');
  await runBuild(vm, { success: false });
  assert.equal(vm.message, null, 'an error clears the success');
  assert.equal(vm.error, 'Build failed.');
});

checkAsync('F7 focus returns to Build Firmware after the request only when it had focus at click time', async () => {
  const prevDocument = global.document;
  const element = () => ({ focused: 0, focus() { this.focused++; } });
  try {
    for (const form of ['component', 'element']) {
      const button = element();
      global.document = { activeElement: button };
      const { vm } = detailPage();
      vm.$refs.buildButton = form === 'component' ? { $el: button } : button;
      const gate = deferred();
      vm.buildFirmware = () => gate.promise;
      const done = vm.buildDevice();
      global.document.activeElement = null; // the disabled button drops focus to the body
      assert.equal(button.focused, 0, form + ': no focus call while pending');
      gate.resolve({ success: true });
      await done;
      await tick();
      assert.equal(button.focused, 1, form + ': focused once after the request settled');
    }
    const button = element();
    global.document = { activeElement: element() };
    const { vm } = detailPage();
    vm.$refs.buildButton = { $el: button };
    vm.buildFirmware = () => Promise.resolve({ success: false });
    await vm.buildDevice();
    await tick();
    assert.equal(button.focused, 0, 'another element had focus: Build Firmware is never focused');
  } finally {
    global.document = prevDocument;
  }
});

check('F8 DeviceDetail.vue: no old cog markup, buildDevice returns early on buildPending, no raw-HTML directive', () => {
  const { def, source, template } = deviceDetailPage();
  assert.ok(!source.includes('fa fa-cogs mr-1'), 'no fa fa-cogs mr-1');
  assert.ok(!/\bv-html\b/.test(template), 'no v-html in the template');
  assert.match(def.methods.buildDevice.toString(), /^async buildDevice\(\)\s*\{\s*if \(this\.buildPending\) return;/, 'buildDevice starts with the buildPending guard');
  assert.equal(def.data.call({}).buildPending, false, 'buildPending starts false');
});

// ================================================================ W: Device Detail content column (POL-01, D-18, UI-C06)

check('W1 device-detail-content wraps the alerts, Actions and the card row; breadcrumb, title and modals stay outside', () => {
  const { vnode } = detailPage({ error: 'some error', message: 'some message' });
  const column = one(byCy(vnode, 'device-detail-content'), 'device-detail-content');
  assert.equal(column.tag, 'div', 'a div');
  assert.deepEqual(classList(column), ['device-detail-content'], 'class device-detail-content');
  const top = elementsOf(vnode);
  const at = (n) => top.indexOf(n);
  const breadcrumb = one(top.filter((n) => n.tag === 'b-breadcrumb'), 'top-level breadcrumb');
  const title = one(top.filter((n) => n.tag === 'h1'), 'top-level title');
  assert.ok(at(breadcrumb) < at(title) && at(title) < at(column), 'breadcrumb, title, then the column');
  const alerts = byTag(column, 'b-alert');
  assert.ok(alerts.some((n) => attrsOf(n).variant === 'danger' && textOf(n) === 'some error'), 'error alert inside');
  assert.ok(alerts.some((n) => attrsOf(n).variant === 'success' && textOf(n) === 'some message'), 'success alert inside');
  one(byCy(column, 'card-actions'), 'Actions card inside');
  assert.equal(elementsOf(column).filter((n) => n.tag === 'b-row').length, 1, 'the card row inside');
  assert.equal(byTag(column, 'b-modal').length, 0, 'no modal inside the column');
  assert.equal(top.filter((n) => n.tag === 'b-modal').length, 2, 'both modals stay at the top level');
  assert.equal(top.filter((n) => ['b-alert', 'b-card', 'b-row'].includes(n.tag)).length, 0, 'nothing else left at the top level');
  for (const state of [{ device: null, loading: true }, { device: null, loading: false }]) {
    const r = renderPage(deviceDetailPage().def, state);
    assert.equal(r.error, null, 'renders without a device');
    assert.equal(byCy(r.vnode, 'device-detail-content').length, 0, 'loading / not found is not wrapped (loading=' + state.loading + ')');
  }
});

check('W2 compiled theme: .device-detail-content max-width 1140px, no margin; imported once right after build-log', () => {
  const bodies = expectDecls('.device-detail-content', { 'max-width': '1140px' });
  bodies.forEach((body) => body.split(';').forEach((d) => {
    assert.ok(!/^\s*margin/.test(d), 'no margin declaration: ' + d);
  }));
  const lines = read('styles/theme.scss').split('\n').map((l) => l.trim());
  assert.equal(lines.filter((l) => l === "@import 'device-detail';").length, 1, "one @import 'device-detail';");
  assert.equal(lines[lines.indexOf("@import 'build-log';") + 1], "@import 'device-detail';", 'right after build-log');
});

// ================================================================ M: account menu (POL-01, D-16, UI-C07..UI-C09)

// The children a named old-syntax slot (`<template slot="x">`) contributes to an element vnode.
function slotChildren(n, name) {
  const marked = (n.children || []).filter((c) => c.data && c.data.slot === name);
  return marked.length === 1 && marked[0].tag === 'template' ? (marked[0].children || []) : marked;
}

check('M1 the account menu toggle is a user icon named Account menu with an Account tip; items unchanged', () => {
  const { def, source } = header();
  assert.ok(!source.includes('flaticon-settings-10'), 'no settings cog in Header.vue');
  const r = renderPage(def, { profile: {} });
  assert.equal(r.error, null, 'Header renders without error');
  assert.deepEqual(r.warnings, [], 'Header renders without Vue warnings');
  const dropdown = one(byCy(r.vnode, 'settings-dropdown'), 'settings-dropdown');
  assert.equal(dropdown.tag, 'b-nav-item-dropdown');
  assert.ok('no-caret' in attrsOf(dropdown) && 'right' in attrsOf(dropdown), 'no-caret and right kept');
  assert.deepEqual(classList(dropdown), ['mr-2'], 'class mr-2');
  assert.equal(attrsOf(dropdown)['menu-class'], 'dropdown-menu-settings', 'menu class kept');
  const content = slotChildren(dropdown, 'button-content');
  assert.deepEqual(content.filter((c) => !c.tag && c.text.trim() !== ''), [], 'no loose text in the toggle');
  const [glyph, name, ...rest] = content.filter((c) => c.tag);
  assert.deepEqual(rest, [], 'two toggle children');
  assert.equal(glyph.tag, 'i', 'glyph is an i');
  assert.deepEqual(classList(glyph), ['la', 'la-user-circle', 'account-menu-icon'], 'la la-user-circle account-menu-icon');
  assert.equal(attrsOf(glyph).title, 'Account', 'hover tip Account');
  assert.equal(attrsOf(glyph)['aria-hidden'], 'true', 'glyph aria-hidden');
  assert.equal(name.tag, 'span', 'name is a span');
  assert.deepEqual(classList(name), ['sr-only'], 'visually hidden name');
  assert.equal(textOf(name), 'Account menu', 'accessible name Account menu');
  const items = elementsOf(dropdown).filter((c) => !(c.data && c.data.slot));
  assert.deepEqual(items.map((c) => c.tag), ['b-dropdown-item', 'b-dropdown-divider', 'b-dropdown-item-button'], 'two items and a divider');
  assert.equal(attrsOf(items[0]).to, '/app/profile', 'My Profile goes to /app/profile');
  assert.equal(cyOf(items[0]), 'header-profile', 'header-profile hook kept');
  assert.deepEqual(classList(one(byTag(items[0], 'i'), 'profile glyph')), ['la', 'la-user']);
  assert.equal(textOf(items[0]), 'My Profile');
  assert.deepEqual(classList(one(byTag(items[2], 'i'), 'logout glyph')), ['la', 'la-sign-out']);
  assert.equal(textOf(items[2]), 'Log Out');
  assert.ok(items[2].data.on && items[2].data.on.click, 'Log Out has its click handler');
});

const headerRules = lazy(() => cssRules(sass.compile(path.join(SRC, 'components', 'Header', 'Header.scss'), {
  style: 'compressed',
  quietDeps: true,
  logger: sass.Logger.silent,
}).css));

check('M2 compiled Header.scss: .account-menu-icon has padding 0 8px', () => {
  const bodies = headerRules().filter((r) => r.selectors.some((s) => /(^|\s)\.account-menu-icon$/.test(loose(s)))).map((r) => r.body);
  assert.ok(bodies.length, '.account-menu-icon has a rule');
  assert.equal(value(bodies, 'padding'), '0 8px', 'padding 0 8px');
});

// ================================================================ C: danger alert contrast (D-14, UI-C15, UI-C16)

// WCAG 2.x relative luminance and contrast of two #rrggbb / #rgb colours.
function rgbOf(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  assert.match(full, /^[0-9a-f]{6}$/i, 'a #rgb or #rrggbb colour: ' + hex);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}
function luminanceOf(hex) {
  const [r, g, b] = rgbOf(hex).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrastOf(a, b) {
  const [hi, lo] = [luminanceOf(a), luminanceOf(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const ruleIndex = (pred) => allRules().findIndex((r) => r.media === '' && pred(r.selectors.map(loose)));

check('C1 compiled theme: .alert-danger text and close button are #fff after the generic close rule, at least 4.5:1', () => {
  const danger = decls('.alert-danger');
  assert.equal(value(danger, 'color'), '#fff', '.alert-danger color #fff');
  const bg = value(danger, 'background');
  const ratio = contrastOf('#fff', bg);
  assert.ok(ratio >= 4.5, 'white on ' + bg + ' is ' + ratio.toFixed(2) + ':1');
  const close = ruleIndex((s) => s.includes('.alert-danger .close') && s.includes('.alert-danger button.close'));
  assert.ok(close !== -1, 'a rule for .alert-danger .close, .alert-danger button.close');
  assert.equal(value([allRules()[close].body], 'color'), '#fff', 'close button color #fff');
  assert.equal(value([allRules()[close].body], 'opacity'), '1', 'close button opacity 1');
  const generic = ruleIndex((s) => s.includes('.alert button.close'));
  assert.ok(generic !== -1 && generic < close, 'the danger close rule comes after .alert button.close');
  return 'white on ' + bg + ' ' + ratio.toFixed(2) + ':1';
});

check('C2 compiled theme: success, info, warning and transparent danger alerts and the danger inner button are unchanged', () => {
  const header = value(decls('.alert-default'), 'color');
  assert.ok(header && header !== '#fff', 'the mixin header colour: ' + header);
  ['.alert-success', '.alert-info', '.alert-warning'].forEach((sel) => assert.equal(value(decls(sel), 'color'), header, sel + ' keeps the header colour'));
  const dangerBg = value(decls('.alert-danger'), 'background');
  assert.equal(value(decls('.alert-danger.alert-transparent'), 'color'), dangerBg, 'transparent danger keeps the danger colour');
  const btn = decls('.alert-danger .btn:not(.btn-default)');
  assert.equal(value(btn, 'color'), dangerBg, 'danger inner button text keeps the danger colour');
  assert.equal(value(btn, 'background'), value(decls('.alert-success .btn:not(.btn-default)'), 'background'), 'danger inner button background as the other variants');
});

// ================================================================ L: device list (D-14, UI-C10..UI-C14)

// bootstrap-vue registers v-b-tooltip in the app (main.js Vue.use); here a no-op stands in,
// so a Devices.vue render never warns about an unknown directive.
Vue.directive('b-tooltip', {});

const platformsMod = lazy(() => loadModule('utils/platforms.js'));

// Fake require.context: resolves './b_medium_07.png' to 'sym:b_medium_07.png'.
const fakeRequire = {
  context: () => {
    const resolve = (key) => 'sym:' + String(key).replace(/^\.\//, '');
    resolve.keys = () => [];
    return resolve;
  },
};

// Devices.vue with the given platforms module (its import of utils/platforms.js).
function loadDevices(p) {
  return loadSfc('pages/Devices/Devices.vue', {
    moment: () => ({ fromNow: () => 'a moment ago' }),
    require: fakeRequire,
    PlatformBullet: { name: 'PlatformBullet', props: ['platform'], render: (h) => h('span') },
    IconButton: iconButton().def,
    BuildLogDialog: { name: 'BuildLogDialog', render: (h) => h('div'), methods: { open() {} } },
    basePlatform: p.basePlatform,
    platformInfo: p.platformInfo,
    comparePlatformKeys: p.comparePlatformKeys,
  });
}
const devicesPage = lazy(() => loadDevices(platformsMod()));

function renderList(items, state = {}, page = devicesPage()) {
  const r = renderPage(page.def, Object.assign({ items: items.map((d) => Object.assign({}, d)), viewMode: 'list' }, state));
  assert.equal(r.error, null, 'Devices renders without error');
  assert.deepEqual(r.warnings, [], 'Devices renders without Vue warnings');
  return r;
}

// One device per known platform key, plus unknown_platform, a null platform and the alias "python".
const L_FLEET = [
  ['sigfox', 'sf'], ['nodemcu', 'nm'], ['unknown', 'u-c'], ['arduino:esp8266', 'ar'], ['python', 'mp-a'],
  ['nodejs', 'nj'], ['unknown_platform', 'u-a'], ['mongoose', 'mo'], ['platformio', 'pio'], ['pine64', 'p64'],
  [null, 'u-b'], ['micropython', 'mp-b'],
].map(([platform, alias], i) => ({ udid: 'l' + i, alias, platform, keyhash: 'k' + i, mac: 'M' + i, lastupdate: new Date(Date.UTC(2026, 9, 1 + i)).toISOString() }));

// Consecutive duplicates removed: the order in which groups appear.
const groups = (list) => list.filter((x, i) => i === 0 || x !== list[i - 1]);

check('L1 view toggles: light / outline-light, aria-pressed, List view and Grid view names, aria-hidden glyphs', () => {
  const toggles = (viewMode) => {
    const { vnode } = renderList(L_FLEET, { viewMode });
    return { list: one(byCy(vnode, 'view-list'), 'view-list'), grid: one(byCy(vnode, 'view-grid'), 'view-grid') };
  };
  [['list', 'list', 'grid'], ['grid', 'grid', 'list']].forEach(([viewMode, on, off]) => {
    const t = toggles(viewMode);
    assert.equal(attrsOf(t[on]).variant, 'light', viewMode + ': active toggle is light');
    assert.equal(attrsOf(t[on])['aria-pressed'], 'true', viewMode + ': active aria-pressed true');
    assert.equal(attrsOf(t[off]).variant, 'outline-light', viewMode + ': inactive toggle is outline-light');
    assert.equal(attrsOf(t[off])['aria-pressed'], 'false', viewMode + ': inactive aria-pressed false');
  });
  const t = toggles('list');
  [['list', 'List view'], ['grid', 'Grid view']].forEach(([k, name]) => {
    assert.equal(attrsOf(t[k])['aria-label'], name, k + ' aria-label');
    assert.equal(attrsOf(t[k]).title, name, k + ' title');
    const glyph = one(elementsOf(t[k]), k + ' glyph');
    assert.equal(glyph.tag, 'span');
    assert.equal(attrsOf(glyph)['aria-hidden'], 'true', k + ' glyph aria-hidden');
  });
});

const MARKERS = [['api-key-indicator', 'No API Key assigned'], ['status-alert', 'Device reported an error'], ['status-warning', 'Device reported a warning']];

check('L2 every API-key, error and warning marker in both views is focusable with a hover and focus tooltip', () => {
  const fleet = [
    { udid: 'm1', alias: 'nokey', platform: 'arduino', keyhash: '', status: 'ok' },
    { udid: 'm2', alias: 'err', platform: 'arduino', keyhash: 'k', status: 'boot #E12' },
    { udid: 'm3', alias: 'warn', platform: 'arduino', keyhash: 'k', status: 'boot #W7' },
    { udid: 'm4', alias: 'all', platform: 'arduino', keyhash: null, status: '#e and #w' },
  ];
  const seen = [];
  ['list', 'grid'].forEach((viewMode) => {
    const { vnode } = renderList(fleet, { viewMode });
    MARKERS.forEach(([cls, text]) => {
      const found = byClass(vnode, cls);
      assert.equal(found.length, 2, viewMode + ': two ' + cls + ' markers');
      found.forEach((n) => {
        const a = attrsOf(n);
        assert.equal(a.role, 'img', cls + ' role img');
        assert.equal(a['aria-label'], text, cls + ' aria-label');
        assert.equal(a.title, a['aria-label'], cls + ' title equals aria-label');
        assert.equal(a.tabindex, '0', cls + ' tabindex 0');
        const tip = ((n.data && n.data.directives) || []).filter((d) => d.name === 'b-tooltip');
        assert.equal(tip.length, 1, cls + ' has v-b-tooltip');
        assert.deepEqual(tip[0].modifiers, { hover: true, focus: true }, cls + ' hover and focus');
        if (cls === 'api-key-indicator') assert.equal(cyOf(n), 'api-key-warning', 'api-key-warning hook kept');
      });
      seen.push(viewMode + ' ' + cls);
    });
  });
  return seen.length + ' marker kinds';
});

check('L3 compiled theme: marker :focus has no outline, :focus-visible a 2px white ring at 2px offset', () => {
  MARKERS.forEach(([cls]) => {
    expectDecls('.' + cls + ':focus', { outline: 'none' });
    expectDecls('.' + cls + ':focus-visible', { outline: '2px solid #fff', 'outline-offset': '2px', 'border-radius': '2px' });
  });
});

check('L4 Platform sort follows the pills (label order, unknown last), alias breaks ties; one shared comparator', () => {
  const p = platformsMod();
  assert.equal(typeof p.comparePlatformKeys, 'function', 'comparePlatformKeys is exported');
  const { vm } = renderList(L_FLEET);
  vm.sortBy = 'platform';
  const pills = vm.platformPills.map((x) => x.key).filter((k) => k !== 'All');
  assert.deepEqual(pills, ['arduino', 'micropython', 'mongoose', 'nodejs', 'nodemcu', 'pine64', 'platformio', 'sigfox', 'unknown'], 'pill order');
  assert.deepEqual(groups(vm.filteredItems.map((d) => p.basePlatform(d.platform))), pills, 'rows group in pill order');
  assert.deepEqual(vm.filteredItems.map((d) => d.alias), ['ar', 'mp-a', 'mp-b', 'mo', 'nj', 'nm', 'p64', 'pio', 'sf', 'u-a', 'u-b', 'u-c'], 'alias breaks ties');
  const { def } = devicesPage();
  assert.ok(def.computed.platformPills.toString().includes('comparePlatformKeys('), 'platformPills sorts with comparePlatformKeys');
  assert.ok(def.computed.filteredItems.toString().includes('comparePlatformKeys('), 'the platform sort uses comparePlatformKeys');
  const c = p.comparePlatformKeys;
  assert.ok(c('unknown', 'arduino') > 0 && c('arduino', 'unknown') < 0 && c('unknown', 'unknown') === 0, 'unknown last');
  assert.ok(c('nodejs', 'nodemcu') < 0 && c('pine64', 'platformio') < 0, 'by label');
});

check('L5 labels decide: renaming NodeJS to Zeta moves nodejs after sigfox in the pills and the sort', () => {
  const zeta = loadModule('utils/platforms.js', (s) => {
    assert.ok(s.includes("nodejs: { label: 'NodeJS'"), 'the NodeJS label is where the transform expects it');
    return s.replace("nodejs: { label: 'NodeJS'", "nodejs: { label: 'Zeta'");
  });
  assert.equal(zeta.PLATFORMS.nodejs.label, 'Zeta', 'transform applied');
  const { vm } = renderList(L_FLEET, {}, loadDevices(zeta));
  vm.sortBy = 'platform';
  const want = ['arduino', 'micropython', 'mongoose', 'nodemcu', 'pine64', 'platformio', 'sigfox', 'nodejs', 'unknown'];
  assert.deepEqual(vm.platformPills.map((x) => x.key).filter((k) => k !== 'All'), want, 'pills by label');
  assert.deepEqual(groups(vm.filteredItems.map((d) => zeta.basePlatform(d.platform))), want, 'rows by label');
});

check('L6 row checkbox ids follow the udid and stay with their row after a re-sort; grid and checkboxAll unchanged', () => {
  const { vm, vnode } = renderList(L_FLEET);
  const idsOf = (top) => byCy(top, 'device-row').map((row) => {
    const input = one(byTag(row, 'input'), 'row checkbox');
    const label = one(byTag(row, 'label'), 'row label');
    assert.equal(attrsOf(input).id, 'checkbox-' + row.key, row.key + ': checkbox-<udid>');
    assert.equal(attrsOf(label).for, attrsOf(input).id, row.key + ': label targets its checkbox');
    return row.key;
  });
  const before = idsOf(vnode);
  vm.sortBy = 'platform';
  const after = idsOf(rerender(vm));
  assert.notDeepEqual(after, before, 'the re-sort changed the row order');
  assert.deepEqual([...after].sort(), [...before].sort(), 'same devices');
  const all = byTag(vnode, 'thead').map((h) => one(byTag(h, 'input'), 'checkboxAll'))[0];
  assert.equal(attrsOf(all).id, 'checkboxAll', 'checkboxAll unchanged');
  vm.viewMode = 'grid';
  const cols = byTag(rerender(vm), 'b-col').filter((n) => n.key);
  assert.equal(cols.length, L_FLEET.length, 'one grid card per device');
  cols.forEach((col) => assert.equal(attrsOf(one(byTag(col, 'input'), 'grid checkbox')).id, 'grid-checkbox-' + col.key));
});

// device-list-parity.cjs runs in the same test:unit chain; this asserts it still carries the
// Phase 48 harness changes and the label-titled sort check, so its pass is the L7 evidence.
check('L7 device-list-parity.cjs renders Devices.vue with the no-op tooltip and the comparator, sort check by label', () => cites('device-list-parity.cjs', [
  "Vue.directive('b-tooltip', {});",
  'comparePlatformKeys: p.comparePlatformKeys',
  "check('sort Platform orders by platform label, unknown last, then alias; Last Update and Alias unchanged'",
  "['Alpha', 'Bravo', 'Hotel', 'Echo', 'Charlie', 'Delta', 'Foxtrot', 'Golf'], 'platform sort order'",
]));

check('L8 a missing or unrecognised platform sorts with unknown at the end; a missing alias sorts first in its platform', () => {
  const fleet = [
    { udid: 'p1', alias: 'b-dev', platform: 'arduino' },
    { udid: 'p2', platform: 'arduino' },
    { udid: 'p3', alias: 'z', platform: 'esp-idf:foo' },
    { udid: 'p4', alias: 'a' },
    { udid: 'p5', alias: 'm', platform: 'mongoose' },
    { udid: 'p6', alias: 42, platform: '' },
  ];
  const { vm } = renderList(fleet);
  vm.sortBy = 'platform';
  assert.deepEqual(vm.filteredItems.map((d) => d.udid), ['p2', 'p1', 'p5', 'p6', 'p4', 'p3'], 'unknown group last, alias as text');
  const c = platformsMod().comparePlatformKeys;
  [undefined, null, '', 'esp-idf:foo', 42].forEach((raw) => {
    assert.ok(c(raw, 'arduino') > 0, JSON.stringify(raw) + ' sorts after arduino');
    assert.equal(c(raw, 'unknown'), 0, JSON.stringify(raw) + ' is unknown');
  });
});

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

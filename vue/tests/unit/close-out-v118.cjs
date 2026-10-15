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

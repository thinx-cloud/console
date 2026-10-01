// Unit test for History log paging in the Vue console (phase 26, LOG-03 / LOG-04).
//
// Drives the real chain in plain node: History.vue (template + script) -> the real
// auditlog / buildlog Vuex modules -> the real Api client ($get -> parseResult) ->
// a fake network that serves synthetic pages. Only Api.request's network part is
// replaced, so parseResult runs exactly as in the browser.
//
// The Vue app has no unit runner (cypress only), so SFCs are split with
// vue-template-compiler and ESM imports/exports are rewritten before evaluation,
// like footer-hostnames.cjs. Components are not mounted: the render function is
// called and the vnode tree is walked, including component children.
// Plain node, no build, no browser: npm run test:unit

const fs = require('fs');
const path = require('path');

const VUE_ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(VUE_ROOT, 'src');

// Load the libraries before stubbing window, so Vue does not take the browser path.
const Vue = require('vue/dist/vue.runtime.common.js');
const compiler = require('vue-template-compiler');
const vuex = require('vuex');

global.window = { location: { origin: 'https://served-origin.invalid' } };

Vue.config.productionTip = false;
Vue.config.devtools = false;
Vue.config.silent = true;
let renderError = null;
Vue.config.errorHandler = (err) => { renderError = err; };
Vue.use(vuex);

// Router stand-ins: History reads $route.name / $route.query and replaces the query.
Vue.prototype.$route = { name: 'HistoryAudit', query: {} };
Vue.prototype.$router = {
  push() { return Promise.resolve(); },
  replace() { return Promise.resolve(); },
};

// Minimal stubs for every bootstrap-vue tag History uses. They are never mounted;
// the walker below reads their children from componentOptions.children.
['b-breadcrumb', 'b-breadcrumb-item', 'b-tabs', 'b-tab', 'b-form', 'b-form-input',
  'b-form-checkbox-group', 'b-badge', 'b-button', 'b-spinner'].forEach((tag) => {
  Vue.component(tag, { render(h) { return h('div', this.$slots.default); } });
});

let failures = 0;

// A rejection nobody handles (e.g. a promise dropped by created()) is recorded so
// the test that caused it fails, instead of killing the whole run.
const unhandled = [];
process.on('unhandledRejection', (err) => { unhandled.push(err); });

function check(name, condition, detail) {
  console.log((condition ? 'ok   ' : 'FAIL ') + name + (condition || !detail ? '' : ' (' + detail + ')'));
  if (!condition) failures++;
}

// ---------------------------------------------------------------------------
// ESM loader: import { a, b as c } / import X / import * as X, export default,
// export const / let / function / class. Resolution maps the store helpers and
// stores to the real files; anything else is a stub.

function stubModule() {
  return new Proxy({}, {
    get(target, key) {
      if (key === 'default') return {};
      if (key === '__esModule') return true;
      return function noop() {};
    },
  });
}

function resolveImport(specifier, fromDir) {
  if (specifier === 'vuex') return vuex;
  let file = null;
  if (specifier.startsWith('@/')) file = path.join(SRC, specifier.slice(2));
  else if (specifier.startsWith('.')) file = path.join(fromDir, specifier);
  if (file) {
    if (!/\.js$/.test(file)) file += '.js';
    if (file.startsWith(path.join(SRC, 'store') + path.sep)) return loadFile(file);
  }
  return stubModule();
}

function loadModule(source, fromDir) {
  let code = source;
  const exported = [];
  code = code.replace(/^\s*import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"];?/gm, (m, names, spec) => {
    const parts = names.split(',').map((s) => s.trim()).filter(Boolean)
      .map((s) => s.replace(/\s+as\s+/, ': '));
    return 'const { ' + parts.join(', ') + ' } = __import(' + JSON.stringify(spec) + ');';
  });
  code = code.replace(/^\s*import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s*['"]([^'"]+)['"];?/gm,
    (m, name, spec) => 'const ' + name + ' = __import(' + JSON.stringify(spec) + ');');
  code = code.replace(/^\s*import\s+([A-Za-z_$][\w$]*)\s+from\s*['"]([^'"]+)['"];?/gm,
    (m, name, spec) => 'const ' + name + ' = __import(' + JSON.stringify(spec) + ').default;');
  code = code.replace(/^\s*import\s*['"][^'"]+['"];?/gm, '');
  code = code.replace(/^export\s+(const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm, (m, kind, name) => {
    exported.push(name);
    return kind + ' ' + name;
  });
  code = code.replace(/\bexport\s+default\b/, 'module.exports.default =');
  code += '\n' + exported.map((n) => 'module.exports.' + n + ' = ' + n + ';').join('\n');
  const module = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('module', '__import', code)(module, (spec) => resolveImport(spec, fromDir));
  return module.exports;
}

// No cache: each store gets fresh module state objects.
function loadFile(file) {
  return loadModule(fs.readFileSync(file, 'utf8'), path.dirname(file));
}

function loadApi() {
  return loadFile(path.join(SRC, 'core', 'api.js')).default;
}

function loadHistoryOptions() {
  const file = path.join(SRC, 'pages', 'History', 'History.vue');
  const sfc = compiler.parseComponent(fs.readFileSync(file, 'utf8'));
  const compiled = compiler.compileToFunctions(sfc.template.content);
  const options = loadModule(sfc.script.content, path.dirname(file)).default;
  return Object.assign({}, options, {
    render: compiled.render,
    staticRenderFns: compiled.staticRenderFns,
  });
}

// ---------------------------------------------------------------------------
// Fake network behind the real Api client. handler(path, n) returns a raw JSON
// body (as the server would send it) or an Error to reject like a network fault.

function makeApi(handler) {
  const Api = loadApi();
  const api = new Api('https://api.invalid');
  const calls = [];
  api.request = async function request(method, p) {
    calls.push(p);
    const raw = await handler(p, calls.filter((c) => c === p).length);
    if (raw instanceof Error) throw raw;
    return this.parseResult(JSON.parse(JSON.stringify(raw)));
  };
  api.calls = calls;
  return api;
}

function makeStore(api) {
  const store = new vuex.Store({
    modules: {
      auditlog: loadFile(path.join(SRC, 'store', 'auditlog.js')).default,
      buildlog: loadFile(path.join(SRC, 'store', 'buildlog.js')).default,
    },
  });
  store.$api = api;
  return store;
}

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

async function settle() {
  for (let i = 0; i < 10; i++) await flush();
}

// Synthetic rows only: no real owners, devices, ids or messages.
function auditRows(prefix, n) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    rows.push({ date: new Date(Date.UTC(2026, 8, 20 - i)).toISOString(), message: prefix + ' event ' + i, flags: ['info'] });
  }
  return rows;
}

function buildRows(prefix, n) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    const id = prefix + '-build-' + i;
    const at = new Date(Date.UTC(2026, 8, 20 - i)).toISOString();
    rows.push({
      _id: id,
      name: prefix + '-device-' + i,
      state: 'completed',
      log: [{ build_id: id, udid: prefix + '-udid-' + i, state: 'completed', last_update: at,
        log: [{ udid: prefix + '-udid-' + i, state: 'completed', last_update: at, contents: 'line ' + i }] }],
    });
  }
  return rows;
}

function page(items, hasMore, cursor) {
  return { success: true, response: items, paging: { limit: 100, has_more: hasMore, next_cursor: hasMore ? cursor : null } };
}

// A promise the test resolves by hand, to observe the in-flight state.
function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

// Default two-page server for both logs.
function twoPageHandler(overrides) {
  const o = overrides || {};
  return (p, n) => {
    if (o[p]) return o[p](n);
    if (p === '/logs/audit?limit=100') return page(auditRows('a1', 3), true, 'audit-c1');
    if (p === '/logs/audit?limit=100&cursor=audit-c1') return page(auditRows('a2', 2), false, null);
    if (p === '/logs/build?limit=100') return page(buildRows('b1', 2), true, 'build-c1');
    if (p === '/logs/build?limit=100&cursor=build-c1') return page(buildRows('b2', 1), false, null);
    return { success: false, response: 'not_found' };
  };
}

async function makeHistory(handler) {
  const api = makeApi(handler);
  const store = makeStore(api);
  const vm = new Vue(Object.assign({}, loadHistoryOptions(), { store }));
  await settle();
  return { vm, store, api };
}

// ---------------------------------------------------------------------------
// vnode helpers

function kids(vnode) {
  const out = [];
  if (vnode.children) out.push(...vnode.children);
  if (vnode.componentOptions && vnode.componentOptions.children) out.push(...vnode.componentOptions.children);
  return out;
}

function walk(vnode, visit) {
  if (!vnode) return;
  visit(vnode);
  kids(vnode).forEach((c) => walk(c, visit));
}

function render(vm) {
  renderError = null;
  const vnode = vm._render();
  if (renderError) throw renderError;
  return vnode;
}

function byCy(root, cy) {
  const out = [];
  walk(root, (v) => { if (v.data && v.data.attrs && v.data.attrs['data-cy'] === cy) out.push(v); });
  return out;
}

function textOf(vnode) {
  let s = '';
  walk(vnode, (v) => { if (!v.tag && typeof v.text === 'string' && !v.isComment) s += v.text; });
  return s.replace(/\s+/g, ' ').trim();
}

function classesOf(vnode) {
  const out = [];
  const add = (c) => {
    if (!c) return;
    if (typeof c === 'string') out.push(...c.split(/\s+/).filter(Boolean));
    else if (Array.isArray(c)) c.forEach(add);
    else Object.keys(c).forEach((k) => { if (c[k]) out.push(k); });
  };
  if (vnode.data) { add(vnode.data.staticClass); add(vnode.data.class); }
  return out;
}

function attr(vnode, name) {
  return vnode && vnode.data && vnode.data.attrs ? vnode.data.attrs[name] : undefined;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------------------------------------------------------------------------
// Task 1: parseResult, auditlog store, History audit Load more

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('parseResult keeps paging', async () => {
  const Api = loadApi();
  const paging = { limit: 100, has_more: true, next_cursor: 'c' };
  const out = new Api('https://api.invalid').parseResult({ success: true, response: [1], paging: Object.assign({}, paging) });
  return [same(out.response, [1]) && same(out.paging, paging), JSON.stringify(out)];
});

test('parseResult legacy shape unchanged', async () => {
  const Api = loadApi();
  const out = new Api('https://api.invalid').parseResult({ success: true, response: [1] });
  return [same(Object.keys(out).sort(), ['response', 'success']) && out.success === true && same(out.response, [1]),
    JSON.stringify(out)];
});

test('auditlog first page requests /logs/audit?limit=100', async () => {
  const api = makeApi(() => page(auditRows('a1', 2), true, 'c'));
  const store = makeStore(api);
  const items = await store.dispatch('auditlog/fetchAuditlog');
  const paging = store.getters['auditlog/getPaging'];
  return [same(api.calls, ['/logs/audit?limit=100']) && items.length === 2 &&
    paging && paging.has_more === true && paging.next_cursor === 'c',
    JSON.stringify({ calls: api.calls, paging })];
});

test('auditlog fetchAuditPage does not mutate store items', async () => {
  const api = makeApi((p) => (p === '/logs/audit?limit=100'
    ? page(auditRows('a1', 3), true, 'c/+=')
    : page(auditRows('a2', 2), false, null)));
  const store = makeStore(api);
  await store.dispatch('auditlog/fetchAuditlog');
  const before = store.state.auditlog.items.slice();
  const res = await store.dispatch('auditlog/fetchAuditPage', { cursor: 'c/+=' });
  const after = store.state.auditlog.items;
  return [api.calls[1] === '/logs/audit?limit=100&cursor=c%2F%2B%3D' && res && res.ok === true &&
    res.items.length === 2 && after.length === 3 && after.every((x, i) => x === before[i]) &&
    res.paging.has_more === false,
    JSON.stringify({ calls: api.calls, res: res && { ok: res.ok, n: res.items && res.items.length }, n: after.length })];
});

test('auditlog fetchAuditPage reports failure', async () => {
  const store1 = makeStore(makeApi(() => ({ success: false, response: 'invalid_cursor' })));
  const r1 = await store1.dispatch('auditlog/fetchAuditPage', { cursor: 'x' });
  const store2 = makeStore(makeApi(() => new Error('network down')));
  let r2;
  let threw = false;
  try { r2 = await store2.dispatch('auditlog/fetchAuditPage', { cursor: 'x' }); } catch (e) { threw = true; }
  return [same(r1, { ok: false }) && same(r2, { ok: false }) && !threw, JSON.stringify({ r1, r2, threw })];
});

test('History audit Load more appends the next page', async () => {
  const { vm, api } = await makeHistory(twoPageHandler());
  const firstLen = vm.auditlog.length;
  await vm.loadMoreAudit();
  return [firstLen === 3 && vm.auditlog.length === 5 && vm.auditPaging.has_more === false &&
    api.calls.includes('/logs/audit?limit=100&cursor=audit-c1') && vm.loading === false,
    JSON.stringify({ firstLen, len: vm.auditlog.length, paging: vm.auditPaging, calls: api.calls })];
});

test('History audit Load more hidden when has_more is false', async () => {
  const { vm } = await makeHistory(twoPageHandler());
  const btn = byCy(render(vm), 'audit-load-more');
  const before = btn.length === 1 && attr(btn[0], 'aria-label') === 'Load more audit log entries' &&
    textOf(btn[0]) === 'Load more';
  await vm.loadMoreAudit();
  const tree = render(vm);
  const after = byCy(tree, 'audit-load-more').length === 0 && byCy(tree, 'audit-paging').length === 1;
  return [before && after, JSON.stringify({ before, after })];
});

// ---------------------------------------------------------------------------
// Task 2: buildlog store, History build Load more, independence, background refresh

const BUILD_KEYS = ['build_id', 'date', 'id', 'log', 'name', 'raw', 'status', 'udid'];

test('buildlog first page requests /logs/build?limit=100', async () => {
  const api = makeApi(() => page(buildRows('b1', 2), true, 'b1'));
  const store = makeStore(api);
  const items = await store.dispatch('buildlog/fetchBuildLog');
  const paging = store.getters['buildlog/getPaging'];
  return [same(api.calls, ['/logs/build?limit=100']) && items.length === 2 &&
    same(paging, { limit: 100, has_more: true, next_cursor: 'b1' }) &&
    same(Object.keys(items[0]).sort(), BUILD_KEYS),
    JSON.stringify({ calls: api.calls, paging })];
});

test('buildlog pages are normalized', async () => {
  // One nested-shape doc and one flat item. Buildlog.toBuildListItem reduces a flat
  // doc (no log) to {date, udid}; both shapes come back from the paged list.
  const flat = { date: '2026-09-01T00:00:00.000Z', udid: 'flat-udid' };
  const api = makeApi(() => page(buildRows('b2', 1).concat([flat]), false, null));
  const store = makeStore(api);
  const before = store.state.buildlog.items;
  const res = await store.dispatch('buildlog/fetchBuildPage', { cursor: 'b/1' });
  const ok = res && res.ok === true && res.items.length === 2 &&
    res.items.every((it) => same(Object.keys(it).sort(), BUILD_KEYS)) &&
    res.items[0].build_id === 'b2-build-0' && res.items[0].udid === 'b2-udid-0' && res.items[0].status === 'OK' &&
    same(res.items[0].log, ['line 0']) && res.items[1].udid === 'flat-udid' &&
    res.items[1].date === '2026-09-01T00:00:00.000Z' &&
    api.calls[0] === '/logs/build?limit=100&cursor=b%2F1' && store.state.buildlog.items === before &&
    res.paging.has_more === false;
  const fail = await makeStore(makeApi(() => new Error('down'))).dispatch('buildlog/fetchBuildPage', { cursor: 'x' });
  return [ok && same(fail, { ok: false }), JSON.stringify({ calls: api.calls, items: res && res.items && res.items.map((it) => [it.udid, it.date]), fail })];
});

test('History build Load more appends the next page', async () => {
  const { vm, api } = await makeHistory(twoPageHandler());
  const btn = byCy(render(vm), 'build-load-more');
  const before = btn.length === 1 && attr(btn[0], 'aria-label') === 'Load more builds' && textOf(btn[0]) === 'Load more';
  const firstLen = vm.buildlog.length;
  await vm.loadMoreBuilds();
  const tree = render(vm);
  return [before && firstLen === 2 && vm.buildlog.length === 3 && vm.buildPaging.has_more === false &&
    api.calls.includes('/logs/build?limit=100&cursor=build-c1') &&
    byCy(tree, 'build-load-more').length === 0 && byCy(tree, 'build-paging').length === 1,
    JSON.stringify({ before, firstLen, len: vm.buildlog.length, paging: vm.buildPaging })];
});

test('History tables page independently', async () => {
  const { vm } = await makeHistory(twoPageHandler());
  const build0 = { rows: vm.buildlog.slice(), paging: Object.assign({}, vm.buildPaging) };
  await vm.loadMoreAudit();
  let tree = render(vm);
  const buildUntouched = vm.buildlog.length === build0.rows.length &&
    vm.buildlog.every((x, i) => x === build0.rows[i]) && same(vm.buildPaging, build0.paging) &&
    byCy(tree, 'build-load-more').length === 1 && vm.buildLoadingMore === false;
  const audit1 = { rows: vm.auditlog.slice(), paging: Object.assign({}, vm.auditPaging) };
  await vm.loadMoreBuilds();
  tree = render(vm);
  const auditUntouched = vm.auditlog.length === 5 && vm.auditlog.every((x, i) => x === audit1.rows[i]) &&
    same(vm.auditPaging, audit1.paging) && vm.buildlog.length === 3;
  return [buildUntouched && auditUntouched, JSON.stringify({ buildUntouched, auditUntouched })];
});

test('History ignores a background first-page refresh', async () => {
  const { vm, store, api } = await makeHistory(twoPageHandler());
  await vm.loadMoreAudit();
  const paging = Object.assign({}, vm.auditPaging);
  const buildPaging = Object.assign({}, vm.buildPaging);
  const n = api.calls.length;
  // What Header / Notifications / the dashboard do on their own schedule.
  await store.dispatch('auditlog/fetchAuditlog');
  await store.dispatch('buildlog/fetchBuildLog');
  await settle();
  return [api.calls.length === n + 2 && store.state.auditlog.items.length === 3 &&
    vm.auditlog.length === 5 && same(vm.auditPaging, paging) &&
    vm.buildlog.length === 2 && same(vm.buildPaging, buildPaging),
    JSON.stringify({ len: vm.auditlog.length, paging: vm.auditPaging })];
});

// ---------------------------------------------------------------------------
// Task 3: UI-SPEC states (hint, no-match, error + retry, initial load, busy, live region)

const NO_MATCH = 'No loaded entries match these filters.';
const LOAD_ERROR = "Couldn't load older entries. Select Load more to try again.";

function hintOf(tree, table) {
  const h = byCy(tree, table + '-filter-hint');
  return h.length ? textOf(h[0]) : null;
}

test('History filter hint singular and plural', async () => {
  const { vm, api } = await makeHistory(twoPageHandler({
    '/logs/audit?limit=100': () => page(auditRows('a1', 1), true, 'audit-c1'),
  }));
  const calls0 = api.calls.length;
  const idle = hintOf(render(vm), 'audit') === null && hintOf(render(vm), 'build') === null;
  vm.dateFrom = '2020-01-01';
  let tree = render(vm);
  const one = hintOf(tree, 'audit') === 'Filtering 1 loaded entry; older entries exist.';
  const buildTwo = hintOf(tree, 'build') === 'Filtering 2 loaded entries; older entries exist.';
  vm.dateFrom = '';
  vm.auditFlagFilter = ['danger', 'warning'];
  vm.auditlog = auditRows('x', 1200);
  tree = render(vm);
  const many = hintOf(tree, 'audit') === 'Filtering ' + (1200).toLocaleString() + ' loaded entries; older entries exist.';
  const buildIdle = hintOf(tree, 'build') === null; // flags are audit-only
  vm.auditFlagFilter = ['danger', 'warning', 'info'];
  vm.auditSearch = '   ';
  const blankSearch = hintOf(render(vm), 'audit') === null;
  vm.auditSearch = 'event';
  const search = hintOf(render(vm), 'audit') !== null;
  vm.auditPaging = { limit: 100, has_more: false, next_cursor: null };
  const complete = hintOf(render(vm), 'audit') === null;
  await settle();
  // Filters stay client-side: none of the changes above requested anything (D-05, D-06).
  const noRequests = api.calls.length === calls0;
  return [idle && one && buildTwo && many && buildIdle && blankSearch && search && complete && noRequests,
    JSON.stringify({ idle, one, buildTwo, many, buildIdle, blankSearch, search, complete, noRequests })];
});

test('History no-match line keeps Load more', async () => {
  const { vm } = await makeHistory(twoPageHandler());
  vm.auditSearch = 'zzz-no-such-entry';
  vm.buildSearch = 'zzz-no-such-build';
  const tree = render(vm);
  const text = textOf(tree);
  const noMatch = text.split(NO_MATCH).length - 1 === 2 && !text.includes('No audit events.') &&
    !text.includes('No build logs.') && byCy(tree, 'audit-row').length === 0 &&
    byCy(tree, 'audit-load-more').length === 1 && byCy(tree, 'build-load-more').length === 1;
  // Nothing loaded at all: the existing empty-state lines and no Load more.
  const empty = await makeHistory(() => page([], false, null));
  const etree = render(empty.vm);
  const etext = textOf(etree);
  const emptyOk = etext.includes('No audit events.') && etext.includes('No build logs.') && !etext.includes(NO_MATCH) &&
    byCy(etree, 'audit-load-more').length === 0 && byCy(etree, 'build-load-more').length === 0 &&
    byCy(etree, 'audit-paging').length === 1 && byCy(etree, 'build-paging').length === 1;
  return [noMatch && emptyOk, JSON.stringify({ noMatch, emptyOk })];
});

test('History load error keeps rows and allows retry', async () => {
  const { vm, api } = await makeHistory(twoPageHandler({
    '/logs/audit?limit=100&cursor=audit-c1': (n) => (n === 1
      ? { success: false, status: 500, response: null }
      : page(auditRows('a2', 2), false, null)),
  }));
  const rows = vm.auditlog.slice();
  const paging = Object.assign({}, vm.auditPaging);
  await vm.loadMoreAudit();
  vm.dateFrom = '2020-01-01'; // show the hint too, for the colour rules
  let tree = render(vm);
  const err = byCy(tree, 'audit-load-more-error');
  const hint = byCy(tree, 'audit-filter-hint');
  const kept = vm.auditlog.length === 3 && vm.auditlog.every((x, i) => x === rows[i]) && same(vm.auditPaging, paging) &&
    byCy(tree, 'audit-load-more').length === 1 && byCy(tree, 'audit-row').length === 3;
  const shown = err.length === 1 && attr(err[0], 'role') === 'alert' && textOf(err[0]) === LOAD_ERROR &&
    byCy(tree, 'build-load-more-error').length === 0;
  // UI-SPEC colour rules: body colour text; red only on the error icon.
  const icons = [];
  if (err.length) walk(err[0], (v) => { if (v.tag === 'i') icons.push(v); });
  const colours = err.length === 1 && hint.length === 1 &&
    !classesOf(err[0]).includes('text-muted') && !classesOf(err[0]).includes('text-danger') &&
    !classesOf(hint[0]).includes('text-muted') && !classesOf(hint[0]).includes('text-danger') &&
    icons.length === 1 && classesOf(icons[0]).includes('text-danger') && classesOf(icons[0]).includes('la-exclamation-circle') &&
    attr(icons[0], 'aria-hidden') === 'true';
  await vm.loadMoreAudit();
  tree = render(vm);
  const retried = vm.auditlog.length === 5 && byCy(tree, 'audit-load-more-error').length === 0 &&
    api.calls.filter((c) => c === '/logs/audit?limit=100&cursor=audit-c1').length === 2;
  return [kept && shown && colours && retried, JSON.stringify({ kept, shown, colours, retried })];
});

test('History initial load clears loading on rejection', async () => {
  const unhandled0 = unhandled.length;
  const { vm } = await makeHistory(twoPageHandler({
    '/logs/audit?limit=100': () => new Error('network down'),
  }));
  const tree = render(vm);
  const ok = vm.loading === false && vm.auditlog.length === 0 && vm.auditPaging.has_more === false &&
    byCy(tree, 'audit-load-more').length === 0 && textOf(tree).includes('No audit events.') &&
    !textOf(tree).includes('Loading...') && unhandled.length === unhandled0;
  return [ok, JSON.stringify({ loading: vm.loading, audit: vm.auditlog.length, build: vm.buildlog.length,
    unhandled: unhandled.length - unhandled0 })];
});

test('History busy state blocks a second request', async () => {
  const gate = deferred();
  const { vm, api } = await makeHistory(twoPageHandler({
    '/logs/audit?limit=100&cursor=audit-c1': () => gate.promise.then(() => page(auditRows('a2', 2), false, null)),
  }));
  const pending = vm.loadMoreAudit();
  await flush();
  let tree = render(vm);
  const btn = byCy(tree, 'audit-load-more')[0];
  const wrap = byCy(tree, 'audit-paging')[0];
  const tables = [];
  walk(tree, (v) => { if (v.tag === 'table') tables.push(v); });
  const busy = !!btn && attr(btn, 'aria-disabled') === 'true' && classesOf(btn).includes('disabled') &&
    !(btn.data.attrs && 'disabled' in btn.data.attrs) && !(btn.data.domProps && btn.data.domProps.disabled) &&
    textOf(btn) === 'Loading…' && attr(wrap, 'aria-busy') === 'true' &&
    tables.length === 2 && attr(tables[0], 'aria-busy') === 'true' && attr(tables[1], 'aria-busy') === 'false' &&
    attr(byCy(tree, 'build-paging')[0], 'aria-busy') === 'false';
  await vm.loadMoreAudit();
  await vm.loadMoreAudit();
  const single = api.calls.filter((c) => c.indexOf('/logs/audit?limit=100&cursor=') === 0).length === 1;
  gate.resolve();
  await pending;
  tree = render(vm);
  const idle = attr(byCy(tree, 'audit-paging')[0], 'aria-busy') === 'false' && vm.auditlog.length === 5;
  return [busy && single && idle, JSON.stringify({ busy, single, idle })];
});

test('History live region announces appended entries', async () => {
  const { vm } = await makeHistory(twoPageHandler({
    '/logs/audit?limit=100&cursor=audit-c1': () => page(auditRows('a2', 2), true, 'audit-c2'),
    '/logs/audit?limit=100&cursor=audit-c2': () => page(auditRows('a3', 1), false, null),
  }));
  const status = () => {
    const s = byCy(render(vm), 'audit-paging-status');
    return s.length === 1 && classesOf(s[0]).includes('sr-only') && attr(s[0], 'aria-live') === 'polite' &&
      attr(s[0], 'aria-atomic') === 'true' ? textOf(s[0]) : null;
  };
  const atRest = status() === '' && byCy(render(vm), 'build-paging-status').length === 1;
  await vm.loadMoreAudit();
  const more = status() === 'Loaded 2 more entries. 5 entries loaded.';
  await vm.loadMoreAudit();
  const last = status() === 'Loaded 1 more entry. All 6 entries loaded.';
  return [atRest && more && last, JSON.stringify({ atRest, more, last, text: status() })];
});

// ---------------------------------------------------------------------------

(async () => {
  for (const t of tests) {
    try {
      const [ok, detail] = await t.fn();
      check(t.name, ok, detail);
    } catch (e) {
      check(t.name, false, 'threw: ' + (e && e.message));
    }
  }
  process.exit(failures ? 1 : 0);
})();

// Unit test for the Deploy Keys page (phase 45, KEY-04..06, POL-04, D-16).
//
// Plain-node checks for src/pages/Rsakeys/Rsakeys.vue: the per-key table groups,
// the Phase 44 IconButton row actions (Show key, Copy key, Delete), the confirmed
// single-shot row and bulk delete, the readable non-wrapping columns with the
// fingerprint, the single load error, and the deploy-key rules compiled from
// src/styles/theme.scss (UI-SPEC UI-K01..UI-K15).
//
// SFC templates are compiled with vue-template-compiler (whitespace: 'condense',
// as vue-cli does) and rendered with vue.runtime.common; bootstrap-vue elements
// (b-*) stay plain vnodes. Child components are expanded one level at a time.
// The harness is copied from device-list-parity.cjs (not required from it).
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

// A promise whose settlement the test controls.
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

// ---------------------------------------------------------------- fixtures

const ELLIPSIS = String.fromCharCode(0x2026);
const HEX = (c) => c.repeat(64);
const KEYS = [
  {
    filename: HEX('a') + '-1760000000000',
    name: 'Firmware Repository',
    date: new Date(Date.UTC(2026, 9, 1, 10)).toString(),
    fingerprint: 'SHA256:' + 'A'.repeat(42) + 'x',
    pubkey: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC' + 'q'.repeat(300) + ' Firmware Repository',
  },
  {
    filename: HEX('b') + '-1760000001000',
    name: 'Docs',
    date: new Date(Date.UTC(2026, 9, 2, 10)).toString(),
    fingerprint: 'SHA256:' + 'B'.repeat(42) + 'y',
    pubkey: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI' + 'z'.repeat(40) + ' Docs',
  },
].map((k) => Object.assign({ id: k.filename }, k));

const keyItems = () => KEYS.map((k) => Object.assign({}, k));

// ---------------------------------------------------------------- components

const iconButton = lazy(() => loadSfc('components/IconButton/IconButton.vue'));
const page = lazy(() => loadSfc('pages/Rsakeys/Rsakeys.vue', { IconButton: iconButton().def }));

function renderKeys(state = {}) {
  const r = renderPage(page().def, Object.assign({ items: keyItems() }, state));
  assert.equal(r.error, null, 'Rsakeys renders without error');
  assert.deepEqual(r.warnings, [], 'Rsakeys renders without Vue warnings');
  return r;
}

// A page vm with the store actions and the confirm dialog replaced by counters.
function harness(state = {}) {
  const { vm } = renderKeys(state);
  const calls = { confirm: [], deleteItems: [], loadData: 0 };
  const control = { confirm: null, deleteItems: null };
  vm.$bvModal = {
    msgBoxConfirm: (text, options) => {
      calls.confirm.push({ text, options });
      control.confirm = deferred();
      return control.confirm.promise;
    },
    show: () => { throw new Error('no modal may open from a row action'); },
  };
  vm.deleteItems = (filenames) => {
    calls.deleteItems.push(filenames);
    control.deleteItems = deferred();
    return control.deleteItems.promise;
  };
  vm.loadData = async () => { calls.loadData++; };
  return { vm, calls, control };
}

const rowOf = (vnode, item) => byCy(vnode, 'deploy-key-row').find((row) => textOf(row).includes(item.name));
const deleteButtonOf = (row) => componentsOf(row, 'IconButton').filter((n) => cyOf(n) === 'key-delete');

// ---------------------------------------------------------------- A: row delete (45-03 task 1)

check('A1 each key is its own tbody.key-group with a deploy-key-row ending in an actions-cell Delete', () => {
  const { vnode } = renderKeys();
  const groups = byCy(vnode, 'deploy-key-group');
  assert.equal(groups.length, KEYS.length, 'one deploy-key-group per key');
  groups.forEach((group, i) => {
    assert.equal(group.tag, 'tbody', 'group is a tbody');
    assert.ok(classList(group).includes('key-group'), 'group has class key-group');
    const rows = byCy(group, 'deploy-key-row');
    assert.equal(rows.length, 1, 'one key row per group');
    assert.equal(rows[0].tag, 'tr');
    assert.ok(textOf(rows[0]).includes(KEYS[i].name), 'row ' + i + ' shows its key');
    const cells = cellsOf(rows[0]);
    const last = cells[cells.length - 1];
    assert.ok(classList(last).includes('actions-cell'), 'last cell is .actions-cell');
    const del = deleteButtonOf(last);
    assert.equal(del.length, 1, 'one key-delete IconButton');
    const p = propsOf(del[0]);
    assert.equal(p.icon, 'fa fa-trash');
    assert.equal(p.label, 'Delete');
    assert.equal(p.variant, 'danger');
    assert.ok(!p.disabled, 'idle Delete is enabled');
  });
  const heads = byTag(vnode, 'th').map((th) => textOf(th));
  assert.ok(heads.includes('Actions'), 'header has an Actions cell: ' + heads.join('|'));
  const empty = renderKeys({ items: [] }).vnode;
  const emptyCells = byTag(empty, 'td');
  assert.equal(emptyCells.length, 1, 'one empty-row cell');
  assert.equal(String(attrsOf(emptyCells[0]).colspan), '5', 'empty row spans 5 columns');
});

checkAsync('A2 deleteRow confirms with the key name and Keep key; no or a rejected answer sends nothing', async () => {
  const { vm, calls, control } = harness();
  const item = vm.items[0];
  const run = vm.deleteRow(item);
  assert.equal(calls.confirm.length, 1, 'one confirmation');
  const { text, options } = calls.confirm[0];
  assert.equal(typeof text, 'string', 'the confirm body is plain text');
  assert.ok(text.includes('"' + item.name + '"'), 'body names the key in double quotes: ' + text);
  assert.deepEqual(options, {
    title: 'Confirm Delete', okVariant: 'danger', okTitle: 'Delete', cancelTitle: 'Keep key',
    autoFocusButton: 'cancel', bodyClass: 'text-break',
  });
  control.confirm.resolve(false);
  await run;
  assert.equal(calls.deleteItems.length, 0, 'Keep key sends nothing');
  const again = vm.deleteRow(item);
  assert.equal(calls.confirm.length, 2, 'a cancelled confirmation releases the guard');
  control.confirm.reject(new Error('closed'));
  await again;
  assert.equal(calls.deleteItems.length, 0, 'a closed dialog sends nothing');
  assert.equal(vm.deletingIds.length, 0, 'nothing is pending');
});

checkAsync('A3 two deleteRow calls while confirming open one dialog and send one request', async () => {
  const { vm, calls, control } = harness();
  const item = vm.items[0];
  const first = vm.deleteRow(item);
  const second = vm.deleteRow(item);
  const third = vm.deleteRow(vm.items[1]);
  assert.equal(calls.confirm.length, 1, 'one msgBoxConfirm while a confirmation is open');
  control.confirm.resolve(true);
  await tick();
  assert.equal(calls.deleteItems.length, 1, 'one request');
  assert.deepEqual(calls.deleteItems[0], [item.filename]);
  vm.deleteRow(item);
  assert.equal(calls.confirm.length, 1, 'a key already deleting opens no dialog');
  control.deleteItems.resolve({ success: true });
  await Promise.all([first, second, third]);
  assert.equal(calls.deleteItems.length, 1, 'still one request');
});

checkAsync('A4 a pending row delete disables that row only; success reloads, failure releases and reports', async () => {
  const { vm, calls, control } = harness();
  const [a, b] = vm.items;
  const run = vm.deleteRow(a);
  control.confirm.resolve(true);
  await tick();
  const vnode = rerender(vm);
  const rowA = rowOf(vnode, a);
  const rowB = rowOf(vnode, b);
  const delA = propsOf(deleteButtonOf(rowA)[0]);
  assert.equal(delA.icon, 'fa fa-spin fa-circle-o-notch');
  assert.equal(delA.label, 'Deleting' + ELLIPSIS);
  assert.equal(delA.disabled, true, 'pending Delete is disabled');
  const boxA = nodesOf(rowA).filter((n) => n.tag === 'b-form-checkbox');
  assert.equal(boxA.length, 1, 'one checkbox in the row');
  assert.equal(attrsOf(boxA[0]).disabled, true, 'pending row checkbox is disabled');
  const delB = propsOf(deleteButtonOf(rowB)[0]);
  assert.ok(!delB.disabled, 'the other row stays usable');
  assert.equal(delB.label, 'Delete');
  const boxB = nodesOf(rowB).filter((n) => n.tag === 'b-form-checkbox');
  assert.ok(!attrsOf(boxB[0]).disabled, 'the other checkbox stays usable');
  control.deleteItems.resolve({ success: true });
  await run;
  assert.equal(calls.loadData, 1, 'success reloads the list');
  assert.deepEqual(vm.deletingIds, [], 'success releases the id');
  assert.equal(vm.error, null);

  for (const outcome of ['refused', 'thrown']) {
    const h = harness();
    const p = h.vm.deleteRow(h.vm.items[1]);
    h.control.confirm.resolve(true);
    await tick();
    if (outcome === 'refused') h.control.deleteItems.resolve({ success: false });
    else h.control.deleteItems.reject(new Error('offline'));
    await p;
    assert.deepEqual(h.vm.deletingIds, [], outcome + ' releases the id');
    assert.equal(h.vm.error, 'Could not delete the deploy key. Try again.', outcome + ' error copy');
    assert.equal(h.calls.loadData, 0, outcome + ' does not reload');
    const after = propsOf(deleteButtonOf(rowOf(rerender(h.vm), h.vm.items[1]))[0]);
    assert.ok(!after.disabled, outcome + ' re-enables the row');
    assert.equal(after.icon, 'fa fa-trash');
  }
});

// ---------------------------------------------------------------- run

(async () => {
  for (const [name, fn] of asyncChecks) {
    try {
      const detail = await fn();
      console.log('ok   ' + name + (typeof detail === 'string' ? ' (' + detail + ')' : ''));
    } catch (err) {
      failures++;
      console.log('FAIL ' + name + ' (' + String(err && err.message ? err.message : err).split('\n')[0] + ')');
    }
  }
  process.exit(failures ? 1 : 0);
})();

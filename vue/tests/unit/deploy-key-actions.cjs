// Unit test for the Deploy Keys page (phase 45, KEY-04..06, POL-04, D-16).
//
// Plain-node checks for src/pages/Rsakeys/Rsakeys.vue: the per-key table groups,
// the Phase 44 IconButton row actions (Show key, Copy key, Rename, Delete), the
// confirmed single-shot row and bulk delete, the readable non-wrapping columns with
// the fingerprint, the single load error, the rename dialog and the name feedback,
// and the deploy-key rules compiled from src/styles/theme.scss (UI-SPEC
// UI-K01..UI-K15). Also the client name check (src/utils/keyNames.js), the PATCH
// helper in src/core/api.js through the CSRF client and the renameItem store action.
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

// Evaluate a plain ES module from src/ and return its named exports (copied from
// device-list-parity.cjs). `transform` edits the source first, e.g. to drop a
// trailing `export default {…}` line.
function loadModule(rel, transform = (s) => s) {
  const names = [];
  const code = transform(read(rel))
    .replace(/^import .*;?$/gm, '')
    .replace(/export (const|let|function|async function) (\w+)/g, (m, kind, name) => { names.push(name); return kind + ' ' + name; });
  return new Function(code + '\nreturn { ' + names.join(', ') + ' };')();
}

// core/api.js: the Api class with its two cookies.js imports injected.
function loadApi(deps) {
  const code = read('core/api.js')
    .replace(/^import .*;?$/gm, '')
    .replace(/export default class /, 'return class ');
  return new Function('getCsrfToken', 'fetchWithCsrf', code)(deps.getCsrfToken, deps.fetchWithCsrf);
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

const keyNames = lazy(() => loadModule('utils/keyNames.js'));

// The page's keyNames imports, or none while the module is missing (the K checks report that).
function keyNameDeps() {
  try {
    const k = keyNames();
    return { validateKeyName: k.validateKeyName, keyNameMessage: k.keyNameMessage, isReservedKeyName: k.isReservedKeyName };
  } catch (e) { return {}; }
}

const iconButton = lazy(() => loadSfc('components/IconButton/IconButton.vue'));
const page = lazy(() => loadSfc('pages/Rsakeys/Rsakeys.vue', Object.assign({ IconButton: iconButton().def }, keyNameDeps())));

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

// ---------------------------------------------------------------- B: icon actions and columns (45-03 task 2)

const DASH = String.fromCharCode(0x2014);
const iconButtonsOf = (top) => componentsOf(top, 'IconButton');
const actionOf = (row, cy) => iconButtonsOf(row).filter((n) => cyOf(n) === cy)[0];
const groupOf = (vnode, item) => byCy(vnode, 'deploy-key-group').find((g) => textOf(byCy(g, 'deploy-key-row')[0]).includes(item.name));
const directText = (n) => (n.children || []).filter((c) => !c.tag).map((c) => c.text).join('');
const ROW_ACTIONS = ['key-show', 'key-copy', 'key-rename', 'key-delete'];

check('B1 header: sr-only Select, then Name, Generated, Public key, Actions; deploy-keys-table with an sr-only caption', () => {
  const { vnode } = renderKeys();
  const tables = byTag(vnode, 'table');
  assert.equal(tables.length, 1, 'one table');
  const cls = classList(tables[0]);
  assert.ok(cls.includes('table') && cls.includes('deploy-keys-table'), 'table classes: ' + cls.join(' '));
  assert.ok(!cls.includes('table-striped'), 'no Bootstrap striped-table class');
  const captions = byTag(tables[0], 'caption');
  assert.equal(captions.length, 1, 'one caption');
  assert.ok(classList(captions[0]).includes('sr-only'), 'caption is sr-only');
  assert.equal(textOf(captions[0]), 'Deploy keys');
  const heads = byTag(tables[0], 'th');
  assert.deepEqual(heads.map((th) => textOf(th)), ['Select', 'Name', 'Generated', 'Public key', 'Actions']);
  const first = (heads[0].children || []).filter((c) => c.tag || (c.text && c.text.trim()));
  assert.equal(first.length, 1, 'the Select header holds one element');
  assert.equal(first[0].tag, 'span');
  assert.ok(classList(first[0]).includes('sr-only'), 'Select text is screen-reader only');
});

check('B2 the Name cell is span.key-name[dir=auto] with the full name as title', () => {
  const { vnode } = renderKeys();
  KEYS.forEach((item) => {
    const row = rowOf(vnode, item);
    const name = cellsOf(row)[1];
    const spans = byCy(name, 'key-name');
    assert.equal(spans.length, 1, item.name + ' one key-name');
    const span = spans[0];
    assert.equal(span.tag, 'span');
    assert.ok(classList(span).includes('key-name'), 'class key-name');
    assert.equal(attrsOf(span).dir, 'auto');
    assert.equal(attrsOf(span).title, item.name);
    assert.equal(directText(span), item.name);
  });
});

check('B3 Generated and Public key cells are text-nowrap; bad dates and fingerprints render a dash', () => {
  const { vm, vnode } = renderKeys();
  KEYS.forEach((item) => {
    const cells = cellsOf(rowOf(vnode, item));
    assert.ok(classList(cells[2]).includes('text-nowrap'), 'Generated is text-nowrap');
    assert.equal(textOf(cells[2]), vm.formatDate(item.date));
    assert.notEqual(vm.formatDate(item.date), DASH, 'a valid date is formatted');
    assert.ok(classList(cells[3]).includes('text-nowrap'), 'Public key is text-nowrap');
    const fp = byCy(cells[3], 'key-fingerprint');
    assert.equal(fp.length, 1, 'one key-fingerprint');
    assert.equal(fp[0].tag, 'span');
    assert.ok(classList(fp[0]).includes('key-fingerprint'));
    assert.equal(attrsOf(fp[0]).title, 'SHA-256 fingerprint of the public key');
    assert.equal(directText(fp[0]), item.fingerprint);
  });
  [undefined, '', 'not a date', null].forEach((d) => assert.equal(vm.formatDate(d), DASH, 'formatDate(' + JSON.stringify(d) + ')'));
  [null, 42, ''].forEach((bad) => {
    const items = keyItems();
    items[0].fingerprint = bad;
    items[0].date = 'not a date';
    const r = renderKeys({ items });
    const cells = cellsOf(rowOf(r.vnode, items[0]));
    assert.equal(directText(byCy(cells[3], 'key-fingerprint')[0]), DASH, 'fingerprint ' + JSON.stringify(bad));
    assert.equal(textOf(cells[2]), DASH, 'unparseable date');
  });
});

check('B4 actions: Show key, Copy key, Rename, Delete in that order, Show wired to its key text', () => {
  const { vnode } = renderKeys();
  KEYS.forEach((item) => {
    const cell = cellsOf(rowOf(vnode, item))[4];
    const buttons = iconButtonsOf(cell);
    assert.deepEqual(buttons.map(cyOf), ['key-show', 'key-copy', 'key-rename', 'key-delete']);
    const show = buttons[0];
    assert.equal(propsOf(show).icon, 'fa fa-eye');
    assert.equal(propsOf(show).label, 'Show key');
    assert.equal(propsOf(show).variant, undefined, 'Show uses the default variant');
    assert.equal(attrsOf(show)['aria-expanded'], 'false');
    assert.equal(attrsOf(show)['aria-controls'], 'key-text-' + item.id);
    const copy = buttons[1];
    assert.equal(propsOf(copy).icon, 'fa fa-copy');
    assert.equal(propsOf(copy).label, 'Copy key');
    assert.equal(propsOf(copy).variant, undefined, 'Copy uses the default variant');
    assert.ok(!propsOf(show).disabled && !propsOf(copy).disabled, 'enabled with a pubkey');
  });
  const rows = byCy(vnode, 'deploy-key-row');
  rows.forEach((row) => assert.equal(nodesOf(row).filter((n) => n.tag === 'b-button').length, 0, 'no text buttons left in the row'));
});

check('B5 Show key toggles a detail row with the key text inline; several can be open; no modal opens', () => {
  const { vm } = renderKeys();
  vm.$bvModal = { show: () => { throw new Error('the row eye must not open a modal'); } };
  const [a, b] = vm.items;
  vm.toggleKey(a);
  let vnode = rerender(vm);
  const group = groupOf(vnode, a);
  const details = byClass(group, 'key-detail-row');
  assert.equal(details.length, 1, 'one detail row in the group');
  assert.equal(details[0].tag, 'tr');
  const tds = byTag(details[0], 'td');
  assert.equal(tds.length, 1, 'one cell');
  assert.equal(String(attrsOf(tds[0]).colspan), '5');
  const pres = byCy(tds[0], 'key-text');
  assert.equal(pres.length, 1, 'one key-text');
  assert.equal(pres[0].tag, 'pre');
  assert.ok(classList(pres[0]).includes('key-text'));
  assert.equal(attrsOf(pres[0]).id, 'key-text-' + a.id);
  assert.equal(directText(pres[0]), a.pubkey);
  const show = actionOf(byCy(group, 'deploy-key-row')[0], 'key-show');
  assert.equal(propsOf(show).icon, 'fa fa-eye-slash');
  assert.equal(propsOf(show).label, 'Hide key');
  assert.equal(attrsOf(show)['aria-expanded'], 'true');
  assert.equal(byClass(groupOf(vnode, b), 'key-detail-row').length, 0, 'the other key stays closed');
  vm.toggleKey(b);
  vnode = rerender(vm);
  assert.equal(byCy(vnode, 'key-text').length, 2, 'two keys open at once');
  vm.toggleKey(a);
  vnode = rerender(vm);
  assert.equal(byClass(groupOf(vnode, a), 'key-detail-row').length, 0, 'a second toggle closes it');
  assert.equal(byClass(groupOf(vnode, b), 'key-detail-row').length, 1, 'the other stays open');
  const handler = actionOf(byCy(groupOf(vnode, b), 'deploy-key-row')[0], 'key-show').componentOptions.listeners.click;
  handler();
  assert.equal(byCy(rerender(vm), 'key-text').length, 0, 'the click handler toggles too');
});

check('B6 an empty or non-string pubkey disables Show and Copy; a deleting key disables all four', () => {
  ['', null, 42].forEach((bad) => {
    const items = keyItems();
    items[0].pubkey = bad;
    const { vnode } = renderKeys({ items });
    const row = rowOf(vnode, items[0]);
    assert.equal(propsOf(actionOf(row, 'key-show')).disabled, true, 'Show disabled for ' + JSON.stringify(bad));
    assert.equal(propsOf(actionOf(row, 'key-copy')).disabled, true, 'Copy disabled for ' + JSON.stringify(bad));
    assert.equal(propsOf(actionOf(row, 'key-show')).label, 'Show key', 'label unchanged');
    assert.equal(propsOf(actionOf(row, 'key-copy')).label, 'Copy key', 'label unchanged');
    assert.ok(!propsOf(actionOf(row, 'key-delete')).disabled, 'Delete stays enabled');
    assert.ok(!propsOf(actionOf(row, 'key-rename')).disabled, 'Rename stays enabled');
  });
  const items = keyItems();
  const { vnode } = renderKeys({ items, deletingIds: [items[1].id] });
  const busy = rowOf(vnode, items[1]);
  ROW_ACTIONS.forEach((cy) => assert.equal(propsOf(actionOf(busy, cy)).disabled, true, cy + ' disabled while deleting'));
  const idle = rowOf(vnode, items[0]);
  ROW_ACTIONS.forEach((cy) => assert.ok(!propsOf(actionOf(idle, cy)).disabled, cy + ' enabled on the other row'));
});

// navigator is a global getter in recent Node; replace it for one check.
async function withNavigator(nav, fn) {
  const prev = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true, writable: true });
  try { return await fn(); } finally {
    if (prev) Object.defineProperty(globalThis, 'navigator', prev); else delete globalThis.navigator;
  }
}

checkAsync('B7 copy: success toasts Copied to clipboard, a total failure shows the UI-SPEC copy error', async () => {
  const { vm } = renderKeys();
  const toasts = [];
  vm.$toasted = { show: (text, opts) => toasts.push([text, opts]) };
  const written = [];
  await withNavigator({ clipboard: { writeText: async (v) => { written.push(v); } } }, () => vm.copyToClipboard(KEYS[0].pubkey));
  assert.deepEqual(written, [KEYS[0].pubkey]);
  assert.deepEqual(toasts, [['Copied to clipboard', { type: 'success', duration: 2000 }]]);
  assert.equal(vm.error, null);
  vm.copyFallback = () => { throw new Error('copy failed'); };
  await withNavigator({ clipboard: { writeText: async () => { throw new Error('denied'); } } }, () => vm.copyToClipboard(KEYS[0].pubkey));
  assert.equal(vm.error, 'Could not copy the key. Use Show key and copy the text manually.');
  assert.equal(toasts.length, 1, 'no success toast after a failure');
});

// ---------------------------------------------------------------- compiled theme

const sass = require('sass');

const compiledCss = lazy(() => sass.compileString('@import "theme";\n', {
  loadPaths: [path.join(SRC, 'styles')],
  style: 'compressed',
  quietDeps: true,
  logger: sass.Logger.silent,
}).css);

// Flat list of { media, selectors, body } for every style rule (copied from device-list-parity.cjs).
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

check('B8 compiled theme: key-name ellipsis 160/240px, key-text wraps, monospace fingerprint, group stripes', () => {
  expectDecls('.key-name', {
    display: 'block', 'max-width': '160px', overflow: 'hidden', 'text-overflow': 'ellipsis',
    'white-space': 'nowrap', 'unicode-bidi': 'isolate',
  });
  const md = allRules().filter((r) => /min-width:\s*768px/.test(r.media) && r.selectors.some((s) => loose(s) === '.key-name'));
  assert.equal(value(md.map((r) => r.body), 'max-width'), '240px', '.key-name from 768px');
  const text = expectDecls('.key-text', { 'white-space': 'pre-wrap', 'word-break': 'break-all', padding: '8px', margin: '0' });
  assert.match(value(text, 'font-family') || '', /monospace/, '.key-text monospace');
  const fp = expectDecls('.key-fingerprint', { 'font-size': '.875rem' });
  assert.match(value(fp, 'font-family') || '', /monospace/, '.key-fingerprint monospace');
  const stripe = decls('.deploy-keys-table>tbody.key-group:nth-of-type(odd)>tr');
  assert.ok(stripe.length, 'group stripe rule');
  assert.match(value(stripe, 'background-color') || '', /^rgba\(0,\s*0,\s*0,\s*0?\.05\)$/, 'stripe colour');
});

// ---------------------------------------------------------------- C: bulk toolbar, form, load error (45-03 task 3)

const rootChildren = (vnode) => (vnode.children || []).filter((n) => n.tag);
const toolbarsOf = (vnode) => byClass(vnode, 'key-toolbar');
const bulkOf = (vnode) => byCy(vnode, 'key-bulk-delete');
const formsOf = (vnode) => nodesOf(vnode).filter((n) => n.tag === 'b-form');
const createFormsOf = (vnode) => formsOf(vnode).filter((n) => classList(n).includes('key-create-form'));
const MARGIN_UTILITY = /^m[trblxy]?-(\d|auto)$/;

check('C1 the bulk toolbar sits between the intro and the table; its label follows the selection', () => {
  const { vnode } = renderKeys();
  const top = rootChildren(vnode);
  const intro = top.findIndex((n) => n.tag === 'p' && /Deploy keys grant access/.test(textOf(n)));
  const bar = top.findIndex((n) => classList(n).includes('key-toolbar'));
  const table = top.findIndex((n) => classList(n).includes('table-responsive'));
  assert.ok(intro !== -1 && bar !== -1 && table !== -1, 'intro ' + intro + ', toolbar ' + bar + ', table ' + table);
  assert.ok(intro < bar && bar < table, 'order intro < toolbar < table');
  const toolbar = top[bar];
  assert.equal(toolbar.tag, 'div');
  assert.equal(attrsOf(toolbar).role, 'toolbar');
  assert.equal(attrsOf(toolbar)['aria-label'], 'Selected deploy keys');
  const buttons = nodesOf(toolbar).filter((n) => n.tag === 'b-button');
  assert.equal(buttons.length, 1, 'one button in the toolbar');
  const btn = buttons[0];
  assert.equal(cyOf(btn), 'key-bulk-delete');
  assert.equal(attrsOf(btn).variant, 'danger');
  assert.equal(attrsOf(btn).size, 'sm');
  const icons = byTag(btn, 'i');
  assert.equal(icons.length, 1, 'one glyph');
  assert.deepEqual(classList(icons[0]).sort(), ['fa', 'fa-trash']);
  assert.equal(attrsOf(icons[0])['aria-hidden'], 'true');
  assert.equal(textOf(btn), 'Delete selected');
  assert.equal(attrsOf(btn).disabled, true, 'disabled with nothing selected');
  const items = keyItems();
  const two = bulkOf(renderKeys({ items, selectedIds: [items[0].id, items[1].id] }).vnode)[0];
  assert.equal(textOf(two), 'Delete selected (2)');
  assert.ok(!attrsOf(two).disabled, 'enabled with a selection');
  const busy = bulkOf(renderKeys({ items, selectedIds: [items[0].id], bulkDeleting: true }).vnode)[0];
  assert.equal(textOf(busy), 'Deleting' + ELLIPSIS);
  assert.equal(attrsOf(busy).disabled, true, 'disabled while deleting');
  assert.equal(toolbarsOf(renderKeys({ items: [] }).vnode).length, 0, 'no toolbar with zero keys');
  assert.equal(toolbarsOf(renderKeys({ items: [], loadFailed: true }).vnode).length, 0, 'no toolbar after a failed load');
  assert.equal(toolbarsOf(renderKeys({ loading: true }).vnode).length, 0, 'no toolbar while loading');
});

check('C2 the Generate form is b-form.key-create-form with one submit button and no margin utilities', () => {
  const { vnode } = renderKeys({ selectedIds: [KEYS[0].id] });
  const forms = createFormsOf(vnode);
  assert.equal(forms.length, 1, 'one Generate form on the page');
  const form = forms[0];
  assert.equal(attrsOf(form).id, undefined, 'the Generate form is not the rename form');
  const buttons = nodesOf(form).filter((n) => n.tag === 'b-button');
  assert.equal(buttons.length, 1, 'one button in the form');
  assert.equal(attrsOf(buttons[0]).type, 'submit');
  assert.ok(!/Delete/.test(textOf(form)), 'no Delete text in the form');
  nodesOf(form).filter((n) => n.tag).forEach((n) => {
    const bad = classList(n).filter((c) => MARGIN_UTILITY.test(c));
    assert.deepEqual(bad, [], n.tag + ' carries a margin utility');
  });
  assert.equal(bulkOf(form).length, 0, 'bulk Delete is outside the form');
});

checkAsync('C3 deleteSelected: one dialog, Keep key / Keep keys, rows disabled while pending, success and failure', async () => {
  const one = harness();
  one.vm.selectedIds = [one.vm.items[0].id];
  const p1 = one.vm.deleteSelected();
  const p2 = one.vm.deleteSelected();
  const p3 = one.vm.deleteRow(one.vm.items[1]);
  assert.equal(one.calls.confirm.length, 1, 'one msgBoxConfirm while a confirmation is open');
  assert.ok(/this deploy key/.test(one.calls.confirm[0].text), 'count wording for one: ' + one.calls.confirm[0].text);
  assert.deepEqual(one.calls.confirm[0].options, {
    title: 'Confirm Delete', okVariant: 'danger', okTitle: 'Delete', cancelTitle: 'Keep key',
    autoFocusButton: 'cancel', bodyClass: 'text-break',
  });
  one.control.confirm.resolve(false);
  await Promise.all([p1, p2, p3]);
  assert.equal(one.calls.deleteItems.length, 0, 'Keep key deletes nothing');

  const h = harness();
  const [a, b] = h.vm.items;
  h.vm.selectedIds = [a.id, b.id];
  const run = h.vm.deleteSelected();
  assert.equal(h.calls.confirm[0].options.cancelTitle, 'Keep keys');
  assert.ok(/2 deploy keys/.test(h.calls.confirm[0].text), 'count wording for two');
  h.control.confirm.resolve(true);
  await tick();
  h.vm.deleteSelected();
  assert.equal(h.calls.confirm.length, 1, 'no second dialog while the bulk request runs');
  assert.deepEqual(h.calls.deleteItems, [[a.filename, b.filename]], 'one request with both filenames');
  const vnode = rerender(h.vm);
  [a, b].forEach((item) => {
    const row = rowOf(vnode, item);
    ROW_ACTIONS.forEach((cy) => assert.equal(propsOf(actionOf(row, cy)).disabled, true, item.name + ' ' + cy));
    assert.equal(attrsOf(nodesOf(row).filter((n) => n.tag === 'b-form-checkbox')[0]).disabled, true, item.name + ' checkbox');
  });
  assert.equal(textOf(bulkOf(vnode)[0]), 'Deleting' + ELLIPSIS);
  h.control.deleteItems.resolve({ success: true });
  await run;
  assert.deepEqual(h.vm.selectedIds, [], 'success clears the selection');
  assert.equal(h.calls.loadData, 1, 'success reloads');
  assert.equal(h.vm.bulkDeleting, false);
  assert.deepEqual(h.vm.deletingIds, []);

  for (const outcome of ['refused', 'thrown']) {
    const f = harness();
    f.vm.selectedIds = [f.vm.items[1].id];
    const p = f.vm.deleteSelected();
    f.control.confirm.resolve(true);
    await tick();
    if (outcome === 'refused') f.control.deleteItems.resolve({ success: false });
    else f.control.deleteItems.reject(new Error('offline'));
    await p;
    assert.deepEqual(f.vm.selectedIds, [f.vm.items[1].id], outcome + ' keeps the selection');
    assert.equal(f.vm.error, 'Could not delete the deploy keys. Try again.', outcome + ' error copy');
    assert.equal(f.calls.loadData, 0, outcome + ' does not reload');
    assert.equal(f.vm.bulkDeleting, false, outcome + ' releases the toolbar');
    assert.deepEqual(f.vm.deletingIds, [], outcome + ' releases the rows');
  }
});

// The real loadData with the store calls replaced.
function loader(state, fetch, listed) {
  const { vm } = renderKeys(state);
  vm.fetchItems = fetch;
  vm.getItems = () => listed;
  return vm;
}

checkAsync('C4 a failed load clears rows, selection and open keys and shows exactly one load alert', async () => {
  const items = keyItems();
  const vm = loader({ items, selectedIds: [items[0].id], shownIds: [items[1].id], error: 'Could not delete the deploy key. Try again.' },
    async () => { throw new Error('offline'); }, []);
  await vm.loadData();
  assert.deepEqual(vm.items, []);
  assert.deepEqual(vm.selectedIds, []);
  assert.deepEqual(vm.shownIds, []);
  assert.equal(vm.loadFailed, true);
  assert.equal(vm.error, null, 'a load failure leaves no action error');
  assert.equal(vm.loading, false);
  const vnode = rerender(vm);
  const alerts = nodesOf(vnode).filter((n) => n.tag === 'b-alert');
  assert.equal(alerts.length, 1, 'exactly one alert');
  assert.equal(cyOf(alerts[0]), 'keys-load-error');
  assert.equal(textOf(alerts[0]), 'Could not load deploy keys. Refresh to retry.');
  assert.equal(attrsOf(alerts[0]).variant, 'danger');
  assert.ok(!('dismissible' in attrsOf(alerts[0])), 'the load alert is not dismissible');
  assert.equal(byTag(vnode, 'table').length, 0, 'no table');
  assert.equal(toolbarsOf(vnode).length, 0, 'no toolbar');
  assert.ok(!/No deploy keys yet/.test(textOf(vnode)), 'no empty-row text');
  assert.equal(createFormsOf(vnode).length, 1, 'the Generate form stays');
});

checkAsync('C5 a successful load clears the failure and prunes selection and open keys to listed ids', async () => {
  const items = keyItems();
  const vm = loader({ items: [], loadFailed: true, selectedIds: [items[0].id, 'gone'], shownIds: ['gone', items[1].id] },
    async () => items, items);
  await vm.loadData();
  assert.equal(vm.loadFailed, false);
  assert.deepEqual(vm.items.map((k) => k.id), items.map((k) => k.id));
  assert.deepEqual(vm.selectedIds, [items[0].id]);
  assert.deepEqual(vm.shownIds, [items[1].id]);
  const vnode = rerender(vm);
  assert.equal(byCy(vnode, 'keys-load-error').length, 0, 'the load alert is gone');
  assert.equal(byCy(vnode, 'key-text').length, 1, 'the still-listed key stays open');
});

check('C6 an empty list shows one body-colour row and no toolbar; no text-muted in the template', () => {
  const { vnode } = renderKeys({ items: [] });
  const tds = byTag(vnode, 'td');
  assert.equal(tds.length, 1, 'one row cell');
  assert.equal(String(attrsOf(tds[0]).colspan), '5');
  assert.equal(textOf(tds[0]), 'No deploy keys yet. Generate one with the form above.');
  assert.deepEqual(classList(tds[0]), [], 'no class on the empty cell');
  assert.ok(!page().template.includes('text-muted'), 'no text-muted in the template');
  assert.equal(toolbarsOf(vnode).length, 0, 'no toolbar');
});

check('C7 compiled theme: key-create-form and key-toolbar flex rows with 8px / 4px gaps', () => {
  expectDecls('.key-create-form', {
    display: 'flex', 'flex-wrap': 'wrap', 'align-items': 'center', gap: '8px', 'margin-bottom': '16px',
  });
  expectDecls('.key-toolbar', {
    display: 'flex', 'justify-content': 'flex-end', 'align-items': 'center', gap: '4px', 'margin-bottom': '8px',
  });
});

// ---------------------------------------------------------------- K: rename (45-04 task 1)

const ch = (c) => String.fromCharCode(c);

// The contract shared with the server: the same cases as NAME_CASES in
// spec/node/DeployKeyNames.test.js (D-05, D-06).
const NAME_CASES = [
  ['Firmware ' + String.fromCodePoint(0x1F680), null], ['Ünïcödé', null], ['مفتاح', null], ['Firmware Repository', null], ['x'.repeat(120), null],
  ['', 'empty'], ['   ', 'empty'], [{}, 'empty'], [[], 'empty'], [42, 'empty'], [null, 'empty'], [undefined, 'empty'],
  ['x'.repeat(121), 'too_long'],
  [ch(0x09), 'control_chars'], ['a' + ch(0x09) + 'b', 'control_chars'], ['a' + ch(0x7f) + 'b', 'control_chars'],
  ['a' + ch(0x85) + 'b', 'control_chars'], ['Firmware' + ch(0x0a), 'control_chars'],
  ['a' + ch(0x2028) + 'b', 'line_separator'], ['a' + ch(0x2029) + 'b', 'line_separator'], [ch(0x2028), 'line_separator'],
  ['a' + ch(0x202e) + 'b', 'bidi'], ['a' + ch(0x202a) + 'b', 'bidi'], ['a' + ch(0x2066) + 'b', 'bidi'],
  ['a' + ch(0x2069) + 'b', 'bidi'], ['a' + ch(0x200e) + 'b', 'bidi'], ['a' + ch(0x200f) + 'b', 'bidi'],
  // 45-REVIEW IN-01: ALM, zero-width / invisible characters, invisible-only names, lone surrogates.
  ['a' + ch(0x061c) + 'b', 'bidi'],
  ['a' + ch(0x200b) + 'b', 'invisible'], ['a' + ch(0x200c) + 'b', 'invisible'], ['a' + ch(0x200d) + 'b', 'invisible'],
  ['a' + ch(0x2060) + 'b', 'invisible'], [ch(0xfeff) + 'ab', 'invisible'], [ch(0x200b) + ch(0x2060), 'invisible'],
  [String.fromCodePoint(0x1f469) + ch(0x200d) + String.fromCodePoint(0x1f4bb), 'invisible'],
  [ch(0x00ad), 'empty'], [ch(0x00ad) + ' ' + ch(0x3164), 'empty'], [ch(0xfe0f), 'empty'], [ch(0x034f) + ch(0x115f), 'empty'],
  [String.fromCodePoint(0xe0001) + String.fromCodePoint(0xe0041), 'empty'], [String.fromCodePoint(0x1d173), 'empty'],
  ['a' + ch(0x00ad) + 'b', null], ['x' + ch(0xfe0f), null],
  ['ab' + ch(0xd800), 'control_chars'], [ch(0xdc00) + 'ab', 'control_chars'], ['a' + ch(0xdbff) + ch(0xdbff) + ch(0xdc00), 'control_chars'],
  [ch(0xd83d) + ch(0xde80), null],
];

// UI-SPEC Copywriting Contract, name validation row.
const SENTENCES = {
  empty: 'Enter a name for the key.',
  too_long: 'The name is longer than 120 characters.',
  control_chars: 'The name contains a control character, such as a tab or a line break.',
  line_separator: 'The name contains a hidden line or paragraph separator.',
  bidi: 'The name contains a hidden direction-override character.',
  invisible: 'The name contains an invisible character, such as a zero-width space.',
  reserved: 'This name is reserved for the key\'s default label. Choose a different name.',
};
const GENERIC_NAME = 'This name is not allowed. Choose a different name.';
const RENAME_ERROR = 'Could not rename the deploy key. Try again.';

check('K1 validateKeyName mirrors the server cases; keyNameMessage gives the UI-SPEC sentences', () => {
  const { validateKeyName, keyNameMessage, KEY_NAME_MAX } = keyNames();
  assert.equal(KEY_NAME_MAX, 120);
  for (const [name, reason] of NAME_CASES) {
    const expected = reason === null ? { ok: true } : { ok: false, reason };
    assert.deepEqual(validateKeyName(name), expected, JSON.stringify(name === undefined ? 'undefined' : name));
  }
  const BIDI = [0x061c, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069];
  const INVISIBLE = [0x200b, 0x200c, 0x200d, 0x2060, 0xfeff];
  for (let c = 0; c <= 0xffff; c++) {
    let expected = { ok: true };
    if (c < 0x20 || c === 0x7f || (c >= 0x80 && c <= 0x9f)) expected = { ok: false, reason: 'control_chars' };
    else if (c >= 0xd800 && c <= 0xdfff) expected = { ok: false, reason: 'control_chars' }; // lone surrogate
    else if (c === 0x2028 || c === 0x2029) expected = { ok: false, reason: 'line_separator' };
    else if (BIDI.includes(c)) expected = { ok: false, reason: 'bidi' };
    else if (INVISIBLE.includes(c)) expected = { ok: false, reason: 'invisible' };
    assert.deepEqual(validateKeyName('a' + ch(c) + 'b'), expected, 'code unit 0x' + c.toString(16).padStart(4, '0'));
  }
  // The first offending unit decides; the scan runs before trimming.
  assert.deepEqual(validateKeyName(ch(0x202e) + 'a' + ch(0x09)), { ok: false, reason: 'bidi' });
  assert.deepEqual(validateKeyName('  ' + 'x'.repeat(120) + '  '), { ok: true });
  Object.keys(SENTENCES).forEach((reason) => assert.equal(keyNameMessage(reason), SENTENCES[reason], reason));
  ['nope', undefined, null, '__proto__', 'toString'].forEach((reason) => assert.equal(keyNameMessage(reason), GENERIC_NAME, String(reason)));
});

function restoreGlobal(name, desc) {
  if (desc) Object.defineProperty(globalThis, name, desc); else delete globalThis[name];
}

const okResponse = (text) => ({ ok: true, status: 200, text: async () => text });

checkAsync('K2 $patch sends PATCH through fetchWithCsrf, which adds the X-XSRF-TOKEN header', async () => {
  const calls = [];
  const Api = loadApi({
    getCsrfToken: () => 'sync-token',
    fetchWithCsrf: async (...args) => { calls.push(args); return okResponse('{"success":true,"response":{"name":"n"}}'); },
  });
  const api = new Api('https://api.example');
  assert.equal(typeof api.$patch, 'function', 'Api has $patch');
  const body = JSON.stringify({ filename: 'f', name: 'n' });
  const result = await api.$patch('/rsakey', body);
  assert.equal(calls.length, 1, 'one fetchWithCsrf call');
  const [base, url, options] = calls[0];
  assert.equal(base, 'https://api.example/api/v2');
  assert.equal(url, 'https://api.example/api/v2/rsakey');
  assert.equal(options.method, 'PATCH');
  assert.equal(options.credentials, 'include');
  assert.equal(options.body, body);
  assert.deepEqual(result, { success: true, response: { name: 'n' } });

  // The real cookies.js client: the token from the XSRF-TOKEN cookie goes out as the header.
  const cookies = loadModule('utils/cookies.js', (s) => s.replace(/^export default .*$/m, ''));
  const sent = [];
  const prevFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
  const prevDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'fetch', {
    value: async (u, init) => { sent.push([u, init]); return okResponse('{"success":true,"response":{}}'); },
    configurable: true, writable: true,
  });
  Object.defineProperty(globalThis, 'document', { value: { cookie: 'other=1; XSRF-TOKEN=tok%2Fabc' }, configurable: true, writable: true });
  try {
    const RealApi = loadApi({ getCsrfToken: cookies.getCsrfToken, fetchWithCsrf: cookies.fetchWithCsrf });
    await new RealApi('https://api.example').$patch('/rsakey', body);
  } finally {
    restoreGlobal('fetch', prevFetch);
    restoreGlobal('document', prevDocument);
  }
  assert.equal(sent.length, 1, 'one request and no prime: the cookie already holds a token');
  assert.equal(sent[0][0], 'https://api.example/api/v2/rsakey');
  assert.equal(sent[0][1].method, 'PATCH');
  assert.equal(sent[0][1].credentials, 'include');
  assert.equal(sent[0][1].headers['X-XSRF-TOKEN'], 'tok/abc', 'the XSRF header carries the cookie value');
  assert.equal(sent[0][1].body, body);
});

checkAsync('K3 renameItem sends one PATCH /rsakey with {filename, name} and returns the result unchanged', async () => {
  const store = loadStore('store/rsakeys.js');
  assert.equal(typeof store.actions.renameItem, 'function', 'the store has renameItem');
  for (const answer of [{ success: false, response: 'invalid_key_name', reason: 'bidi' }, { success: true, response: { name: 'n' } }]) {
    const calls = [];
    const refuse = () => { throw new Error('only $patch may be called'); };
    const $api = { $patch: async (p, b) => { calls.push([p, b]); return answer; }, $get: refuse, $put: refuse, $post: refuse, $delete: refuse };
    let dispatched = 0;
    let committed = 0;
    const ctx = { dispatch: () => { dispatched++; }, commit: () => { committed++; } };
    const out = await store.actions.renameItem.call({ $api }, ctx, { filename: 'f', name: 'n' });
    assert.deepEqual(calls, [['/rsakey', '{"filename":"f","name":"n"}']], 'one PATCH with the JSON body');
    assert.equal(out, answer, 'the API result comes back unchanged');
    assert.equal(dispatched + committed, 0, 'no refresh inside the action');
  }
});

check('K4 Rename sits between Copy key and Delete: fa fa-pencil, Rename, default variant, disabled while deleting', () => {
  const items = keyItems();
  const { vm, vnode } = renderKeys({ items, deletingIds: [items[1].id] });
  const idle = cellsOf(rowOf(vnode, items[0]))[4];
  assert.deepEqual(iconButtonsOf(idle).map(cyOf), ROW_ACTIONS);
  const rename = actionOf(idle, 'key-rename');
  assert.equal(propsOf(rename).icon, 'fa fa-pencil');
  assert.equal(propsOf(rename).label, 'Rename');
  assert.equal(propsOf(rename).variant, undefined, 'Rename uses the default variant');
  assert.ok(!propsOf(rename).disabled, 'idle Rename is enabled');
  assert.equal(propsOf(actionOf(rowOf(vnode, items[1]), 'key-rename')).disabled, true, 'Rename is disabled while its key is deleting');
  const opened = [];
  vm.openRename = (item) => opened.push(item.id);
  rename.componentOptions.listeners.click();
  assert.deepEqual(opened, [items[0].id], 'the click opens the rename dialog for its key');
  assert.equal(page().source.split('data-cy="key-rename"').length - 1, 1, 'one key-rename hook in the template');
});

check('K5 openRename prefills the name, clears earlier feedback and shows the rename modal', () => {
  const { vm } = renderKeys();
  const shown = [];
  vm.$bvModal = { show: (id) => shown.push(id), hide: () => {} };
  Object.assign(vm, { renameServerReason: 'bidi', renameError: RENAME_ERROR });
  const item = vm.items[0];
  vm.openRename(item);
  assert.equal(vm.renameTarget, item);
  assert.equal(vm.renameName, item.name);
  assert.equal(vm.renameServerReason, null);
  assert.equal(vm.renameError, null);
  assert.equal(vm.renameFeedback, '', 'a valid prefilled name shows no sentence');
  assert.deepEqual(shown, ['rsakey-rename-modal']);
});

// A page vm with the rename dialog open on the first key; renameItem, the modal, the
// toast and loadData are replaced by recorders. hide() runs onRenameHide like BModal.
function renameHarness() {
  const { vm } = renderKeys();
  const calls = { renameItem: [], hide: [], prevented: [], toasts: [], loadData: 0 };
  const control = { renameItem: null };
  vm.$bvModal = {
    show: () => {},
    hide: (id) => {
      let prevented = false;
      vm.onRenameHide({ preventDefault: () => { prevented = true; } });
      calls.hide.push(id);
      calls.prevented.push(prevented);
    },
  };
  vm.$toasted = { show: (text, opts) => calls.toasts.push([text, opts]) };
  vm.renameItem = (args) => {
    calls.renameItem.push(args);
    control.renameItem = deferred();
    return control.renameItem.promise;
  };
  vm.loadData = async () => { calls.loadData++; };
  const item = vm.items[0];
  vm.openRename(item);
  return { vm, calls, control, item };
}

checkAsync('K6 saveRename checks the trimmed name first, skips an unchanged name and sends one request', async () => {
  const { vm, calls, control, item } = renameHarness();
  vm.renameName = 'a' + ch(0x202e) + 'b';
  await vm.saveRename();
  assert.equal(calls.renameItem.length, 0, 'a bidi name sends nothing');
  assert.equal(vm.renameFeedback, SENTENCES.bidi);
  vm.renameName = '   ';
  await vm.saveRename();
  assert.equal(calls.renameItem.length, 0, 'a whitespace-only name sends nothing');
  assert.equal(vm.renameFeedback, SENTENCES.empty);
  assert.equal(calls.hide.length, 0, 'an invalid name keeps the dialog open');
  vm.renameName = '  ' + item.name + ' ';
  await vm.saveRename();
  assert.equal(calls.renameItem.length, 0, 'an unchanged name sends nothing');
  assert.deepEqual(calls.hide, ['rsakey-rename-modal'], 'an unchanged name closes the dialog');
  vm.renameName = '  New name ';
  const run = vm.saveRename();
  assert.equal(vm.renaming, true, 'renaming while the request runs');
  assert.deepEqual(calls.renameItem, [{ filename: item.filename, name: 'New name' }], 'one request with the trimmed name');
  await vm.saveRename();
  assert.equal(calls.renameItem.length, 1, 'a second save while pending sends nothing');
  assert.equal(vm.renaming, true, 'still renaming');
  control.renameItem.resolve({ success: true });
  await run;
  assert.equal(vm.renaming, false, 'released once settled');
});

const renameInputOf = (vnode) => nodesOf(vnode).find((n) => n.tag === 'b-form-input' && attrsOf(n).id === 'rename-key-name');

checkAsync('K7 rename outcomes: success closes, toasts and reloads; server reasons and failures keep the dialog', async () => {
  const ok = renameHarness();
  ok.vm.renameName = 'New name';
  const p = ok.vm.saveRename();
  ok.control.renameItem.resolve({ success: true, response: { name: 'New name' } });
  await p;
  assert.deepEqual(ok.calls.hide, ['rsakey-rename-modal'], 'success closes the dialog');
  assert.deepEqual(ok.calls.prevented, [false], 'the close is not blocked once the request settled');
  assert.deepEqual(ok.calls.toasts, [['Deploy key renamed', { type: 'success', duration: 2000 }]]);
  assert.equal(ok.calls.loadData, 1, 'success reloads the list');
  assert.equal(ok.vm.renaming, false);

  const outcomes = [
    ['bidi reason', (c) => c.resolve({ success: false, response: 'invalid_key_name', reason: 'bidi' }), SENTENCES.bidi, 'true'],
    ['too_long reason', (c) => c.resolve({ success: false, response: 'invalid_key_name', reason: 'too_long' }), SENTENCES.too_long, 'true'],
    ['missing reason', (c) => c.resolve({ success: false, response: 'invalid_key_name' }), GENERIC_NAME, 'true'],
    ['unknown reason', (c) => c.resolve({ success: false, response: 'invalid_key_name', reason: 'nope' }), GENERIC_NAME, 'true'],
    ['empty body', (c) => c.resolve({ success: false, status: 500, response: null }), RENAME_ERROR, 'false'],
    ['thrown', (c) => c.reject(new Error('offline')), RENAME_ERROR, 'false'],
  ];
  for (const [label, settle, sentence, invalid] of outcomes) {
    const h = renameHarness();
    h.vm.renameName = 'New name';
    const run = h.vm.saveRename();
    settle(h.control.renameItem);
    await run;
    assert.equal(h.calls.hide.length, 0, label + ' keeps the dialog open');
    assert.equal(h.calls.toasts.length, 0, label + ' shows no toast');
    assert.equal(h.calls.loadData, 0, label + ' does not reload');
    assert.equal(h.vm.renaming, false, label + ' releases the dialog');
    assert.equal(h.vm.renameFeedback, sentence, label);
    const vnode = rerender(h.vm);
    assert.equal(textOf(byCy(vnode, 'rename-key-feedback')[0]), sentence, label + ' feedback line');
    const input = renameInputOf(vnode);
    assert.equal(attrsOf(input)['aria-invalid'], invalid, label + ' aria-invalid');
    assert.equal(attrsOf(input).disabled, false, label + ' re-enables the field');
    h.vm.renameName = 'Another name';
    await tick();
    assert.equal(h.vm.renameFeedback, '', label + ': editing the name clears the sentence');
  }
});

check('K8 onRenameHide blocks Esc, backdrop and header close only while renaming', () => {
  const { vm } = renderKeys();
  let prevented = 0;
  const evt = { preventDefault: () => { prevented++; } };
  vm.renaming = false;
  vm.onRenameHide(evt);
  assert.equal(prevented, 0, 'an idle dialog closes');
  vm.renaming = true;
  vm.onRenameHide(evt);
  assert.equal(prevented, 1, 'a pending rename holds the dialog open');
});

check('K9 rename modal markup: title, form, input, feedback, help and the Keep current name / Save name footer', () => {
  const items = keyItems();
  const { vm, vnode } = renderKeys({ items, renameTarget: items[0], renameName: items[0].name });
  const modals = nodesOf(vnode).filter((n) => n.tag === 'b-modal' && attrsOf(n).id === 'rsakey-rename-modal');
  assert.equal(modals.length, 1, 'one rename modal');
  const modal = modals[0];
  assert.equal(attrsOf(modal).title, 'Rename deploy key');
  const on = modal.data.on || {};
  assert.equal(typeof on.hide, 'function', '@hide is wired');
  assert.equal(typeof on.shown, 'function', '@shown is wired');
  const forms = nodesOf(modal).filter((n) => n.tag === 'b-form');
  assert.equal(forms.length, 1, 'one form in the modal');
  assert.equal(attrsOf(forms[0]).id, 'rsakey-rename-form');
  assert.equal(typeof (forms[0].data.on || {}).submit, 'function', 'the form submits');
  const labels = byTag(forms[0], 'label');
  assert.equal(labels.length, 1, 'one label');
  assert.equal(attrsOf(labels[0]).for, 'rename-key-name');
  assert.equal(textOf(labels[0]), 'Key name');
  const input = renameInputOf(forms[0]);
  assert.ok(input, 'the rename input is inside the form');
  const a = attrsOf(input);
  assert.equal(String(a.maxlength), '120');
  assert.equal(a['data-cy'], 'rename-key-input');
  assert.equal(a['aria-describedby'], 'rename-key-name-feedback rename-key-name-help');
  assert.equal(a.disabled, false);
  assert.equal(a['aria-invalid'], 'false');
  const feedback = byCy(forms[0], 'rename-key-feedback');
  assert.equal(feedback.length, 1, 'one feedback line');
  assert.equal(feedback[0].tag, 'p');
  assert.equal(attrsOf(feedback[0]).id, 'rename-key-name-feedback');
  assert.ok(classList(feedback[0]).includes('key-name-feedback'));
  assert.equal(attrsOf(feedback[0])['aria-live'], 'polite');
  assert.equal(textOf(feedback[0]), '', 'no sentence for a valid name');
  const help = nodesOf(forms[0]).filter((n) => attrsOf(n).id === 'rename-key-name-help');
  assert.equal(help.length, 1, 'one help line');
  assert.equal(help[0].tag, 'p');
  assert.ok(classList(help[0]).includes('key-name-help'));
  assert.equal(textOf(help[0]), 'Up to 120 characters. The key itself does not change.');

  const footer = (top) => {
    const m = nodesOf(top).find((n) => n.tag === 'b-modal' && attrsOf(n).id === 'rsakey-rename-modal');
    const buttons = nodesOf(m).filter((n) => n.tag === 'b-button');
    assert.deepEqual(buttons.map(cyOf), ['rename-key-cancel', 'rename-key-save'], 'footer buttons in order');
    return { cancel: buttons[0], save: buttons[1], input: renameInputOf(m), feedback: byCy(m, 'rename-key-feedback')[0] };
  };
  const idle = footer(vnode);
  assert.equal(textOf(idle.cancel), 'Keep current name');
  assert.equal(attrsOf(idle.cancel).variant, 'default');
  assert.equal(attrsOf(idle.cancel).disabled, false);
  assert.equal(textOf(idle.save), 'Save name');
  assert.equal(attrsOf(idle.save).variant, 'success');
  assert.equal(attrsOf(idle.save).type, 'submit');
  assert.equal(attrsOf(idle.save).form, 'rsakey-rename-form');
  assert.equal(attrsOf(idle.save).disabled, false);
  const hidden = [];
  vm.$bvModal = { hide: (id) => hidden.push(id) };
  idle.cancel.data.on.click();
  assert.deepEqual(hidden, ['rsakey-rename-modal'], 'Keep current name closes the dialog');

  const busy = footer(renderKeys({ items, renameTarget: items[0], renameName: 'New name', renaming: true }).vnode);
  assert.equal(textOf(busy.save), 'Saving' + ELLIPSIS);
  assert.equal(attrsOf(busy.save).disabled, true, 'Save name is disabled while saving');
  assert.equal(attrsOf(busy.cancel).disabled, true, 'Keep current name is disabled while saving');
  assert.equal(attrsOf(busy.input).disabled, true, 'the field is disabled while saving');

  const bad = footer(renderKeys({ items, renameTarget: items[0], renameName: 'a' + ch(0x202e) + 'b' }).vnode);
  assert.equal(attrsOf(bad.save).disabled, true, 'Save name is disabled while the client check fails');
  assert.equal(attrsOf(bad.input)['aria-invalid'], 'true');
  assert.equal(textOf(bad.feedback), SENTENCES.bidi);
  const cleared = footer(renderKeys({ items, renameTarget: items[0], renameName: '' }).vnode);
  assert.equal(textOf(cleared.feedback), SENTENCES.empty, 'a cleared name asks for one');
  assert.equal(attrsOf(cleared.save).disabled, true);

  const template = page().template;
  ['>Cancel<', '>Save<'].forEach((s) => assert.ok(!template.includes(s), 'no generic button text ' + s));
  assert.ok(!template.includes('v-html'), 'no raw-HTML binding');
});

// 45-REVIEW IN-02: the server refuses a key's own generated default comment thinx-<timestamp>
// (the list shows the date for it) as `reserved`; the dialog names that before sending.
checkAsync('K10 the rename dialog refuses the key\'s own default name thinx-<timestamp> before sending (IN-02)', async () => {
  const { isReservedKeyName } = keyNames();
  const f = KEYS[0].filename;
  assert.equal(isReservedKeyName('thinx-1760000000000', f), true);
  assert.equal(isReservedKeyName('  thinx-1760000000000 ', f), true);
  assert.equal(isReservedKeyName('thinx-1760000001000', f), false, 'another key\'s default is an ordinary name');
  assert.equal(isReservedKeyName('Thinx-1760000000000', f), false);
  [[undefined, f], ['thinx-1', null], [42, f]].forEach(([n, file]) => assert.equal(isReservedKeyName(n, file), false));
  const items = keyItems();
  const m = (top) => nodesOf(top).find((n) => n.tag === 'b-modal' && attrsOf(n).id === 'rsakey-rename-modal');
  const vnode = renderKeys({ items, renameTarget: items[0], renameName: 'thinx-1760000000000' }).vnode;
  assert.equal(attrsOf(byCy(m(vnode), 'rename-key-save')[0]).disabled, true, 'Save name is disabled');
  assert.equal(textOf(byCy(m(vnode), 'rename-key-feedback')[0]), SENTENCES.reserved);
  assert.equal(attrsOf(renameInputOf(m(vnode)))['aria-invalid'], 'true');
  const h = renameHarness();
  h.vm.renameName = 'thinx-1760000000000';
  await h.vm.saveRename();
  assert.equal(h.calls.renameItem.length, 0, 'nothing is sent');
  assert.equal(h.vm.renameFeedback, SENTENCES.reserved);
  // The server answer is shown the same way (a client that skipped the check).
  const s = renameHarness();
  s.vm.renameName = 'Other';
  const run = s.vm.saveRename();
  s.control.renameItem.resolve({ success: false, response: 'invalid_key_name', reason: 'reserved' });
  await run;
  assert.equal(s.vm.renameFeedback, SENTENCES.reserved);
  assert.equal(s.calls.toasts.length, 0, 'no success toast');
});

// 45-REVIEW IN-03: answers that retrying can never fix reload the list and say what happened.
const GONE_ONE = 'This deploy key no longer exists. The list has been refreshed.';
const GONE_MANY = 'These deploy keys no longer exist. The list has been refreshed.';
const CANNOT_RENAME = 'This deploy key cannot be renamed.';

checkAsync('K11 rename of a vanished key closes and reloads; a key that cannot be renamed says so and reloads (IN-03)', async () => {
  const gone = renameHarness();
  gone.vm.renameName = 'New name';
  const p = gone.vm.saveRename();
  gone.control.renameItem.resolve({ success: false, status: 404, response: 'key_not_found' });
  await p;
  assert.deepEqual(gone.calls.hide, ['rsakey-rename-modal'], 'the dialog closes');
  assert.deepEqual(gone.calls.prevented, [false]);
  assert.equal(gone.calls.loadData, 1, 'the list is reloaded');
  assert.equal(gone.vm.error, GONE_ONE);
  assert.equal(gone.calls.toasts.length, 0, 'no success toast');
  assert.ok(!/Try again/.test(gone.vm.error));

  const stuck = renameHarness();
  stuck.vm.renameName = 'New name';
  const q = stuck.vm.saveRename();
  stuck.control.renameItem.resolve({ success: false, status: 500, response: 'rename_failed' });
  await q;
  assert.equal(stuck.calls.hide.length, 0, 'the dialog stays open on the reason');
  assert.equal(stuck.vm.renameFeedback, CANNOT_RENAME);
  assert.equal(stuck.calls.loadData, 1, 'the list is reloaded');
  assert.equal(stuck.calls.toasts.length, 0);
});

checkAsync('A5 deleting keys that are already gone reloads the list and says they no longer exist (IN-03)', async () => {
  const row = harness();
  const p = row.vm.deleteRow(row.vm.items[1]);
  row.control.confirm.resolve(true);
  await tick();
  row.control.deleteItems.resolve({ success: false, response: [] });
  await p;
  assert.equal(row.vm.error, GONE_ONE);
  assert.equal(row.calls.loadData, 1, 'the list is reloaded');
  assert.deepEqual(row.vm.deletingIds, []);

  for (const [count, sentence] of [[1, GONE_ONE], [2, GONE_MANY]]) {
    const bulk = harness();
    bulk.vm.selectedIds = bulk.vm.items.slice(0, count).map((k) => k.id);
    const q = bulk.vm.deleteSelected();
    bulk.control.confirm.resolve(true);
    await tick();
    bulk.control.deleteItems.resolve({ success: false, response: [] });
    await q;
    assert.equal(bulk.vm.error, sentence, count + ' selected');
    assert.equal(bulk.calls.loadData, 1, 'the list is reloaded');
    assert.deepEqual(bulk.vm.selectedIds, [], 'the vanished keys leave the selection');
    assert.equal(bulk.vm.bulkDeleting, false);
  }
});

// ---------------------------------------------------------------- G: Generate form name feedback (45-04 task 2)

const GENERATE_ERROR = 'Could not generate the deploy key. Try again.';

// The Generate form, its input and submit button, and the feedback line right after it.
function generateParts(vnode) {
  const top = rootChildren(vnode);
  const at = top.findIndex((n) => n.tag === 'b-form' && classList(n).includes('key-create-form'));
  assert.ok(at !== -1, 'the Generate form is a top-level child');
  const form = top[at];
  const input = nodesOf(form).find((n) => n.tag === 'b-form-input' && attrsOf(n).id === 'deploy-key-name');
  const button = nodesOf(form).find((n) => n.tag === 'b-button');
  return { form, input, button, next: top[at + 1] };
}

check('G1 the Generate form names a bad name under the form and disables Generate; an empty name only disables it', () => {
  const idle = generateParts(renderKeys({ keyName: 'Firmware' }).vnode);
  assert.equal(attrsOf(idle.input)['aria-describedby'], 'deploy-key-name-feedback');
  assert.equal(attrsOf(idle.input)['aria-invalid'], 'false');
  const line = idle.next;
  assert.equal(line.tag, 'p', 'the feedback line follows the form');
  assert.equal(attrsOf(line).id, 'deploy-key-name-feedback');
  assert.ok(classList(line).includes('key-name-feedback'));
  assert.equal(attrsOf(line)['aria-live'], 'polite');
  assert.equal(cyOf(line), 'create-key-feedback');
  assert.equal(textOf(line), '', 'no sentence for a valid name');
  assert.ok(!attrsOf(idle.button).disabled, 'Generate is enabled for a valid name');
  const bad = [
    ['a' + ch(0x2028) + 'b', SENTENCES.line_separator],
    ['a' + ch(0x09) + 'b', SENTENCES.control_chars],
    ['a' + ch(0x202e) + 'b', SENTENCES.bidi],
    ['a' + ch(0x200b) + 'b', SENTENCES.invisible],
    ['x'.repeat(121), SENTENCES.too_long],
  ];
  bad.forEach(([keyName, sentence]) => {
    const p = generateParts(renderKeys({ keyName }).vnode);
    assert.equal(textOf(p.next), sentence, JSON.stringify(keyName.slice(0, 3)));
    assert.equal(attrsOf(p.input)['aria-invalid'], 'true');
    assert.equal(attrsOf(p.button).disabled, true, 'Generate is disabled for a bad name');
  });
  ['', '   '].forEach((keyName) => {
    const p = generateParts(renderKeys({ keyName }).vnode);
    assert.equal(textOf(p.next), '', 'no sentence for ' + JSON.stringify(keyName));
    assert.equal(attrsOf(p.input)['aria-invalid'], 'false');
    assert.equal(attrsOf(p.button).disabled, true, 'Generate is disabled for ' + JSON.stringify(keyName));
  });
});

// A page vm whose createItem, result modal and loadData are recorders.
function createHarness(keyName) {
  const { vm } = renderKeys({ keyName });
  const calls = { createItem: [], shown: [], loadData: 0 };
  const control = { createItem: null };
  vm.$bvModal = { show: (id) => calls.shown.push(id) };
  vm.createItem = (name) => {
    calls.createItem.push(name);
    control.createItem = deferred();
    return control.createItem.promise;
  };
  vm.loadData = async () => { calls.loadData++; };
  return { vm, calls, control };
}

checkAsync('G2 create: a bad client name sends nothing; a server reason keeps the name; other failures show the generate error', async () => {
  const refused = createHarness('a' + ch(0x09) + 'b');
  const r = refused.vm.create();
  assert.equal(refused.calls.createItem.length, 0, 'an invalid name sends nothing');
  await r;
  assert.equal(refused.vm.creating, false);

  const server = createHarness('  Firmware  ');
  const run = server.vm.create();
  assert.deepEqual(server.calls.createItem, ['Firmware'], 'the trimmed name is sent once');
  server.control.createItem.resolve({ success: false, response: 'invalid_key_name', reason: 'control_chars' });
  await run;
  assert.equal(server.vm.createFeedback, SENTENCES.control_chars);
  assert.equal(server.vm.keyName, '  Firmware  ', 'the typed name stays');
  assert.equal(server.vm.error, null, 'no action alert for a name reason');
  assert.equal(server.vm.creating, false);
  const vnode = rerender(server.vm);
  const parts = generateParts(vnode);
  assert.equal(textOf(parts.next), SENTENCES.control_chars, 'the server sentence is under the form');
  assert.equal(attrsOf(parts.input)['aria-invalid'], 'true');
  server.vm.keyName = 'Firmware 2';
  await tick();
  assert.equal(server.vm.createFeedback, '', 'typing clears the server sentence');

  const unknown = createHarness('Firmware');
  const u = unknown.vm.create();
  unknown.control.createItem.resolve({ success: false, response: 'invalid_key_name' });
  await u;
  assert.equal(unknown.vm.createFeedback, GENERIC_NAME, 'a missing reason gives the generic sentence');

  for (const outcome of ['refused', 'thrown']) {
    const h = createHarness('Firmware');
    const p = h.vm.create();
    if (outcome === 'refused') h.control.createItem.resolve({ success: false });
    else h.control.createItem.reject(new Error('offline'));
    await p;
    assert.equal(h.vm.error, GENERATE_ERROR, outcome + ' error copy');
    assert.equal(h.vm.createFeedback, '', outcome + ' shows no name sentence');
    assert.equal(h.vm.keyName, 'Firmware', outcome + ' keeps the name');
    assert.equal(h.vm.creating, false);
  }

  const ok = createHarness('Firmware');
  const o = ok.vm.create();
  ok.control.createItem.resolve({ success: true, response: { name: 'Firmware', pubkey: 'ssh-ed25519 AAAA Firmware' } });
  await o;
  assert.deepEqual(ok.calls.shown, ['rsakey-result-modal'], 'success opens the created-key modal');
  assert.equal(ok.vm.createdPubkey, 'ssh-ed25519 AAAA Firmware');
  assert.equal(ok.vm.keyName, '', 'success clears the field');
  assert.equal(ok.calls.loadData, 1);
  assert.equal(ok.vm.error, null);
  assert.ok(!page().source.includes('Failed to generate deploy key'), 'the old generate error copy is gone');
});

check('G3 compiled theme: key-name-feedback in #FF8A8A, hidden when empty; key-name-help in body colour', () => {
  const fb = expectDecls('.key-name-feedback', { margin: '4px 0 0', 'font-size': '.875rem', 'font-weight': '400' });
  assert.match(value(fb, 'color') || '', /^#ff8a8a$/i, '.key-name-feedback colour');
  expectDecls('.key-name-feedback:empty', { display: 'none' });
  expectDecls('.key-name-help', { margin: '4px 0 0', color: 'inherit', 'font-size': '.875rem' });
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

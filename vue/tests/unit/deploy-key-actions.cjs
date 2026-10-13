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

// ---------------------------------------------------------------- B: icon actions and columns (45-03 task 2)

const DASH = String.fromCharCode(0x2014);
const iconButtonsOf = (top) => componentsOf(top, 'IconButton');
const actionOf = (row, cy) => iconButtonsOf(row).filter((n) => cyOf(n) === cy)[0];
const groupOf = (vnode, item) => byCy(vnode, 'deploy-key-group').find((g) => textOf(byCy(g, 'deploy-key-row')[0]).includes(item.name));
const directText = (n) => (n.children || []).filter((c) => !c.tag).map((c) => c.text).join('');

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

check('B4 actions: Show key, Copy key, Delete in that order, Show wired to its key text', () => {
  const { vnode } = renderKeys();
  KEYS.forEach((item) => {
    const cell = cellsOf(rowOf(vnode, item))[4];
    const buttons = iconButtonsOf(cell);
    assert.deepEqual(buttons.map(cyOf), ['key-show', 'key-copy', 'key-delete']);
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

check('B6 an empty or non-string pubkey disables Show and Copy; a deleting key disables all three', () => {
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
  });
  const items = keyItems();
  const { vnode } = renderKeys({ items, deletingIds: [items[1].id] });
  const busy = rowOf(vnode, items[1]);
  ['key-show', 'key-copy', 'key-delete'].forEach((cy) => assert.equal(propsOf(actionOf(busy, cy)).disabled, true, cy + ' disabled while deleting'));
  const idle = rowOf(vnode, items[0]);
  ['key-show', 'key-copy', 'key-delete'].forEach((cy) => assert.ok(!propsOf(actionOf(idle, cy)).disabled, cy + ' enabled on the other row'));
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

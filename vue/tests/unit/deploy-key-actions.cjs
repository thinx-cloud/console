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

// ---------------------------------------------------------------- C: bulk toolbar, form, load error (45-03 task 3)

const rootChildren = (vnode) => (vnode.children || []).filter((n) => n.tag);
const toolbarsOf = (vnode) => byClass(vnode, 'key-toolbar');
const bulkOf = (vnode) => byCy(vnode, 'key-bulk-delete');
const formsOf = (vnode) => nodesOf(vnode).filter((n) => n.tag === 'b-form');
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
  const forms = formsOf(vnode);
  assert.equal(forms.length, 1, 'one b-form on the page');
  const form = forms[0];
  assert.ok(classList(form).includes('key-create-form'), 'form class: ' + classList(form).join(' '));
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
    ['key-show', 'key-copy', 'key-delete'].forEach((cy) => assert.equal(propsOf(actionOf(row, cy)).disabled, true, item.name + ' ' + cy));
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
  assert.equal(formsOf(vnode).length, 1, 'the Generate form stays');
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

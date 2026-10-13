// Unit test for the Phase 46 Settings pages (v1.18 Phase 46: TRANS-03, TRANS-04, ENV-01,
// POL-03, FIX-03; UI-SPEC UI-T01..UI-T26).
//
// Plain-node checks for src/pages/Transformers/Transformers.vue: the Phase 44 IconButton
// row actions (white wrench Edit, trash Delete), the typed `confirm` delete dialog shared
// by the row trash and the bulk trash, the device-usage warning, the load states and the
// Name naming; for the transformers store (deleteItems with one write, the Phase 35 IN-02
// refreshed flag) and for the Phase 46 rules compiled from src/styles/theme.scss.
// 46-03 and 46-04 extend this file for Environment Globals and Device Detail.
//
// SFC templates are compiled with vue-template-compiler (whitespace: 'condense', as
// vue-cli does) and rendered with vue.runtime.common; bootstrap-vue elements (b-*) stay
// plain vnodes. Child components are expanded one level at a time. The harness is copied
// from deploy-key-actions.cjs (not required from it).
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

// ---------------------------------------------------------------- fixtures

const ELLIPSIS = String.fromCharCode(0x2026);
const TRANSFORMERS = [
  { utid: 'utid-battery', alias: 'Battery Parser', body: 'YmF0dGVyeQ==' },
  { utid: 'utid-temp', alias: 'Temperature', body: 'dGVtcA==' },
];

const items = () => TRANSFORMERS.map((t) => Object.assign({ id: t.utid }, t));

// ---------------------------------------------------------------- components

const usage = lazy(() => loadModule('utils/transformerUsage.js'));

// The page's transformerUsage imports, or none while the module is missing (B5 reports that).
function usageDeps() {
  try {
    const u = usage();
    return { countDevicesUsing: u.countDevicesUsing, usageSentence: u.usageSentence };
  } catch (e) { return {}; }
}

const iconButton = lazy(() => loadSfc('components/IconButton/IconButton.vue'));
const page = lazy(() => loadSfc('pages/Transformers/Transformers.vue', Object.assign({ IconButton: iconButton().def }, usageDeps())));
const transformersStore = lazy(() => loadStore('store/transformers.js'));
const devicesStore = lazy(() => loadStore('store/devices.js'));

function renderTransformers(state = {}) {
  const r = renderPage(page().def, Object.assign({ items: items() }, state));
  assert.equal(r.error, null, 'Transformers renders without error');
  assert.deepEqual(r.warnings, [], 'Transformers renders without Vue warnings');
  return r;
}

// A page vm with the store actions, the dialogs and the router replaced by recorders.
function harness(state = {}) {
  const { vm } = renderTransformers(state);
  const calls = { show: [], hide: [], hideWhileDeleting: [], deleteItems: [], loadData: 0, push: [], getItems: 0 };
  const control = { deleteItems: null, storeItems: [] };
  vm.$bvModal = {
    show: (id) => { calls.show.push(id); },
    hide: (id) => { calls.hide.push(id); calls.hideWhileDeleting.push(vm.deleting); },
    msgBoxConfirm: () => { throw new Error('the transformer delete is the typed dialog, never a confirm box'); },
  };
  vm.$router = { push: (to) => { calls.push.push(to); } };
  vm.deleteItems = (utids) => {
    calls.deleteItems.push(utids);
    control.deleteItems = deferred();
    return control.deleteItems.promise;
  };
  vm.getItems = () => { calls.getItems++; return control.storeItems; };
  vm.loadData = async () => { calls.loadData++; };
  return { vm, calls, control };
}

const rowsOf = (vnode) => byCy(vnode, 'transformer-row');
const rowOf = (vnode, item) => rowsOf(vnode).find((row) => textOf(row).includes(item.alias));
const buttonsOf = (top, cy) => componentsOf(top, 'IconButton').filter((n) => cyOf(n) === cy);
const deleteModalOf = (vnode) => nodesOf(vnode).filter((n) => n.tag === 'b-modal' && attrsOf(n).id === 'transformer-delete-modal');
const one = (list, what) => { assert.equal(list.length, 1, 'exactly one ' + what + ' (found ' + list.length + ')'); return list[0]; };
const submitOf = (vnode) => one(byCy(vnode, 'transformer-delete-submit'), 'transformer-delete-submit');
const keepOf = (vnode) => one(byCy(vnode, 'transformer-delete-keep'), 'transformer-delete-keep');
const inputOf = (vnode) => one(byCy(vnode, 'transformer-delete-input'), 'transformer-delete-input');
const errorLineOf = (vnode) => one(byCy(vnode, 'transformer-delete-error'), 'transformer-delete-error');

// Open the row delete for `item` on a harness vm through its trash button.
function openRowDelete(h, item) {
  const row = rowOf(rerender(h.vm), item);
  assert.ok(row, 'row for ' + item.alias);
  click(one(buttonsOf(row, 'transformer-delete'), 'row trash'));
}

// ---------------------------------------------------------------- A: row delete (46-02 task 1)

check('A1 each row ends in an actions-cell with the IconButtons Edit (white wrench) and Delete (trash)', () => {
  const { vnode } = renderTransformers();
  const rows = rowsOf(vnode);
  assert.equal(rows.length, TRANSFORMERS.length, 'one transformer-row per transformer');
  rows.forEach((row, i) => {
    assert.equal(row.tag, 'tr');
    assert.ok(textOf(row).includes(TRANSFORMERS[i].alias), 'row ' + i + ' shows its name');
    const cells = cellsOf(row);
    const last = cells[cells.length - 1];
    assert.ok(classList(last).includes('actions-cell'), 'last cell is .actions-cell');
    const edit = one(buttonsOf(last, 'transformer-edit'), 'transformer-edit IconButton');
    assert.deepEqual(
      { icon: propsOf(edit).icon, label: propsOf(edit).label, variant: propsOf(edit).variant || 'default' },
      { icon: 'fa fa-wrench icon-white', label: 'Edit', variant: 'default' });
    assert.ok(!propsOf(edit).disabled, 'idle Edit is enabled');
    const del = one(buttonsOf(last, 'transformer-delete'), 'transformer-delete IconButton');
    assert.deepEqual(
      { icon: propsOf(del).icon, label: propsOf(del).label, variant: propsOf(del).variant },
      { icon: 'fa fa-trash', label: 'Delete', variant: 'danger' });
    assert.ok(!propsOf(del).disabled, 'idle Delete is enabled');
  });
  const h = harness();
  click(one(buttonsOf(rowOf(rerender(h.vm), TRANSFORMERS[1]), 'transformer-edit'), 'row Edit'));
  assert.deepEqual(h.calls.push, [{ name: 'TransformerEditor', params: { utid: TRANSFORMERS[1].utid } }]);
  assert.deepEqual(h.calls.show, [], 'Edit opens no dialog');
});

check('A2 the row trash opens the typed dialog once with that transformer; field and error start empty', () => {
  const h = harness({ confirmText: 'confirm', deleteError: 'old error' });
  const item = TRANSFORMERS[0];
  openRowDelete(h, item);
  assert.deepEqual(h.calls.show, ['transformer-delete-modal'], 'the typed dialog opens once');
  assert.deepEqual(JSON.parse(JSON.stringify(h.vm.deleteTargets)), [{ utid: item.utid, name: item.alias }]);
  assert.equal(h.vm.confirmText, '', 'the field is cleared on open');
  assert.ok(!h.vm.deleteError, 'the error is cleared on open');
  const vnode = rerender(h.vm);
  const modal = one(deleteModalOf(vnode), 'transformer-delete-modal');
  assert.equal(attrsOf(modal).title, 'Confirm Delete');
  assert.equal(attrsOf(modal)['body-class'], 'text-break');
  assert.equal(textOf(one(byCy(modal, 'transformer-delete-question'), 'question')),
    'Delete the transformer "' + item.alias + '"? This cannot be undone.');
  const label = one(byClass(modal, 'dialog-label'), 'dialog-label');
  assert.equal(label.tag, 'label');
  assert.equal(attrsOf(label).for, 'transformer-delete-confirm');
  assert.equal(textOf(label), 'Type confirm to delete it.');
  assert.equal(textOf(one(byClass(label, 'typed-confirm__word'), 'typed-confirm__word')), 'confirm');
  assert.equal(textOf(errorLineOf(vnode)), '', 'the error line is empty');
  assert.equal(textOf(keepOf(vnode)), 'Keep transformer');
  assert.equal(textOf(submitOf(vnode)), 'Delete transformer');
  const input = inputOf(vnode);
  assert.equal(input.tag, 'b-form-input');
  const a = attrsOf(input);
  assert.deepEqual(
    { id: a.id, autocomplete: a.autocomplete, autocapitalize: a.autocapitalize, spellcheck: a.spellcheck, describedby: a['aria-describedby'] },
    { id: 'transformer-delete-confirm', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', describedby: 'transformer-delete-error' });
  const err = errorLineOf(vnode);
  assert.equal(err.tag, 'p');
  assert.equal(attrsOf(err).id, 'transformer-delete-error');
  assert.equal(attrsOf(err)['aria-live'], 'polite');
  assert.ok(classList(err).includes('dialog-feedback'), 'error line is .dialog-feedback');
});

check('A3 Delete stays disabled until the trimmed field is exactly confirm; a submit before that sends nothing', () => {
  const h = harness();
  openRowDelete(h, TRANSFORMERS[0]);
  for (const typed of ['', 'Confirm', 'confirm.', 'con firm', 'CONFIRM']) {
    h.vm.confirmText = typed;
    assert.equal(h.vm.confirmMatches, false, JSON.stringify(typed) + ' does not match');
    const submit = submitOf(rerender(h.vm));
    assert.equal(attrsOf(submit).disabled, true, 'Delete disabled for ' + JSON.stringify(typed));
    h.vm.submitDelete();
  }
  assert.deepEqual(h.calls.deleteItems, [], 'no delete request before the word matches');
  for (const typed of ['confirm', '  confirm  ']) {
    h.vm.confirmText = typed;
    assert.equal(h.vm.confirmMatches, true, JSON.stringify(typed) + ' matches');
    assert.ok(!attrsOf(submitOf(rerender(h.vm))).disabled, 'Delete enabled for ' + JSON.stringify(typed));
  }
  const submit = submitOf(rerender(h.vm));
  assert.equal(attrsOf(submit).type, 'submit');
  assert.equal(attrsOf(submit).form, 'transformer-delete-form');
  assert.equal(attrsOf(submit).variant, 'danger');
  const form = one(nodesOf(rerender(h.vm)).filter((n) => n.tag === 'b-form' && attrsOf(n).id === 'transformer-delete-form'), 'transformer-delete-form');
  assert.ok(classList(form).includes('dialog-stack'), 'the form is .dialog-stack');
  assert.ok(form.data.on && form.data.on.submit, 'the form handles submit');
});

checkAsync('A4 one typed submit sends one deleteItems; while it runs the dialog and the row are locked', async () => {
  const h = harness();
  const item = TRANSFORMERS[0];
  openRowDelete(h, item);
  h.vm.confirmText = 'confirm';
  h.vm.submitDelete();
  h.vm.submitDelete();
  await tick();
  assert.deepEqual(h.calls.deleteItems, [[item.utid]], 'one request with exactly the target utid');
  assert.equal(h.vm.deleting, true, 'deleting while pending');
  const vnode = rerender(h.vm);
  assert.equal(attrsOf(inputOf(vnode)).disabled, true, 'input disabled');
  assert.equal(attrsOf(keepOf(vnode)).disabled, true, 'Keep disabled');
  const submit = submitOf(vnode);
  assert.equal(attrsOf(submit).disabled, true, 'Delete disabled');
  assert.equal(textOf(submit), 'Deleting' + ELLIPSIS);
  const row = rowOf(vnode, item);
  const del = one(buttonsOf(row, 'transformer-delete'), 'row trash');
  assert.equal(propsOf(del).icon, 'fa fa-spin fa-circle-o-notch');
  assert.equal(propsOf(del).label, 'Deleting' + ELLIPSIS);
  assert.equal(propsOf(del).disabled, true, 'row trash disabled');
  assert.equal(propsOf(one(buttonsOf(row, 'transformer-edit'), 'row Edit')).disabled, true, 'row Edit disabled');
  const other = rowOf(vnode, TRANSFORMERS[1]);
  assert.ok(!propsOf(one(buttonsOf(other, 'transformer-delete'), 'other trash')).disabled, 'other rows stay usable');
  let prevented = 0;
  h.vm.onDeleteHide({ preventDefault: () => { prevented++; } });
  assert.equal(prevented, 1, 'hide is prevented while deleting');
  const modal = one(deleteModalOf(vnode), 'transformer-delete-modal');
  assert.ok(modal.data.on && modal.data.on.hide, 'the dialog binds @hide');
  h.control.deleteItems.resolve({ success: true });
  await tick();
});

checkAsync('A5 a failed delete keeps the dialog open with the typed word and the error line', async () => {
  for (const outcome of ['answer', 'throw']) {
    const h = harness();
    openRowDelete(h, TRANSFORMERS[1]);
    h.vm.confirmText = 'confirm';
    h.vm.submitDelete();
    await tick();
    if (outcome === 'answer') h.control.deleteItems.resolve({ success: false });
    else h.control.deleteItems.reject(new Error('offline'));
    await tick();
    assert.deepEqual(h.calls.hide, [], outcome + ': the dialog stays open');
    assert.equal(h.vm.deleting, false, outcome + ': deleting cleared');
    assert.equal(h.vm.confirmText, 'confirm', outcome + ': the typed word is kept');
    assert.deepEqual(h.vm.deletingUtids, [], outcome + ': the row is released');
    const vnode = rerender(h.vm);
    assert.equal(textOf(errorLineOf(vnode)), 'Could not delete the transformer. Try again.');
    assert.ok(!attrsOf(submitOf(vnode)).disabled, outcome + ': Delete enabled again for a retry');
    let prevented = 0;
    h.vm.onDeleteHide({ preventDefault: () => { prevented++; } });
    assert.equal(prevented, 0, outcome + ': the dialog can be closed again');
    assert.equal(h.calls.loadData, 0, outcome + ': no reload on failure');
  }
});

checkAsync('A6 success closes the dialog once, drops the selection and takes the store list without a fetch', async () => {
  const item = TRANSFORMERS[0];
  const h = harness({ selectedUtids: [item.utid, TRANSFORMERS[1].utid] });
  h.control.storeItems = [Object.assign({ id: TRANSFORMERS[1].utid }, TRANSFORMERS[1])];
  openRowDelete(h, item);
  h.vm.confirmText = 'confirm';
  h.vm.submitDelete();
  await tick();
  h.control.deleteItems.resolve({ success: true });
  await tick();
  assert.deepEqual(h.calls.hide, ['transformer-delete-modal'], 'hidden once');
  assert.deepEqual(h.calls.hideWhileDeleting, [false], 'deleting is cleared before the hide');
  assert.deepEqual(h.vm.selectedUtids, [TRANSFORMERS[1].utid], 'the deleted utid leaves the selection');
  assert.deepEqual(h.vm.items.map((t) => t.utid), [TRANSFORMERS[1].utid], 'items come from the store getter');
  assert.equal(h.calls.loadData, 0, 'no page fetch after a refreshed write');
  assert.deepEqual(h.vm.deletingUtids, [], 'the row is released');
  // Phase 35 IN-02: the write succeeded but the store could not re-read; the page reloads.
  const r = harness();
  openRowDelete(r, item);
  r.vm.confirmText = 'confirm';
  r.vm.submitDelete();
  await tick();
  r.control.deleteItems.resolve({ success: true, refreshed: false });
  await tick();
  assert.deepEqual(r.calls.hide, ['transformer-delete-modal'], 'refreshed:false still closes');
  assert.equal(r.calls.loadData, 1, 'refreshed:false runs loadData once');
  assert.equal(r.calls.getItems, 0, 'refreshed:false does not read the stale getter');
});

// ---------------------------------------------------------------- S: store (46-02 task 1)

// A store context whose dispatch runs the real actions against a fake API.
function storeRun(gets) {
  const store = transformersStore();
  const state = { items: [] };
  const calls = { get: 0, post: [] };
  const api = {
    $get: async (url) => {
      assert.equal(url, '/profile');
      const next = gets[Math.min(calls.get, gets.length - 1)];
      calls.get++;
      if (next instanceof Error) throw next;
      return typeof next === 'function' ? next() : next;
    },
    $post: async (url, body) => {
      calls.post.push({ url, body: JSON.parse(body) });
      return calls.postResult || { success: true };
    },
  };
  const self = { $api: api };
  const ctx = { state };
  ctx.commit = (name, payload) => store.mutations[name](state, payload);
  ctx.dispatch = (name, payload) => store.actions[name].call(self, ctx, payload);
  return { store, state, ctx, calls };
}

const profileWith = (list) => ({ success: true, response: { info: { transformers: list.map((t) => Object.assign({}, t)) } } });
const ABC = [
  { utid: 'a', alias: 'A', body: 'YQ==' },
  { utid: 'b', alias: 'B', body: 'Yg==' },
  { utid: 'c', alias: 'C', body: 'Yw==' },
];

checkAsync('S1 deleteItems re-reads, removes exactly the targets in one write, and skips the write when none exists', async () => {
  assert.equal(typeof transformersStore().actions.deleteItems, 'function', 'the store has deleteItems');
  assert.equal(transformersStore().actions.deleteItem, undefined, 'the single-utid deleteItem is gone');
  const run = storeRun([profileWith(ABC), profileWith([ABC[1]])]);
  const result = await run.ctx.dispatch('deleteItems', ['a', 'c']);
  assert.equal(result.success, true);
  assert.equal(run.calls.post.length, 1, 'one write');
  assert.deepEqual(run.calls.post[0], { url: '/profile', body: { info: { transformers: [{ utid: 'b', alias: 'B', body: 'Yg==' }] } } });
  const none = storeRun([profileWith(ABC)]);
  const skipped = await none.ctx.dispatch('deleteItems', ['zz']);
  assert.deepEqual(skipped, { success: true }, 'nothing to delete answers success');
  assert.equal(none.calls.post.length, 0, 'no write when no target exists');
  assert.equal(none.calls.get, 1, 'one re-read before deciding');
});

checkAsync('S2 a stored write whose re-read fails resolves with refreshed:false; the name message says Name', async () => {
  const run = storeRun([{ success: false }]);
  run.calls.postResult = { success: true, response: 'saved' };
  const result = await run.ctx.dispatch('saveTransformers', [ABC[0]]);
  assert.deepEqual(result, { success: true, response: 'saved', refreshed: false });
  assert.equal(run.calls.get, 1, 'one re-read after the write');
  const thrown = storeRun([new Error('offline')]);
  assert.equal((await thrown.ctx.dispatch('saveTransformers', [ABC[0]])).refreshed, false, 'a thrown re-read also gives refreshed:false');
  const failed = storeRun([profileWith(ABC)]);
  failed.calls.postResult = { success: false };
  const answer = await failed.ctx.dispatch('saveTransformers', [ABC[0]]);
  assert.equal(answer.success, false);
  assert.equal(failed.calls.get, 0, 'a failed write makes no re-read');
  const ok = storeRun([profileWith(ABC)]);
  const fine = await ok.ctx.dispatch('saveTransformers', ABC);
  assert.equal(fine.refreshed, undefined, 'a refreshed write carries no flag');
  for (const alias of ['', '   ']) {
    const blank = await ok.ctx.dispatch('updateItem', { utid: 'a', alias, body: 'x' });
    assert.deepEqual(blank, { success: false, message: 'Transformer name is required.' });
  }
});

// ---------------------------------------------------------------- B: bulk, usage, load states (46-02 task 2)

const THIRD = { utid: 'utid-humidity', alias: 'Humidity', body: 'aHVt' };
const threeItems = () => TRANSFORMERS.concat([THIRD]).map((t) => Object.assign({ id: t.utid }, t));
const rootChildren = (vnode) => (vnode.children || []).filter((n) => n.tag);
const toolbarsOf = (vnode) => byClass(vnode, 'bulk-toolbar');
const bulkOf = (vnode) => one(byCy(vnode, 'transformer-bulk-delete'), 'transformer-bulk-delete');
const tablesOf = (vnode) => byTag(vnode, 'table');
const loadAlertsOf = (vnode) => byCy(vnode, 'transformers-load-error');

// A page vm whose own loadData runs against controllable store calls.
function liveHarness(state = {}, opts = {}) {
  const h = harness(state);
  h.vm.loadData = page().def.methods.loadData.bind(h.vm);
  h.calls.fetchItems = 0;
  h.calls.loadDevices = 0;
  h.control.fetchItems = opts.fetchItems || (async () => {});
  h.control.loadDevices = opts.loadDevices || (async () => {});
  h.control.devices = opts.devices || [];
  h.vm.fetchItems = () => { h.calls.fetchItems++; return h.control.fetchItems(); };
  h.vm.loadDevices = () => { h.calls.loadDevices++; return h.control.loadDevices(); };
  h.vm.getDevices = () => h.control.devices;
  return h;
}

check('B1 the table is captioned, its first header is a screen-reader Select, and names render in span.transformer-name', () => {
  const blank = { utid: 'utid-blank', alias: '   ', body: 'eA==' };
  const { vnode } = renderTransformers({ items: items().concat([Object.assign({ id: blank.utid }, blank)]) });
  const table = one(tablesOf(vnode), 'table');
  assert.deepEqual(classList(table).filter((c) => /^table|transformers-table$/.test(c)).sort(), ['table', 'table-striped', 'transformers-table']);
  const wrap = rootChildren(vnode).find((n) => classList(n).includes('table-responsive'));
  assert.ok(wrap && nodesOf(wrap).includes(table), 'the table sits in .table-responsive');
  const caption = one(byTag(table, 'caption'), 'caption');
  assert.ok(classList(caption).includes('sr-only'), 'caption is sr-only');
  assert.equal(textOf(caption), 'Transformers');
  const heads = byTag(table, 'th');
  assert.equal(heads.length, 3, 'three header cells');
  const sr = (heads[0].children || []).filter((n) => n.tag || (n.text && n.text.trim()));
  assert.equal(sr.length, 1, 'the first header holds one element');
  assert.equal(sr[0].tag, 'span');
  assert.ok(classList(sr[0]).includes('sr-only'), 'its span is sr-only');
  assert.equal(textOf(sr[0]), 'Select');
  assert.deepEqual(heads.slice(1).map((th) => textOf(th)), ['Name', 'Actions']);
  const names = byCy(table, 'transformer-name');
  assert.equal(names.length, 3, 'one name per row');
  names.forEach((n) => {
    assert.equal(n.tag, 'span');
    assert.ok(classList(n).includes('transformer-name'), 'span.transformer-name');
    assert.equal(attrsOf(n).dir, 'auto');
    assert.equal(attrsOf(n).title, textOf(n), 'title is the full name');
  });
  assert.equal(textOf(names[0]), TRANSFORMERS[0].alias);
  assert.equal(textOf(names[2]), blank.utid, 'a blank alias shows the utid');
});

check('B2 each row has a transformer-select checkbox bound to selectedUtids, disabled while that row is deleted', () => {
  const list = items();
  const { vnode } = renderTransformers({ items: list, deletingUtids: [list[1].utid] });
  const boxes = byCy(vnode, 'transformer-select');
  assert.equal(boxes.length, list.length, 'one checkbox per row');
  boxes.forEach((box, i) => {
    assert.equal(box.tag, 'b-form-checkbox');
    assert.equal(box.data.model && box.data.model.expression, 'selectedUtids', 'v-model selectedUtids');
    assert.equal(attrsOf(box).value, list[i].utid, 'value is the utid');
    assert.equal(attrsOf(box)['aria-label'], 'Select ' + list[i].alias);
  });
  assert.ok(!attrsOf(boxes[0]).disabled, 'an idle row is selectable');
  assert.equal(attrsOf(boxes[1]).disabled, true, 'a row being deleted is not');
  const first = cellsOf(rowsOf(vnode)[0])[0];
  assert.ok(nodesOf(first).includes(boxes[0]), 'the checkbox is in the first cell');
});

check('B3 the bulk toolbar sits between the intro and the table; its label follows the selection', () => {
  const list = items();
  const { vnode } = renderTransformers({ items: list });
  const top = rootChildren(vnode);
  const intro = top.findIndex((n) => n.tag === 'p' && /Status transformers are JavaScript/.test(textOf(n)));
  const bar = top.findIndex((n) => classList(n).includes('bulk-toolbar'));
  const table = top.findIndex((n) => classList(n).includes('table-responsive'));
  assert.ok(intro !== -1 && bar !== -1 && table !== -1, 'intro ' + intro + ', toolbar ' + bar + ', table ' + table);
  assert.ok(intro < bar && bar < table, 'order intro < toolbar < table');
  const toolbar = top[bar];
  assert.equal(toolbar.tag, 'div');
  assert.equal(attrsOf(toolbar).role, 'toolbar');
  assert.equal(attrsOf(toolbar)['aria-label'], 'Selected transformers');
  const btn = bulkOf(toolbar);
  assert.equal(btn.tag, 'b-button');
  assert.equal(attrsOf(btn).variant, 'danger');
  assert.equal(attrsOf(btn).size, 'sm');
  const icon = one(byTag(btn, 'i'), 'glyph');
  assert.deepEqual(classList(icon).sort(), ['fa', 'fa-trash']);
  assert.equal(attrsOf(icon)['aria-hidden'], 'true');
  const label = one(byClass(btn, 'button-text'), 'span.button-text');
  assert.equal(label.tag, 'span');
  assert.equal(textOf(label), 'Delete selected');
  assert.equal(attrsOf(btn).disabled, true, 'disabled with nothing selected');
  const two = bulkOf(renderTransformers({ items: list, selectedUtids: [list[0].utid, list[1].utid] }).vnode);
  assert.equal(textOf(two), 'Delete selected (2)');
  assert.ok(!attrsOf(two).disabled, 'enabled with a selection');
  const busy = bulkOf(renderTransformers({ items: list, selectedUtids: [list[0].utid], bulkDeleting: true }).vnode);
  assert.equal(textOf(busy), 'Deleting' + ELLIPSIS);
  assert.equal(attrsOf(busy).disabled, true, 'disabled while a bulk delete runs');
});

checkAsync('B4 the bulk trash opens the same dialog for the selected transformers that still exist, in table order', async () => {
  const list = threeItems();
  const h = harness({ items: list, selectedUtids: [THIRD.utid, 'utid-gone', TRANSFORMERS[0].utid] });
  click(bulkOf(rerender(h.vm)));
  assert.deepEqual(h.calls.show, ['transformer-delete-modal'], 'the typed dialog opens once');
  assert.deepEqual(JSON.parse(JSON.stringify(h.vm.deleteTargets)),
    [{ utid: TRANSFORMERS[0].utid, name: TRANSFORMERS[0].alias }, { utid: THIRD.utid, name: THIRD.alias }]);
  let vnode = rerender(h.vm);
  const modal = one(deleteModalOf(vnode), 'transformer-delete-modal');
  assert.equal(textOf(one(byCy(modal, 'transformer-delete-question'), 'question')), 'Delete these 2 transformers? This cannot be undone.');
  const list2 = one(byCy(modal, 'transformer-delete-names'), 'names list');
  assert.equal(list2.tag, 'ul');
  assert.ok(classList(list2).includes('typed-confirm__names'), 'ul.typed-confirm__names');
  const lis = byTag(list2, 'li');
  assert.deepEqual(lis.map((li) => textOf(li)), [TRANSFORMERS[0].alias, THIRD.alias]);
  lis.forEach((li) => assert.equal(attrsOf(li).dir, 'auto', 'li dir=auto'));
  assert.equal(textOf(one(byClass(modal, 'dialog-label'), 'label')), 'Type confirm to delete them.');
  assert.equal(textOf(keepOf(vnode)), 'Keep transformers');
  assert.equal(textOf(submitOf(vnode)), 'Delete transformers');
  // A row-level edit to the selection while the dialog is open: success drops exactly the targets.
  h.vm.selectedUtids = [TRANSFORMERS[0].utid, THIRD.utid, TRANSFORMERS[1].utid];
  h.vm.confirmText = 'confirm';
  h.vm.submitDelete();
  await tick();
  assert.deepEqual(h.calls.deleteItems, [[TRANSFORMERS[0].utid, THIRD.utid]], 'one request with both targets');
  vnode = rerender(h.vm);
  assert.equal(textOf(bulkOf(vnode)), 'Deleting' + ELLIPSIS, 'the bulk button shows the run');
  assert.equal(attrsOf(bulkOf(vnode)).disabled, true);
  h.control.storeItems = [list[1]];
  h.control.deleteItems.resolve({ success: true });
  await tick();
  assert.deepEqual(h.vm.selectedUtids, [TRANSFORMERS[1].utid], 'exactly the deleted utids leave the selection');
  assert.equal(h.vm.bulkDeleting, false, 'the bulk run is over');
  // Failure keeps the selection and shows the plural copy.
  const f = harness({ items: threeItems(), selectedUtids: [TRANSFORMERS[1].utid, THIRD.utid] });
  click(bulkOf(rerender(f.vm)));
  f.vm.confirmText = 'confirm';
  f.vm.submitDelete();
  await tick();
  f.control.deleteItems.resolve({ success: false });
  await tick();
  assert.deepEqual(f.vm.selectedUtids, [TRANSFORMERS[1].utid, THIRD.utid], 'failure keeps the selection');
  assert.equal(textOf(errorLineOf(rerender(f.vm))), 'Could not delete the transformers. Try again.');
  assert.equal(f.vm.bulkDeleting, false);
  // One selected target: the singular dialog with no names list.
  const s = harness({ items: threeItems(), selectedUtids: [THIRD.utid] });
  click(bulkOf(rerender(s.vm)));
  const single = rerender(s.vm);
  assert.equal(byCy(single, 'transformer-delete-names').length, 0, 'one target shows no names list');
  assert.equal(textOf(one(byCy(single, 'transformer-delete-question'), 'question')), 'Delete the transformer "' + THIRD.alias + '"? This cannot be undone.');
  assert.equal(textOf(submitOf(single)), 'Delete transformer');
  // The row trash never shows the names list either.
  const r = harness();
  openRowDelete(r, TRANSFORMERS[0]);
  assert.equal(byCy(rerender(r.vm), 'transformer-delete-names').length, 0, 'the row dialog shows no names list');
});

check('B5 countDevicesUsing counts distinct devices; usageSentence gives the eight contract sentences', () => {
  const { countDevicesUsing, usageSentence } = usage();
  const devices = [
    { udid: 'd1', transformers: ['t1', 't2'] },
    { udid: 'd2', transformers: ['t2', 'other'] },
    { udid: 'd3', transformers: ['other'] },
    { udid: 'd4' },
    { udid: 'd5', transformers: 't1' },
    { udid: 'd6', transformers: null },
  ];
  assert.equal(countDevicesUsing(devices, ['t1', 't2']), 2, 'a device using two targets counts once');
  assert.equal(countDevicesUsing(devices, ['t1']), 1);
  assert.equal(countDevicesUsing(devices, ['nope']), 0, 'non-targets do not count');
  assert.equal(countDevicesUsing([], ['t1']), 0);
  assert.equal(countDevicesUsing(devices, []), 0);
  const want = {
    'false:0': 'No device uses it.',
    'true:0': 'No device uses them.',
    'false:1': '1 device will stop applying it.',
    'true:1': '1 device will stop applying them.',
    'false:3': '3 devices will stop applying it.',
    'true:3': '3 devices will stop applying them.',
    'false:null': 'Devices using this transformer will stop applying it.',
    'true:null': 'Devices using these transformers will stop applying them.',
  };
  [0, 1, 3, null].forEach((count) => [false, true].forEach((many) => {
    assert.equal(usageSentence(count, many), want[many + ':' + count], 'usageSentence(' + count + ', ' + many + ')');
  }));
});

checkAsync('B6 the dialog warns how many devices stop applying the targets, or says so generically', async () => {
  const devices = [
    { udid: 'd1', transformers: [TRANSFORMERS[0].utid, THIRD.utid] },
    { udid: 'd2', transformers: [THIRD.utid] },
    { udid: 'd3', transformers: [TRANSFORMERS[1].utid] },
  ];
  const h = liveHarness({ items: [], loading: true, selectedUtids: [TRANSFORMERS[0].utid, THIRD.utid] }, { devices });
  h.control.storeItems = threeItems();
  await h.vm.loadData();
  assert.equal(h.calls.fetchItems, 1, 'one transformer fetch');
  assert.equal(h.calls.loadDevices, 1, 'one device load next to it');
  assert.equal(h.vm.devicesLoaded, true);
  click(bulkOf(rerender(h.vm)));
  const usageLine = one(byCy(rerender(h.vm), 'transformer-delete-usage'), 'usage line');
  assert.equal(usageLine.tag, 'p');
  assert.ok(classList(usageLine).includes('typed-confirm__usage'), 'p.typed-confirm__usage');
  const glyph = one(byTag(usageLine, 'i'), 'warning glyph');
  assert.deepEqual(classList(glyph).sort(), ['fa', 'fa-warning']);
  assert.equal(attrsOf(glyph)['aria-hidden'], 'true');
  assert.equal(textOf(usageLine), '2 devices will stop applying them.');
  openRowDelete(h, TRANSFORMERS[1]);
  assert.equal(textOf(one(byCy(rerender(h.vm), 'transformer-delete-usage'), 'usage line')), '1 device will stop applying it.');
  const u = liveHarness({ items: [], loading: true, error: null, selectedUtids: [TRANSFORMERS[0].utid, THIRD.utid] },
    { loadDevices: async () => { throw new Error('offline'); } });
  u.control.storeItems = threeItems();
  await u.vm.loadData();
  assert.equal(u.vm.devicesLoaded, false);
  assert.equal(u.vm.error, null, 'a failed device load shows no page message');
  assert.equal(u.vm.loadFailed, false, 'the transformer list is not blocked');
  click(bulkOf(rerender(u.vm)));
  assert.equal(textOf(one(byCy(rerender(u.vm), 'transformer-delete-usage'), 'usage line')), 'Devices using these transformers will stop applying them.');
});

checkAsync('B7 devices/loadDevices reads GET /device once and throws on failure; fetchItems never throws on success:false', async () => {
  const store = devicesStore();
  assert.equal(typeof store.actions.loadDevices, 'function', 'the devices store has loadDevices');
  const run = (answer) => {
    const calls = { get: [], commit: [] };
    const state = { items: [] };
    const self = { $api: { $get: async (url) => { calls.get.push(url); if (answer instanceof Error) throw answer; return answer; } } };
    const ctx = { state, commit: (name, payload) => { calls.commit.push({ name, payload }); store.mutations[name](state, payload); } };
    return { calls, state, ctx, self };
  };
  const list = [{ udid: 'd1', transformers: ['t1'] }];
  const ok = run({ success: true, response: list });
  await store.actions.loadDevices.call(ok.self, ok.ctx);
  assert.deepEqual(ok.calls.get, ['/device'], 'one GET /device');
  assert.deepEqual(ok.calls.commit.map((c) => c.name), ['saveDevices']);
  assert.deepEqual(ok.calls.commit[0].payload, { items: list });
  assert.deepEqual(ok.state.items.map((d) => d.udid), ['d1']);
  const no = run({ success: false });
  await assert.rejects(() => store.actions.loadDevices.call(no.self, no.ctx), 'success:false rejects');
  assert.deepEqual(no.calls.commit, [], 'nothing committed on failure');
  const down = run(new Error('offline'));
  await assert.rejects(() => store.actions.loadDevices.call(down.self, down.ctx), 'a rejected request rejects');
  const legacy = run({ success: false });
  await store.actions.fetchItems.call(legacy.self, legacy.ctx);
  assert.deepEqual(legacy.calls.commit, [], 'fetchItems keeps its non-throwing behaviour');
});

checkAsync('B8 load states: first-load status, one load alert on failure, pruning, in-place reloads, the empty row', async () => {
  const first = renderTransformers({ items: [], loading: true }).vnode;
  const status = byTag(first, 'div').filter((n) => attrsOf(n).role === 'status');
  assert.equal(status.length, 1, 'one role=status');
  assert.equal(textOf(status[0]), 'Loading' + ELLIPSIS);
  assert.equal(tablesOf(first).length, 0, 'no table while loading');
  assert.equal(toolbarsOf(first).length, 0, 'no toolbar while loading');
  const h = liveHarness({ items: items(), selectedUtids: [TRANSFORMERS[0].utid], error: 'an earlier action error' },
    { fetchItems: async () => { throw new Error('offline'); } });
  await h.vm.loadData();
  assert.deepEqual(h.vm.items, [], 'items emptied');
  assert.deepEqual(h.vm.selectedUtids, [], 'selection emptied');
  assert.equal(h.vm.loadFailed, true);
  assert.equal(h.vm.error, 'an earlier action error', 'the action error is left alone');
  h.vm.error = null;
  let vnode = rerender(h.vm);
  const alert = one(loadAlertsOf(vnode), 'transformers-load-error');
  assert.equal(alert.tag, 'b-alert');
  assert.equal(attrsOf(alert).variant, 'danger');
  assert.ok(!attrsOf(alert).dismissible, 'not dismissible');
  assert.equal(textOf(alert), 'Could not load transformers. Refresh to retry.');
  assert.equal(byTag(vnode, 'b-alert').filter((n) => attrsOf(n).show !== false && textOf(n)).length, 1, 'exactly one alert');
  assert.equal(tablesOf(vnode).length, 0, 'no table after a failed load');
  assert.equal(toolbarsOf(vnode).length, 0, 'no toolbar after a failed load');
  h.control.fetchItems = async () => {};
  h.control.storeItems = [items()[1]];
  h.vm.selectedUtids = [TRANSFORMERS[0].utid, TRANSFORMERS[1].utid];
  await h.vm.loadData();
  assert.equal(h.vm.loadFailed, false, 'a later success clears loadFailed');
  assert.deepEqual(h.vm.selectedUtids, [TRANSFORMERS[1].utid], 'the selection is pruned to listed utids');
  assert.equal(loadAlertsOf(rerender(h.vm)).length, 0, 'the load alert is gone');
  // A reload after the first load keeps the table rendered.
  const pending = deferred();
  h.control.fetchItems = () => pending.promise;
  const reload = h.vm.loadData();
  vnode = rerender(h.vm);
  assert.equal(tablesOf(vnode).length, 1, 'the table stays during a reload');
  assert.equal(byTag(vnode, 'div').filter((n) => attrsOf(n).role === 'status').length, 0, 'no Loading on a reload');
  pending.resolve();
  await reload;
  // Empty successful load.
  const e = liveHarness({ items: items(), loading: true });
  e.control.storeItems = [];
  await e.vm.loadData();
  vnode = rerender(e.vm);
  assert.equal(toolbarsOf(vnode).length, 0, 'no toolbar with zero transformers');
  const cells = byTag(one(tablesOf(vnode), 'table'), 'td');
  assert.equal(cells.length, 1, 'one empty-row cell');
  assert.equal(String(attrsOf(cells[0]).colspan), '3', 'the empty row spans 3 columns');
  assert.equal(textOf(cells[0]), 'No transformers yet. Add one with Add Transformer.');
  assert.ok(!classList(cells[0]).includes('text-muted'), 'body colour, no text-muted');
});

check('B9 a name holding HTML and a direction override renders as text in the table, the question and the list', () => {
  const evil = '<img src=x onerror=alert(1)>' + String.fromCharCode(0x202E) + 'gnp.exe';
  const list = [{ id: 'utid-evil', utid: 'utid-evil', alias: evil, body: 'eA==' }].concat(items());
  const h = harness({ items: list, selectedUtids: ['utid-evil', TRANSFORMERS[0].utid] });
  let vnode = rerender(h.vm);
  const name = one(byCy(vnode, 'transformer-name').filter((n) => attrsOf(n).title === evil), 'evil name cell');
  assert.equal(name.children.length, 1, 'one child');
  assert.equal(name.children[0].tag, undefined, 'a text node');
  assert.equal(name.children[0].text, evil, 'exactly the stored string');
  click(bulkOf(vnode));
  vnode = rerender(h.vm);
  const lis = byTag(one(byCy(vnode, 'transformer-delete-names'), 'names list'), 'li');
  assert.equal(lis[0].children.length, 1);
  assert.equal(lis[0].children[0].text, evil, 'the list item is the plain string');
  const r = harness({ items: list });
  openRowDelete(r, list[0]);
  vnode = rerender(r.vm);
  const question = one(byCy(vnode, 'transformer-delete-question'), 'question');
  assert.equal(question.children.length, 1);
  assert.equal(question.children[0].text, 'Delete the transformer "' + evil + '"? This cannot be undone.');
  assert.equal(byTag(vnode, 'img').length, 0, 'no img element anywhere');
  const { template } = page();
  assert.ok(!/v-html|innerHTML/.test(template), 'no raw-HTML binding in the template');
});

// ---------------------------------------------------------------- compiled theme

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

// Referenced by the checks that later plans add; kept so the harness stays whole.
void expand;

// ---------------------------------------------------------------- C: add, create, styles (46-02 task 3)

const createModalOf = (vnode) => one(nodesOf(vnode).filter((n) => n.tag === 'b-modal' && attrsOf(n).id === 'create-transformer-modal'), 'create-transformer-modal');

// A page vm whose create runs against a controllable createItem.
function createHarness(state = {}) {
  const h = harness(state);
  h.calls.createItem = [];
  h.vm.createItem = (name) => {
    h.calls.createItem.push(name);
    h.control.createItem = deferred();
    return h.control.createItem.promise;
  };
  return h;
}

const okEvent = () => { const e = { prevented: 0 }; e.preventDefault = () => { e.prevented++; }; return e; };

check('C1 Add Transformer is a green button with a plus glyph and visible text in div.settings-add', () => {
  const h = harness();
  const vnode = rerender(h.vm);
  const top = rootChildren(vnode);
  const rows = top.filter((n) => classList(n).includes('settings-add'));
  assert.equal(rows.length, 1, 'one div.settings-add at the top level');
  assert.equal(rows[0].tag, 'div');
  const btn = one(byCy(rows[0], 'transformer-add'), 'transformer-add');
  assert.equal(btn.tag, 'b-button');
  assert.equal(attrsOf(btn).variant, 'success');
  const kids = (btn.children || []).filter((n) => n.tag);
  assert.deepEqual(kids.map((n) => n.tag), ['i', 'span'], 'glyph then text');
  assert.deepEqual(classList(kids[0]).sort(), ['fa', 'fa-plus']);
  assert.equal(attrsOf(kids[0])['aria-hidden'], 'true');
  assert.ok(classList(kids[1]).includes('button-text'), 'span.button-text');
  assert.equal(textOf(kids[1]), 'Add Transformer');
  assert.ok(!top.some((n) => n.tag === 'p' && byCy(n, 'transformer-add').length), 'no <p> wrapper');
  click(btn);
  assert.deepEqual(h.calls.show, ['create-transformer-modal'], 'opens the create dialog');
});

check('C2 the create dialog says Name, has verb + noun buttons and its own feedback line', () => {
  const { vnode } = renderTransformers();
  const modal = createModalOf(vnode);
  const a = attrsOf(modal);
  assert.deepEqual(
    { title: a.title, ok: a['ok-title'], okVariant: a['ok-variant'], cancel: a['cancel-title'], cancelVariant: a['cancel-variant'], okDisabled: a['ok-disabled'] },
    { title: 'Add Transformer', ok: 'Create Transformer', okVariant: 'success', cancel: 'Close without adding', cancelVariant: 'default', okDisabled: false });
  const busy = attrsOf(createModalOf(renderTransformers({ creating: true }).vnode));
  assert.equal(busy['ok-title'], 'Creating' + ELLIPSIS);
  assert.equal(busy['ok-disabled'], true, 'OK disabled while creating');
  const group = one(nodesOf(modal).filter((n) => n.tag === 'b-form-group'), 'b-form-group');
  assert.equal(attrsOf(group).label, 'Name');
  assert.equal(attrsOf(group)['label-for'], 'transformer-name');
  const input = one(byCy(modal, 'transformer-create-input'), 'transformer-create-input');
  assert.equal(input.tag, 'b-form-input');
  assert.equal(attrsOf(input).id, 'transformer-name');
  assert.equal(attrsOf(input).placeholder, 'e.g. Battery Parser');
  assert.equal(attrsOf(input)['aria-describedby'], 'transformer-create-feedback');
  assert.equal(byTag(modal, 'b-alert').length, 0, 'no alert inside the dialog');
  const kids = (modal.children || []).filter((n) => n.tag);
  const at = kids.indexOf(group);
  const feedback = kids[at + 1];
  assert.ok(feedback, 'a line follows the group');
  assert.equal(feedback.tag, 'p');
  assert.equal(attrsOf(feedback).id, 'transformer-create-feedback');
  assert.ok(classList(feedback).includes('dialog-feedback'), 'p.dialog-feedback');
  assert.equal(attrsOf(feedback)['aria-live'], 'polite');
  assert.equal(textOf(feedback), '', 'silent until there is something to say');
});

checkAsync('C3 create validates in the dialog, sends once, keeps the dialog on failure and never writes the page error', async () => {
  const pageError = 'an earlier action error';
  const h = createHarness({ error: pageError });
  for (const blank of ['', '   ']) {
    h.vm.form.alias = blank;
    const e = okEvent();
    await h.vm.create(e);
    assert.equal(e.prevented, 1, 'the dialog stays while validating');
    assert.equal(h.vm.createError, 'Enter a transformer name.');
  }
  h.vm.form.alias = '  ' + TRANSFORMERS[0].alias + ' ';
  await h.vm.create(okEvent());
  assert.equal(h.vm.createError, 'A transformer with this name already exists.');
  assert.deepEqual(h.calls.createItem, [], 'nothing sent for a blank or duplicate name');
  assert.equal(textOf(one(byCy(rerender(h.vm), 'transformer-create-feedback'), 'feedback')), 'A transformer with this name already exists.');
  for (const outcome of ['answer', 'throw']) {
    h.vm.form.alias = ' Pressure ';
    const first = h.vm.create(okEvent());
    const second = h.vm.create(okEvent());
    await tick();
    assert.equal(h.calls.createItem.length, 1, outcome + ': two rapid calls send one createItem');
    assert.equal(h.calls.createItem[0], 'Pressure', 'the trimmed name is sent');
    if (outcome === 'answer') h.control.createItem.resolve({ success: false });
    else h.control.createItem.reject(new Error('offline'));
    await first; await second;
    assert.equal(h.vm.createError, 'Could not create the transformer. Try again.');
    assert.deepEqual(h.calls.hide, [], outcome + ': the dialog stays open');
    assert.equal(h.vm.creating, false);
    h.calls.createItem = [];
  }
  h.control.storeItems = items().concat([{ id: 'utid-new', utid: 'utid-new', alias: 'Pressure', body: 'eA==' }]);
  h.vm.form.alias = 'Pressure';
  const run = h.vm.create(okEvent());
  await tick();
  h.control.createItem.resolve({ success: true, utid: 'utid-new' });
  await run;
  assert.deepEqual(h.calls.hide, ['create-transformer-modal'], 'success closes the dialog');
  assert.equal(h.vm.form.alias, '', 'the field is reset');
  assert.equal(h.vm.createError, null);
  assert.deepEqual(h.vm.items.map((t) => t.utid), TRANSFORMERS.map((t) => t.utid).concat(['utid-new']), 'the store list is shown');
  assert.equal(h.calls.loadData, 0, 'no second fetch after a refreshed write');
  h.vm.form.alias = 'Wind';
  const stale = h.vm.create(okEvent());
  await tick();
  h.control.createItem.resolve({ success: true, refreshed: false });
  await stale;
  assert.equal(h.calls.loadData, 1, 'refreshed:false reloads once');
  assert.equal(h.vm.error, pageError, 'create never writes the page error');
});

check('C4 compiled theme: white wrench glyph, bulk toolbar, button text, add row and the transformer name', () => {
  const white = expectDecls('.icon-button .icon-white', {});
  assert.match(value(white, 'color') || '', /^#(fff|ffffff)$/i, '.icon-white color');
  const bar = expectDecls('.bulk-toolbar', { display: 'flex', 'justify-content': 'flex-end', 'align-items': 'center', 'margin-bottom': '8px' });
  assert.equal(value(bar, 'gap'), undefined, 'the one-button toolbar has no gap');
  expectDecls('.button-text', { 'margin-left': '4px', 'font-weight': '400' });
  expectDecls('.settings-add', { 'margin-bottom': '16px' });
  expectDecls('.transformer-name', {
    display: 'block', 'max-width': '160px', overflow: 'hidden', 'text-overflow': 'ellipsis',
    'white-space': 'nowrap', 'unicode-bidi': 'isolate',
  });
  const md = allRules().filter((r) => /min-width:\s*768px/.test(r.media) && r.selectors.some((x) => loose(x) === '.transformer-name'));
  assert.equal(value(md.map((r) => r.body), 'max-width'), '240px', '.transformer-name from 768px');
});

check('C5 compiled theme: dialog stack, label, feedback and help lines, typed-confirm names, word and glyph', () => {
  expectDecls('.dialog-stack', { display: 'flex', 'flex-direction': 'column', gap: '8px' });
  expectDecls('.dialog-stack > *', { margin: '0' });
  expectDecls('.dialog-label', { display: 'block', margin: '0 0 4px' });
  const fb = expectDecls('.dialog-feedback', { margin: '4px 0 0', 'font-size': '.875rem', 'font-weight': '400' });
  assert.match(value(fb, 'color') || '', /^#ff8a8a$/i, '.dialog-feedback color');
  expectDecls('.dialog-feedback:empty', { display: 'none' });
  expectDecls('.dialog-help', { margin: '4px 0 0', color: 'inherit', 'font-size': '.875rem', 'font-weight': '400' });
  expectDecls('.typed-confirm__names', { 'max-height': '160px', 'overflow-y': 'auto', 'padding-left': '16px', 'overflow-wrap': 'anywhere' });
  const word = expectDecls('.typed-confirm__word', { 'font-size': '.875rem', 'font-weight': '400' });
  assert.match(value(word, 'font-family') || '', /monospace/, '.typed-confirm__word monospace');
  const glyph = expectDecls('.typed-confirm__usage .fa-warning', { 'margin-right': '4px' });
  assert.match(value(glyph, 'color') || '', /^#f0ad4e$/i, 'usage glyph colour');
});

check('C6 Transformers.vue holds no forbidden string; theme.scss imports settings-pages once, after deploy-keys', () => {
  const source = read('pages/Transformers/Transformers.vue');
  const forbidden = ['Alias', 'alias already exists', 'text-muted', 'ok-title="Create"', 'Delete this transformer?', 'Failed to',
    '>Cancel<', '>Save<', 'class="mr-2"', 'msgBoxConfirm', 'v-html', 'innerHTML'];
  const found = forbidden.filter((x) => source.includes(x));
  assert.deepEqual(found, [], 'forbidden strings in Transformers.vue');
  const theme = read('styles/theme.scss');
  const imports = theme.split('\n').map((l) => l.trim()).filter((l) => /^@import/.test(l));
  const at = imports.indexOf("@import 'settings-pages';");
  assert.equal(imports.filter((l) => l === "@import 'settings-pages';").length, 1, 'imported once');
  assert.equal(imports[at - 1], "@import 'deploy-keys';", 'right after deploy-keys');
  assert.ok(fs.existsSync(path.join(SRC, 'styles', '_settings-pages.scss')), 'the partial exists');
});

// ---------------------------------------------------------------- E: environment edit (46-03 task 1)

const ENVIROS = ['WIFI_SSID', 'WIFI', 'MQTT_HOST'];
const enviroItems = (names = ENVIROS) => names.map((label, id) => ({ id, label }));
const SECRET = 'pa55-Secret-Value';
const EDIT_HELP = 'The current value is never shown. The new value replaces it when you save.';
const editErrorFor = (key) => 'Could not save the new value. ' + key + ' keeps its current value. Try again.';

// List: {} keeps the pre-46-03 page loadable, so its checks fail on their assertions.
const enviroPage = lazy(() => loadSfc('pages/Enviros/Enviros.vue', { IconButton: iconButton().def, List: {} }));
const envirosStore = lazy(() => loadStore('store/enviros.js'));

function renderEnviros(state = {}) {
  const r = renderPage(enviroPage().def, Object.assign({ items: enviroItems() }, state));
  assert.equal(r.error, null, 'Enviros renders without error');
  assert.deepEqual(r.warnings, [], 'Enviros renders without Vue warnings');
  return r;
}

// An Enviros vm with the store actions, the dialogs and the toast replaced by recorders.
function enviroHarness(state = {}) {
  const { vm } = renderEnviros(state);
  const calls = { show: [], hide: [], hideWhileSaving: [], createItem: [], deleteItems: [], confirm: [], toast: [], loadData: 0, getItems: 0, fetchItems: 0 };
  const control = { storeItems: enviroItems(), createItem: null, deleteItems: null, confirm: null };
  vm.$bvModal = {
    show: (id) => { calls.show.push(id); },
    hide: (id) => { calls.hide.push(id); calls.hideWhileSaving.push(vm.editSaving); },
    msgBoxConfirm: (text, opts) => {
      calls.confirm.push({ text, opts });
      control.confirm = deferred();
      return control.confirm.promise;
    },
  };
  vm.$toasted = { show: (...args) => { calls.toast.push(args); } };
  vm.createItem = (payload) => {
    calls.createItem.push(payload);
    control.createItem = deferred();
    return control.createItem.promise;
  };
  vm.deleteItems = (names) => {
    calls.deleteItems.push(names);
    control.deleteItems = deferred();
    return control.deleteItems.promise;
  };
  vm.getItems = () => { calls.getItems++; return control.storeItems; };
  vm.fetchItems = async () => { calls.fetchItems++; };
  vm.loadData = async () => { calls.loadData++; };
  return { vm, calls, control };
}

// An Enviros vm whose own loadData runs against a controllable loadItems.
function enviroLiveHarness(state = {}, opts = {}) {
  const h = enviroHarness(state);
  h.vm.loadData = enviroPage().def.methods.loadData.bind(h.vm);
  h.calls.loadItems = 0;
  h.control.loadItems = opts.loadItems || (async () => {});
  h.vm.loadItems = () => { h.calls.loadItems++; return h.control.loadItems(); };
  return h;
}

const enviroRowsOf = (vnode) => byCy(vnode, 'enviro-row');
const enviroRowOf = (vnode, name) => enviroRowsOf(vnode).find((row) => row.key === name);
const editModalOf = (vnode) => one(nodesOf(vnode).filter((n) => n.tag === 'b-modal' && attrsOf(n).id === 'enviro-edit-modal'), 'enviro-edit-modal');
const editSaveOf = (vnode) => one(byCy(vnode, 'enviro-edit-save'), 'enviro-edit-save');
const editKeepOf = (vnode) => one(byCy(vnode, 'enviro-edit-keep'), 'enviro-edit-keep');
const editInputOf = (vnode) => one(byCy(vnode, 'enviro-edit-value'), 'enviro-edit-value');
const hideEvent = () => { const e = { prevented: 0 }; e.preventDefault = () => { e.prevented++; }; return e; };

// Open the edit dialog for `name` through its row's Edit value button.
function openRowEdit(h, name) {
  const row = enviroRowOf(rerender(h.vm), name);
  assert.ok(row, 'row for ' + name);
  click(one(buttonsOf(row, 'enviro-edit'), 'row Edit value'));
}

check('E1 a page-local table: captioned, Select/Key/Actions, rows keyed by name with the key and one Edit value IconButton', () => {
  assert.ok(!/<List\b/.test(enviroPage().template), 'no generic List component in the template');
  const { vnode } = renderEnviros();
  const table = one(tablesOf(vnode), 'table');
  assert.deepEqual(classList(table).filter((c) => /^table|enviros-table$/.test(c)).sort(), ['enviros-table', 'table', 'table-striped']);
  const wrap = rootChildren(vnode).find((n) => classList(n).includes('table-responsive'));
  assert.ok(wrap && nodesOf(wrap).includes(table), 'the table sits in .table-responsive');
  const caption = one(byTag(table, 'caption'), 'caption');
  assert.ok(classList(caption).includes('sr-only'), 'caption is sr-only');
  assert.equal(textOf(caption), 'Environment variables');
  const heads = byTag(table, 'th');
  assert.equal(heads.length, 3, 'three header cells');
  const sr = one(byClass(heads[0], 'sr-only'), 'sr-only Select');
  assert.equal(textOf(sr), 'Select');
  assert.deepEqual(heads.slice(1).map(textOf), ['Key', 'Actions']);
  const rows = enviroRowsOf(vnode);
  assert.deepEqual(rows.map((r) => r.tag), ['tr', 'tr', 'tr']);
  assert.deepEqual(rows.map((r) => r.key), ENVIROS, 'rows are keyed by the variable name');
  rows.forEach((row, i) => {
    const key = one(byCy(row, 'enviro-key'), 'enviro-key');
    assert.equal(key.tag, 'span');
    assert.ok(classList(key).includes('enviro-key'), 'span.enviro-key');
    assert.equal(attrsOf(key).title, ENVIROS[i], 'full key as title');
    assert.equal(textOf(key), ENVIROS[i]);
    const cells = cellsOf(row);
    const last = cells[cells.length - 1];
    assert.ok(classList(last).includes('actions-cell'), 'last cell is .actions-cell');
    assert.equal(componentsOf(last, 'IconButton').length, 1, 'one IconButton in the actions cell');
    const edit = one(buttonsOf(last, 'enviro-edit'), 'enviro-edit IconButton');
    assert.deepEqual(
      { icon: propsOf(edit).icon, label: propsOf(edit).label, variant: propsOf(edit).variant || 'default' },
      { icon: 'fa fa-pencil', label: 'Edit value', variant: 'default' });
    assert.ok(!propsOf(edit).disabled, 'idle Edit value is enabled');
  });
  const h = enviroHarness();
  openRowEdit(h, 'WIFI');
  assert.deepEqual(h.calls.show, ['enviro-edit-modal'], 'Edit value opens the edit dialog');
  assert.equal(h.vm.editKey, 'WIFI');
});

check('E2 the edit dialog names the key, starts empty, and has the key text, value field, feedback and help lines', () => {
  const h = enviroHarness({ editValue: 'an earlier value', editError: 'an earlier error' });
  h.vm.openEdit(enviroItems()[1]);
  assert.equal(h.vm.editKey, 'WIFI');
  assert.equal(h.vm.editValue, '', 'the value starts empty');
  assert.ok(!h.vm.editError, 'the error is cleared on open');
  assert.deepEqual(h.calls.show, ['enviro-edit-modal']);
  const vnode = rerender(h.vm);
  const modal = editModalOf(vnode);
  assert.equal(attrsOf(modal).title, 'Change value of WIFI');
  assert.equal(attrsOf(modal)['title-class'], 'text-break');
  const form = one(byTag(modal, 'b-form'), 'b-form');
  assert.equal(attrsOf(form).id, 'enviro-edit-form');
  assert.ok(classList(form).includes('dialog-stack'), 'b-form.dialog-stack');
  const fields = (form.children || []).filter((n) => n.tag);
  assert.equal(fields.length, 2, 'two blocks in the form');
  fields.forEach((f) => assert.ok(f.tag === 'div' && classList(f).includes('dialog-field'), 'div.dialog-field'));
  const keyLabel = one(nodesOf(fields[0]).filter((n) => attrsOf(n).id === 'enviro-edit-key-label'), 'key label');
  assert.equal(keyLabel.tag, 'span');
  assert.ok(classList(keyLabel).includes('dialog-label'));
  assert.equal(textOf(keyLabel), 'Key');
  const keyText = one(byCy(fields[0], 'enviro-edit-key'), 'enviro-edit-key');
  assert.equal(keyText.tag, 'p');
  assert.ok(classList(keyText).includes('enviro-edit-key'), 'p.enviro-edit-key');
  assert.equal(attrsOf(keyText)['aria-labelledby'], 'enviro-edit-key-label');
  assert.equal(textOf(keyText), 'WIFI');
  const kids = (fields[1].children || []).filter((n) => n.tag);
  assert.deepEqual(kids.map((n) => n.tag), ['label', 'b-form-input', 'p', 'p'], 'label, input, feedback, help');
  assert.equal(attrsOf(kids[0]).for, 'enviro-edit-value');
  assert.ok(classList(kids[0]).includes('dialog-label'));
  assert.equal(textOf(kids[0]), 'New value');
  const input = editInputOf(vnode);
  assert.equal(input, kids[1], 'the value field follows its label');
  const a = attrsOf(input);
  assert.deepEqual(
    { id: a.id, autocomplete: a.autocomplete, spellcheck: a.spellcheck, describedby: a['aria-describedby'], disabled: a.disabled },
    { id: 'enviro-edit-value', autocomplete: 'off', spellcheck: 'false', describedby: 'enviro-edit-feedback enviro-edit-help', disabled: false });
  assert.equal(input.data.ref, 'valueInput');
  assert.equal(attrsOf(kids[2]).id, 'enviro-edit-feedback');
  assert.ok(classList(kids[2]).includes('dialog-feedback'), 'p.dialog-feedback');
  assert.equal(attrsOf(kids[2])['aria-live'], 'polite');
  assert.equal(textOf(kids[2]), '', 'the feedback line is silent');
  assert.equal(attrsOf(kids[3]).id, 'enviro-edit-help');
  assert.ok(classList(kids[3]).includes('dialog-help'), 'p.dialog-help');
  assert.equal(textOf(kids[3]), EDIT_HELP);
  assert.equal(textOf(editKeepOf(vnode)), 'Keep current value');
  assert.equal(attrsOf(editKeepOf(vnode)).variant, 'default');
  const save = editSaveOf(vnode);
  assert.equal(textOf(save), 'Save value');
  assert.deepEqual({ variant: attrsOf(save).variant, type: attrsOf(save).type, form: attrsOf(save).form },
    { variant: 'success', type: 'submit', form: 'enviro-edit-form' });
  h.vm.editValue = 'typed';
  h.vm.openEdit(enviroItems()[0]);
  assert.equal(h.vm.editValue, '', 'a second open empties the value again');
  assert.equal(attrsOf(editModalOf(rerender(h.vm))).title, 'Change value of WIFI_SSID');
});

checkAsync('E3 Save value is disabled for an empty trimmed value; two rapid saves send one trimmed createItem', async () => {
  const h = enviroHarness();
  h.vm.openEdit(enviroItems()[1]);
  for (const blank of ['', '   ']) {
    h.vm.editValue = blank;
    assert.equal(attrsOf(editSaveOf(rerender(h.vm))).disabled, true, JSON.stringify(blank) + ' keeps Save value disabled');
    await h.vm.saveEdit();
  }
  assert.deepEqual(h.calls.createItem, [], 'an empty value sends nothing');
  h.vm.editValue = 'x';
  assert.equal(attrsOf(editSaveOf(rerender(h.vm))).disabled, false, 'x enables Save value');
  h.vm.editValue = '  ' + SECRET + '  ';
  const first = h.vm.saveEdit();
  const second = h.vm.saveEdit();
  await tick();
  assert.deepEqual(h.calls.createItem, [{ key: 'WIFI', value: SECRET }], 'one createItem with the key and the trimmed value');
  h.control.createItem.resolve({ success: true, response: 'WIFI' });
  await first; await second;
});

checkAsync('E4 while the request runs the field and both buttons are disabled, Save reads Saving and the dialog cannot close', async () => {
  const h = enviroHarness();
  h.vm.openEdit(enviroItems()[1]);
  h.vm.editValue = SECRET;
  const run = h.vm.saveEdit();
  await tick();
  assert.equal(h.vm.editSaving, true);
  const vnode = rerender(h.vm);
  assert.equal(attrsOf(editInputOf(vnode)).disabled, true, 'field disabled');
  assert.equal(attrsOf(editKeepOf(vnode)).disabled, true, 'Keep current value disabled');
  assert.equal(attrsOf(editSaveOf(vnode)).disabled, true, 'Save value disabled');
  assert.equal(textOf(editSaveOf(vnode)), 'Saving' + ELLIPSIS);
  const e = hideEvent();
  h.vm.onEditHide(e);
  assert.equal(e.prevented, 1, 'hide is prevented while saving');
  h.control.createItem.resolve({ success: true, response: 'WIFI' });
  await run;
  const after = hideEvent();
  h.vm.onEditHide(after);
  assert.equal(after.prevented, 0, 'hide is allowed once the request ended');
});

checkAsync('E5 success hides once, toasts the constant, takes the store list without a fetch and never shows the value', async () => {
  const h = enviroHarness({ items: enviroItems(['WIFI', 'WIFI_SSID']) });
  h.control.storeItems = enviroItems();
  h.vm.openEdit({ id: 0, label: 'WIFI' });
  h.vm.editValue = SECRET;
  const run = h.vm.saveEdit();
  await tick();
  h.control.createItem.resolve({ success: true, response: 'WIFI' });
  await run;
  assert.deepEqual(h.calls.hide, ['enviro-edit-modal'], 'hidden once');
  assert.deepEqual(h.calls.hideWhileSaving, [false], 'editSaving is cleared before hide');
  assert.deepEqual(h.calls.toast, [['Value saved', { type: 'success', duration: 2000 }]], 'one constant toast');
  assert.deepEqual(h.vm.items.map((i) => i.label), ENVIROS, 'the store list is shown');
  assert.equal(h.calls.loadData, 0, 'no second page fetch');
  assert.equal(h.calls.fetchItems, 0, 'no fetchItems from the page');
  assert.ok(!textOf(rerender(h.vm)).includes(SECRET), 'the page text never holds the value');
  h.vm.onEditHidden();
  assert.equal(h.vm.editValue, '', 'the value is gone once the dialog has closed');
  assert.ok(!JSON.stringify(h.calls.toast).includes(SECRET), 'the toast never holds the value');
});

checkAsync('E6 a failed save keeps the dialog and the typed value, names the key in the error and reloads once', async () => {
  for (const outcome of ['answer', 'throw']) {
    const h = enviroHarness();
    h.vm.openEdit(enviroItems()[1]);
    h.vm.editValue = SECRET;
    const run = h.vm.saveEdit();
    await tick();
    if (outcome === 'answer') h.control.createItem.resolve({ success: false });
    else h.control.createItem.reject(new Error('offline'));
    await run;
    assert.deepEqual(h.calls.hide, [], outcome + ': the dialog stays open');
    assert.equal(h.vm.editSaving, false, outcome + ': editSaving cleared');
    assert.equal(h.vm.editValue, SECRET, outcome + ': the typed value is kept');
    assert.equal(h.vm.editError, editErrorFor('WIFI'), outcome + ': the edit error copy');
    assert.equal(h.calls.loadData, 1, outcome + ': the list reloads once');
    assert.deepEqual(h.calls.toast, [], outcome + ': no toast');
    const vnode = rerender(h.vm);
    assert.equal(textOf(one(byCy(vnode, 'enviro-edit-feedback'), 'enviro-edit-feedback')), editErrorFor('WIFI'));
    assert.ok(!textOf(vnode).includes(SECRET), outcome + ': the error never holds the value');
  }
});

check('E7 once the dialog has closed the value and the error are emptied', () => {
  const h = enviroHarness({ editKey: 'WIFI', editValue: SECRET, editError: editErrorFor('WIFI') });
  h.vm.onEditHidden();
  assert.equal(h.vm.editValue, '');
  assert.ok(!h.vm.editError, 'the error is cleared');
});

checkAsync('E8 enviros/loadItems reads GET /env once and throws on failure; fetchItems never throws; createItem is one PUT', async () => {
  const store = envirosStore();
  assert.equal(typeof store.actions.loadItems, 'function', 'the enviros store has loadItems');
  const run = (answer) => {
    const calls = { get: [], put: [], commit: [], dispatch: [] };
    const state = { items: [] };
    const self = { $api: {
      $get: async (url) => { calls.get.push(url); if (answer instanceof Error) throw answer; return answer; },
      $put: async (url, body) => { calls.put.push({ url, body }); return { success: true, response: 'WIFI' }; },
    } };
    const ctx = {
      state,
      commit: (name, payload) => { calls.commit.push(name); store.mutations[name](state, payload); },
      dispatch: async (name) => { calls.dispatch.push(name); },
    };
    return { calls, state, ctx, self };
  };
  const ok = run({ success: true, response: ['WIFI', 'MQTT_HOST'] });
  await store.actions.loadItems.call(ok.self, ok.ctx);
  assert.deepEqual(ok.calls.get, ['/env'], 'one GET /env');
  assert.deepEqual(ok.calls.commit, ['saveSimpleArray']);
  assert.deepEqual(ok.state.items, [{ id: 0, label: 'WIFI' }, { id: 1, label: 'MQTT_HOST' }]);
  for (const [what, answer] of [['success:false', { success: false }], ['a rejected request', new Error('offline')], ['a non-array answer', { success: true, response: 'x' }]]) {
    const bad = run(answer);
    await assert.rejects(() => store.actions.loadItems.call(bad.self, bad.ctx), what + ' rejects');
    assert.deepEqual(bad.calls.commit, [], what + ': nothing committed');
  }
  const legacy = run({ success: false });
  await store.actions.fetchItems.call(legacy.self, legacy.ctx);
  assert.deepEqual(legacy.calls.commit, [], 'fetchItems keeps its non-throwing behaviour');
  const put = run({ success: true, response: [] });
  const answer = await store.actions.createItem.call(put.self, put.ctx, { key: 'WIFI', value: 'v' });
  assert.deepEqual(put.calls.put, [{ url: '/env', body: '{"key":"WIFI","value":"v"}' }], 'one PUT /env with key and value');
  assert.deepEqual(answer, { success: true, response: 'WIFI' });
});

checkAsync('E9 loadData uses loadItems: the first load shows only Loading, success takes the store list and clears loading', async () => {
  const first = renderEnviros({ items: [], loading: true }).vnode;
  const status = byTag(first, 'div').filter((n) => attrsOf(n).role === 'status');
  assert.equal(status.length, 1, 'one role=status');
  assert.equal(textOf(status[0]), 'Loading' + ELLIPSIS);
  assert.equal(tablesOf(first).length, 0, 'no table while loading');
  const h = enviroLiveHarness({ items: [], loading: true });
  h.control.storeItems = enviroItems(['A', 'B']);
  await h.vm.loadData();
  assert.equal(h.calls.loadItems, 1, 'one loadItems');
  assert.equal(h.calls.fetchItems, 0, 'the page does not use fetchItems');
  assert.deepEqual(h.vm.items.map((i) => i.label), ['A', 'B']);
  assert.equal(h.vm.loading, false);
  const down = enviroLiveHarness({ items: enviroItems(), loading: true }, { loadItems: async () => { throw new Error('offline'); } });
  await down.vm.loadData();
  assert.equal(down.vm.loading, false, 'a rejected load clears loading');
  assert.deepEqual(down.vm.items, [], 'a rejected load empties the rows');
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

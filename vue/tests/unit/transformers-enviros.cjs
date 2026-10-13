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

const iconButton = lazy(() => loadSfc('components/IconButton/IconButton.vue'));
const page = lazy(() => loadSfc('pages/Transformers/Transformers.vue', { IconButton: iconButton().def }));
const transformersStore = lazy(() => loadStore('store/transformers.js'));

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
void expand; void loadModule; void byTag; void expectDecls;

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

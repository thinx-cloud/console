// Unit test for the Phase 47 build log search (v1.18 Phase 47: BUILD-03, POL-02, FIX-02;
// UI-SPEC UI-B01..UI-B19).
//
// Plain-node checks for buildLogSearch() in src/utils/buildLog.js (plain-text, case-insensitive,
// capped at 1000 matches, segments that rebuild the log exactly) and for
// src/components/BuildLogDialog/BuildLogDialog.vue: the sticky search bar, the highlighted
// text-only segments (log HTML stays inert), the debounce, the count and its spoken form,
// stepping with the Phase 44 IconButtons, Enter / Shift+Enter, the centred scroll inside the
// log box, the id-only open(), the loading reset on close, the error and empty states, and
// the Phase 47 rules compiled from src/styles/theme.scss.
// Check prefixes: S (helper), D (dialog search), T (stepping), L (lifecycle and states),
// C (compiled styles). 47-02 adds V (dashboard), N (navbar and status mapping) and
// H (History, Device Detail).
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
// Exact text under a node: text vnodes joined with nothing added.
const rawTextOf = (top) => nodesOf(top).filter((n) => !n.tag && typeof n.text === 'string').map((n) => n.text).join('');
const elementsOf = (n) => (n.children || []).filter((c) => c.tag);
const one = (list, what) => { assert.equal(list.length, 1, 'exactly one ' + what + ' (found ' + list.length + ')'); return list[0]; };

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
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------- fixtures

const ELLIPSIS = String.fromCharCode(0x2026);
const PLACEHOLDER = 'Search log (3+ characters)';
const LABEL = 'Search this build log';

const logUtils = lazy(() => loadModule('utils/buildLog.js'));
const search = (...args) => {
  const fn = logUtils().buildLogSearch;
  assert.equal(typeof fn, 'function', 'buildLogSearch is exported from utils/buildLog.js');
  return fn(...args);
};
const iconButton = lazy(() => loadSfc('components/IconButton/IconButton.vue'));
const dialog = lazy(() => loadSfc('components/BuildLogDialog/BuildLogDialog.vue', {
  buildLogText: logUtils().buildLogText,
  buildLogSearch: logUtils().buildLogSearch,
  hasBuildLog: logUtils().hasBuildLog,
  IconButton: iconButton().def,
}));

// A dialog vm with $refs.modal, $store.dispatch and every call recorded. `dispatch` answers
// buildlog/fetchBuildDetail; the default answers an empty log.
function dialogHarness(state = {}, dispatch) {
  const { def } = dialog();
  const vm = new Vue({
    render: def.render,
    staticRenderFns: def.staticRenderFns,
    data: def.data,
    computed: def.computed,
    methods: def.methods,
    watch: def.watch,
    beforeDestroy: def.beforeDestroy,
    components: Object.assign({}, def.components),
  });
  const calls = { show: 0, dispatch: [] };
  vm.$refs.modal = { show: () => { calls.show++; } };
  vm.$store = {
    dispatch: (...args) => {
      calls.dispatch.push(args);
      return dispatch ? dispatch(...args) : Promise.resolve({ success: true, response: { contents: '' } });
    },
  };
  Object.assign(vm, state);
  return { vm, calls };
}

// Render a dialog vm with the given state; no Vue warning and no render error allowed.
function renderDialog(state = {}) {
  const h = dialogHarness(state);
  return { ...h, vnode: rerender(h.vm) };
}

const barOf = (vnode) => byCy(vnode, 'build-log-search-bar');
const preOf = (vnode) => one(byCy(vnode, 'full-build-log'), 'full-build-log');
const marksOf = (vnode) => byCy(vnode, 'build-log-match');
const countOf = (vnode) => one(byCy(vnode, 'build-log-search-count'), 'build-log-search-count');
const fieldOf = (vnode) => one(byCy(vnode, 'build-log-search'), 'build-log-search field');
const repeat = (word, n) => Array.from({ length: n }, () => word).join(' ');

// ---------------------------------------------------------------- S: buildLogSearch

const joined = (r) => r.segments.map((s) => s.text).join('');
const matchesOf = (r) => r.segments.filter((s) => s.match);

check('S1 plain, case-insensitive: error finds Error, error and ERROR in order, segments rebuild the text', () => {
  const input = 'Error error ERROR';
  const r = search(input, 'error');
  assert.equal(r.count, 3);
  assert.equal(r.capped, false);
  assert.deepEqual(matchesOf(r).map((s) => s.text), ['Error', 'error', 'ERROR']);
  assert.deepEqual(matchesOf(r).map((s) => s.index), [0, 1, 2]);
  assert.equal(joined(r), input);
  assert.ok(r.segments.filter((s) => !s.match).every((s) => s.match === false && s.text.length > 0), 'plain segments are non-empty and match: false');
});

check('S2 regex characters match only themselves; no term throws', () => {
  const cases = [['abc a.c', 'a.c'], ['f(x) fx', '(x)'], ['a[b] ab', 'a[b'], ['12 \\d+', '\\d+']];
  cases.forEach(([text, term]) => {
    const r = search(text, term);
    assert.equal(r.count, 1, JSON.stringify(term) + ' in ' + JSON.stringify(text));
    assert.equal(matchesOf(r)[0].text, term, 'the literal ' + term);
    assert.equal(joined(r), text);
  });
  const meta = '^$.*+?()[]{}|/\\';
  for (let i = 0; i + 3 <= meta.length; i++) {
    const term = meta.slice(i, i + 3);
    const r = search('x' + meta + 'y', term);
    assert.equal(r.count, 1, JSON.stringify(term) + ' is matched literally');
  }
  assert.equal(search('aaa', '.*.').count, 0, '.*. does not act as a pattern');
});

check('S3 thresholds: 2 characters or a blank term search nothing; 3 characters (spaces count) search', () => {
  assert.deepEqual(search('abc ab', 'ab'), { segments: [{ text: 'abc ab', match: false }], count: 0, capped: false });
  assert.deepEqual(search('a   b', '   '), { segments: [{ text: 'a   b', match: false }], count: 0, capped: false });
  assert.deepEqual(search('a\t\n b', ' \t\n'), { segments: [{ text: 'a\t\n b', match: false }], count: 0, capped: false });
  assert.equal(search('ab x ab ', 'ab ').count, 2, 'a trailing space counts as a character');
  assert.deepEqual(search('', 'abc'), { segments: [], count: 0, capped: false });
  [undefined, null, 42, {}, ['abc']].forEach((bad) => {
    assert.deepEqual(search(bad, 'abc'), { segments: [], count: 0, capped: false }, 'text ' + String(bad));
    assert.deepEqual(search('abc', bad), { segments: [{ text: 'abc', match: false }], count: 0, capped: false }, 'term ' + String(bad));
  });
});

check('S4 cap: 1000 matches are all highlighted; the 1001st sets capped and the rest stays one plain segment', () => {
  const t1000 = repeat('abc', 1000);
  const r1 = search(t1000, 'abc');
  assert.equal(r1.count, 1000);
  assert.equal(r1.capped, false);
  assert.equal(matchesOf(r1).length, 1000);
  assert.equal(joined(r1), t1000);
  const t1001 = repeat('abc', 1001) + ' tail';
  const r2 = search(t1001, 'abc');
  assert.equal(r2.count, 1000);
  assert.equal(r2.capped, true);
  assert.equal(matchesOf(r2).length, 1000);
  assert.equal(matchesOf(r2)[999].index, 999);
  assert.equal(joined(r2), t1001);
  const last = r2.segments[r2.segments.length - 1];
  assert.equal(last.match, false);
  assert.equal(last.text, ' abc tail', 'the text from the 1001st match on is one plain segment');
});

check('S5 non-overlapping, left to right: aaa in aaaaaa is 2 matches', () => {
  const r = search('aaaaaa', 'aaa');
  assert.equal(r.count, 2);
  assert.deepEqual(r.segments, [{ text: 'aaa', match: true, index: 0 }, { text: 'aaa', match: true, index: 1 }]);
});

check('S6 indices stay aligned after a character that changes length when lower-cased (U+0130)', () => {
  const input = 'İ ERROR x';
  assert.notEqual(input.toLowerCase().length, input.length, 'fixture: lower-casing changes the length');
  const r = search(input, 'error');
  assert.equal(r.count, 1);
  assert.equal(matchesOf(r)[0].text, 'ERROR');
  assert.equal(joined(r), input);
});

// ---------------------------------------------------------------- D: dialog search

check('D1 with log text the dialog renders one search bar before the log: field with addon, count with live text', () => {
  const { vnode } = renderDialog({ text: 'line one\nline two', term: 'xyz' });
  const bar = one(barOf(vnode), 'build-log-search-bar');
  assert.equal(bar.tag, 'div');
  assert.ok(classList(bar).includes('build-log-search'), 'class build-log-search');
  assert.equal(attrsOf(bar).role, 'search');
  assert.equal(attrsOf(bar)['aria-label'], LABEL);
  const top = elementsOf(vnode);
  const pre = preOf(vnode);
  assert.ok(top.indexOf(bar) !== -1 && top.indexOf(bar) < top.indexOf(pre), 'the bar comes before the log box');
  const group = one(byTag(bar, 'b-input-group'), 'b-input-group');
  assert.ok(classList(group).includes('build-log-search__field'), 'group class build-log-search__field');
  const prepend = one(byTag(group, 'b-input-group-prepend'), 'b-input-group-prepend');
  assert.ok('is-text' in attrsOf(prepend), 'prepend is-text');
  const glyph = one(byTag(prepend, 'i'), 'search glyph');
  assert.ok(classList(glyph).includes('fa') && classList(glyph).includes('fa-search'), 'fa fa-search');
  assert.equal(attrsOf(glyph)['aria-hidden'], 'true');
  const input = one(byTag(group, 'b-form-input'), 'b-form-input');
  assert.equal(cyOf(input), 'build-log-search');
  const a = attrsOf(input);
  assert.equal(a.type, 'text');
  assert.equal(a['aria-label'], LABEL);
  assert.equal(a.placeholder, PLACEHOLDER);
  assert.equal(a.autocomplete, 'off');
  assert.equal(a.spellcheck, 'false');
  assert.equal(input.data.model && input.data.model.expression, 'searchInput', 'v-model searchInput');
  const count = countOf(bar);
  assert.equal(count.tag, 'span');
  assert.ok(classList(count).includes('build-log-search__count'), 'class build-log-search__count');
  const spans = elementsOf(count);
  assert.equal(spans.length, 2, 'visible text and live text');
  assert.equal(attrsOf(spans[0])['aria-hidden'], 'true');
  assert.equal(textOf(spans[0]), 'No matches');
  assert.ok(classList(spans[1]).includes('sr-only'), 'live text is sr-only');
  assert.equal(attrsOf(spans[1])['aria-live'], 'polite');
  assert.equal(attrsOf(spans[1])['aria-atomic'], 'true');
  assert.equal(textOf(spans[1]), 'No matches');
});

check('D2 the bar is absent while loading, with an error and with no log text', () => {
  assert.equal(barOf(renderDialog({ text: 'abc', loading: true }).vnode).length, 0, 'loading');
  assert.equal(barOf(renderDialog({ text: 'abc', error: 'Could not load this build log.' }).vnode).length, 0, 'error');
  assert.equal(barOf(renderDialog({ text: '' }).vnode).length, 0, 'empty');
  assert.equal(barOf(renderDialog({ text: 'abc' }).vnode).length, 1, 'shown with text');
});

check('D3 the log box holds exactly the log text: one text node without a term, segments without added whitespace with one', () => {
  const text = '  first line\n\tsecond ERROR line  \n\nlast error\n';
  const plain = preOf(renderDialog({ text }).vnode);
  assert.equal(plain.tag, 'pre');
  assert.ok(classList(plain).includes('build-log-text'), 'class build-log-text');
  assert.equal(plain.children.length, 1, 'one child');
  assert.equal(plain.children[0].tag, undefined, 'a text node');
  assert.equal(plain.children[0].text, text);
  const short = preOf(renderDialog({ text, term: 'er' }).vnode);
  assert.equal(rawTextOf(short), text);
  assert.equal(nodesOf(short).filter((n) => n.tag && n !== short).length, 0, 'no element under a short term');
  const found = renderDialog({ text, term: 'error' }).vnode;
  assert.equal(rawTextOf(preOf(found)), text, 'segments rebuild the text exactly');
  assert.equal(marksOf(found).length, 2);
  const none = renderDialog({ text, term: 'zzz' }).vnode;
  assert.equal(preOf(none).children.length, 1, 'no hit: one plain interpolation');
  assert.equal(preOf(none).children[0].text, text);
});

check('D4 log text that looks like HTML stays text: one mark around abc, no element or innerHTML from the log', () => {
  const text = '<b>x</b> abc <script>';
  const { vnode } = renderDialog({ text, term: 'abc' });
  const mark = one(marksOf(vnode), 'build-log-match');
  assert.equal(mark.tag, 'mark');
  assert.ok(classList(mark).includes('build-log-match'), 'class build-log-match');
  assert.equal(mark.children.length, 1);
  assert.equal(mark.children[0].tag, undefined);
  assert.equal(mark.children[0].text, 'abc');
  const texts = nodesOf(preOf(vnode)).filter((n) => !n.tag).map((n) => n.text);
  assert.ok(texts.includes('<b>x</b> '), 'leading markup is a text node');
  assert.ok(texts.includes(' <script>'), 'trailing markup is a text node');
  assert.equal(nodesOf(vnode).filter((n) => n.data && n.data.domProps && 'innerHTML' in n.data.domProps).length, 0, 'no innerHTML domProp');
  ['b', 'script', 'img'].forEach((tag) => assert.equal(byTag(vnode, tag).length, 0, 'no ' + tag + ' element'));
  const { source } = dialog();
  assert.ok(!/v-html|innerHTML|outerHTML|insertAdjacentHTML|domProps/.test(source), 'no raw-HTML binding or DOM HTML property in the dialog');
});

check('D5 count and spoken count: 3 / 17, 1 / 1000+, No matches, empty under 3 characters', () => {
  const at = (text, term, current) => {
    const { vm, vnode } = renderDialog({ text, term, current });
    const spans = elementsOf(countOf(vnode));
    assert.equal(textOf(spans[0]), vm.countText, 'visible text renders countText');
    assert.equal(textOf(spans[1]), vm.countSpeech, 'live text renders countSpeech');
    return [vm.countText, vm.countSpeech];
  };
  assert.deepEqual(at(repeat('abc', 17), 'abc', 2), ['3 / 17', 'Match 3 of 17']);
  assert.deepEqual(at(repeat('abc', 1001), 'abc', 0), ['1 / 1000+', 'Match 1 of more than 1000']);
  assert.deepEqual(at(repeat('abc', 3), 'xyz', 0), ['No matches', 'No matches']);
  assert.deepEqual(at(repeat('abc', 3), 'ab', 0), ['', '']);
  assert.deepEqual(at(repeat('abc', 3), '   ', 0), ['', '']);
});

checkAsync('D6 debounce: the typed term reaches the search 200 ms after the last keystroke', async () => {
  const a = dialogHarness({ text: 'some err text' });
  a.vm.searchInput = 'err';
  await sleep(50);
  assert.equal(a.vm.term, '', 'not applied after 50 ms');
  await sleep(250);
  assert.equal(a.vm.term, 'err', 'applied after 300 ms');
  const b = dialogHarness({ text: 'abcd abc' });
  b.vm.searchInput = 'abc';
  await sleep(120);
  b.vm.searchInput = 'abcd';
  await sleep(120);
  assert.equal(b.vm.term, '', 'a second value restarts the 200 ms window');
  await sleep(150);
  assert.equal(b.vm.term, 'abcd', 'only the last value is applied');
});

checkAsync('D7 open, load, type: the log arrives, the term is applied and two matches are counted 1 / 2', async () => {
  const h = dialogHarness({}, () => Promise.resolve({ success: true, response: { contents: 'ok\nERROR one\nerror two' } }));
  await h.vm.open({ build_id: 'b1' });
  assert.equal(h.calls.show, 1, 'modal shown once');
  assert.deepEqual(h.calls.dispatch, [['buildlog/fetchBuildDetail', 'b1']]);
  assert.equal(h.vm.text, 'ok\nERROR one\nerror two');
  h.vm.searchInput = 'error';
  await sleep(300);
  const vnode = rerender(h.vm);
  assert.deepEqual(marksOf(vnode).map((m) => m.children[0].text), ['ERROR', 'error']);
  assert.equal(textOf(elementsOf(countOf(vnode))[0]), '1 / 2');
});

// ---------------------------------------------------------------- T: stepping

const stepButtonOf = (vnode, cy) => one(componentsOf(vnode, 'IconButton').filter((n) => cyOf(n) === cy), cy + ' IconButton');

// Replace a method on a vm with a recorder; the render functions and other methods call it.
function record(vm, name, impl = () => {}) {
  const calls = [];
  vm[name] = (...args) => { calls.push(args); return impl(...args); };
  return calls;
}

check('T1 the bar holds field, count, Previous match and Next match IconButtons; both disabled without a match', () => {
  const found = renderDialog({ text: 'abc abc', term: 'abc' }).vnode;
  const bar = one(barOf(found), 'build-log-search-bar');
  const blocks = elementsOf(bar);
  assert.equal(blocks.length, 4, 'four blocks in the bar');
  assert.equal(blocks[0].tag, 'b-input-group');
  assert.equal(cyOf(blocks[1]), 'build-log-search-count');
  assert.ok(isComponent(blocks[2], 'IconButton') && cyOf(blocks[2]) === 'build-log-prev', 'third: build-log-prev IconButton');
  assert.ok(isComponent(blocks[3], 'IconButton') && cyOf(blocks[3]) === 'build-log-next', 'fourth: build-log-next IconButton');
  const prev = propsOf(blocks[2]);
  const next = propsOf(blocks[3]);
  assert.equal(prev.icon, 'fa fa-chevron-left');
  assert.equal(prev.label, 'Previous match');
  assert.equal(next.icon, 'fa fa-chevron-right');
  assert.equal(next.label, 'Next match');
  assert.equal(prev.disabled, false, 'prev enabled with matches');
  assert.equal(next.disabled, false, 'next enabled with matches');
  [['xyz', 'no hit'], ['ab', 'short term'], ['', 'no term']].forEach(([term, why]) => {
    const vnode = renderDialog({ text: 'abc abc', term }).vnode;
    assert.equal(propsOf(stepButtonOf(vnode, 'build-log-prev')).disabled, true, 'prev disabled: ' + why);
    assert.equal(propsOf(stepButtonOf(vnode, 'build-log-next')).disabled, true, 'next disabled: ' + why);
  });
});

check('T2 step wraps at both ends; no match leaves current at 0; one match stays on it', () => {
  const { vm } = dialogHarness({ text: 'abc abc abc', term: 'abc', current: 2 });
  assert.equal(typeof vm.step, 'function', 'step method');
  vm.step(1);
  assert.equal(vm.current, 0, 'next on the last goes to the first');
  vm.step(-1);
  assert.equal(vm.current, 2, 'previous on the first goes to the last');
  vm.current = 0;
  vm.step(1);
  assert.equal(vm.current, 1);
  const none = dialogHarness({ text: 'abc', term: 'xyz', current: 0 }).vm;
  none.step(1);
  assert.equal(none.current, 0, 'no match: unchanged');
  none.step(-1);
  assert.equal(none.current, 0, 'no match: unchanged');
  const single = dialogHarness({ text: 'x abc y', term: 'abc', current: 0 }).vm;
  single.step(1);
  assert.equal(single.current, 0);
  single.step(-1);
  assert.equal(single.current, 0);
});

check('T3 only the current match carries build-log-match--current and aria-current="true"', () => {
  const { vnode } = renderDialog({ text: 'abc abc abc', term: 'abc', current: 1 });
  const marks = marksOf(vnode);
  assert.equal(marks.length, 3);
  marks.forEach((m, i) => {
    const current = i === 1;
    assert.equal(classList(m).includes('build-log-match--current'), current, 'mark ' + i + ' current class');
    if (current) assert.equal(attrsOf(m)['aria-current'], 'true', 'mark ' + i + ' aria-current');
    else assert.ok(attrsOf(m)['aria-current'] == null, 'mark ' + i + ' has no aria-current attribute');
    assert.ok(classList(m).includes('build-log-match'), 'mark ' + i + ' keeps build-log-match');
  });
});

const keyEvent = (key, extra = {}) => {
  const evt = { type: 'keydown', key, keyCode: { Enter: 13, Escape: 27 }[key], shiftKey: false, prevented: 0, ...extra };
  evt.preventDefault = () => { evt.prevented++; };
  return evt;
};
const keydownOf = (vnode) => {
  const on = fieldOf(vnode).data.on || {};
  assert.ok(on.keydown, 'the field has a keydown handler');
  return (evt) => (Array.isArray(on.keydown) ? on.keydown : [on.keydown]).forEach((fn) => fn(evt));
};

check('T4 Enter steps forward, Shift+Enter back, Escape is left to the modal', () => {
  const { vm } = dialogHarness({ text: 'abc abc abc', term: 'abc' });
  const steps = record(vm, 'step');
  const keydown = keydownOf(rerender(vm));
  const enter = keyEvent('Enter');
  keydown(enter);
  assert.deepEqual(steps, [[1]], 'Enter: step(1) once');
  assert.equal(enter.prevented, 1, 'Enter: preventDefault once');
  const back = keyEvent('Enter', { shiftKey: true });
  keydown(back);
  assert.deepEqual(steps, [[1], [-1]], 'Shift+Enter: step(-1)');
  assert.equal(back.prevented, 1);
  const esc = keyEvent('Escape');
  keydown(esc);
  assert.equal(steps.length, 2, 'Escape does not step');
  assert.equal(esc.prevented, 0, 'Escape is not prevented');
});

checkAsync('T5 Enter while the debounce is pending applies the term at once and does not step', async () => {
  const { vm } = dialogHarness({ text: 'xx error yy error' });
  vm.searchInput = 'error';
  await tick();
  assert.ok(vm.debounceTimer, 'debounce pending');
  assert.equal(vm.term, '');
  const steps = record(vm, 'step');
  const original = vm.$options.methods.applyTerm;
  const applied = record(vm, 'applyTerm', () => original.call(vm));
  vm.current = 1;
  keydownOf(rerender(vm))(keyEvent('Enter'));
  assert.equal(vm.term, 'error', 'term applied at once');
  assert.equal(vm.current, 0, 'first match selected');
  assert.equal(steps.length, 0, 'no step');
  assert.equal(applied.length, 1, 'applied once');
  assert.equal(vm.debounceTimer, null, 'timer cleared');
  await sleep(300);
  assert.equal(applied.length, 1, 'no later timer applies the term again');
  assert.equal(vm.term, 'error');
});

check('T6 scrollToCurrent centres the current mark by setting only the log box scrollTop', () => {
  const { vm } = dialogHarness({ text: 'abc', term: 'abc' });
  assert.equal(typeof vm.scrollToCurrent, 'function', 'scrollToCurrent method');
  const selectors = [];
  let intoView = 0;
  const mark = { offsetTop: 500, offsetHeight: 20, scrollIntoView: () => { intoView++; } };
  const log = { clientHeight: 100, scrollTop: 0, querySelector: (sel) => { selectors.push(sel); return mark; } };
  vm.$refs.log = log;
  vm.scrollToCurrent();
  assert.equal(log.scrollTop, 460, '500 - (100 - 20) / 2');
  assert.deepEqual(selectors, ['.build-log-match--current'], 'queries the current mark only');
  assert.equal(intoView, 0, 'the element scroll-into-view API is not used');
  const empty = { clientHeight: 100, scrollTop: 37, querySelector: () => null };
  vm.$refs.log = empty;
  vm.scrollToCurrent();
  assert.equal(empty.scrollTop, 37, 'no current mark: scrollTop unchanged');
  vm.$refs.log = undefined;
  vm.scrollToCurrent();
});

checkAsync('T7 a change of term, of text, or a step scrolls on a following tick, never synchronously', async () => {
  const { vm } = dialogHarness({ text: 'abc abc abc' });
  await tick();
  const scrolls = record(vm, 'scrollToCurrent');
  vm.term = 'abc';
  assert.equal(scrolls.length, 0, 'term: not synchronous');
  await tick(); await tick();
  assert.ok(scrolls.length >= 1, 'term: scrolled after the tick');
  scrolls.length = 0;
  vm.text = 'abc abc abc abc';
  assert.equal(scrolls.length, 0, 'text: not synchronous');
  await tick(); await tick();
  assert.ok(scrolls.length >= 1, 'text: scrolled after the tick');
  scrolls.length = 0;
  vm.step(1);
  assert.equal(scrolls.length, 0, 'step: not synchronous');
  await tick(); await tick();
  assert.ok(scrolls.length >= 1, 'step: scrolled after the tick');
});

check('T8 a click on Next match steps forward and on Previous match steps back', () => {
  const { vm } = dialogHarness({ text: 'abc abc', term: 'abc' });
  const steps = record(vm, 'step');
  const vnode = rerender(vm);
  click(stepButtonOf(vnode, 'build-log-next'));
  assert.deepEqual(steps, [[1]]);
  click(stepButtonOf(vnode, 'build-log-prev'));
  assert.deepEqual(steps, [[1], [-1]]);
});

// ---------------------------------------------------------------- L: lifecycle and states

const snapshot = (vm) => ({ buildId: vm.buildId, text: vm.text, error: vm.error, searchInput: vm.searchInput, term: vm.term, loading: vm.loading });

checkAsync('L1 open() without a non-empty string build_id resolves without showing, loading or changing state', async () => {
  const bad = [{ build_id: '' }, { id: '0' }, {}, null, undefined, { build_id: 42 }, { build_id: null, id: 'x' }];
  for (const build of bad) {
    const h = dialogHarness({ buildId: 'keep', text: 'kept log', error: null, searchInput: 'abc', term: 'abc' });
    const before = snapshot(h.vm);
    let result;
    assert.doesNotThrow(() => { result = h.vm.open(build); }, 'open(' + JSON.stringify(build) + ') does not throw');
    assert.ok(result && typeof result.then === 'function', 'open(' + JSON.stringify(build) + ') returns a promise');
    await result;
    assert.equal(h.calls.show, 0, 'modal not shown for ' + JSON.stringify(build));
    assert.deepEqual(h.calls.dispatch, [], 'no fetchBuildDetail for ' + JSON.stringify(build));
    assert.deepEqual(snapshot(h.vm), before, 'state unchanged for ' + JSON.stringify(build));
  }
});

checkAsync('L2 a valid open() resets the search, cancels the debounce, shows the modal and loads that build', async () => {
  const h = dialogHarness({ buildId: 'old', text: 'old log', error: 'x' }, () => Promise.resolve({ success: true, response: { contents: 'new log abc' } }));
  await tick();
  Object.assign(h.vm, { searchInput: 'abc', term: 'abc', current: 4 });
  await tick();
  clearTimeout(h.vm.debounceTimer);
  let fired = 0;
  h.vm.debounceTimer = setTimeout(() => { fired++; h.vm.term = 'late'; }, 50);
  const done = h.vm.open({ build_id: 'b1', id: '7' });
  assert.equal(h.vm.searchInput, '', 'searchInput reset');
  assert.equal(h.vm.term, '', 'term reset');
  assert.equal(h.vm.current, 0, 'current reset');
  assert.equal(h.vm.buildId, 'b1');
  assert.equal(h.vm.text, '', 'text cleared');
  assert.equal(h.vm.error, null, 'error cleared');
  assert.equal(h.calls.show, 1, 'modal shown once');
  assert.deepEqual(h.calls.dispatch, [['buildlog/fetchBuildDetail', 'b1']], 'loads build_id, not the list id');
  assert.equal(attrsOf(rerender(h.vm)).title, 'Build Log — b1');
  await done;
  await sleep(120);
  assert.equal(fired, 0, 'the pending debounce was cancelled');
  assert.equal(h.vm.term, '');
  assert.equal(h.vm.text, 'new log abc');
});

checkAsync('L3 Try again (load) keeps the term; the first match is selected when the text arrives', async () => {
  const h = dialogHarness({ buildId: 'b1', text: '', error: 'Could not load this build log.' }, () => Promise.resolve({ success: true, response: { contents: 'abc abc abc' } }));
  Object.assign(h.vm, { searchInput: 'abc', term: 'abc' });
  await tick();
  h.vm.current = 2;
  await h.vm.load();
  await tick();
  assert.equal(h.vm.searchInput, 'abc', 'searchInput kept');
  assert.equal(h.vm.term, 'abc', 'term kept');
  assert.equal(h.vm.text, 'abc abc abc');
  assert.equal(h.vm.current, 0, 'first match selected');
  assert.equal(h.vm.result.count, 3);
});

checkAsync('L4 onHidden drops the pending request, resets loading and cancels the debounce; the modal binds it', async () => {
  const h = dialogHarness({ text: 'abc', loading: true, requestId: 5 });
  assert.equal(typeof h.vm.onHidden, 'function', 'onHidden method');
  let fired = 0;
  h.vm.debounceTimer = setTimeout(() => { fired++; h.vm.term = 'late'; }, 50);
  h.vm.onHidden();
  assert.equal(h.vm.requestId, 6);
  assert.equal(h.vm.loading, false);
  assert.equal(h.vm.debounceTimer, null);
  await sleep(300);
  assert.equal(fired, 0, 'the debounce was cancelled');
  assert.equal(h.vm.term, '');
  const modal = rerender(h.vm);
  assert.equal(modal.tag, 'b-modal');
  assert.equal(modal.data.on && modal.data.on.hidden, h.vm.onHidden, '@hidden="onHidden"');
  const d = deferred();
  const late = dialogHarness({ buildId: 'b1' }, () => d.promise);
  const pending = late.vm.load();
  late.vm.onHidden();
  d.resolve({ success: true, response: { contents: 'stale' } });
  await pending;
  assert.equal(late.vm.text, '', 'a response after close is dropped');
  assert.equal(late.vm.loading, false);
});

check('L5 exactly one state renders: loading line, error with Try again, log box, or the empty line', () => {
  const states = (vnode) => ({
    loading: nodesOf(vnode).filter((n) => n.tag === 'div' && attrsOf(n).role === 'status').length,
    error: byCy(vnode, 'build-log-error').length,
    log: byCy(vnode, 'full-build-log').length,
    empty: byCy(vnode, 'build-log-empty').length,
  });
  const loading = renderDialog({ loading: true }).vnode;
  assert.deepEqual(states(loading), { loading: 1, error: 0, log: 0, empty: 0 });
  const status = nodesOf(loading).find((n) => n.tag === 'div' && attrsOf(n).role === 'status');
  assert.equal(byTag(status, 'b-spinner').length, 1, 'spinner');
  assert.equal(textOf(status), 'Loading build log' + ELLIPSIS);

  const h = dialogHarness({ error: 'Could not load this build log.' });
  const loads = record(h.vm, 'load');
  const errVnode = rerender(h.vm);
  assert.deepEqual(states(errVnode), { loading: 0, error: 1, log: 0, empty: 0 });
  const alert = one(byCy(errVnode, 'build-log-error'), 'build-log-error');
  assert.equal(alert.tag, 'b-alert');
  assert.equal(attrsOf(alert).variant, 'danger');
  assert.ok(textOf(alert).startsWith('Could not load this build log.'), 'error copy');
  const retry = one(byCy(alert, 'build-log-retry'), 'build-log-retry');
  assert.equal(retry.tag, 'b-button');
  assert.equal(attrsOf(retry).variant, 'default');
  assert.equal(attrsOf(retry).size, 'sm');
  const glyph = one(byTag(retry, 'i'), 'refresh glyph');
  assert.ok(classList(glyph).includes('fa') && classList(glyph).includes('fa-refresh'), 'fa fa-refresh');
  assert.equal(attrsOf(glyph)['aria-hidden'], 'true');
  const label = one(byClass(retry, 'button-text'), 'button-text');
  assert.equal(label.tag, 'span');
  assert.equal(textOf(label), 'Try again');
  click(retry);
  assert.equal(loads.length, 1, 'Try again calls load');

  assert.deepEqual(states(renderDialog({ text: 'log' }).vnode), { loading: 0, error: 0, log: 1, empty: 0 });

  const emptyVnode = renderDialog({ text: '' }).vnode;
  assert.deepEqual(states(emptyVnode), { loading: 0, error: 0, log: 0, empty: 1 });
  const empty = one(byCy(emptyVnode, 'build-log-empty'), 'build-log-empty');
  assert.equal(empty.tag, 'p');
  assert.ok(classList(empty).includes('mb-0'), 'mb-0');
  assert.ok(!classList(empty).includes('text-muted'), 'body colour, not muted');
  assert.equal(textOf(empty), 'No log output is available for this build yet.');
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

check('C1 compiled theme: the log box and both highlights use the build-log tokens', () => {
  expectDecls('.build-log-text', {
    position: 'relative',
    'max-height': '70vh',
    overflow: 'auto',
    margin: '0',
    padding: '16px',
    'white-space': 'pre-wrap',
    'overflow-wrap': 'anywhere',
    'line-height': '1.5',
    background: '#1e1e1e',
    color: '#ddd',
  });
  expectDecls('.build-log-text .build-log-match', {
    padding: '0',
    'border-radius': '0',
    font: 'inherit',
    'background-color': '#806600',
    color: '#fff',
  });
  expectDecls('.build-log-text .build-log-match--current', {
    'background-color': '#ffc94d',
    color: '#1e1e1e',
  });
});

check('C2 compiled theme: the sticky search bar on the modal surface, field, count and step-button spacing', () => {
  const modalBg = value(decls('.modal-content'), 'background-color');
  assert.ok(modalBg, '.modal-content has a background-color');
  expectDecls('.build-log-search', {
    display: 'flex',
    'flex-wrap': 'wrap',
    'align-items': 'center',
    gap: '8px',
    'padding-bottom': '8px',
    position: 'sticky',
    top: '0',
    'z-index': '1',
    'background-color': modalBg,
  });
  expectDecls('.build-log-search__field', { flex: '1 1 200px', 'max-width': '320px', width: 'auto' });
  expectDecls('.build-log-search__count', {
    'min-width': '88px',
    'white-space': 'nowrap',
    'font-size': '.875rem',
    'font-weight': '400',
    'font-variant-numeric': 'tabular-nums',
  });
  expectDecls('.build-log-search .icon-button', { 'margin-right': '0' });
});

check('C3 sources: six !default tokens, one build-log import after settings-pages, no local styles or forbidden strings', () => {
  const variables = read('styles/_variables.scss');
  const tokens = {
    'build-log-bg': '#1E1E1E',
    'build-log-color': '#DDDDDD',
    'build-log-match-bg': '#806600',
    'build-log-match-color': '#FFFFFF',
    'build-log-current-bg': '#FFC94D',
    'build-log-current-color': '#1E1E1E',
  };
  Object.keys(tokens).forEach((name) => {
    const re = new RegExp('^\\$' + name + ':\\s*' + tokens[name] + '\\s*!default;', 'm');
    assert.ok(re.test(variables), '$' + name + ': ' + tokens[name] + ' !default');
  });
  const theme = read('styles/theme.scss').split('\n').map((l) => l.trim());
  assert.equal(theme.filter((l) => l === "@import 'build-log';").length, 1, 'build-log imported once');
  assert.equal(theme[theme.indexOf("@import 'settings-pages';") + 1], "@import 'build-log';", 'right after settings-pages');
  assert.ok(fs.existsSync(path.join(SRC, 'styles/_build-log.scss')), '_build-log.scss exists');
  const { source } = dialog();
  // 47-REVIEW IN-03: the search field has no template ref (nothing reads it).
  ['<style', 'build.id', 'text-muted', '>Retry<', 'v-html', 'innerHTML', '#1e1e1e', '#ddd', 'console.', 'ref="searchInput"'].forEach((s) => {
    assert.ok(!source.includes(s), 'BuildLogDialog.vue has no ' + s);
  });
});

check('V7 compiled theme: .build-actions spaces View and Download 8px apart on one line', () => {
  expectDecls('.build-actions', { display: 'inline-flex', 'align-items': 'center', gap: '8px' });
});

// ---------------------------------------------------------------- V: dashboard Recent Builds card

// A component stub that keeps its name, so the render tree can be searched for it.
const namedStub = (name) => ({ name, render: (h) => h('div') });

const visits = lazy(() => loadSfc('pages/Visits/Visits.vue', {
  buildStatusVariant: logUtils().buildStatusVariant,
  hasBuildLog: logUtils().hasBuildLog,
  CheckinsTimeline: namedStub('CheckinsTimeline'),
  hostnameMixin: {},
  BuildLogDialog: namedStub('BuildLogDialog'),
}));

// The store getters the page's computed properties and loadData call (mapGetters is stubbed).
const VISITS_GETTERS = {
  getTimeline: () => null,
  getStats: () => null,
  getToday: () => null,
  getDevices: () => [],
  getAudit: () => [],
  getBuildLog: () => [],
  getProfile: () => ({}),
};

// Render the dashboard with loading false; no Vue warning and no render error allowed.
function renderVisits(state = {}) {
  const { def } = visits();
  const page = renderPage(Object.assign({}, def, { methods: Object.assign({}, def.methods, VISITS_GETTERS) }), state);
  assert.equal(page.error, null, 'Visits renders without error');
  assert.deepEqual(page.warnings, [], 'Visits renders without Vue warnings');
  return page;
}

const visitBuilds = () => [
  { build_id: 'b1', status: 'OK', name: 'zephyr-01', udid: 'udid-zephyr', date: Date.UTC(2026, 9, 14, 12) },
  { build_id: '', status: 'FAILED', udid: 'udid-x', date: Date.UTC(2026, 9, 14, 11) },
];

// One row per candidate build_id (47-REVIEW WR-01): only the non-empty string counts as a
// build log; '', a missing key, null, numbers, true, an object and an array never do.
const NO_KEY = {};
const idRows = () => ['b1', '', NO_KEY, null, 0, 42, true, { id: 'x' }, ['b1']].map((id, i) => Object.assign(
  { name: 'n' + i, udid: 'udid-n' + i, date: Date.UTC(2026, 9, 14, 12) - i * 60000, status: 'FAILED', log: [] },
  id === NO_KEY ? {} : { build_id: id },
));
const shown = (v) => (v === undefined ? 'undefined' : JSON.stringify(v));
const predicate = () => {
  const fn = logUtils().hasBuildLog;
  assert.equal(typeof fn, 'function', 'hasBuildLog is exported from utils/buildLog.js');
  return fn;
};

const buildsCardOf = (vnode) => one(byCy(vnode, 'recent-builds'), 'recent-builds card');
const rowsOf = (card) => byTag(one(byTag(card, 'tbody'), 'tbody'), 'tr');
const lastCellOf = (row) => { const cells = elementsOf(row); return cells[cells.length - 1]; };
const hasListener = (n) => {
  const d = n.data || {};
  return Object.keys(d.on || {}).length > 0 || Object.keys(d.nativeOn || {}).length > 0
    || !!(n.componentOptions && Object.keys(n.componentOptions.listeners || {}).length);
};
const isInert = (n) => !hasListener(n) && !('tabindex' in attrsOf(n)) && !('role' in attrsOf(n));

check('V1 the dashboard Recent Builds card has the columns Time, Device, Status, Actions', () => {
  const card = buildsCardOf(renderVisits({ buildItems: visitBuilds() }).vnode);
  assert.deepEqual(byTag(card, 'th').map(textOf), ['Time', 'Device', 'Status', 'Actions']);
  assert.equal(rowsOf(card).length, 2, 'one row per build');
});

check('V2 a row with a build id: View (link, p-0, eye, aria-label) then Download inside .build-actions in .actions-cell', () => {
  const card = buildsCardOf(renderVisits({ buildItems: visitBuilds() }).vnode);
  const cell = lastCellOf(rowsOf(card)[0]);
  assert.equal(cell.tag, 'td');
  assert.ok(classList(cell).includes('actions-cell'), 'td.actions-cell');
  const wrap = one(elementsOf(cell), 'element in the actions cell');
  assert.equal(wrap.tag, 'span');
  assert.ok(classList(wrap).includes('build-actions'), 'span.build-actions');
  const [view, download, ...rest] = elementsOf(wrap);
  assert.equal(rest.length, 0, 'two buttons in .build-actions');
  assert.equal(view && view.tag, 'b-button');
  assert.equal(cyOf(view), 'build-open-log', 'View comes first');
  const a = attrsOf(view);
  assert.equal(a.size, 'sm');
  assert.equal(a.variant, 'link');
  assert.ok(classList(view).includes('p-0'), 'View has p-0');
  assert.equal(a['aria-label'], 'View build log b1');
  assert.equal(textOf(view), 'View');
  assert.ok(a['aria-label'].startsWith(textOf(view)), 'the aria-label starts with the visible text (WCAG 2.5.3)');
  const eye = one(byTag(view, 'i'), 'eye glyph');
  assert.ok(classList(eye).includes('la') && classList(eye).includes('la-eye'), 'la la-eye');
  assert.equal(attrsOf(eye)['aria-hidden'], 'true');
  assert.ok(!textOf(view).includes('b1'), 'the build id is only in the aria-label, not the visible text');
  assert.equal(download && download.tag, 'b-button');
  assert.equal(cyOf(download), 'build-download', 'Download comes second');
  assert.equal(attrsOf(download).variant, 'primary');
  assert.equal(textOf(download), 'Download');
});

check('V3 a row without a build id: the No build log placeholder, no View, no Download, nothing interactive', () => {
  const card = buildsCardOf(renderVisits({ buildItems: visitBuilds() }).vnode);
  const cell = lastCellOf(rowsOf(card)[1]);
  const holder = one(byCy(cell, 'build-no-log'), 'build-no-log placeholder');
  assert.equal(holder.tag, 'span');
  const [dash, sr, ...rest] = elementsOf(holder);
  assert.equal(rest.length, 0, 'two spans in the placeholder');
  assert.equal(attrsOf(dash)['aria-hidden'], 'true');
  assert.equal(textOf(dash), '—');
  assert.ok(classList(sr).includes('sr-only'), 'screen-reader text');
  assert.equal(textOf(sr), 'No build log');
  assert.equal(byCy(cell, 'build-open-log').length, 0, 'no View');
  assert.equal(byCy(cell, 'build-download').length, 0, 'no Download');
  nodesOf(cell).filter((n) => n.tag).forEach((n) => assert.ok(isInert(n), n.tag + ' has no listener, tabindex or role'));
});

check('V4 the time cell is text-nowrap without inline style; no muted text in the card; rows are inert; empty line', () => {
  const card = buildsCardOf(renderVisits({ buildItems: visitBuilds() }).vnode);
  rowsOf(card).forEach((row, i) => {
    const time = elementsOf(row)[0];
    assert.ok(classList(time).includes('text-nowrap'), 'row ' + i + ' time cell text-nowrap');
    assert.ok(!time.data.staticStyle && !time.data.style, 'row ' + i + ' time cell has no inline style');
    assert.ok(isInert(row), 'row ' + i + ' has no listener, tabindex or role');
  });
  assert.equal(byClass(card, 'text-muted').length, 0, 'no text-muted in the card');
  const empty = buildsCardOf(renderVisits({ buildItems: [] }).vnode);
  assert.equal(byTag(empty, 'table').length, 0, 'no table without builds');
  const line = elementsOf(empty).find((n) => textOf(n) === 'No builds yet.');
  assert.ok(line, 'No builds yet. line');
  assert.ok(!classList(line).includes('text-muted'), 'the empty line is body colour');
  assert.equal(byClass(empty, 'text-muted').length, 0, 'no text-muted in the empty card');
});

check('V5 one BuildLogDialog with ref buildLogDialog, also while loading; View hands its own row to open()', () => {
  const { vm, vnode } = renderVisits({ buildItems: visitBuilds() });
  const dlg = one(componentsOf(vnode, 'BuildLogDialog'), 'BuildLogDialog');
  assert.equal(dlg.data.ref, 'buildLogDialog');
  const loadingPage = renderVisits({ loading: true, buildItems: visitBuilds() }).vnode;
  assert.equal(componentsOf(loadingPage, 'BuildLogDialog').length, 1, 'the dialog is outside the loading branch');
  const opened = [];
  vm.$refs.buildLogDialog = { open: (b) => { opened.push(b); return Promise.resolve(); } };
  click(one(byCy(buildsCardOf(vnode), 'build-open-log'), 'build-open-log'));
  assert.equal(opened.length, 1, 'open() called once');
  assert.equal(opened[0], vm.buildItems[0], 'open() receives the same row object');
});

// The real store module: fetchBuildDetail runs with an $api recorder (logPaging inlined).
const buildlogStore = lazy(() => loadModule('store/buildlog.js', (s) => read('store/logPaging.js').replace(/^export /gm, '') + '\n' + s.replace('export default', 'export const store =')).store);

checkAsync('V6 end to end: View on a row with a build id makes one GET /logs/build/b1; a row without one makes none', async () => {
  const store = buildlogStore();
  assert.equal(typeof store.actions.fetchBuildDetail, 'function', 'fetchBuildDetail action');
  const run = async (row) => {
    const gets = [];
    const $api = { $get: (p) => { gets.push(p); return Promise.resolve({ success: true, response: { contents: 'log for ' + p } }); } };
    const h = dialogHarness({}, (action, payload) => store.actions[action.split('/')[1]].call({ $api }, {}, payload));
    const { vm } = renderVisits({ buildItems: visitBuilds() });
    vm.$refs.buildLogDialog = h.vm;
    assert.equal(typeof vm.openBuildLog, 'function', 'Visits has openBuildLog');
    await vm.openBuildLog(row);
    await tick();
    await tick();
    return { gets, show: h.calls.show, text: h.vm.text };
  };
  const [withId, withoutId] = visitBuilds();
  const a = await run(withId);
  assert.deepEqual(a.gets, ['/logs/build/b1'], 'one GET for b1');
  assert.equal(a.show, 1, 'modal shown once');
  assert.equal(a.text, 'log for /logs/build/b1');
  const b = await run(withoutId);
  assert.deepEqual(b.gets, [], 'no request without a build id');
  assert.equal(b.show, 0, 'the modal stays closed');
});

check('V8 dashboard agreement: View and Download exactly when hasBuildLog(row), the placeholder otherwise', () => {
  const has = predicate();
  const { vm, vnode } = renderVisits({ buildItems: idRows() });
  const rows = rowsOf(buildsCardOf(vnode));
  assert.equal(rows.length, 9, 'one row per candidate build id');
  rows.forEach((row, i) => {
    const item = vm.buildItems[i];
    const what = 'row ' + i + ' (build_id ' + shown(item.build_id) + ')';
    const cell = lastCellOf(row);
    if (has(item)) {
      one(byCy(cell, 'build-open-log'), what + ' View');
      one(byCy(cell, 'build-download'), what + ' Download');
      assert.equal(byCy(cell, 'build-no-log').length, 0, what + ' has no placeholder');
    } else {
      assert.equal(byCy(cell, 'build-open-log').length, 0, what + ' has no View');
      assert.equal(byCy(cell, 'build-download').length, 0, what + ' has no Download');
      one(byCy(cell, 'build-no-log'), what + ' placeholder');
      nodesOf(cell).filter((n) => n.tag).forEach((n) => assert.ok(isInert(n), what + ' ' + n.tag + ' has no listener, tabindex or role'));
    }
  });
});

// ---------------------------------------------------------------- P: the shared build log predicate

check('P1 hasBuildLog is true only for a non-empty string build_id and always returns a boolean', () => {
  const has = predicate();
  assert.strictEqual(has({ build_id: 'b1' }), true, '{ build_id: b1 }');
  const no = [{ build_id: '' }, {}, null, undefined, { build_id: 0 }, { build_id: 42 }, { build_id: true },
    { build_id: { id: 'x' } }, { build_id: ['b1'] }, { build_id: null, id: 'x' }, { id: '0' }, 'b1'];
  no.forEach((b) => assert.strictEqual(has(b), false, shown(b) + ' has no build log'));
});

checkAsync('P2 open() agrees with hasBuildLog: modal and one fetchBuildDetail exactly for rows that pass it', async () => {
  const has = predicate();
  for (const row of [...idRows(), null, undefined, { id: '0' }]) {
    const what = shown(row);
    const h = dialogHarness({ buildId: 'keep', text: 'kept log', error: null, searchInput: 'abc', term: 'abc' });
    const before = snapshot(h.vm);
    let result;
    assert.doesNotThrow(() => { result = h.vm.open(row); }, 'open(' + what + ') does not throw');
    assert.ok(result && typeof result.then === 'function', 'open(' + what + ') returns a promise');
    await result;
    if (has(row)) {
      assert.equal(h.calls.show, 1, 'modal shown once for ' + what);
      assert.deepEqual(h.calls.dispatch, [['buildlog/fetchBuildDetail', row.build_id]], 'one fetchBuildDetail for ' + what);
    } else {
      assert.equal(h.calls.show, 0, 'modal not shown for ' + what);
      assert.deepEqual(h.calls.dispatch, [], 'no fetchBuildDetail for ' + what);
      assert.deepEqual(snapshot(h.vm), before, 'state unchanged for ' + what);
    }
  }
});

// ---------------------------------------------------------------- N: navbar rows and the status mapping

const notifications = lazy(() => loadSfc('components/Notifications/Notifications.vue', {
  BuildLogDialog: namedStub('BuildLogDialog'),
  buildStatusVariant: logUtils().buildStatusVariant,
  hasBuildLog: logUtils().hasBuildLog,
  Vue,
}));

const navBuilds = () => [
  { build_id: 'b1', status: 'OK', date: 3 },
  { build_id: '', status: 'TIMEOUT', date: 2, udid: 'udid-abcdefgh' },
  { build_id: 'b3', status: '', date: 1, name: 'n3' },
];

// Render the navbar list; openBuildLog is replaced with a recorder before the render.
function renderNav(buildItems = navBuilds()) {
  const { def } = notifications();
  const vm = new Vue({
    render: def.render,
    staticRenderFns: def.staticRenderFns,
    data: def.data,
    computed: def.computed,
    methods: def.methods,
    components: Object.assign({}, def.components),
  });
  Object.assign(vm, { loading: false, buildItems });
  const opened = record(vm, 'openBuildLog');
  const vnode = rerender(vm);
  const rows = byCy(vnode, 'recent-build');
  return { vm, vnode, rows, opened };
}

check('N1 navbar rows: buttons with a click listener only with a build id; a row without one is static and inert', () => {
  const { vm, rows, opened } = renderNav();
  assert.equal(rows.length, 3, 'three recent-build rows');
  rows.forEach((row) => assert.equal(row.tag, 'b-list-group-item'));
  const [b1, idless, b3] = rows;
  [[b1, 0], [b3, 2]].forEach(([row, i]) => {
    assert.ok(attrsOf(row).button, 'row ' + i + ' has a truthy button attribute');
    click(row);
    assert.equal(opened[opened.length - 1][0], vm.recentBuilds[i], 'row ' + i + ' opens its own build');
  });
  assert.equal(opened.length, 2, 'two opens');
  assert.ok(!attrsOf(idless).button, 'the row without a build id has no button attribute');
  assert.ok(!hasListener(idless), 'the row without a build id has no listener (on and nativeOn empty)');
  assert.ok(!('tabindex' in attrsOf(idless)), 'no tabindex');
  assert.ok(!('role' in attrsOf(idless)), 'no role');
  assert.ok(classList(idless).includes('listGroupItem') && classList(idless).includes('listGroupItem--static'), 'listGroupItem listGroupItem--static');
  [b1, b3].forEach((row, i) => assert.ok(!classList(row).includes('listGroupItem--static'), 'button row ' + i + ' is not static'));
});

check('N2 navbar row markup: no h6 or p; one title span and one meta span holding the status and short udid', () => {
  const { vm, rows } = renderNav();
  const titles = ['—', 'udid-abc...', 'n3'];
  rows.forEach((row, i) => {
    assert.equal(byTag(row, 'h6').length + byTag(row, 'p').length, 0, 'row ' + i + ' has no h6 or p');
    const title = one(byClass(row, 'notification-title'), 'notification-title');
    assert.equal(title.tag, 'span');
    assert.ok(classList(title).includes('text-ellipsis'), 'title text-ellipsis');
    assert.equal(textOf(title), titles[i]);
    const meta = one(byClass(row, 'notification-meta'), 'notification-meta');
    assert.equal(meta.tag, 'span');
    assert.ok(classList(meta).includes('deemphasize') && classList(meta).includes('text-ellipsis'), 'meta deemphasize text-ellipsis');
    const status = elementsOf(meta)[0];
    assert.ok(classList(status).includes(vm.statusTextClass(vm.recentBuilds[i])), 'meta starts with the coloured status');
  });
  assert.equal(textOf(byClass(rows[1], 'notification-meta')[0]), 'TIMEOUT · udid-abc...');
});

check('N3 a missing status reads an em dash with the danger circle and the cross glyph', () => {
  const { rows } = renderNav();
  const meta = one(byClass(rows[2], 'notification-meta'), 'notification-meta');
  assert.equal(textOf(elementsOf(meta)[0]), '—');
  const icon = one(byClass(rows[2], 'circle'), 'status circle');
  assert.equal(classList(icon).join(' '), 'circle circle-lg bg-danger');
  assert.equal(classList(one(byTag(icon, 'i'), 'status glyph')).join(' '), 'fa fa-times text-white');
});

const STATUS_VARIANTS = [['OK', 'success', 'fa-check'], ['TIMEOUT', 'warning', 'fa-clock-o'], ['RUNNING', 'info', 'fa-circle-o-notch'], ['FAILED', 'danger', 'fa-times']];
const LIST_FILES = ['pages/Visits/Visits.vue', 'components/Notifications/Notifications.vue', 'pages/History/History.vue', 'pages/Devices/DeviceDetail.vue'];
const history = lazy(() => loadSfc('pages/History/History.vue', {
  BuildLogDialog: namedStub('BuildLogDialog'),
  normPaging: (p) => p,
  buildStatusVariant: logUtils().buildStatusVariant,
  hasBuildLog: logUtils().hasBuildLog,
}));
const deviceDetail = lazy(() => loadSfc('pages/Devices/DeviceDetail.vue', {
  BuildLogDialog: namedStub('BuildLogDialog'),
  moment: () => ({ fromNow: () => '' }),
  parseEnvironmentJSON: () => ({ ok: true }),
  buildStatusVariant: logUtils().buildStatusVariant,
  hasBuildLog: logUtils().hasBuildLog,
  confirmLeave: async () => true,
}));
const regionOf = (source, start, end) => {
  const at = source.indexOf(start);
  assert.ok(at !== -1, 'region start ' + start);
  const stop = source.indexOf(end, at);
  assert.ok(stop !== -1, 'region end ' + end);
  return source.slice(at, stop + end.length);
};

check('N4 status mapping lock: OK, TIMEOUT, RUNNING, FAILED are success, warning, info, danger on all four lists', () => {
  const { vm } = renderNav();
  STATUS_VARIANTS.forEach(([status, v, glyph]) => {
    const b = { status };
    assert.equal(vm.statusIconClass(b), 'circle circle-lg bg-' + v, 'navbar circle ' + status);
    assert.equal(vm.statusTextClass(b), 'text-' + v, 'navbar text ' + status);
    assert.equal(vm.statusGlyph(b), 'fa ' + glyph + ' text-white', 'navbar glyph ' + status);
  });
  const builds = STATUS_VARIANTS.map(([status], i) => ({ build_id: 'b' + i, status, name: 'd' + i }));
  const card = buildsCardOf(renderVisits({ buildItems: builds }).vnode);
  assert.deepEqual(byTag(card, 'b-badge').map((n) => attrsOf(n).variant), STATUS_VARIANTS.map((s) => s[1]), 'dashboard badges');
  [['History', history(), 'data-cy="build-row"', '</tr>'], ['DeviceDetail', deviceDetail(), 'data-cy="card-build-history"', '</b-card>']].forEach(([name, page, start, end]) => {
    assert.equal(page.def.methods.buildStatusVariant, logUtils().buildStatusVariant, name + ' uses the shared helper');
    STATUS_VARIANTS.forEach(([status, v]) => assert.equal(page.def.methods.buildStatusVariant(status), v, name + ' ' + status));
    const badges = regionOf(page.source, start, end).match(/<b-badge\b[^>]*>/g) || [];
    assert.equal(badges.length, 1, name + ' has one build status badge');
    assert.ok(badges[0].includes(':variant="buildStatusVariant('), name + ' badge binds buildStatusVariant');
  });
});

check('N5 sources: no OK comparison or literal badge variant on any list; no OK-only helper, h6, p or UNKNOWN in the navbar rows', () => {
  LIST_FILES.forEach((rel) => {
    const source = read(rel);
    assert.ok(!/===? *'OK'/.test(source), rel + ' compares no status with OK');
    assert.ok(!/<b-badge[^>]* variant="/.test(source), rel + ' gives no b-badge a literal variant');
  });
  const { source, def } = notifications();
  assert.ok(!('isSuccess' in def.methods), 'no isSuccess method');
  assert.ok(!source.includes('isSuccess'), 'no isSuccess in the source');
  assert.ok(!source.includes("'UNKNOWN'"), 'no UNKNOWN status word');
  const loop = regionOf(source, 'v-for="build in recentBuilds"', '</b-list-group-item>');
  assert.ok(!/<h6\b|<p\b/.test(loop), 'no h6 or p inside the row loop');
});

const notificationRules = lazy(() => cssRules(sass.compile(path.join(SRC, 'components/Notifications/Notifications.scss'), {
  style: 'compressed',
  quietDeps: true,
  logger: sass.Logger.silent,
}).css));

function expectRule(rules, selector, want) {
  const target = loose(selector);
  const bodies = rules.filter((r) => r.media === '' && r.selectors.some((s) => loose(s) === target)).map((r) => r.body);
  assert.ok(bodies.length, selector + ' has a rule');
  Object.keys(want).forEach((p) => assert.equal(value(bodies, p), want[p], selector + ' ' + p));
}

check('N6 compiled Notifications.scss: title and meta lines, static rows without pointer or hover highlight', () => {
  const rules = notificationRules();
  expectRule(rules, '.notification-title', { display: 'block', 'margin-bottom': '4px', 'font-size': '1rem', 'font-weight': '300' });
  expectRule(rules, '.notification-meta', { display: 'block', 'font-size': '.875rem', 'font-weight': '400' });
  expectRule(rules, '.listGroupItem.listGroupItem--static', { cursor: 'default' });
  // Compressed Dart Sass writes transparent as rgba(0,0,0,0); both are the same colour.
  const hover = rules.filter((r) => r.media === '' && r.selectors.some((s) => loose(s) === '.listGroupItem.listGroupItem--static:hover')).map((r) => r.body);
  assert.ok(hover.length, '.listGroupItem.listGroupItem--static:hover has a rule');
  assert.ok(['transparent', 'rgba(0,0,0,0)'].includes(value(hover, 'background-color')), 'static row hover background is transparent');
});

// ---------------------------------------------------------------- H: History and Device Detail

check('H1 History build row: View has p-0 and @click.stop; the date cell is text-nowrap without inline style', () => {
  const row = regionOf(read('pages/History/History.vue'), 'data-cy="build-row"', '</tr>');
  const view = (row.match(/<b-button\b[^>]*data-cy="build-open-log"[^>]*>/) || [])[0];
  assert.ok(view, 'History build row has a View button');
  assert.ok(view.includes('class="p-0"'), 'View has class p-0');
  assert.ok(view.includes('@click.stop="openBuildLog(item)"'), 'View keeps @click.stop');
  const date = (row.match(/<td\b[^>]*>/) || [])[0];
  assert.equal(date, '<td class="text-nowrap">', 'the date cell is <td class="text-nowrap">');
  assert.ok(!row.includes('white-space:nowrap'), 'no inline nowrap in the build row');
});

check('H2 Device Build History: one No build log placeholder and no muted dash', () => {
  const card = regionOf(read('pages/Devices/DeviceDetail.vue'), 'data-cy="card-build-history"', '</b-card>');
  assert.equal(card.split('data-cy="build-no-log"').length - 1, 1, 'exactly one build-no-log placeholder');
  assert.ok(card.includes('<span v-else data-cy="build-no-log"><span aria-hidden="true">—</span><span class="sr-only">No build log</span></span>'), 'UI-B15 placeholder markup');
  assert.ok(!card.includes('class="text-muted">—<'), 'no muted dash');
});

// Referenced by the checks that 47-02 adds; kept so the harness stays whole.
void [expand, renderPage];

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

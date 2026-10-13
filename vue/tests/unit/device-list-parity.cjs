// Unit test for device list parity (phase 44, DEV-01..05, REPO-01, D-16).
//
// Plain-node checks for the shared platform module (src/utils/platforms.js), the
// shared PlatformBullet component, the Devices page (platform bullet in the table
// and the grid, Legacy device icons on platform tiles, platform filter pills, the
// base-platform sort and the empty states), the per-column List.vue slot used by
// Repositories, and the platform palette compiled from src/styles/theme.scss.
// Plan 44-02 extends this file with IconButton and the row actions.
//
// SFC templates are compiled with vue-template-compiler (whitespace: 'condense',
// as vue-cli does) and rendered with vue.runtime.common; bootstrap-vue elements
// (b-*) stay plain vnodes. Child components are expanded one level at a time.
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

// Evaluate a plain ES module from src/ and return its named exports.
function loadModule(rel) {
  const names = [];
  const code = read(rel)
    .replace(/^import .*;?$/gm, '')
    .replace(/export (const|let|function) (\w+)/g, (m, kind, name) => { names.push(name); return kind + ' ' + name; });
  return new Function(code + '\nreturn { ' + names.join(', ') + ' };')();
}

// Fake require.context: resolves './b_medium_07.png' to 'sym:b_medium_07.png'.
const fakeRequire = {
  context: () => {
    const resolve = (key) => 'sym:' + String(key).replace(/^\.\//, '');
    resolve.keys = () => [];
    return resolve;
  },
};

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
    moment: () => ({ fromNow: () => 'a moment ago' }),
    require: fakeRequire,
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

// Render a component vnode one level down, resolving props, $attrs and scoped slots.
function expand(vnode, parentVm) {
  const opts = vnode.componentOptions;
  assert.ok(opts, 'not a component vnode');
  const child = new opts.Ctor({ propsData: opts.propsData, _parentVnode: vnode, _parentListeners: opts.listeners, parent: parentVm });
  const { out, warnings, error } = withWarnings(() => child._render());
  return { vm: child, vnode: out, warnings, error };
}

// Mount a definition directly with props.
function renderComponent(def, propsData) {
  const Ctor = Vue.extend(def);
  const vm = new Ctor({ propsData });
  const { out, warnings, error } = withWarnings(() => vm._render());
  return { vm, vnode: out, warnings, error };
}

// ---------------------------------------------------------------- vnode walkers

// All vnodes under top; scoped slots of plain (non-component) elements such as
// <b-card #header> are rendered inline because b-* elements are not components here.
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
const isComponent = (n, name) => !!(n && n.componentOptions && n.componentOptions.Ctor.options.name === name);
const componentsOf = (top, name) => nodesOf(top).filter((n) => isComponent(n, name));
const textOf = (top) => nodesOf(top).filter((n) => !n.tag && n.text).map((n) => n.text).join(' ').replace(/\s+/g, ' ').trim();

// Text of a subtree with every child component expanded (recursively).
function deepText(top, parentVm) {
  const parts = [];
  (function walk(n, vm) {
    if (!n) return;
    if (Array.isArray(n)) { n.forEach((x) => walk(x, vm)); return; }
    if (n.componentOptions) { const r = expand(n, vm); walk(r.vnode, r.vm); return; }
    if (!n.tag && n.text) parts.push(n.text);
    (n.children || []).forEach((c) => walk(c, vm));
    const slots = n.data && n.data.scopedSlots;
    if (slots) Object.keys(slots).filter((k) => k[0] !== '$' && typeof slots[k] === 'function').forEach((k) => walk(slots[k]({}), vm));
  })(top, parentVm);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------- src/utils/platforms.js

const platforms = lazy(() => loadModule('utils/platforms.js'));

const EXPECTED = {
  arduino: 'Arduino',
  platformio: 'Platform.io',
  nodemcu: 'NodeMCU',
  pine64: 'Pine64',
  micropython: 'Micropython',
  mongoose: 'MongooseOS',
  nodejs: 'NodeJS',
  sigfox: 'Sigfox',
  unknown: 'unknown',
};

check('basePlatform maps known values onto their key and the rest onto unknown', () => {
  const { basePlatform } = platforms();
  const cases = [
    ['arduino:esp8266', 'arduino'], ['PlatformIO', 'platformio'], [' nodemcu ', 'nodemcu'],
    ['', 'unknown'], [null, 'unknown'], [undefined, 'unknown'], ['unknown', 'unknown'],
    ['unknown_platform', 'unknown'], ['foo', 'unknown'], ['esp-idf:foo', 'unknown'],
    // The backend's MicroPython plugin reports "python" (44 WR-01).
    ['python', 'micropython'], ['Python', 'micropython'], ['python:esp32', 'micropython'],
  ];
  cases.forEach(([raw, key]) => assert.equal(basePlatform(raw), key, JSON.stringify(raw)));
});

check('PLATFORMS holds exactly the nine palette keys and labels; only sigfox has build false', () => {
  const { PLATFORMS } = platforms();
  assert.deepEqual(Object.keys(PLATFORMS).sort(), Object.keys(EXPECTED).sort());
  Object.keys(EXPECTED).forEach((k) => {
    assert.equal(PLATFORMS[k].label, EXPECTED[k], k);
    assert.equal(PLATFORMS[k].build, k !== 'sigfox', k + ' build');
  });
});

check('platformInfo returns { key, label, build } and never throws', () => {
  const { platformInfo } = platforms();
  assert.deepEqual(platformInfo('sigfox'), { key: 'sigfox', label: 'Sigfox', build: false });
  assert.deepEqual(platformInfo('arduino:esp32'), { key: 'arduino', label: 'Arduino', build: true });
  [null, 42, {}, [], undefined, 'unknown_platform'].forEach((raw) => {
    assert.deepEqual(platformInfo(raw), { key: 'unknown', label: 'unknown', build: true }, String(raw));
  });
});

// A JSON object whose own toString is not a function makes String() and parseInt() throw
// (44-SECURITY N-1). Only strings (and numbers for the icon) are read.
const WEIRD = () => JSON.parse('{"toString":1}');

check('basePlatform and platformInfo treat non-strings, including {toString:1}, as unknown', () => {
  const { basePlatform, platformInfo } = platforms();
  [WEIRD(), 42, true, {}, [], ['arduino']].forEach((raw) => {
    assert.equal(basePlatform(raw), 'unknown', JSON.stringify(raw));
    assert.deepEqual(platformInfo(raw), { key: 'unknown', label: 'unknown', build: true }, JSON.stringify(raw));
  });
});

// ---------------------------------------------------------------- PlatformBullet.vue

const bullet = lazy(() => {
  const p = platforms();
  return loadSfc('components/PlatformBullet/PlatformBullet.vue', { basePlatform: p.basePlatform, platformInfo: p.platformInfo, PLATFORMS: p.PLATFORMS });
});

function renderBullet(platform) {
  const r = renderComponent(bullet().def, { platform });
  assert.equal(r.error, null, 'bullet renders without error');
  assert.deepEqual(r.warnings, [], 'bullet renders without Vue warnings');
  return r.vnode;
}

check('PlatformBullet renders one span "platform-bullet platform-arduino" with "Arduino"', () => {
  const v = renderBullet('arduino:esp8266');
  assert.equal(v.tag, 'span');
  assert.deepEqual(classList(v).sort(), ['platform-arduino', 'platform-bullet']);
  assert.equal(textOf(v), 'Arduino');
  assert.equal(nodesOf(v).filter((n) => n.tag).length, 1, 'exactly one element');
  assert.equal(attrsOf(v).title, undefined, 'no title attribute');
});

check('PlatformBullet renders the Micropython bullet for the backend value python', () => {
  const v = renderBullet('python');
  assert.deepEqual(classList(v).sort(), ['platform-bullet', 'platform-micropython']);
  assert.equal(textOf(v), 'Micropython');
});

check('PlatformBullet renders unknown for unknown_platform, empty and null, never the input', () => {
  ['unknown_platform', '', null, 'esp-idf:foo'].forEach((raw) => {
    const v = renderBullet(raw);
    assert.deepEqual(classList(v).sort(), ['platform-bullet', 'platform-unknown'], String(raw));
    assert.equal(textOf(v), 'unknown', String(raw));
    if (raw) assert.ok(!textOf(v).includes(raw), 'input string rendered');
    assert.equal(attrsOf(v).title, undefined, 'no title attribute');
  });
});

check('PlatformBullet has no "Platform:" text and no raw-HTML binding', () => {
  const { source } = bullet();
  assert.equal(source.indexOf('Platform:'), -1);
  assert.equal(source.indexOf('v-html'), -1);
});

// ---------------------------------------------------------------- IconButton.vue (44-02)

const ICON_BUTTON = 'components/IconButton/IconButton.vue';
const iconButton = lazy(() => loadSfc(ICON_BUTTON));
// Devices imports IconButton from 44-02 on; on the 44-01 tree the file does not exist yet.
const iconButtonDep = () => (fs.existsSync(path.join(SRC, ICON_BUTTON)) ? iconButton().def : undefined);

// Render <IconButton …> from a compiled parent template, so $attrs and listeners
// resolve as they do in a page, then expand it one level.
function renderIconButton(tpl) {
  const compiled = compiler.compileToFunctions(tpl, { whitespace: 'condense' });
  const hits = [];
  const parent = new Vue({
    render: compiled.render,
    staticRenderFns: compiled.staticRenderFns,
    components: { IconButton: iconButton().def },
    methods: { hit(e) { hits.push(e); } },
  });
  const outer = withWarnings(() => parent._render());
  assert.equal(outer.error, null, 'parent renders without error');
  assert.ok(isComponent(outer.out, 'IconButton'), 'parent renders an IconButton');
  const r = expand(outer.out, parent);
  assert.equal(r.error, null, 'IconButton renders without error');
  assert.deepEqual(r.warnings, [], 'IconButton renders without Vue warnings');
  return { vnode: r.vnode, vm: r.vm, outer: outer.out, hits };
}

const tagged = (n) => (n.children || []).filter((c) => c.tag);

check('IconButton renders the UI-D07 markup with the label as tip, aria-label and text', () => {
  const { vnode } = renderIconButton('<IconButton icon="fa fa-pencil" label="Edit" data-cy="x" @click="hit" />');
  assert.equal(vnode.tag, 'span', 'root is a span');
  assert.deepEqual(classList(vnode), ['icon-button']);
  assert.equal(attrsOf(vnode).title, 'Edit', 'wrapper title');
  assert.equal(attrsOf(vnode)['data-cy'], undefined, 'data-cy not on the wrapper');
  const kids = tagged(vnode);
  assert.equal(kids.length, 1, 'one child');
  const btn = kids[0];
  assert.equal(btn.tag, 'b-button');
  const a = attrsOf(btn);
  assert.equal(a['aria-label'], 'Edit');
  assert.equal(a.size, 'sm');
  assert.equal(a.variant, 'default');
  assert.equal(a.disabled, false);
  assert.equal(a['data-cy'], 'x', 'data-cy lands on the button');
  const inner = tagged(btn);
  assert.equal(inner.length, 2, 'glyph and text');
  assert.equal(inner[0].tag, 'i');
  assert.deepEqual(classList(inner[0]), ['fa', 'fa-pencil']);
  assert.equal(attrsOf(inner[0])['aria-hidden'], 'true');
  assert.equal(inner[1].tag, 'span');
  assert.deepEqual(classList(inner[1]), ['icon-button__text', 'd-none', 'd-lg-inline']);
  assert.equal(textOf(inner[1]), 'Edit');
});

check('IconButton passes variant and disabled through and emits click only while enabled', () => {
  const on = renderIconButton('<IconButton icon="fa fa-trash" label="Revoke" variant="danger" @click="hit" />');
  const btn = tagged(on.vnode)[0];
  assert.equal(attrsOf(btn).variant, 'danger');
  assert.equal(attrsOf(btn).disabled, false);
  btn.data.on.click({ type: 'click' });
  assert.equal(on.hits.length, 1, 'one click emitted');
  assert.equal(on.hits[0].type, 'click', 'the event is passed on');
  const off = renderIconButton('<IconButton icon="fa fa-eye" label="No build yet" :disabled="true" @click="hit" />');
  const btnOff = tagged(off.vnode)[0];
  assert.equal(attrsOf(btnOff).disabled, true);
  assert.equal(attrsOf(off.vnode).title, 'No build yet', 'disabled button keeps its tip on the wrapper');
  btnOff.data.on.click({ type: 'click' });
  assert.equal(off.hits.length, 0, 'no click while disabled');
});

check('IconButton props, inheritAttrs false, no raw-HTML binding, no style block', () => {
  const { def, source } = iconButton();
  assert.equal(def.name, 'IconButton');
  assert.equal(def.inheritAttrs, false);
  assert.equal(def.props.icon.type, String);
  assert.equal(def.props.icon.required, true);
  assert.equal(def.props.label.type, String);
  assert.equal(def.props.label.required, true);
  assert.equal(def.props.variant.default, 'default');
  assert.equal(def.props.disabled.type, Boolean);
  assert.equal(def.props.disabled.default, false);
  assert.equal(source.indexOf('v-html'), -1);
  assert.equal(source.indexOf('<style'), -1);
});

// ---------------------------------------------------------------- Devices.vue

const DEVICES = [
  { udid: 'd1', alias: 'Alpha', platform: 'arduino:esp8266', icon: 7, keyhash: 'k1', lastupdate: '2026-10-01T10:00:00Z', mac: 'AA' },
  { udid: 'd2', alias: 'Bravo', platform: 'PlatformIO', icon: '12', keyhash: 'k2', lastupdate: '2026-10-02T10:00:00Z', mac: 'BB' },
  { udid: 'd3', alias: 'Charlie', platform: 'sigfox', icon: 73, keyhash: 'k3', lastupdate: '2026-10-03T10:00:00Z', mac: 'CC' },
  { udid: 'd4', alias: 'Delta', platform: 'unknown_platform', icon: 0, keyhash: 'k4', lastupdate: '2026-10-04T10:00:00Z', mac: 'DD' },
  { udid: 'd5', alias: 'Echo', icon: null, keyhash: 'k5', lastupdate: '2026-10-05T10:00:00Z', mac: 'EE' },
];

// BuildLogDialog is stubbed: the page only needs one instance it can open by ref.
const BUILD_LOG_DIALOG_STUB = { name: 'BuildLogDialog', render(h) { return h('div'); }, methods: { open() {} } };

const devices = lazy(() => {
  const p = platforms();
  return loadSfc('pages/Devices/Devices.vue', {
    PlatformBullet: bullet().def, IconButton: iconButtonDep(), BuildLogDialog: BUILD_LOG_DIALOG_STUB,
    basePlatform: p.basePlatform, platformInfo: p.platformInfo,
  });
});

function renderDevices(state) {
  const r = renderPage(devices().def, Object.assign({ items: DEVICES.map((d) => Object.assign({}, d)) }, state));
  assert.equal(r.error, null, 'Devices renders without error');
  assert.deepEqual(r.warnings, [], 'Devices renders without Vue warnings');
  return r;
}

check('Devices table rows render PlatformBullet with the raw platform, never the raw string', () => {
  const { vm, vnode } = renderDevices({ viewMode: 'list' });
  const rows = byCy(vnode, 'device-row');
  assert.equal(rows.length, DEVICES.length, 'one row per device');
  rows.forEach((row) => {
    const bullets = componentsOf(row, 'PlatformBullet');
    assert.equal(bullets.length, 1, 'one PlatformBullet per row');
    const dev = DEVICES.find((d) => deepText(row, vm).includes(d.alias));
    assert.ok(dev, 'row alias');
    assert.equal(bullets[0].componentOptions.propsData.platform, dev.platform, dev.alias + ' propsData.platform');
    const label = textOf(expand(bullets[0], vm).vnode);
    assert.equal(label, platforms().platformInfo(dev.platform).label, dev.alias + ' label');
    const text = deepText(row, vm);
    if (dev.platform && dev.platform !== platforms().platformInfo(dev.platform).label) {
      assert.ok(!text.includes(dev.platform), dev.alias + ' row shows the raw platform ' + dev.platform);
    }
  });
});

// ---------------------------------------------------------------- compiled theme (platform palette)

const sass = require('sass');

const compiledCss = lazy(() => sass.compileString('@import "theme";\n', {
  loadPaths: [path.join(SRC, 'styles')],
  style: 'compressed',
  quietDeps: true,
  logger: sass.Logger.silent,
}).css);

// Flat list of { media, selectors, body } for every style rule (copied from login-page.cjs).
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

function decls(selector) {
  return allRules().filter((r) => r.media === '' && r.selectors.includes(selector)).map((r) => r.body);
}

function value(bodies, prop) {
  let found;
  bodies.forEach((body) => body.split(';').forEach((d) => {
    const at = d.indexOf(':');
    if (at !== -1 && d.slice(0, at).trim() === prop) found = d.slice(at + 1).trim();
  }));
  return found;
}

// Colour helpers (copied from login-page.cjs).
function parseColour(raw) {
  const text = String(raw).trim().toLowerCase();
  if (text === 'white') return { r: 255, g: 255, b: 255, a: 1 };
  if (text === 'black') return { r: 0, g: 0, b: 0, a: 1 };
  // Dart Sass compressed output writes #FFA500 as its shorter name.
  if (text === 'orange') return { r: 255, g: 165, b: 0, a: 1 };
  let m = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/);
  if (m) {
    let hex = m[1];
    if (hex.length === 3) hex = hex.split('').map((h) => h + h).join('');
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
    };
  }
  // Dart Sass may emit rgba(255,255,255,.24) as hsla(0,0%,100%,.24) in compressed output.
  m = text.match(/^hsla?\(([^)]*)\)$/);
  if (m) {
    const [h, s, l, a] = m[1].split(',').map((x) => parseFloat(x));
    const sat = s / 100;
    const lig = l / 100;
    const k = (n) => (n + h / 30) % 12;
    const f = (n) => lig - sat * Math.min(lig, 1 - lig) * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    const c = { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255, a: a === undefined || Number.isNaN(a) ? 1 : a };
    if ([c.r, c.g, c.b, c.a].some((n) => !Number.isFinite(n))) return null;
    return c;
  }
  m = text.match(/^rgba?\(([^)]*)\)$/);
  if (!m) return null;
  const parts = m[1].split(',').map((x) => x.trim());
  if (parts.length < 3 || parts.length > 4) return null;
  const c = { r: parseFloat(parts[0]), g: parseFloat(parts[1]), b: parseFloat(parts[2]), a: parts[3] === undefined ? 1 : parseFloat(parts[3]) };
  if ([c.r, c.g, c.b, c.a].some((n) => !Number.isFinite(n))) return null;
  return c;
}

function luminance(c) {
  const lin = (v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function sameColour(a, b) {
  return !!a && !!b && Math.abs(a.r - b.r) <= 0.5 && Math.abs(a.g - b.g) <= 0.5
    && Math.abs(a.b - b.b) <= 0.5 && Math.abs(a.a - b.a) <= 0.005;
}

const PALETTE = {
  arduino: ['#00979D', '#000000'],
  platformio: ['#FF9125', '#000000'],
  nodemcu: ['#005780', '#FFFFFF'],
  pine64: ['#333333', '#FFFFFF'],
  micropython: ['#3C393A', '#FFFFFF'],
  mongoose: ['#0E7CAD', '#FFFFFF'],
  nodejs: ['#8EC64B', '#000000'],
  sigfox: ['#6D04D6', '#FFFFFF'],
  unknown: ['#333333', '#FFFFFF'],
};

check('sass compiles src/styles/theme.scss', () => { compiledCss(); });

check('each .platform-<key> rule carries the palette colours and reaches 4.5:1', () => {
  const ratios = [];
  Object.keys(PALETTE).forEach((key) => {
    const bodies = decls('.platform-' + key);
    assert.ok(bodies.length, 'no .platform-' + key + ' rule');
    const bg = parseColour(value(bodies, 'background-color'));
    const fg = parseColour(value(bodies, 'color'));
    assert.ok(sameColour(bg, parseColour(PALETTE[key][0])), key + ' background ' + value(bodies, 'background-color'));
    assert.ok(sameColour(fg, parseColour(PALETTE[key][1])), key + ' color ' + value(bodies, 'color'));
    const ratio = contrast(fg, bg);
    assert.ok(ratio >= 4.5, key + ' ' + ratio.toFixed(2) + ' < 4.5');
    ratios.push(key + ' ' + ratio.toFixed(2));
  });
  return ratios.join(', ');
});

check('.platform-bullet has the UI-D04 shape', () => {
  const bodies = decls('.platform-bullet');
  const want = {
    display: 'inline-block', padding: '4px 8px', 'border-radius': '12px', 'font-size': '.875rem',
    'font-weight': '400', 'line-height': '1', 'white-space': 'nowrap', 'vertical-align': 'middle',
  };
  Object.keys(want).forEach((prop) => assert.equal(String(value(bodies, prop)).replace(/^0\./, '.'), want[prop], prop));
});

function insetShadow(selector) {
  const shadow = String(value(decls(selector), 'box-shadow'));
  const m = shadow.match(/^inset 0 0 0 1px (.+)$/);
  assert.ok(m, selector + ' box-shadow ' + shadow);
  assert.ok(sameColour(parseColour(m[1]), { r: 255, g: 255, b: 255, a: 0.24 }), selector + ' shadow colour ' + m[1]);
}

check('.platform-bullet and .device-icon share the inset white outline', () => {
  insetShadow('.platform-bullet');
  insetShadow('.device-icon');
  const shared = allRules().filter((r) => r.selectors.includes('.platform-bullet') && r.selectors.includes('.device-icon'));
  assert.ok(shared.length, 'no shared .platform-bullet, .device-icon rule');
});

// ---------------------------------------------------------------- List.vue and Repositories.vue

// Copy of the repositories store headers at phase 44 (the store itself is not changed here).
const REPO_HEADERS = [
  { title: 'id', prop: 'id', pos: null },
  { title: 'alias', prop: 'alias', pos: 0 },
  { title: 'url', prop: 'url', pos: null },
  { title: 'branch', prop: 'branch', pos: 1 },
  { title: 'platform', prop: 'platform', pos: 2 },
];

const list = lazy(() => loadSfc('components/List/List.vue', { Vue }));

const bodyCells = (vnode) => {
  const tbody = nodesOf(vnode).find((n) => n.tag === 'tbody');
  const rows = (tbody.children || []).filter((n) => n.tag === 'tr');
  return rows.map((tr) => (tr.children || []).filter((n) => n.tag === 'td').slice(1));
};

check('List.vue without a slot renders each raw cell value as before', () => {
  const r = renderComponent(list().def, {
    datasource: [{ id: 'r1', alias: 'a', branch: 'origin/master', platform: 'unknown_platform' }],
    dataheaders: REPO_HEADERS,
    showLoading: false,
  });
  assert.equal(r.error, null);
  assert.deepEqual(r.warnings, []);
  const rows = bodyCells(r.vnode);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].map((td) => textOf(td)), ['a', 'origin/master', 'unknown_platform']);
});

const repositories = lazy(() => loadSfc('pages/Repositories/Repositories.vue', { List: list().def, PlatformBullet: bullet().def }));

function renderRepositoryRow(platform) {
  const page = renderPage(repositories().def, {
    items: [{ id: 'r1', alias: 'repo', branch: 'origin/master', url: 'https://example.invalid/r.git', platform }],
    headers: REPO_HEADERS,
  }, { List: list().def, PlatformBullet: bullet().def });
  assert.equal(page.error, null, 'Repositories renders without error');
  assert.deepEqual(page.warnings, [], 'Repositories renders without Vue warnings');
  const lists = componentsOf(page.vnode, 'List');
  assert.equal(lists.length, 1, 'Repositories renders one List');
  const listRender = expand(lists[0], page.vm);
  assert.equal(listRender.error, null, 'List renders without error');
  const rows = bodyCells(listRender.vnode);
  assert.equal(rows.length, 1);
  const cells = rows[0];
  const bullets = componentsOf(cells[2], 'PlatformBullet');
  assert.equal(bullets.length, 1, 'platform cell holds one PlatformBullet');
  const b = expand(bullets[0], listRender.vm);
  assert.equal(b.error, null);
  return { cells, bullet: b.vnode, rowText: deepText(cells, listRender.vm) };
}

check('Repositories renders the unknown bullet and never unknown_platform', () => {
  ['unknown_platform', 'unknown', '', null].forEach((raw) => {
    const { bullet: v, rowText } = renderRepositoryRow(raw);
    assert.deepEqual(classList(v).sort(), ['platform-bullet', 'platform-unknown'], String(raw));
    assert.equal(textOf(v), 'unknown', String(raw));
    assert.ok(!rowText.includes('unknown_platform'), 'row renders unknown_platform');
  });
});

check('Repositories bullet markup equals the Devices bullet for arduino:esp8266', () => {
  const { bullet: v, cells } = renderRepositoryRow('arduino:esp8266');
  assert.deepEqual(classList(v).sort(), ['platform-arduino', 'platform-bullet']);
  assert.equal(textOf(v), 'Arduino');
  assert.equal(textOf(cells[0]), 'repo');
  assert.equal(textOf(cells[1]), 'origin/master');
  const ref = renderBullet('arduino:esp8266');
  assert.equal(v.tag, ref.tag);
  assert.deepEqual(classList(v), classList(ref));
  assert.deepEqual(attrsOf(v), attrsOf(ref));
  assert.equal(textOf(v), textOf(ref));
});

// The Repositories bullet relies on the store's `platform` column; the check reads the
// store's headers instead of pinning the file to a commit (phase 44 WR-03).
check('store/repositories.js still declares a visible platform column', () => {
  const mod = { exports: {} };
  new Function('module', read('store/repositories.js').replace(/export default /, 'module.exports.default = '))(mod);
  const headers = mod.exports.default.state.headers;
  const platform = headers.filter((h) => h.prop === 'platform');
  assert.equal(platform.length, 1, 'one platform header');
  assert.ok(platform[0].pos !== null && platform[0].pos !== undefined, 'platform column is shown');
});

// ---------------------------------------------------------------- Devices: icon tiles, filter, sort, empty states

const CATEGORY_NAMES = ['grey-mint', 'yellow-crusta', 'red-intense', 'purple-studio', 'blue', 'green', 'green-dark'];

// [alias, platform, icon, expected symbol]; 'mongoose' has no icon key at all.
const FLEET = [
  ['Alpha', 'arduino:esp8266', 7, '07'],
  ['Bravo', 'arduino', '12', '12'],
  ['Charlie', 'PlatformIO', 73, '73'],
  ['Delta', 'sigfox', 0, '01'],
  ['Echo', 'nodemcu:esp32', 74, '01'],
  ['Foxtrot', 'unknown_platform', 'x', '01'],
  ['Golf', undefined, null, '01'],
  ['Hotel', 'mongoose', undefined, '01'],
].map(([alias, platform, icon, nn], i) => {
  const d = { udid: 'u' + i, alias, mac: 'M' + i, keyhash: 'k' + i, category: CATEGORY_NAMES[i % CATEGORY_NAMES.length],
    lastupdate: new Date(Date.UTC(2026, 9, 1 + i)).toISOString(), expectSymbol: nn };
  if (platform !== undefined) d.platform = platform;
  if (icon !== undefined || alias !== 'Hotel') d.icon = icon;
  return d;
});
const fleet = () => FLEET.map((d) => Object.assign({}, d));

function renderFleet(state) {
  return renderDevices(Object.assign({ items: fleet() }, state));
}

const aliasOfRow = (row) => FLEET.find((d) => textOf(row).includes(d.alias));

check('Devices.vue holds no category colour name, category map, lookup, pill hook or category read', () => {
  const { source } = devices();
  CATEGORY_NAMES.concat(['CATEGORY_COLORS', 'categoryColor', 'category-pill', 'Platform:', 'device.category', 'filterCategory'])
    .forEach((s) => assert.equal(source.indexOf(s), -1, 'still present: ' + s));
  assert.doesNotMatch(source, /\.category\b|\[['"]category['"]\]/, 'reads a category field');
});

check('rendered Devices (both views) shows no category in any class, attribute or text', () => {
  ['list', 'grid'].forEach((viewMode) => {
    const { vm, vnode } = renderFleet({ viewMode });
    const blob = [deepText(vnode, vm)]
      .concat(nodesOf(vnode).map((n) => classList(n).join(' ') + ' ' + JSON.stringify(attrsOf(n)) + ' ' + JSON.stringify((n.data && n.data.style) || '')))
      .join(' ');
    ['grey-mint', 'yellow-crusta', 'red-intense', 'purple-studio', 'green-dark'].forEach((c) => assert.ok(!blob.includes(c), viewMode + ': ' + c));
    assert.ok(!/\bPlatform:/.test(blob), viewMode + ': Platform: label');
  });
});

check('table head: checkbox, sr-only Icon, Alias, Platform, Firmware, Status, Last Seen, Actions', () => {
  const { vnode } = renderFleet({ viewMode: 'list' });
  const thead = nodesOf(vnode).find((n) => n.tag === 'thead');
  const ths = nodesOf(thead).filter((n) => n.tag === 'th');
  assert.equal(ths.length, 8, '8 columns');
  assert.ok(nodesOf(ths[0]).some((n) => n.tag === 'input'), 'first column is the checkbox');
  const iconHead = nodesOf(ths[1]).filter((n) => n.tag);
  assert.equal(iconHead.length, 2, 'icon header holds only one span');
  assert.equal(iconHead[1].tag, 'span');
  assert.deepEqual(classList(iconHead[1]), ['sr-only']);
  assert.equal(textOf(ths[1]), 'Icon');
  assert.deepEqual(ths.slice(2).map((th) => textOf(th)), ['Alias', 'Platform', 'Firmware', 'Status', 'Last Seen', 'Actions']);
});

function checkTile(tile, dev, small) {
  const info = platforms().platformInfo(dev.platform);
  const cls = classList(tile);
  assert.equal(tile.tag, 'span', dev.alias + ' tile is a span');
  assert.ok(cls.includes('device-icon'), dev.alias + ' device-icon');
  assert.equal(cls.includes('device-icon--sm'), small, dev.alias + ' device-icon--sm');
  assert.ok(cls.includes('platform-' + info.key), dev.alias + ' platform-' + info.key + ' in ' + cls.join(' '));
  assert.equal(cls.filter((c) => /^platform-/.test(c)).length, 1, dev.alias + ' one platform class');
  assert.equal(attrsOf(tile).title, info.label, dev.alias + ' tile title');
  const imgs = nodesOf(tile).filter((n) => n.tag === 'img');
  assert.equal(imgs.length, 1, dev.alias + ' one symbol');
  assert.deepEqual(classList(imgs[0]), ['device-icon-symbol']);
  assert.equal(attrsOf(imgs[0]).alt, info.label + ' device icon', dev.alias + ' alt');
  assert.equal(attrsOf(imgs[0]).src, 'sym:b_medium_' + dev.expectSymbol + '.png', dev.alias + ' symbol for icon ' + JSON.stringify(dev.icon));
  assert.ok(!nodesOf(tile).some((n) => n.tag === 'a' || n.tag === 'router-link'), dev.alias + ' tile is not a link');
}

check('table rows: second cell is the 32px platform tile with the Legacy symbol', () => {
  const { vnode } = renderFleet({ viewMode: 'list' });
  const rows = byCy(vnode, 'device-row');
  assert.equal(rows.length, FLEET.length);
  rows.forEach((row) => {
    const dev = aliasOfRow(row);
    assert.ok(dev, 'row alias');
    const tds = (row.children || []).filter((n) => n.tag === 'td');
    assert.equal(tds.length, 8, dev.alias + ' 8 cells');
    const tiles = (tds[1].children || []).filter((n) => n.tag);
    assert.equal(tiles.length, 1, dev.alias + ' icon cell holds one tile');
    checkTile(tiles[0], dev, true);
  });
});

check('grid cards: header row of 48px tile then the alias, one line holding only the bullet', () => {
  const { vm, vnode } = renderFleet({ viewMode: 'grid' });
  const cards = byCy(vnode, 'device-card');
  assert.equal(cards.length, FLEET.length);
  cards.forEach((card) => {
    const slots = card.data.scopedSlots || {};
    assert.equal(typeof slots.header, 'function', 'card has a header slot');
    const header = [].concat(slots.header({})).filter((n) => n && n.tag);
    assert.equal(header.length, 1, 'header has one wrapper');
    const wrap = header[0];
    assert.ok(classList(wrap).includes('d-flex') && classList(wrap).includes('align-items-center'), 'header wrapper is d-flex align-items-center');
    const parts = (wrap.children || []).filter((n) => n.tag);
    assert.equal(parts.length, 2, 'header holds the tile and the alias');
    assert.equal(parts[1].tag, 'strong');
    const dev = FLEET.find((d) => textOf(parts[1]) === d.alias);
    assert.ok(dev, 'alias in strong');
    checkTile(parts[0], dev, false);
    const bullets = componentsOf(card, 'PlatformBullet');
    assert.equal(bullets.length, 1, dev.alias + ' one bullet per card');
    const line = (card.children || []).find((n) => n.tag === 'p' && (n.children || []).some((c) => isComponent(c, 'PlatformBullet')));
    assert.ok(line, dev.alias + ' bullet line');
    assert.equal((line.children || []).filter((c) => c.tag).length, 1, dev.alias + ' bullet line holds only the bullet');
    assert.equal(textOf(line), '', dev.alias + ' bullet line has no other text');
    assert.equal(textOf(expand(bullets[0], vm).vnode), platforms().platformInfo(dev.platform).label);
    assert.ok(!nodesOf(card).some((n) => n.tag === 'strong' && /Platform/.test(textOf(n))), 'no bold platform label');
  });
});

function pillsOf(vnode) {
  const groups = nodesOf(vnode).filter((n) => attrsOf(n).role === 'group' && attrsOf(n)['aria-label'] === 'Filter by platform');
  assert.equal(groups.length, 1, 'one "Filter by platform" group');
  return nodesOf(groups[0]).filter((n) => n.tag === 'b-button');
}

check('platform pills: All, then present platforms by label with unknown last, aria-pressed and variant', () => {
  const { vnode } = renderFleet({ viewMode: 'list' });
  const pills = pillsOf(vnode);
  assert.deepEqual(pills.map((p) => cyOf(p)), ['platform-pill-All', 'platform-pill-arduino', 'platform-pill-mongoose',
    'platform-pill-nodemcu', 'platform-pill-platformio', 'platform-pill-sigfox', 'platform-pill-unknown']);
  assert.deepEqual(pills.map((p) => textOf(p)), ['All', 'Arduino', 'MongooseOS', 'NodeMCU', 'Platform.io', 'Sigfox', 'unknown']);
  pills.forEach((p, i) => {
    assert.equal(attrsOf(p).size, 'sm');
    assert.equal(attrsOf(p).variant, i === 0 ? 'light' : 'outline-light', cyOf(p) + ' variant');
    assert.equal(attrsOf(p)['aria-pressed'], i === 0 ? 'true' : 'false', cyOf(p) + ' aria-pressed');
    assert.equal(typeof (p.data.on && p.data.on.click), 'function', cyOf(p) + ' click handler');
  });
});

check('platform pills: with no items, and while loading, only All renders', () => {
  assert.deepEqual(pillsOf(renderDevices({ items: [] }).vnode).map((p) => cyOf(p)), ['platform-pill-All']);
  const loading = renderDevices({ items: [], loading: true });
  assert.deepEqual(pillsOf(loading.vnode).map((p) => cyOf(p)), ['platform-pill-All']);
  assert.ok(textOf(loading.vnode).includes('Loading...'), 'Loading... shows');
  assert.ok(!nodesOf(loading.vnode).some((n) => n.tag === 'table' || cyOf(n) === 'device-card'), 'no table or grid while loading');
});

check('python and micropython devices share one Micropython pill and filter together', () => {
  const items = [
    { udid: 'p1', alias: 'Py', platform: 'python', keyhash: 'k' },
    { udid: 'p2', alias: 'Mpy', platform: 'micropython', keyhash: 'k' },
  ];
  const { vm, vnode } = renderDevices({ items, viewMode: 'list' });
  assert.deepEqual(pillsOf(vnode).map((p) => cyOf(p)), ['platform-pill-All', 'platform-pill-micropython']);
  vm.platformFilter = 'micropython';
  assert.deepEqual(vm.filteredItems.map((d) => d.udid).sort(), ['p1', 'p2']);
});

check('clicking the Arduino pill keeps arduino and arduino:esp8266 devices only', () => {
  const first = renderFleet({ viewMode: 'list' });
  const pill = pillsOf(first.vnode).find((p) => cyOf(p) === 'platform-pill-arduino');
  pill.data.on.click();
  const again = withWarnings(() => first.vm._render());
  assert.equal(again.error, null);
  const rows = byCy(again.out, 'device-row');
  assert.deepEqual(rows.map((r) => aliasOfRow(r).alias).sort(), ['Alpha', 'Bravo']);
  const active = pillsOf(again.out).filter((p) => attrsOf(p)['aria-pressed'] === 'true').map((p) => cyOf(p));
  assert.deepEqual(active, ['platform-pill-arduino']);
  assert.equal(attrsOf(pillsOf(again.out).find((p) => cyOf(p) === 'platform-pill-arduino')).variant, 'light');
});

check('a reload without the selected platform falls back to All', () => {
  const { vm } = renderFleet({ viewMode: 'list' });
  vm.platformFilter = 'arduino';
  assert.equal(vm.filteredItems.length, 2);
  vm.items = fleet().filter((d) => platforms().basePlatform(d.platform) !== 'arduino');
  assert.equal(vm.activePlatform, 'All');
  assert.equal(vm.filteredItems.length, FLEET.length - 2, 'unfiltered');
  const again = withWarnings(() => vm._render());
  const active = pillsOf(again.out).filter((p) => attrsOf(p)['aria-pressed'] === 'true').map((p) => cyOf(p));
  assert.deepEqual(active, ['platform-pill-All']);
});

// UI review / IN-04: bulk Revoke, Transfer and Push Config act only on visible devices.
checkAsync('selection: search drops hidden selections for good, a pill switch clears it', async () => {
  const { vm } = renderFleet({ viewMode: 'list' });
  vm.selectedUdids = ['u0', 'u1', 'u2'];
  await Vue.nextTick();
  assert.deepEqual(vm.selectedUdids, ['u0', 'u1', 'u2'], 'all visible, all kept');
  vm.searchText = 'alp';
  await Vue.nextTick();
  assert.deepEqual(vm.selectedUdids, ['u0'], 'search keeps only visible selections');
  assert.equal(vm.selectedCount, 1);
  vm.searchText = '';
  await Vue.nextTick();
  assert.deepEqual(vm.selectedUdids, ['u0'], 'clearing the search does not bring hidden selections back');
  vm.selectedUdids = ['u0', 'u2'];
  vm.platformFilter = 'arduino';
  await Vue.nextTick();
  assert.deepEqual(vm.selectedUdids, [], 'a pill switch clears the selection');
  vm.toggleDevice('u0');
  vm.platformFilter = 'All';
  await Vue.nextTick();
  assert.deepEqual(vm.selectedUdids, [], 'switching back to All clears it too');
});

checkAsync('selection: bulk Revoke, Transfer and Push Config send only visible devices', async () => {
  const { vm } = renderFleet({ viewMode: 'list' });
  const sent = [];
  vm.$bvModal = { msgBoxConfirm: () => Promise.resolve(true), hide() {}, show() {} };
  vm.revokeDevices = (udids) => { sent.push(['revoke', udids]); return Promise.resolve({ success: false }); };
  vm.transferDevices = (p) => { sent.push(['transfer', p.udids]); return Promise.resolve({ success: false }); };
  vm.pushConfiguration = (p) => { sent.push(['push', p.udids]); return Promise.resolve({ success: false }); };
  vm.selectedUdids = ['u0', 'u2', 'u5'];
  vm.searchText = 'a';
  await Vue.nextTick();
  const visible = vm.filteredItems.map((d) => d.udid);
  const want = ['u0', 'u2', 'u5'].filter((u) => visible.includes(u));
  assert.ok(want.length < 3, 'the search hides at least one selected device');
  vm.transferForm.to = 'owner@example.invalid';
  await vm.confirmRevoke();
  await vm.transfer({ preventDefault() {} });
  await vm.pushConfig({ preventDefault() {} });
  assert.deepEqual(sent, [['revoke', want], ['transfer', want], ['push', want]]);
});

checkAsync('a reload without the selected platform resets the filter to All, and it stays All', async () => {
  const { vm } = renderFleet({ viewMode: 'list' });
  vm.platformFilter = 'arduino';
  await Vue.nextTick();
  vm.items = fleet().filter((d) => platforms().basePlatform(d.platform) !== 'arduino');
  await Vue.nextTick();
  assert.equal(vm.platformFilter, 'All', 'the filter itself falls back');
  vm.items = fleet();
  await Vue.nextTick();
  assert.equal(vm.activePlatform, 'All', 'arduino devices are back but the filter stays All');
  assert.equal(vm.filteredItems.length, FLEET.length);
});

check('sort Platform orders by base platform, then alias; Last Update and Alias unchanged', () => {
  const { vm } = renderFleet({ viewMode: 'list' });
  const { basePlatform } = platforms();
  vm.sortBy = 'platform';
  assert.deepEqual(vm.filteredItems.map((d) => d.alias),
    ['Alpha', 'Bravo', 'Hotel', 'Echo', 'Charlie', 'Delta', 'Foxtrot', 'Golf'], 'platform sort order');
  assert.deepEqual(vm.filteredItems.map((d) => basePlatform(d.platform)),
    ['arduino', 'arduino', 'mongoose', 'nodemcu', 'platformio', 'sigfox', 'unknown', 'unknown'], 'platform sort keys');
  const swapped = fleet().reverse();
  vm.items = swapped;
  assert.deepEqual(vm.filteredItems.slice(0, 2).map((d) => d.alias), ['Alpha', 'Bravo'], 'alias breaks the tie');
  vm.items = fleet();
  // Same comparator as the page: localeCompare follows the host locale (in Czech "Ch" sorts after "H").
  vm.sortBy = 'alias';
  assert.deepEqual(vm.filteredItems.map((d) => d.alias), FLEET.map((d) => d.alias).sort((a, b) => a.localeCompare(b)), 'alias sort');
  vm.sortBy = 'lastupdate';
  assert.deepEqual(vm.filteredItems.map((d) => d.alias), FLEET.map((d) => d.alias).reverse(), 'last update sort');
});

function emptyText(vnode, viewMode) {
  if (viewMode === 'list') {
    const tbody = nodesOf(vnode).find((n) => n.tag === 'tbody');
    const tds = nodesOf(tbody).filter((n) => n.tag === 'td');
    assert.equal(tds.length, 1, 'one empty cell');
    assert.equal(attrsOf(tds[0]).colspan, '8', 'colspan 8');
    assert.ok(!classList(tds[0]).includes('text-muted'), 'not text-muted');
    return textOf(tds[0]);
  }
  const cards = byCy(vnode, 'device-card');
  assert.equal(cards.length, 0);
  const holders = nodesOf(vnode).filter((n) => n.tag === 'p' && /No devices/.test(textOf(n)));
  assert.equal(holders.length, 1, 'one empty-state line');
  assert.ok(!classList(holders[0]).includes('text-muted'), 'not text-muted');
  return textOf(holders[0]);
}

check('empty states: no devices vs no filter match, both views, never text-muted', () => {
  ['list', 'grid'].forEach((viewMode) => {
    assert.equal(emptyText(renderDevices({ items: [], viewMode }).vnode, viewMode), 'No devices registered yet.', viewMode);
    assert.equal(emptyText(renderFleet({ viewMode, searchText: 'no-such-device' }).vnode, viewMode), 'No devices match the current filter.', viewMode);
  });
});

check('one device renders one row and one card with the same layout', () => {
  const one = [fleet()[0]];
  const list = renderDevices({ items: one, viewMode: 'list' });
  assert.equal(byCy(list.vnode, 'device-row').length, 1);
  const grid = renderDevices({ items: one, viewMode: 'grid' });
  assert.equal(byCy(grid.vnode, 'device-card').length, 1);
});

check('compiled tile geometry: 48px tile with a 40px symbol, 32px/24px small variant', () => {
  const tile = decls('.device-icon');
  const want = { display: 'inline-flex', 'align-items': 'center', 'justify-content': 'center', flex: '0 0 auto',
    width: '48px', height: '48px', 'border-radius': '8px' };
  Object.keys(want).forEach((p) => assert.equal(value(tile, p), want[p], '.device-icon ' + p));
  const sym = decls('.device-icon-symbol');
  assert.equal(value(sym, 'width'), '40px');
  assert.equal(value(sym, 'height'), '40px');
  assert.equal(value(sym, 'border-radius'), '4px');
  assert.ok(sameColour(parseColour(value(sym, 'background-color')), parseColour('#F9F9F9')), 'symbol background');
  const sm = decls('.device-icon--sm');
  assert.equal(value(sm, 'width'), '32px');
  assert.equal(value(sm, 'height'), '32px');
  const smSym = decls('.device-icon--sm .device-icon-symbol');
  assert.equal(value(smSym, 'width'), '24px');
  assert.equal(value(smSym, 'height'), '24px');
  assert.equal(read('styles/_platforms.scss').indexOf('zoom'), -1, 'Legacy zoom not ported');
});

check('grid card tile keeps an 8px gap before the alias', () => {
  const gap = allRules().filter((r) => r.media === '' && r.selectors.some((s) => /\.device-icon$/.test(s) && s !== '.device-icon'));
  const margin = value(gap.map((r) => r.body), 'margin-right');
  assert.equal(margin, '8px');
});

// ---------------------------------------------------------------- Devices: row actions (44-02)

const lastCell = (row) => {
  const tds = (row.children || []).filter((n) => n.tag === 'td');
  return tds[tds.length - 1];
};

function iconButtonsOf(top) {
  return componentsOf(top, 'IconButton');
}

check('the device table sits inside div.table-responsive', () => {
  const { vnode } = renderFleet({ viewMode: 'list' });
  const tables = nodesOf(vnode).filter((n) => n.tag === 'table');
  assert.equal(tables.length, 1, 'one table');
  const wraps = byClass(vnode, 'table-responsive');
  assert.equal(wraps.length, 1, 'one .table-responsive');
  assert.equal(wraps[0].tag, 'div');
  assert.ok((wraps[0].children || []).includes(tables[0]), 'the table is the wrapper child');
});

check('each row ends in td.actions-cell whose Edit IconButton opens DeviceDetail', () => {
  const { vm, vnode } = renderFleet({ viewMode: 'list' });
  const pushed = [];
  vm.$router = { push: (to) => pushed.push(to) };
  const rows = byCy(vnode, 'device-row');
  assert.equal(rows.length, FLEET.length);
  rows.forEach((row) => {
    const dev = aliasOfRow(row);
    const cell = lastCell(row);
    assert.ok(classList(cell).includes('actions-cell'), dev.alias + ' last cell is .actions-cell');
    const edit = iconButtonsOf(cell).filter((n) => cyOf(n) === 'row-detail');
    assert.equal(edit.length, 1, dev.alias + ' one row-detail IconButton');
    assert.equal(edit[0].componentOptions.propsData.icon, 'fa fa-pencil');
    assert.equal(edit[0].componentOptions.propsData.label, 'Edit');
    pushed.length = 0;
    edit[0].componentOptions.listeners.click();
    assert.deepEqual(pushed, [{ name: 'DeviceDetail', params: { udid: dev.udid } }], dev.alias + ' push');
  });
});

check('compiled CSS: one-line actions cell and 32px icon buttons 4px apart', () => {
  const cell = decls('.actions-cell');
  assert.equal(value(cell, 'white-space'), 'nowrap');
  assert.equal(value(cell, 'width'), '1%');
  const btn = decls('.icon-button .btn');
  const want = { display: 'inline-flex', 'align-items': 'center', 'justify-content': 'center',
    'min-width': '32px', 'min-height': '32px', 'white-space': 'nowrap' };
  Object.keys(want).forEach((p) => assert.equal(value(btn, p), want[p], '.icon-button .btn ' + p));
  assert.equal(value(decls('.icon-button__text'), 'margin-left'), '4px');
  const gap = allRules().filter((r) => r.media === '' && r.selectors.some((s) => /^\.icon-button:not\(:last-child\)$/.test(s)));
  assert.equal(value(gap.map((r) => r.body), 'margin-right'), '4px', 'gap between icon buttons');
});

// ---------------------------------------------------------------- Devices: build, view log, revoke, grid actions (44-02)

const ELLIPSIS = String.fromCharCode(0x2026);
const ACTION_DEVICES = [
  { udid: 'a1', alias: 'Anvil', platform: 'arduino:esp8266', source: 's1', last_build_id: 'b1', keyhash: 'k' },
  { udid: 'a2', alias: 'Beacon', platform: 'sigfox', source: 's2', last_build_id: 'b2', keyhash: 'k' },
  { udid: 'a3', alias: 'Cinder', platform: 'nodemcu', last_build_id: '', keyhash: 'k' },
  { udid: 'a4', alias: 'Dynamo', platform: 'platformio', source: 's4', last_build_id: '   ', keyhash: 'k' },
  { udid: 'a5', alias: 'Ember', platform: 'mongoose', source: '', keyhash: 'k' },
  { udid: 'a6', alias: 'Flint', platform: 'sigfox', last_build_id: null, keyhash: 'k' },
];
// With a4 in flight: [icon, label, disabled] for Build, and whether View log is enabled.
const EXPECT_ACTIONS = {
  a1: { build: ['icomoon-hammer_icon', 'Build', false], log: true },
  a2: { build: ['fa fa-ban', 'Not supported', true], log: true },
  a3: { build: ['fa fa-ban', 'No source', true], log: false },
  a4: { build: ['fa fa-spin fa-circle-o-notch', 'Building' + ELLIPSIS, true], log: false },
  a5: { build: ['fa fa-ban', 'No source', true], log: false },
  a6: { build: ['fa fa-ban', 'Not supported', true], log: false },
};

function renderActions(state) {
  return renderDevices(Object.assign({ items: ACTION_DEVICES.map((d) => Object.assign({}, d)), buildingUdids: ['a4'] }, state));
}

const actionDeviceOf = (top) => ACTION_DEVICES.find((d) => textOf(top).includes(d.alias));
const propsOf = (n) => n.componentOptions.propsData;

function checkBuildAndLog(top, dev, prefix, vm) {
  const want = EXPECT_ACTIONS[dev.udid];
  const build = iconButtonsOf(top).filter((n) => cyOf(n) === prefix + '-build');
  assert.equal(build.length, 1, dev.alias + ' one ' + prefix + '-build');
  const bp = propsOf(build[0]);
  assert.deepEqual([bp.icon, bp.label, !!bp.disabled], want.build, dev.alias + ' build state');
  const log = iconButtonsOf(top).filter((n) => cyOf(n) === prefix + '-log');
  assert.equal(log.length, 1, dev.alias + ' one ' + prefix + '-log');
  const lp = propsOf(log[0]);
  assert.equal(lp.icon, 'fa fa-eye', dev.alias + ' log icon');
  assert.equal(lp.label, want.log ? 'View log' : 'No build yet', dev.alias + ' log label');
  assert.equal(!!lp.disabled, !want.log, dev.alias + ' log disabled');
  const opened = [];
  vm.$refs.buildLogDialog = { open: (b) => opened.push(b) };
  log[0].componentOptions.listeners.click();
  assert.deepEqual(opened, want.log ? [{ build_id: dev.last_build_id }] : [], dev.alias + ' log opens');
}

check('table: Build and View log states for in-flight, Sigfox, no source, no build and buildable devices', () => {
  const { vm, vnode } = renderActions({ viewMode: 'list' });
  const rows = byCy(vnode, 'device-row');
  assert.equal(rows.length, ACTION_DEVICES.length);
  rows.forEach((row) => checkBuildAndLog(lastCell(row), actionDeviceOf(row), 'row', vm));
});

check('grid: Build and View log states match the table', () => {
  const { vm, vnode } = renderActions({ viewMode: 'grid' });
  const cards = byCy(vnode, 'device-card');
  assert.equal(cards.length, ACTION_DEVICES.length);
  cards.forEach((card) => {
    const dev = ACTION_DEVICES.find((d) => deepText(card, vm).includes(d.alias));
    checkBuildAndLog(card, dev, 'card', vm);
  });
});

check('buildAction: in flight wins over every other state', () => {
  const { vm } = renderActions({ viewMode: 'list', buildingUdids: ['a2', 'a3'] });
  ['a2', 'a3'].forEach((udid) => {
    const a = vm.buildAction(vm.items.find((d) => d.udid === udid));
    assert.deepEqual([a.icon, a.label, a.disabled], ['fa fa-spin fa-circle-o-notch', 'Building' + ELLIPSIS, true], udid);
  });
});

checkAsync('buildDevice sends one request while in flight and releases it on success, failure and rejection', async () => {
  const cases = [
    [{ success: true }, 'message', 'Build triggered.'],
    [{ success: false, message: 'm' }, 'error', 'm'],
    [{ success: false }, 'error', 'Build failed.'],
    ['reject', 'error', 'Build failed.'],
  ];
  for (const [reply, field, text] of cases) {
    const { vm } = renderActions({ viewMode: 'list', buildingUdids: [] });
    const calls = [];
    let settle;
    vm.buildFirmware = (payload) => {
      calls.push(payload);
      return new Promise((resolve, reject) => {
        settle = () => (reply === 'reject' ? reject(new Error('network')) : resolve(reply));
      });
    };
    const dev = vm.items.find((d) => d.udid === 'a1');
    const first = vm.buildDevice(dev);
    const second = vm.buildDevice(dev);
    assert.equal(calls.length, 1, JSON.stringify(reply) + ' one request');
    assert.deepEqual(calls[0], { udid: 'a1', source_id: 's1' });
    assert.deepEqual(vm.buildingUdids, ['a1'], 'in flight');
    assert.equal(vm.buildAction(dev).label, 'Building' + ELLIPSIS);
    settle();
    await Promise.all([first, second]);
    assert.deepEqual(vm.buildingUdids, [], JSON.stringify(reply) + ' released');
    assert.equal(vm[field], text, JSON.stringify(reply) + ' ' + field);
    const after = vm.buildAction(dev);
    assert.deepEqual([after.icon, after.label, after.disabled], ['icomoon-hammer_icon', 'Build', false], 'enabled again');
  }
});

// UI review: a rejected load used to leave Loading... up for good with no message.
const LOAD_ERROR = 'Could not load devices. Refresh to retry.';

function stubLoad(vm, { items = [], reject = false, builds = [], rejectBuilds = false } = {}) {
  vm.fetchItems = () => (reject ? Promise.reject(new Error('network')) : Promise.resolve(items));
  vm.fetchEnviros = () => Promise.resolve([]);
  vm.fetchBuildLog = () => (rejectBuilds ? Promise.reject(new Error('network')) : Promise.resolve(builds));
  vm.getItems = () => items;
  vm.getEnviros = () => [];
  vm.getBuildItems = () => builds;
}

checkAsync('loadData: a rejected load clears Loading... and shows a visible error, not text-muted', async () => {
  const { vm } = renderDevices({ items: [], viewMode: 'list' });
  stubLoad(vm, { reject: true });
  const pending = vm.loadData();
  assert.equal(vm.loading, true, 'loading while the request runs');
  await pending;
  assert.equal(vm.loading, false, 'loading cleared');
  assert.equal(vm.error, LOAD_ERROR);
  const r = withWarnings(() => vm._render());
  assert.equal(r.error, null);
  assert.ok(!textOf(r.out).includes('Loading...'), 'Loading... gone');
  const alerts = nodesOf(r.out).filter((n) => n.tag === 'b-alert' && textOf(n) === LOAD_ERROR);
  assert.equal(alerts.length, 1, 'one alert with the load error');
  assert.equal(attrsOf(alerts[0]).variant, 'danger');
  assert.ok(!classList(alerts[0]).includes('text-muted'), 'not text-muted');
});

checkAsync('loadData: a successful load stores the devices, clears Loading... and a stale load error', async () => {
  const { vm } = renderDevices({ items: [], viewMode: 'list' });
  stubLoad(vm, { items: fleet() });
  vm.error = LOAD_ERROR;
  await vm.loadData();
  assert.equal(vm.loading, false);
  assert.equal(vm.error, null, 'a stale load error is cleared');
  assert.equal(vm.items.length, FLEET.length);
  vm.error = 'Build failed.';
  await vm.loadData();
  assert.equal(vm.error, 'Build failed.', 'other errors stay until dismissed');
});

// WR-02: last_build_id only moves on builds that produced an artifact. View log opens the
// newest build of the device from the build log list (newest first, as GET /logs/build
// returns it and as Legacy's deviceBuilds[udid][0] did), failed builds included.
const BUILDS = [
  { build_id: 'bf1', udid: 'a1', status: 'FAILED' },
  { build_id: '', udid: 'a3', status: 'UNKNOWN' },
  { build_id: 'bf3', udid: 'a3', status: 'FAILED' },
  { build_id: 'b-old', udid: 'a1', status: 'OK' },
  { build_id: 'bx', udid: 'zz', status: 'OK' },
];

check('View log opens the newest build of the device, failed ones included, else last_build_id', () => {
  ['list', 'grid'].forEach((viewMode) => {
    const { vm, vnode } = renderActions({ viewMode, builds: BUILDS.map((b) => Object.assign({}, b)) });
    const want = { a1: 'bf1', a2: 'b2', a3: 'bf3', a4: null, a5: null, a6: null };
    const prefix = viewMode === 'list' ? 'row' : 'card';
    const holders = viewMode === 'list' ? byCy(vnode, 'device-row') : byCy(vnode, 'device-card');
    assert.equal(holders.length, ACTION_DEVICES.length);
    holders.forEach((top) => {
      const dev = ACTION_DEVICES.find((d) => deepText(top, vm).includes(d.alias));
      const log = iconButtonsOf(top).filter((n) => cyOf(n) === prefix + '-log')[0];
      const lp = propsOf(log);
      const id = want[dev.udid];
      assert.equal(lp.label, id ? 'View log' : 'No build yet', viewMode + ' ' + dev.alias + ' label');
      assert.equal(!!lp.disabled, !id, viewMode + ' ' + dev.alias + ' disabled');
      const opened = [];
      vm.$refs.buildLogDialog = { open: (b) => opened.push(b) };
      log.componentOptions.listeners.click();
      assert.deepEqual(opened, id ? [{ build_id: id }] : [], viewMode + ' ' + dev.alias + ' opens');
    });
  });
});

checkAsync('loadData stores the build list; a failed build list still loads the devices', async () => {
  const { vm } = renderDevices({ items: [], viewMode: 'list' });
  stubLoad(vm, { items: ACTION_DEVICES.map((d) => Object.assign({}, d)), builds: BUILDS });
  await vm.loadData();
  assert.equal(vm.builds.length, BUILDS.length);
  assert.equal(vm.latestBuildId(vm.items.find((d) => d.udid === 'a3')), 'bf3');
  const second = renderDevices({ items: [], viewMode: 'list' }).vm;
  stubLoad(second, { items: ACTION_DEVICES.map((d) => Object.assign({}, d)), rejectBuilds: true });
  await second.loadData();
  assert.equal(second.error, null, 'no error for a failed build list');
  assert.equal(second.items.length, ACTION_DEVICES.length);
  assert.deepEqual(second.builds, []);
  assert.equal(second.latestBuildId(second.items.find((d) => d.udid === 'a1')), 'b1', 'falls back to last_build_id');
});

checkAsync('buildDevice sends nothing for a disabled state', async () => {
  const { vm } = renderActions({ viewMode: 'list', buildingUdids: ['a4'] });
  const calls = [];
  vm.buildFirmware = (payload) => { calls.push(payload); return Promise.resolve({ success: true }); };
  for (const udid of ['a2', 'a3', 'a4', 'a5', 'a6']) await vm.buildDevice(vm.items.find((d) => d.udid === udid));
  assert.deepEqual(calls, []);
});

check('table actions: Build, View log, Edit, Revoke, all IconButtons; Revoke keeps its confirmation', () => {
  const { vm, vnode } = renderActions({ viewMode: 'list' });
  const asked = [];
  vm.$bvModal = { msgBoxConfirm: (body, opts) => { asked.push([body, opts]); return Promise.resolve(false); } };
  byCy(vnode, 'device-row').forEach((row) => {
    const dev = actionDeviceOf(row);
    const cell = lastCell(row);
    const buttons = iconButtonsOf(cell);
    assert.deepEqual(buttons.map(cyOf), ['row-build', 'row-log', 'row-detail', 'row-revoke'], dev.alias + ' order');
    assert.equal(nodesOf(cell).filter((n) => n.tag === 'b-button').length, 0, dev.alias + ' no text buttons');
    const revoke = propsOf(buttons[3]);
    assert.deepEqual([revoke.icon, revoke.label, revoke.variant], ['fa fa-trash', 'Revoke', 'danger']);
    asked.length = 0;
    buttons[3].componentOptions.listeners.click();
    assert.equal(asked.length, 1, dev.alias + ' asks once');
    assert.equal(asked[0][0], 'Revoke this device? This cannot be undone.');
    assert.equal(asked[0][1].title, 'Confirm Revoke');
    assert.equal(asked[0][1].okVariant, 'danger');
    assert.equal(asked[0][1].okTitle, 'Revoke');
  });
});

check('grid actions: one non-wrapping row of checkbox, Build, View log, Edit (pushed right); no Revoke', () => {
  const { vm, vnode } = renderActions({ viewMode: 'grid' });
  const pushed = [];
  vm.$router = { push: (to) => pushed.push(to) };
  byCy(vnode, 'device-card').forEach((card) => {
    const dev = ACTION_DEVICES.find((d) => deepText(card, vm).includes(d.alias));
    const rows = nodesOf(card).filter((n) => n.tag === 'div' && ['d-flex', 'align-items-center', 'flex-nowrap'].every((c) => classList(n).includes(c)));
    assert.equal(rows.length, 1, dev.alias + ' one action row');
    const parts = tagged(rows[0]);
    assert.equal(parts.length, 4, dev.alias + ' four parts');
    assert.ok(classList(parts[0]).includes('abc-checkbox'), dev.alias + ' checkbox first');
    assert.equal(attrsOf(nodesOf(parts[0]).find((n) => n.tag === 'input')).id, 'grid-checkbox-' + dev.udid);
    assert.deepEqual(parts.slice(1).map(cyOf), ['card-build', 'card-log', 'card-detail']);
    parts.slice(1).forEach((p) => assert.ok(isComponent(p, 'IconButton'), dev.alias + ' ' + cyOf(p) + ' is an IconButton'));
    const edit = parts[3];
    assert.deepEqual([propsOf(edit).icon, propsOf(edit).label], ['fa fa-pencil', 'Edit']);
    assert.ok(classList(edit).includes('ml-auto'), dev.alias + ' Edit pushed right');
    pushed.length = 0;
    edit.componentOptions.listeners.click();
    assert.deepEqual(pushed, [{ name: 'DeviceDetail', params: { udid: dev.udid } }]);
    assert.ok(!iconButtonsOf(card).some((n) => propsOf(n).label === 'Revoke' || /revoke/.test(cyOf(n) || '')), dev.alias + ' no Revoke');
    assert.equal(nodesOf(card).filter((n) => n.tag === 'b-button').length, 0, dev.alias + ' no text buttons');
  });
});

check('Devices renders exactly one BuildLogDialog with ref buildLogDialog, in both views', () => {
  ['list', 'grid'].forEach((viewMode) => {
    const { vnode } = renderActions({ viewMode });
    const dialogs = componentsOf(vnode, 'BuildLogDialog');
    assert.equal(dialogs.length, 1, viewMode);
    assert.equal(dialogs[0].data.ref, 'buildLogDialog', viewMode);
  });
});

check('icomoon fonts are byte copies of the Legacy files', () => {
  ['icomoon.woff', 'icomoon.ttf'].forEach((f) => {
    const legacy = fs.readFileSync(path.join(SRC, '..', '..', 'src', 'assets', 'thinx', 'fonts', f));
    const copy = fs.readFileSync(path.join(SRC, 'fonts', 'icomoon', f));
    assert.ok(legacy.equals(copy), f + ' differs');
  });
});

check('compiled theme: icomoon font face (woff, ttf) and only the hammer glyph rule', () => {
  const css = compiledCss();
  const faces = (css.match(/@font-face\{[^}]*\}/g) || []).filter((f) => /font-family:\s*["']?icomoon["']?/.test(f));
  assert.equal(faces.length, 1, 'one icomoon @font-face');
  assert.ok(faces[0].includes('icomoon.woff') && faces[0].includes('icomoon.ttf'), 'woff and ttf: ' + faces[0]);
  const content = value(decls('.icomoon-hammer_icon:before'), 'content');
  assert.ok(content === '"\\e900"' || content === '"' + String.fromCharCode(0xE900) + '"', 'hammer content ' + JSON.stringify(content));
  assert.match(String(value(decls('.icomoon-hammer_icon'), 'font-family')), /icomoon.*!important/);
  const icomoonSelectors = [...new Set(allRules().flatMap((r) => r.selectors).filter((s) => /icomoon-/.test(s)))].sort();
  assert.deepEqual(icomoonSelectors, ['.icomoon-hammer_icon', '.icomoon-hammer_icon:before']);
  const imports = read('styles/theme.scss').split('\n').filter((l) => l.trim() === "@import '../fonts/icomoon/icomoon';");
  assert.equal(imports.length, 1, 'theme imports the icomoon partial once');
});

// ---------------------------------------------------------------- Devices: status, firmware, API-key warning (44-02)

const CC = (n) => String.fromCharCode(n);
// Legacy's text (device.html "No API Key assigned"); keyhash is a console-chosen key used by
// builds, not a check-in precondition, so the tip makes no claim about check-in (44 CR-01).
const API_KEY_TIP = 'No API Key assigned';
const LONG_STATUS = Array.from({ length: 200 }, (_, i) => CC(97 + (i % 26))).join('');
// Status fixtures are built with String.fromCharCode, so this file holds no control-character escapes.
const STATUS_DEVICES = [
  { udid: 's1', alias: 'Kilo', keyhash: null, firmware: 'thinx-1.2.3' },
  { udid: 's2', alias: 'Lima', keyhash: '', status: null },
  { udid: 's3', alias: 'Mike', status: '', firmware: '' },
  { udid: 's4', alias: 'November', keyhash: 'abc', status: 'x' },
  { udid: 's5', alias: 'Oscar', keyhash: 'abc', status: 'Online', firmware: null },
  { udid: 's6', alias: 'Papa', keyhash: 'abc', status: LONG_STATUS },
  { udid: 's7', alias: 'Quebec', keyhash: 'abc', status: 'On' + CC(9) + 'li' + CC(7) + 'ne' + CC(127) },
  { udid: 's8', alias: 'Romeo', keyhash: 'abc', status: 'Fault #E12' },
  { udid: 's9', alias: 'Sierra', keyhash: 'abc', status: 'low batt #w' },
  { udid: 's10', alias: 'Tango', keyhash: null, status: '#e and #W', firmware: 'x'.repeat(120) },
  { udid: 's11', alias: 'Uniform', keyhash: 'abc', status: 'A' + CC(1) },
];
const EXPECT_STATUS = {
  s1: { key: true, text: 'Registered', title: null, alert: false, warning: false, firmware: 'thinx-1.2.3' },
  s2: { key: true, text: 'Registered', title: null, alert: false, warning: false, firmware: '' },
  s3: { key: true, text: 'Registered', title: null, alert: false, warning: false, firmware: '' },
  s4: { key: false, text: 'Registered', title: null, alert: false, warning: false, firmware: '' },
  s5: { key: false, text: 'Online', title: null, alert: false, warning: false, firmware: '' },
  s6: { key: false, text: LONG_STATUS.slice(0, 22) + ELLIPSIS, title: LONG_STATUS, alert: false, warning: false, firmware: '' },
  s7: { key: false, text: 'Online', title: null, alert: false, warning: false, firmware: '' },
  s8: { key: false, text: 'Fault #E12', title: null, alert: true, warning: false, firmware: '' },
  s9: { key: false, text: 'low batt #w', title: null, alert: false, warning: true, firmware: '' },
  s10: { key: true, text: '#e and #W', title: null, alert: true, warning: true, firmware: 'x'.repeat(120) },
  s11: { key: false, text: 'Registered', title: null, alert: false, warning: false, firmware: '' },
};

function renderStatus(viewMode) {
  return renderDevices({ items: STATUS_DEVICES.map((d) => Object.assign({}, d)), viewMode });
}

const statusDeviceOf = (top, vm) => {
  const text = deepText(top, vm);
  const hits = STATUS_DEVICES.filter((d) => new RegExp('\\b' + d.alias + '\\b').test(text));
  assert.equal(hits.length, 1, 'one alias in ' + text.slice(0, 60));
  return hits[0];
};

function checkMarker(node, cls, text) {
  assert.equal(node.tag, 'span', cls + ' is a span');
  assert.deepEqual(classList(node), [cls]);
  assert.equal(attrsOf(node).role, 'img', cls + ' role');
  assert.equal(attrsOf(node)['aria-label'], text, cls + ' aria-label');
  assert.equal(attrsOf(node).title, text, cls + ' title');
  const glyph = tagged(node);
  assert.equal(glyph.length, 1, cls + ' one glyph');
  assert.equal(glyph[0].tag, 'i');
  assert.deepEqual(classList(glyph[0]), ['fa', 'fa-warning']);
  assert.equal(attrsOf(glyph[0])['aria-hidden'], 'true');
}

function checkStatus(top, dev) {
  const want = EXPECT_STATUS[dev.udid];
  const holders = byClass(top, 'device-status');
  assert.equal(holders.length, 1, dev.alias + ' one .device-status');
  assert.equal(holders[0].tag, 'span');
  const parts = tagged(holders[0]);
  const heart = parts.shift();
  assert.equal(heart.tag, 'i', dev.alias + ' heartbeat first');
  assert.deepEqual(classList(heart), ['fa', 'fa-heartbeat']);
  assert.equal(attrsOf(heart)['aria-hidden'], 'true');
  const warnings = byCy(top, 'api-key-warning');
  if (want.key) {
    const key = parts.shift();
    assert.equal(warnings.length, 1, dev.alias + ' one api-key-warning');
    assert.equal(key, warnings[0], dev.alias + ' the warning follows the heartbeat');
    assert.equal(cyOf(key), 'api-key-warning');
    checkMarker(key, 'api-key-indicator', API_KEY_TIP);
  } else {
    assert.equal(warnings.length, 0, dev.alias + ' no api-key-warning');
    assert.equal(byClass(top, 'api-key-indicator').length, 0, dev.alias + ' no indicator');
  }
  const label = parts.shift();
  assert.equal(label.tag, 'span', dev.alias + ' status text span');
  assert.deepEqual(classList(label), [], dev.alias + ' status text has no class');
  assert.equal(textOf(label), want.text, dev.alias + ' status text');
  if (want.title === null) assert.ok(attrsOf(label).title == null, dev.alias + ' no status title');
  else assert.equal(attrsOf(label).title, want.title, dev.alias + ' status title');
  if (want.alert) checkMarker(parts.shift(), 'status-alert', 'Device reported an error');
  if (want.warning) checkMarker(parts.shift(), 'status-warning', 'Device reported a warning');
  assert.equal(parts.length, 0, dev.alias + ' nothing else in the status');
  const control = (c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127;
  assert.ok(!nodesOf(holders[0]).some((n) => !n.tag && n.text && n.text.split('').some(control)), dev.alias + ' no control characters');
}

function checkCogs(node, dev) {
  const glyphs = tagged(node);
  assert.equal(glyphs.length, 1, dev.alias + ' one glyph in the firmware');
  assert.equal(glyphs[0].tag, 'i');
  assert.deepEqual(classList(glyphs[0]), ['fa', 'fa-cogs']);
  assert.equal(attrsOf(glyphs[0])['aria-hidden'], 'true');
  const want = EXPECT_STATUS[dev.udid].firmware;
  assert.equal(textOf(node), want || CC(0x2014), dev.alias + ' firmware text');
}

check('table: heartbeat, API-key warning, cleaned status and markers in the Status cell', () => {
  const { vm, vnode } = renderStatus('list');
  const rows = byCy(vnode, 'device-row');
  assert.equal(rows.length, STATUS_DEVICES.length);
  rows.forEach((row) => {
    const dev = statusDeviceOf(row, vm);
    const tds = (row.children || []).filter((n) => n.tag === 'td');
    checkStatus(tds[5], dev);
  });
});

check('grid: the same status line in every card', () => {
  const { vm, vnode } = renderStatus('grid');
  const cards = byCy(vnode, 'device-card');
  assert.equal(cards.length, STATUS_DEVICES.length);
  cards.forEach((card) => checkStatus(card, statusDeviceOf(card, vm)));
});

check('table: firmware cell with cogs, full text as title, dash when empty', () => {
  const { vm, vnode } = renderStatus('list');
  byCy(vnode, 'device-row').forEach((row) => {
    const dev = statusDeviceOf(row, vm);
    const td = (row.children || []).filter((n) => n.tag === 'td')[4];
    assert.deepEqual(classList(td), ['firmware-cell'], dev.alias + ' firmware-cell');
    const want = EXPECT_STATUS[dev.udid].firmware;
    if (want) assert.equal(attrsOf(td).title, want, dev.alias + ' firmware title');
    else assert.ok(attrsOf(td).title == null, dev.alias + ' no firmware title');
    checkCogs(td, dev);
  });
});

check('grid: firmware line with cogs in body text', () => {
  const { vm, vnode } = renderStatus('grid');
  byCy(vnode, 'device-card').forEach((card) => {
    const dev = statusDeviceOf(card, vm);
    const lines = byClass(card, 'device-firmware');
    assert.equal(lines.length, 1, dev.alias + ' one firmware line');
    assert.equal(lines[0].tag, 'p');
    assert.ok(!classList(lines[0]).includes('text-muted') && !classList(lines[0]).includes('small'), dev.alias + ' body text');
    checkCogs(lines[0], dev);
  });
});

check('status helpers: Registered, truncation, control characters and markers', () => {
  const { vm } = renderStatus('list');
  [undefined, null, '', 'x', CC(9) + 'y' + CC(0)].forEach((s) => assert.equal(vm.statusText(s), 'Registered', JSON.stringify(s)));
  assert.equal(vm.statusText('Online'), 'Online');
  assert.equal(vm.statusTitle('Online'), null);
  assert.equal(vm.statusText(LONG_STATUS), LONG_STATUS.slice(0, 22) + ELLIPSIS);
  assert.equal(vm.statusTitle(LONG_STATUS), LONG_STATUS);
  assert.equal(vm.statusText('a'.repeat(22)), 'a'.repeat(22), '22 characters are not truncated');
  assert.equal(vm.cleanStatus('a' + CC(31) + 'b' + CC(127) + 'c' + CC(32) + 'd'), 'abc d');
  assert.equal(vm.statusHasError('x #E y'), true);
  assert.equal(vm.statusHasWarning('x #W y'), true);
  assert.equal(vm.statusHasError('ok'), false);
  assert.equal(vm.statusHasWarning(null), false);
  assert.equal(vm.missingApiKey({ keyhash: null }), true);
  assert.equal(vm.missingApiKey({}), true);
  assert.equal(vm.missingApiKey({ keyhash: '' }), true);
  assert.equal(vm.missingApiKey({ keyhash: 'abc' }), false);
});

check('Devices.vue: no control-character escape or regex, no raw HTML, tip defined once, heartbeat in both views', () => {
  const { source } = devices();
  const bs = CC(92);
  [bs + 'x0', bs + 'x1', bs + 'u000', bs + 'u001', 'v-html'].forEach((s) => assert.equal(source.indexOf(s), -1, 'found ' + s));
  assert.equal(source.split(API_KEY_TIP).length - 1, 1, 'API-key tip defined once');
  assert.doesNotMatch(source, /check in|check-in/i, 'no check-in claim in Devices.vue');
  assert.ok(source.split('fa fa-heartbeat').length - 1 >= 2, 'heartbeat in table and grid');
});

check('status and icon helpers accept strings (icon: numbers too) and never throw on {toString:1}', () => {
  const { vm } = renderStatus('list');
  [WEIRD(), 42, true, {}, ['#e']].forEach((s) => {
    const label = JSON.stringify(s);
    assert.equal(vm.cleanStatus(s), '', label);
    assert.equal(vm.statusText(s), 'Registered', label);
    assert.equal(vm.statusTitle(s), null, label);
    assert.equal(vm.statusHasError(s), false, label);
    assert.equal(vm.statusHasWarning(s), false, label);
  });
  [WEIRD(), {}, [7], true].forEach((i) => assert.equal(vm.symbolSrc(i), 'sym:b_medium_01.png', JSON.stringify(i)));
  assert.equal(vm.symbolSrc(7), 'sym:b_medium_07.png');
  assert.equal(vm.symbolSrc('12'), 'sym:b_medium_12.png');
});

check('Devices renders, filters and sorts a device whose platform, status and icon are {toString:1}', () => {
  const weird = { udid: 'w1', alias: 'Whiskey', mac: 'WW', keyhash: 'k', platform: WEIRD(), status: WEIRD(), icon: WEIRD() };
  ['list', 'grid'].forEach((viewMode) => {
    const { vm } = renderDevices({ items: fleet().concat([weird]), viewMode });
    ['platform', 'alias', 'lastupdate'].forEach((sortBy) => {
      vm.sortBy = sortBy;
      assert.equal(vm.filteredItems.length, FLEET.length + 1, viewMode + ' ' + sortBy);
    });
    vm.platformFilter = 'unknown';
    assert.ok(vm.filteredItems.some((d) => d.udid === 'w1'), viewMode + ' under the unknown pill');
    assert.ok(vm.platformPills.some((p) => p.key === 'unknown'), viewMode + ' unknown pill');
    vm.searchText = 'whis';
    const again = withWarnings(() => vm._render());
    assert.equal(again.error, null, viewMode + ' renders without error');
    assert.equal(byCy(again.out, viewMode === 'list' ? 'device-row' : 'device-card').length, 1, viewMode + ' one match');
  });
});

const loose = (sel) => sel.replace(/\s*([>+~])\s*/g, '$1').replace(/\s+/g, ' ').trim();
function declsLoose(selector) {
  const want = loose(selector);
  return allRules().filter((r) => r.media === '' && r.selectors.some((s) => loose(s) === want)).map((r) => r.body);
}

check('compiled CSS: warning colours reach 3:1, firmware ellipsis at 240px, 8px status and cogs gaps', () => {
  const page = parseColour('#333867');
  const ratios = [];
  [['.api-key-indicator', '#FFA500'], ['.status-alert', '#FF6B6B'], ['.status-warning', '#F0AD4E']].forEach(([sel, hex]) => {
    const c = parseColour(value(decls(sel), 'color'));
    assert.ok(sameColour(c, parseColour(hex)), sel + ' colour ' + value(decls(sel), 'color'));
    const ratio = contrast(c, page);
    assert.ok(ratio >= 3, sel + ' ' + ratio.toFixed(2));
    ratios.push(sel + ' ' + ratio.toFixed(2));
  });
  const fw = decls('.firmware-cell');
  const want = { 'max-width': '240px', overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' };
  Object.keys(want).forEach((p) => assert.equal(value(fw, p), want[p], '.firmware-cell ' + p));
  assert.equal(value(decls('.device-firmware'), 'overflow-wrap'), 'anywhere');
  assert.equal(value(declsLoose('.device-status > * + *'), 'margin-left'), '8px', 'status gap');
  assert.equal(value(declsLoose('.firmware-cell > .fa-cogs'), 'margin-right'), '8px', 'table cogs gap');
  assert.equal(value(declsLoose('.device-firmware > .fa-cogs'), 'margin-right'), '8px', 'grid cogs gap');
  return ratios.join(', ');
});

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

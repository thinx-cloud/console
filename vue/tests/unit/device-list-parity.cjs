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
  const child = new opts.Ctor({ propsData: opts.propsData, _parentVnode: vnode, parent: parentVm });
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

// ---------------------------------------------------------------- Devices.vue

const DEVICES = [
  { udid: 'd1', alias: 'Alpha', platform: 'arduino:esp8266', icon: 7, keyhash: 'k1', lastupdate: '2026-10-01T10:00:00Z', mac: 'AA' },
  { udid: 'd2', alias: 'Bravo', platform: 'PlatformIO', icon: '12', keyhash: 'k2', lastupdate: '2026-10-02T10:00:00Z', mac: 'BB' },
  { udid: 'd3', alias: 'Charlie', platform: 'sigfox', icon: 73, keyhash: 'k3', lastupdate: '2026-10-03T10:00:00Z', mac: 'CC' },
  { udid: 'd4', alias: 'Delta', platform: 'unknown_platform', icon: 0, keyhash: 'k4', lastupdate: '2026-10-04T10:00:00Z', mac: 'DD' },
  { udid: 'd5', alias: 'Echo', icon: null, keyhash: 'k5', lastupdate: '2026-10-05T10:00:00Z', mac: 'EE' },
];

const devices = lazy(() => {
  const p = platforms();
  return loadSfc('pages/Devices/Devices.vue', { PlatformBullet: bullet().def, basePlatform: p.basePlatform, platformInfo: p.platformInfo });
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

process.exit(failures ? 1 : 0);

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

// ---------------------------------------------------------------- compiled theme (platform palette)

const sass = require('sass');
const { execFileSync } = require('child_process');

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

// Copy of the repositories store headers (store/repositories.js is not changed).
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

check('store/repositories.js is unchanged since the phase start (cfff199)', () => {
  let out;
  try {
    execFileSync('git', ['cat-file', '-e', 'cfff199^{commit}'], { cwd: SRC, stdio: 'ignore' });
  } catch (e) {
    return 'skipped: cfff199 not in this checkout';
  }
  out = execFileSync('git', ['diff', 'cfff199', '--', 'store/repositories.js'], { cwd: SRC, encoding: 'utf8' });
  assert.equal(out, '');
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

process.exit(failures ? 1 : 0);

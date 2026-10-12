// Unit test for the "THiNX Console" / "THiNX Cloud" footer links (phase 22, CI-03).
//
// The footers bind :href="this.$hostnames.CONSOLE" and .LANDING. $hostnames is an
// own property that src/mixins/hostnames.js assigns in created(); a component that
// does not declare that mixin falls through to the empty Vue.prototype.$hostnames
// object from src/main.js, and Vue drops the undefined href. The authenticated
// Layout footer shipped that way.
//
// This renders the real <footer> of each SFC with the component's own mixins and
// the real hostnames.js, then sweeps src for every $hostnames reader and requires
// the mixin there. The Vue app has no unit runner (cypress only), so the SFC is
// split with vue-template-compiler and the script's ESM imports are rewritten
// before evaluation. Plain node, no build, no browser: npm run test:unit
//
// Since phase 42 (UI-05) the footer is the shared AppFooter component
// (src/components/AppFooter/AppFooter.vue). A page that carries an <AppFooter> tag
// is rendered through that component with the page's variant, and this file also
// checks the build year / commit id contract (D-09..D-12, UI-D08, UI-D11, UI-D12):
// ordered one-line text, a 7-hex commit id or nothing, a year after 2018 or no range,
// and the vue.config.js values that feed them, each in a clean child process.
// It also checks that Login, PasswordReset and Layout carry the AppFooter tag and no
// footer markup of their own, and that the compiled footer colours reach WCAG AA
// (4.5:1) on the lightest page gradient stop #333867 (UI-D09, UI-D10).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const sass = require('sass');

const VUE_ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(VUE_ROOT, 'src');

// Load the libraries before stubbing window, so Vue does not take the browser path.
const Vue = require('vue/dist/vue.runtime.common.js');
const compiler = require('vue-template-compiler');
const vuex = require('vuex');

global.window = { location: { origin: 'https://served-origin.invalid' } };

// Test constants that match what the live bundle compiles (scheme-less console host).
process.env.VUE_APP_CONSOLE_HOSTNAME = 'console.thinx.cloud';
process.env.VUE_APP_LANDING_HOSTNAME = 'https://thinx.cloud';
process.env.VUE_APP_API_HOSTNAME = 'https://app.thinx.cloud';

Vue.config.productionTip = false;
Vue.config.devtools = false;

let renderError = null;
Vue.config.errorHandler = (err) => { renderError = err; };

// Mirrors src/main.js:23. Components without the hostnames mixin read this.
Vue.prototype.$hostnames = {};

let failures = 0;

function check(name, condition) {
  console.log((condition ? 'ok   ' : 'FAIL ') + name);
  if (!condition) failures++;
}

// Anything that is not the mixin under test or vuex: child components, utils.
function stubModule() {
  return new Proxy({}, {
    get(target, key) {
      if (key === 'default') return {};
      if (key === '__esModule') return true;
      return function noop() {};
    },
  });
}

function resolveImport(specifier) {
  if (specifier === '@/mixins/hostnames') {
    return loadModule(fs.readFileSync(path.join(SRC, 'mixins', 'hostnames.js'), 'utf8'));
  }
  if (specifier === 'vuex') return vuex;
  return stubModule();
}

// Minimal ESM-to-function loader for the component scripts and the mixin.
function loadModule(source) {
  let code = source;
  code = code.replace(/^\s*import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"];?/gm, (m, names, spec) => {
    const parts = names.split(',').map((s) => s.trim()).filter(Boolean)
      .map((s) => s.replace(/\s+as\s+/, ': '));
    return 'const { ' + parts.join(', ') + ' } = __import(' + JSON.stringify(spec) + ');';
  });
  code = code.replace(/^\s*import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s*['"]([^'"]+)['"];?/gm,
    (m, name, spec) => 'const ' + name + ' = __import(' + JSON.stringify(spec) + ');');
  code = code.replace(/^\s*import\s+([A-Za-z_$][\w$]*)\s+from\s*['"]([^'"]+)['"];?/gm,
    (m, name, spec) => 'const ' + name + ' = __import(' + JSON.stringify(spec) + ').default;');
  code = code.replace(/^\s*import\s*['"][^'"]+['"];?/gm, '');
  code = code.replace(/\bexport\s+default\b/, 'module.exports.default =');
  const module = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('module', '__import', code)(module, resolveImport);
  return module.exports;
}

function collectAnchors(vnode, out) {
  if (!vnode) return out;
  if (vnode.tag === 'a') {
    const text = (vnode.children || []).map((c) => c.text || '').join('').trim();
    out[text] = vnode.data && vnode.data.attrs ? vnode.data.attrs.href : undefined;
  }
  (vnode.children || []).forEach((child) => collectAnchors(child, out));
  return out;
}

// All text in document order, whitespace runs collapsed to one space, trimmed.
function collectText(vnode) {
  const parts = [];
  (function walkText(node) {
    if (!node) return;
    if (!node.tag && typeof node.text === 'string') parts.push(node.text);
    (node.children || []).forEach(walkText);
  }(vnode));
  return parts.join('').replace(/\s+/g, ' ').trim();
}

function classList(data) {
  const out = [];
  if (!data) return out;
  if (typeof data.staticClass === 'string') out.push(...data.staticClass.split(/\s+/));
  const bound = data.class;
  if (typeof bound === 'string') out.push(...bound.split(/\s+/));
  else if (Array.isArray(bound)) bound.forEach((c) => { if (typeof c === 'string') out.push(...c.split(/\s+/)); });
  else if (bound && typeof bound === 'object') Object.keys(bound).forEach((k) => { if (bound[k]) out.push(k); });
  return out.filter(Boolean);
}

function findByClass(vnode, cls, out) {
  const found = out || [];
  if (!vnode) return found;
  if (classList(vnode.data).indexOf(cls) !== -1) found.push(vnode);
  (vnode.children || []).forEach((child) => findByClass(child, cls, found));
  return found;
}

const APP_FOOTER = 'src/components/AppFooter/AppFooter.vue';

// Renders the footer of a page. A page with an <AppFooter> tag is rendered through
// AppFooter.vue with the tag's variant; otherwise the page's first inline <footer>.
// Returns { anchors, text, vnode } or { error }.
function renderFooter(relPath, forcedVariant) {
  let target = relPath;
  let propsData;
  if (forcedVariant !== undefined) {
    propsData = { variant: forcedVariant };
  } else {
    const page = compiler.parseComponent(fs.readFileSync(path.join(VUE_ROOT, relPath), 'utf8'));
    const tag = (page.template.content.match(/<AppFooter\b[^>]*>/) || [])[0];
    if (tag) {
      target = APP_FOOTER;
      propsData = { variant: (tag.match(/\bvariant="([^"]*)"/) || [])[1] };
    }
  }
  if (!fs.existsSync(path.join(VUE_ROOT, target))) return { error: target + ' does not exist' };
  const sfc = compiler.parseComponent(fs.readFileSync(path.join(VUE_ROOT, target), 'utf8'));
  const footer = (sfc.template.content.match(/<footer[\s\S]*?<\/footer>/) || [])[0];
  if (!footer) return { error: 'no <footer> in template' };
  // @vue/cli-service 5 compiles SFC templates with whitespace: 'condense'; use the
  // same option so a spacing bug in the template shows up here.
  const compiled = compiler.compileToFunctions(footer, { whitespace: 'condense' });
  const options = loadModule(sfc.script.content).default;

  const vmOptions = {
    mixins: options.mixins || [],
    render: compiled.render,
    staticRenderFns: compiled.staticRenderFns,
  };
  // Passing data: undefined makes Vue warn and the render throw; only add a real one.
  if (typeof options.data === 'function') vmOptions.data = options.data;
  if (options.props) vmOptions.props = options.props;
  if (options.computed) vmOptions.computed = options.computed;
  if (propsData) vmOptions.propsData = propsData;

  renderError = null;
  try {
    const vm = new Vue(vmOptions);
    const vnode = vm._render();
    if (renderError) return { error: renderError.message };
    return { anchors: collectAnchors(vnode, {}), text: collectText(vnode), vnode };
  } catch (e) {
    return { error: e.message };
  }
}

function describe(result, label) {
  if (result.error) return 'render threw: ' + result.error;
  return String(result.anchors[label]);
}

const FOOTERS = [
  'src/components/Layout/Layout.vue',
  'src/pages/Login/Login.vue',
  'src/pages/PasswordReset/PasswordReset.vue',
];

FOOTERS.forEach((relPath) => {
  const name = path.basename(relPath, '.vue');
  const result = renderFooter(relPath);
  check(name + ' footer THiNX Console -> ' + describe(result, 'THiNX Console'),
    !result.error && result.anchors['THiNX Console'] === 'https://console.thinx.cloud');
  check(name + ' footer THiNX Cloud -> ' + describe(result, 'THiNX Cloud'),
    !result.error && result.anchors['THiNX Cloud'] === 'https://thinx.cloud');
});

// Documented fallback: an unset build var yields the serving origin, never undefined.
// Rendered through AppFooter variant layout, which every authenticated page shows.
const savedConsole = process.env.VUE_APP_CONSOLE_HOSTNAME;
delete process.env.VUE_APP_CONSOLE_HOSTNAME;
const fallback = renderFooter(APP_FOOTER, 'layout');
check('AppFooter variant layout falls back to the serving origin when VUE_APP_CONSOLE_HOSTNAME is unset -> ' +
  describe(fallback, 'THiNX Console'),
  !fallback.error && fallback.anchors['THiNX Console'] === 'https://served-origin.invalid');
process.env.VUE_APP_CONSOLE_HOSTNAME = savedConsole;

// --- Build year and commit id (UI-05, D-09..D-12) ----------------------------------

const COPY = '©';
const NDASH = '–';
const MIDDOT = '·';

function withBuildEnv(hash, year, fn) {
  const saved = { hash: process.env.VUE_APP_BUILD_HASH, year: process.env.VUE_APP_BUILD_YEAR };
  if (hash === undefined) delete process.env.VUE_APP_BUILD_HASH; else process.env.VUE_APP_BUILD_HASH = hash;
  if (year === undefined) delete process.env.VUE_APP_BUILD_YEAR; else process.env.VUE_APP_BUILD_YEAR = year;
  try {
    return fn();
  } finally {
    if (saved.hash === undefined) delete process.env.VUE_APP_BUILD_HASH; else process.env.VUE_APP_BUILD_HASH = saved.hash;
    if (saved.year === undefined) delete process.env.VUE_APP_BUILD_YEAR; else process.env.VUE_APP_BUILD_YEAR = saved.year;
  }
}

function renderApp(variant, hash, year) {
  return withBuildEnv(hash, year, () => renderFooter(APP_FOOTER, variant));
}

function shown(result) {
  return result.error ? 'render threw: ' + result.error : JSON.stringify(result.text);
}

['auth', 'layout'].forEach((variant) => {
  const label = 'AppFooter variant ' + variant;
  const full = renderApp(variant, 'a1b2c3d', '2030');
  const want = COPY + ' 2018 ' + NDASH + ' 2030 THiNX Console by THiNX Cloud ' + MIDDOT + ' Build a1b2c3d';
  check(label + ' renders the ordered one-line footer -> ' + shown(full), !full.error && full.text === want);
  if (!full.error) {
    const hashes = findByClass(full.vnode, 'build-hash');
    const seps = findByClass(full.vnode, 'footer-sep');
    check(label + ' has one .build-hash titled "Build a1b2c3d"',
      hashes.length === 1 && hashes[0].data.attrs && hashes[0].data.attrs.title === 'Build a1b2c3d');
    check(label + ' has one aria-hidden .footer-sep',
      seps.length === 1 && seps[0].data.attrs && seps[0].data.attrs['aria-hidden'] === 'true');
    const rootClass = variant === 'layout' ? 'contentFooter' : 'auth-footer';
    check(label + ' root is <footer class="' + rootClass + '">',
      full.vnode.tag === 'footer' && classList(full.vnode.data).indexOf(rootClass) !== -1);
    check(label + ' THiNX Console -> ' + full.anchors['THiNX Console'],
      full.anchors['THiNX Console'] === 'https://console.thinx.cloud');
    check(label + ' THiNX Cloud -> ' + full.anchors['THiNX Cloud'],
      full.anchors['THiNX Cloud'] === 'https://thinx.cloud');
  } else {
    check(label + ' has one .build-hash titled "Build a1b2c3d"', false);
  }

  const upper = renderApp(variant, 'A1B2C3D', '2030');
  check(label + ' shows an upper-case 7-hex id -> ' + shown(upper),
    !upper.error && upper.text === COPY + ' 2018 ' + NDASH + ' 2030 THiNX Console by THiNX Cloud ' + MIDDOT + ' Build A1B2C3D');

  const noHash = COPY + ' 2018 ' + NDASH + ' 2030 THiNX Console by THiNX Cloud';
  ['', 'dev', 'undefined', 'a1b2c3d4', 'zzzzzzz', undefined].forEach((hash) => {
    const r = renderApp(variant, hash, '2030');
    const ok = !r.error && r.text === noHash
      && findByClass(r.vnode, 'build-hash').length === 0
      && findByClass(r.vnode, 'footer-sep').length === 0
      && r.text.indexOf(MIDDOT) === -1 && !/\bdev\b|undefined/.test(r.text);
    check(label + ' hides hash and separator for hash ' + JSON.stringify(hash === undefined ? '<unset>' : hash)
      + ' -> ' + shown(r), ok);
  });

  const noRange = COPY + ' 2018 THiNX Console by THiNX Cloud ' + MIDDOT + ' Build a1b2c3d';
  ['2018', '2017', '', 'abcd', '20301', undefined].forEach((year) => {
    const r = renderApp(variant, 'a1b2c3d', year);
    check(label + ' shows no year range for year ' + JSON.stringify(year === undefined ? '<unset>' : year)
      + ' -> ' + shown(r), !r.error && r.text === noRange && r.text.indexOf(NDASH) === -1);
  });
});

// --- vue.config.js build env, each case in a clean child process -------------------

function runConfig(cwd, vars) {
  // Built from scratch: PATH plus the variables under test, never a copy of
  // process.env, so a CI CIRCLE_SHA1 or a shell VUE_APP_* cannot leak in.
  const env = Object.assign({ PATH: process.env.PATH }, vars);
  const script = 'require(' + JSON.stringify(path.join(VUE_ROOT, 'vue.config.js')) + ');'
    + 'process.stdout.write(JSON.stringify({ hash: process.env.VUE_APP_BUILD_HASH, year: process.env.VUE_APP_BUILD_YEAR }));';
  try {
    return JSON.parse(execFileSync(process.execPath, ['-e', script], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] }).toString());
  } catch (e) {
    return { error: e.message.split('\n')[0] };
  }
}

const utcYear = String(new Date().getUTCFullYear());

const cut = runConfig(VUE_ROOT, { VUE_APP_BUILD_HASH: '0123456789abcdef' });
check('vue.config.js cuts VUE_APP_BUILD_HASH to 7 characters -> ' + JSON.stringify(cut), cut.hash === '0123456');

const cutCircle = runConfig(VUE_ROOT, { CIRCLE_SHA1: 'fedcba9876543210' });
check('vue.config.js cuts CIRCLE_SHA1 to 7 characters -> ' + JSON.stringify(cutCircle), cutCircle.hash === 'fedcba9');

check('vue.config.js sets an unset VUE_APP_BUILD_YEAR to the UTC year ' + utcYear + ' -> ' + JSON.stringify(cut),
  cut.year === utcYear);

const preset = runConfig(VUE_ROOT, { VUE_APP_BUILD_HASH: 'a1b2c3d', VUE_APP_BUILD_YEAR: '2031' });
check('vue.config.js keeps a preset VUE_APP_BUILD_YEAR -> ' + JSON.stringify(preset), preset.year === '2031');

const noGitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase42-'));
try {
  const noGit = runConfig(noGitDir, {});
  check('vue.config.js falls back to "dev" outside any git repository -> ' + JSON.stringify(noGit), noGit.hash === 'dev');
} finally {
  fs.rmSync(noGitDir, { recursive: true, force: true });
}

// --- Page wiring ---------------------------------------------------------------------

const WIRING = [
  ['src/pages/Login/Login.vue', 'auth'],
  ['src/pages/PasswordReset/PasswordReset.vue', 'auth'],
  ['src/components/Layout/Layout.vue', 'layout'],
];

WIRING.forEach(([relPath, variant]) => {
  const template = compiler.parseComponent(fs.readFileSync(path.join(VUE_ROOT, relPath), 'utf8')).template.content;
  const tag = '<AppFooter variant="' + variant + '" />';
  check(path.basename(relPath) + ' has exactly one ' + tag, template.split(tag).length - 1 === 1);
  check(path.basename(relPath) + ' template has no own <footer> and no &copy;',
    template.indexOf('<footer') === -1 && template.indexOf('&copy;') === -1);
});

// --- Footer colours (UI-D09, UI-D10) ---------------------------------------------------

const STYLES = path.join(SRC, 'styles');
const SASS_OPTIONS = { loadPaths: [STYLES], style: 'compressed', quietDeps: true, logger: sass.Logger.silent };
const PROBE = '.footer-probe{--probe-text-color:#{$text-color};--probe-gray-400:#{$gray-400};'
  + '--probe-white:#{$white};--probe-gradient-start:#{$body-bg-gradient-start};}';

let themeCss = '';
let layoutCss = '';
try {
  themeCss = sass.compileString('@import "theme";\n' + PROBE + '\n', SASS_OPTIONS).css;
} catch (err) {
  check('sass compiles src/styles/theme.scss', false);
}
try {
  layoutCss = sass.compile(path.join(SRC, 'components', 'Layout', 'Layout.scss'), SASS_OPTIONS).css;
} catch (err) {
  check('sass compiles src/components/Layout/Layout.scss', false);
}

// Flat list of { media, selectors, body } for every style rule; media is the
// enclosing @media prelude or ''. Braces inside strings are skipped.
function cssRules(css) {
  const rules = [];
  (function parse(text, media) {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i);
      if (open === -1) break;
      const prelude = text.slice(i, open).replace(/^[;\s]+/, '').trim();
      let depth = 0;
      let end = open;
      for (; end < text.length; end++) {
        const ch = text[end];
        if (ch === '"' || ch === "'") { const q = ch; end++; while (end < text.length && text[end] !== q) { if (text[end] === '\\') end++; end++; } continue; }
        if (ch === '{') depth++;
        else if (ch === '}') { depth--; if (depth === 0) break; }
      }
      const body = text.slice(open + 1, end);
      if (/^@media/.test(prelude)) parse(body, prelude);
      else if (prelude[0] !== '@') rules.push({ media, selectors: prelude.split(',').map((x) => x.trim()), body });
      i = end + 1;
    }
  }(css, ''));
  return rules;
}

function decls(css, selector, mediaTest) {
  return cssRules(css)
    .filter((r) => r.selectors.indexOf(selector) !== -1 && (mediaTest ? mediaTest(r.media) : r.media === ''))
    .map((r) => r.body);
}

function lastValue(bodies, prop) {
  let value;
  bodies.forEach((body) => body.split(';').forEach((d) => {
    const at = d.indexOf(':');
    if (at !== -1 && d.slice(0, at).trim() === prop) value = d.slice(at + 1).trim();
  }));
  return value;
}

function probeValue(name) {
  return lastValue(decls(themeCss, '.footer-probe'), '--probe-' + name);
}

function channel(token) {
  token = token.trim();
  if (/%$/.test(token)) return parseFloat(token) * 2.55;
  return parseFloat(token);
}

function alphaOf(token) {
  if (token === undefined) return 1;
  token = token.trim();
  if (/%$/.test(token)) return parseFloat(token) / 100;
  return parseFloat(token);
}

// Returns {r,g,b,a} (channels 0..255, alpha 0..1) or null.
function parseColour(raw) {
  const value = String(raw).trim().toLowerCase();
  if (value === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  if (value === 'white') return { r: 255, g: 255, b: 255, a: 1 };
  let m = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/);
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
  m = value.match(/^rgba?\(([^)]*)\)$/);
  if (!m) return null;
  const parts = m[1].split(',').map((x) => x.trim());
  if (parts.length < 3 || parts.length > 4) return null;
  const c = { r: channel(parts[0]), g: channel(parts[1]), b: channel(parts[2]), a: alphaOf(parts[3]) };
  if ([c.r, c.g, c.b, c.a].some((n) => !Number.isFinite(n))) return null;
  return c;
}

// Source-over compositing onto an opaque backdrop.
function over(top, bottom) {
  return {
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  };
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

const TEXT = parseColour(probeValue('text-color'));
const GRAY_400 = parseColour(probeValue('gray-400'));
const WHITE = parseColour(probeValue('white'));
const PAGE = parseColour('#333867');
check('page gradient lightest stop is #333867', sameColour(parseColour(probeValue('gradient-start')), PAGE));

[['.auth-footer', themeCss], ['.contentFooter', layoutCss]].forEach(([sel, css]) => {
  const text = parseColour(lastValue(decls(css, sel), 'color'));
  const link = parseColour(lastValue(decls(css, sel + ' a'), 'color'));
  const underline = lastValue(decls(css, sel + ' a'), 'text-decoration');
  const hover = parseColour(lastValue(decls(css, sel + ' a:hover'), 'color'));
  const focus = parseColour(lastValue(decls(css, sel + ' a:focus'), 'color'));
  check(sel + ' text colour is the compiled $text-color', sameColour(text, TEXT));
  check(sel + ' a is #c1ccd3 and underlined', sameColour(link, GRAY_400) && sameColour(link, parseColour('#c1ccd3'))
    && underline === 'underline');
  check(sel + ' a:hover and a:focus are white', sameColour(hover, WHITE) && sameColour(focus, WHITE));
  const textRatio = text ? contrast(over(text, PAGE), PAGE) : 0;
  const linkRatio = link ? contrast(over(link, PAGE), PAGE) : 0;
  check(sel + ' text on #333867 reaches 4.5:1 (' + textRatio.toFixed(2) + ')', textRatio >= 4.5);
  check(sel + ' links on #333867 reach 4.5:1 (' + linkRatio.toFixed(2) + ')', linkRatio >= 4.5);
});

const authPage = decls(themeCss, '.auth-page');
check('.auth-page has min-height 100vh and no height 100vh',
  lastValue(authPage, 'min-height') === '100vh' && lastValue(authPage, 'height') === undefined);
const fixedNew = decls(themeCss, '.auth-footer', (m) => /\(\s*min-height:\s*800px\s*\)/.test(m));
const fixedOld = decls(themeCss, '.auth-footer', (m) => /\(\s*min-height:\s*600px\s*\)/.test(m));
check('fixed .auth-footer sits under @media (min-height: 800px), not 600px',
  lastValue(fixedNew, 'position') === 'fixed' && fixedOld.length === 0
  && lastValue(decls(themeCss, '.auth-footer'), 'position') === undefined);

// Defect class: every $hostnames reader must declare the mixin that populates it.
const SKIP = new Set([path.join(SRC, 'main.js'), path.join(SRC, 'mixins', 'hostnames.js')]);

function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(vue|js)$/.test(entry.name) && !SKIP.has(full)) out.push(full);
  });
  return out;
}

const readers = walk(SRC, []).sort().filter((file) => fs.readFileSync(file, 'utf8').indexOf('$hostnames') !== -1);
check('sweep found $hostnames readers under src (' + readers.length + ')', readers.length > 0);

readers.forEach((file) => {
  const text = fs.readFileSync(file, 'utf8');
  const imports = /import\s+hostnameMixin\s+from\s+['"]@\/mixins\/hostnames['"]/.test(text);
  const declares = /mixins:\s*\[[^\]]*\bhostnameMixin\b[^\]]*\]/.test(text);
  check('hostnames mixin declared: ' + path.relative(VUE_ROOT, file), imports && declares);
});

process.exit(failures ? 1 : 0);

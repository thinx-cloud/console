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

const fs = require('fs');
const path = require('path');

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

// Returns { anchors } or { error } for the first <footer> in the SFC.
function renderFooter(relPath) {
  const sfc = compiler.parseComponent(fs.readFileSync(path.join(VUE_ROOT, relPath), 'utf8'));
  const footer = (sfc.template.content.match(/<footer[\s\S]*?<\/footer>/) || [])[0];
  if (!footer) return { error: 'no <footer> in template' };
  const compiled = compiler.compileToFunctions(footer);
  const options = loadModule(sfc.script.content).default;

  const vmOptions = {
    mixins: options.mixins || [],
    render: compiled.render,
    staticRenderFns: compiled.staticRenderFns,
  };
  // Passing data: undefined makes Vue warn and the render throw; only add a real one.
  if (typeof options.data === 'function') vmOptions.data = options.data;

  renderError = null;
  try {
    const vm = new Vue(vmOptions);
    const vnode = vm._render();
    if (renderError) return { error: renderError.message };
    return { anchors: collectAnchors(vnode, {}) };
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
const savedConsole = process.env.VUE_APP_CONSOLE_HOSTNAME;
delete process.env.VUE_APP_CONSOLE_HOSTNAME;
const fallback = renderFooter('src/components/Layout/Layout.vue');
check('Layout footer falls back to the serving origin when VUE_APP_CONSOLE_HOSTNAME is unset -> ' +
  describe(fallback, 'THiNX Console'),
  !fallback.error && fallback.anchors['THiNX Console'] === 'https://served-origin.invalid');
process.env.VUE_APP_CONSOLE_HOSTNAME = savedConsole;

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

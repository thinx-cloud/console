// Unit test for the branded welcome login (phase 42, LOGIN-01..03, D-13..D-18).
//
// Static checks over src/pages/Login/Login.vue: the template compiles, carries the
// THiNX logo above the auth panel (D-13, UI-D01), the welcome title (D-15, UI-D04),
// a green submit button (D-16, UI-D05) and the Google / GitHub buttons directly
// under it (D-17, UI-D06), while the OAuth hrefs, the CSRF login call and the
// oauthReturnQuery computed stay byte-identical (D-18). The public logo copy must
// be byte-identical to the Legacy file. The real theme (src/styles/theme.scss) is
// compiled with the project's own `sass` to check the panel overlay, the logo and
// social-row rules and WCAG AA contrast (4.5:1) on the lightest page gradient
// stop #333867 (D-14, UI-D03, UI-D09).
//
// Plain node, offline, no browser: npm run test:unit

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('node:assert/strict');
const compiler = require('vue-template-compiler');
const sass = require('sass');

const VUE_ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(VUE_ROOT, 'src');
const LOGIN = path.join(SRC, 'pages', 'Login', 'Login.vue');
const LEGACY_LOGO = path.join(VUE_ROOT, '..', 'src', 'assets', 'thinx', 'img', 'logo_white_200.png');
const PUBLIC_LOGO = path.join(VUE_ROOT, 'public', 'assets', 'thinx', 'img', 'logo_white_200.png');
const LEGACY_LOGO_SHA256 = 'e361d6781eedba693c46f002def0bd6e544b25f52dbb41b123c0aea14048996c';
const MIN_CONTRAST = 4.5;

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

// ---------------------------------------------------------------- Login.vue

const source = fs.readFileSync(LOGIN, 'utf8');
const sfc = compiler.parseComponent(source);
const template = sfc.template.content;
const script = sfc.script.content;

check('Login.vue template compiles without errors', () => {
  assert.deepEqual(compiler.compile(template).errors, []);
});

check('Widget title is "Welcome to THiNX Management Console."', () => {
  assert.match(template, /<Widget\b[^>]*\btitle="Welcome to THiNX Management Console\."/);
});

check('Login.vue nowhere carries the old widget title', () => {
  // Comments included: the production image ships a development-mode bundle
  // that keeps script comments.
  assert.equal(source.indexOf('THiNX Login'), -1);
});

check('logo img sits between <b-container> and <Widget> with src, alt and size', () => {
  const img = (template.match(/<img\b[^>]*\bclass="auth-logo"[^>]*>/) || [])[0];
  assert.ok(img, 'no img.auth-logo');
  assert.match(img, /\bsrc="\/assets\/thinx\/img\/logo_white_200\.png"/);
  assert.match(img, /\balt="THiNX"/);
  assert.match(img, /\bwidth="200"/);
  assert.match(img, /\bheight="100"/);
  const at = template.indexOf(img);
  assert.ok(template.indexOf('<b-container') !== -1 && template.indexOf('<b-container') < at, 'logo before <b-container>');
  assert.ok(at < template.indexOf('<Widget'), 'logo after <Widget>');
});

check('submit b-button is variant success, never danger', () => {
  const button = (template.match(/<b-button\b[^>]*\btype="submit"[^>]*>/) || [])[0];
  assert.ok(button, 'no submit b-button');
  assert.match(button, /\bvariant="success"/);
  assert.doesNotMatch(button, /\bvariant="danger"/);
  assert.match(button, /\bclass="auth-btn"/);
  assert.match(button, /\bsize="sm"/);
});

check('order: Login, social row, "Don\'t have an account?", Create an Account', () => {
  const order = [
    'type="submit"',
    'class="social-buttons"',
    "Don't have an account? Sign up now!",
    'Create an Account',
  ].map((needle) => {
    const at = template.indexOf(needle);
    assert.notEqual(at, -1, 'missing ' + needle);
    return at;
  });
  for (let i = 1; i < order.length; i++) assert.ok(order[i - 1] < order[i], 'out of order at step ' + i);
});

check('both OAuth bindings unchanged, once each', () => {
  for (const provider of ['google', 'github']) {
    const binding = ':href="this.$hostnames.API + \'/oauth/' + provider + '\' + oauthReturnQuery"';
    assert.equal(template.split(binding).length - 1, 1, provider);
  }
});

check('login flow unchanged: @submit.prevent, CSRF login call, oauthReturnQuery computed', () => {
  assert.equal(template.split('@submit.prevent="login"').length - 1, 1);
  assert.ok(script.indexOf('fetchWithCsrf(this.$hostnames.API, this.$hostnames.API + "/login"') !== -1, 'fetchWithCsrf call');
  assert.match(script, /\n\s+oauthReturnQuery\(\)\s*\{/);
  assert.match(script, /\n\s+async login\(e\)\s*\{/);
});

check('buildHash is gone from Login.vue (the footer owns it)', () => {
  assert.equal(source.indexOf('buildHash'), -1);
});

check('subtitle and Create an Account are kept', () => {
  assert.ok(template.indexOf('Use your username to sign in.') !== -1);
  assert.ok(template.indexOf('Create an Account') !== -1);
});

// ---------------------------------------------------------------- logo file

check('public logo is byte-identical to the Legacy logo', () => {
  assert.ok(fs.existsSync(PUBLIC_LOGO), 'missing ' + path.relative(VUE_ROOT, PUBLIC_LOGO));
  const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  assert.equal(sha(LEGACY_LOGO), LEGACY_LOGO_SHA256, 'Legacy logo changed');
  assert.equal(sha(PUBLIC_LOGO), LEGACY_LOGO_SHA256);
});

check('public logo PNG header says 200 by 100', () => {
  const png = fs.readFileSync(PUBLIC_LOGO);
  assert.equal(png.toString('latin1', 12, 16), 'IHDR');
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  assert.equal(width, 200);
  assert.equal(height, 100);
  return width + 'x' + height;
});

// ---------------------------------------------------------------- compiled theme

const PROBE = '.login-probe{--probe-gradient-start:#{$body-bg-gradient-start};--probe-body-color:#{$body-color};'
  + '--probe-link-color:#{$link-color};--probe-green:#{$green};--probe-white:#{$white};}';

let css = '';
check('sass compiles src/styles/theme.scss', () => {
  css = sass.compileString('@import "theme";\n' + PROBE + '\n', {
    loadPaths: [path.join(SRC, 'styles')],
    style: 'compressed',
    quietDeps: true,
    logger: sass.Logger.silent,
  }).css;
});

// Flat list of { media, selectors, body } for every style rule; media is the
// enclosing @media prelude or ''. Braces inside strings are skipped.
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

// Declarations of rules with a selector matching `test`, top level or in a matching @media.
function decls(selectorTest, mediaTest) {
  return cssRules(css)
    .filter((r) => r.selectors.some(selectorTest) && (mediaTest ? mediaTest(r.media) : r.media === ''))
    .map((r) => r.body);
}

function value(bodies, prop) {
  let found;
  bodies.forEach((body) => body.split(';').forEach((d) => {
    const at = d.indexOf(':');
    if (at !== -1 && d.slice(0, at).trim() === prop) found = d.slice(at + 1).trim();
  }));
  return found;
}

const exact = (sel) => (s) => s === sel;
const endsWith = (sel) => (s) => s === sel || s.endsWith(' ' + sel);

check('.auth-page .widget-auth background is rgba(0,0,0,.7)', () => {
  const bg = value(decls(exact('.auth-page .widget-auth')), 'background');
  assert.ok(bg, 'no .auth-page .widget-auth background');
  assert.ok(sameColour(parseColour(bg), { r: 0, g: 0, b: 0, a: 0.7 }), bg);
  return bg;
});

check('.auth-logo is a centred block that scales down', () => {
  const bodies = decls(exact('.auth-logo'));
  assert.equal(value(bodies, 'display'), 'block');
  assert.equal(value(bodies, 'max-width'), '100%');
  assert.equal(value(bodies, 'height'), 'auto');
  assert.match(String(value(bodies, 'margin')), /^0 auto 24px$/);
});

check('.social-buttons is a row with an 8px gap', () => {
  const bodies = decls(endsWith('.social-buttons'));
  assert.equal(value(bodies, 'display'), 'flex');
  assert.equal(value(bodies, 'flex-direction'), 'row');
  assert.equal(value(bodies, 'gap'), '8px');
  const button = decls(endsWith('.social-button'));
  assert.match(String(value(button, 'flex')), /^1 1 0(px|%)?$/);
  assert.equal(value(button, 'min-width'), '0');
  assert.equal(value(button, 'white-space'), 'nowrap');
});

check('.social-buttons stacks below 460px (max-width: 459.98px)', () => {
  const narrow = (m) => /\(\s*max-width:\s*459\.98px\s*\)/.test(m);
  assert.equal(value(decls(endsWith('.social-buttons'), narrow), 'flex-direction'), 'column');
  assert.equal(value(decls(endsWith('.social-button'), narrow), 'flex'), '0 0 auto');
  // Same specificity as the row rules, so the stacked rules must come later to win.
  const rules = cssRules(css);
  const lastIndex = (pred) => rules.reduce((at, r, i) => (pred(r) ? i : at), -1);
  const base = lastIndex((r) => r.media === '' && r.selectors.some(endsWith('.social-button')) && /(^|;)flex:/.test(r.body));
  const stacked = lastIndex((r) => narrow(r.media) && r.selectors.some(endsWith('.social-button')));
  assert.ok(base !== -1 && stacked > base, 'stacked .social-button rule does not follow the row rule');
});

// ---------------------------------------------------------------- contrast

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
  const text = String(raw).trim().toLowerCase();
  if (text === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
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
  m = text.match(/^rgba?\(([^)]*)\)$/);
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

function probe(name) {
  const colour = parseColour(value(decls(exact('.login-probe')), '--probe-' + name));
  assert.ok(colour, 'unparseable probe ' + name);
  return colour;
}

function passes(fg, bg) {
  const ratio = contrast(over(fg, bg), bg);
  assert.ok(ratio >= MIN_CONTRAST, ratio.toFixed(2) + ' < ' + MIN_CONTRAST);
  return ratio.toFixed(2) + ':1';
}

// Panel = the overlay composited over the lightest gradient stop (worst case).
function panel() {
  const page = probe('gradient-start');
  assert.ok(sameColour(page, parseColour('#333867')), 'gradient start is not #333867');
  const overlay = parseColour(value(decls(exact('.auth-page .widget-auth')), 'background'));
  assert.ok(overlay, 'no panel overlay');
  return over(overlay, page);
}

check('panel subtitle reaches 4.5:1 over the overlay on #333867', () => {
  const subtitle = parseColour(value(decls(endsWith('.widget-auth-info')), 'color'));
  assert.ok(sameColour(subtitle, parseColour('#888')), 'subtitle colour changed');
  return passes(subtitle, panel());
});

check('panel links reach 4.5:1 over the overlay on #333867', () => passes(probe('link-color'), panel()));

check('panel body text reaches 4.5:1 over the overlay on #333867', () => passes(probe('body-color'), panel()));

check('white Login label reaches 4.5:1 on the success green', () => {
  const green = probe('green');
  assert.ok(sameColour(green, parseColour('#2d8515')), 'green changed');
  return passes(probe('white'), green);
});

process.exit(failures ? 1 : 0);

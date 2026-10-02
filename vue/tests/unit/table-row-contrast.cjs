// Unit test for readable warning and danger rows in the dark theme (phase 26, G-26-1).
//
// History's audit table (`table table-striped table-sm`) marks flagged rows with
// Bootstrap's `table-warning` / `table-danger` (History.vue rowClass). Bootstrap 4
// paints those rows with a pale fill and sets no text colour, so the theme's light
// body text lands on a light background (about 1.1:1 for warning rows).
//
// This compiles the real theme (src/styles/theme.scss) with the project's own
// `sass`, reads the top-level rules of the compiled CSS, and runs a small cascade
// for one audit row, `table.table.table-striped.table-sm > tbody > tr.table-<v> > td`,
// on even and odd rows. The cell is composited over the row, the row over the
// panel (`.tab-content` over the gradient's lightest stop, about #272B4E, the
// worst case for light text), and the text over the result. Each row state must
// reach WCAG AA body text contrast (4.5:1) on a dark tint. Two guards keep the
// fix narrow: info and unflagged rows keep Bootstrap's rules, and the Flags
// badges keep their colours.
//
// Unparseable colours, a layer with no candidate rule, or a compile error are
// failures, never skips. Plain node, offline, no browser: npm run test:unit

const path = require('path');
const sass = require('sass');

const VUE_ROOT = path.join(__dirname, '..', '..');
const STYLES = path.join(VUE_ROOT, 'src', 'styles');
const MIN_CONTRAST = 4.5;
const MAX_TINT_LUMINANCE = 0.1;

let failures = 0;

function check(name, condition, detail) {
  console.log((condition ? 'ok   ' : 'FAIL ') + name + (detail ? ' (' + detail + ')' : ''));
  if (!condition) failures++;
}

function finish() {
  process.exit(failures ? 1 : 0);
}

// ---------------------------------------------------------------- compile

const PROBE = [
  '.contrast-probe {',
  '  --probe-panel-start: #{$body-bg-gradient-start};',
  '  --probe-widget-bg: #{$widget-bg};',
  '  --probe-orange: #{$orange};',
  '  --probe-red: #{$red};',
  '  --probe-header-color: #{$header-color};',
  '}',
].join('\n');

let css;
try {
  css = sass.compileString('@import "theme";\n' + PROBE + '\n', {
    loadPaths: [STYLES],
    style: 'compressed',
    quietDeps: true,
    logger: sass.Logger.silent,
  }).css;
} catch (err) {
  check('sass compiles src/styles/theme.scss', false, String(err && err.message ? err.message.split('\n')[0] : err));
  finish();
}

// ---------------------------------------------------------------- parse

// Index just past the block that opens at css[open] === '{'. Respects strings,
// comments and parentheses.
function skipBlock(text, open) {
  let depth = 0;
  let paren = 0;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === "'") { i = skipString(text, i); continue; }
    if (ch === '/' && text[i + 1] === '*') { i = skipComment(text, i); continue; }
    if (ch === '(') paren++;
    else if (ch === ')') paren = Math.max(0, paren - 1);
    else if (paren === 0 && ch === '{') depth++;
    else if (paren === 0 && ch === '}') { depth--; if (depth === 0) return i + 1; }
  }
  return text.length;
}

function skipString(text, start) {
  const quote = text[start];
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === '\\') { i++; continue; }
    if (text[i] === quote) return i;
  }
  return text.length;
}

function skipComment(text, start) {
  const end = text.indexOf('*/', start + 2);
  return end === -1 ? text.length : end + 1;
}

// Split on a separator at paren depth 0, outside strings.
function splitTop(text, sep) {
  const parts = [];
  let paren = 0;
  let last = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === "'") { i = skipString(text, i); continue; }
    if (ch === '(') paren++;
    else if (ch === ')') paren = Math.max(0, paren - 1);
    else if (paren === 0 && ch === sep) { parts.push(text.slice(last, i)); last = i + 1; }
  }
  parts.push(text.slice(last));
  return parts;
}

function normaliseSelector(sel) {
  return sel.replace(/\s+/g, ' ').replace(/\s*>\s*/g, '>').trim();
}

// Top-level style rules in source order. Every @-block (@media print,
// @font-face, @keyframes, @supports) and @-statement (@import, @charset) is
// skipped, so the print-only `background-color:#fff !important` never counts.
function parseRules(text) {
  const rules = [];
  let i = 0;
  let order = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch) || ch === ';' || ch === '}') { i++; continue; }
    if (ch === '/' && text[i + 1] === '*') { i = skipComment(text, i) + 1; continue; }
    // Read the prelude up to '{' or ';' at paren depth 0, outside strings.
    let j = i;
    let paren = 0;
    while (j < text.length) {
      const c = text[j];
      if (c === '"' || c === "'") { j = skipString(text, j) + 1; continue; }
      if (c === '(') paren++;
      else if (c === ')') paren = Math.max(0, paren - 1);
      else if (paren === 0 && (c === '{' || c === ';')) break;
      j++;
    }
    const prelude = text.slice(i, j).trim();
    if (j >= text.length) break;
    if (text[j] === ';') { i = j + 1; continue; } // @import url(...); and similar
    const end = skipBlock(text, j);
    if (!prelude.startsWith('@')) {
      const body = text.slice(j + 1, end - 1);
      const decls = [];
      splitTop(body, ';').forEach((raw) => {
        const colon = raw.indexOf(':');
        if (colon === -1) return;
        const prop = raw.slice(0, colon).trim().toLowerCase();
        let value = raw.slice(colon + 1).trim();
        const important = /!\s*important\s*$/i.test(value);
        if (important) value = value.replace(/!\s*important\s*$/i, '').trim();
        if (prop) decls.push({ prop, value, important });
      });
      rules.push({
        order: order++,
        selectors: splitTop(prelude, ',').map(normaliseSelector),
        decls,
      });
    }
    i = end;
  }
  return rules;
}

const rules = parseRules(css);

// ---------------------------------------------------------------- colours

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
  let inner = m[1].trim();
  let alpha;
  let parts;
  if (inner.includes(',')) {
    parts = inner.split(',').map((p) => p.trim());
    if (parts.length === 4) alpha = parts.pop();
  } else {
    const slash = inner.split('/');
    if (slash.length > 2) return null;
    if (slash.length === 2) alpha = slash[1].trim();
    parts = slash[0].trim().split(/\s+/);
  }
  if (parts.length !== 3) return null;
  const NUM = /^-?(\d+\.?\d*|\.\d+)(e-?\d+)?%?$/;
  if (!parts.every((p) => NUM.test(p))) return null;
  if (alpha !== undefined && !NUM.test(alpha)) return null;
  const c = { r: channel(parts[0]), g: channel(parts[1]), b: channel(parts[2]), a: alphaOf(alpha) };
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
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function sameColour(a, b) {
  return Math.abs(a.r - b.r) <= 0.5 && Math.abs(a.g - b.g) <= 0.5
    && Math.abs(a.b - b.b) <= 0.5 && Math.abs(a.a - b.a) <= 0.005;
}

function hex(c) {
  const h = (v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return '#' + h(c.r) + h(c.g) + h(c.b);
}

// A colour from a considered declaration; an unparseable value is a FAIL.
let parseFailed = false;
function colourOf(decl, where) {
  const c = parseColour(decl.value);
  if (!c) {
    check('parse colour in ' + where, false, 'unparseable value "' + decl.value + '"');
    parseFailed = true;
  }
  return c;
}

// ---------------------------------------------------------------- cascade

function specificity(selector) {
  // Enough for the candidate selectors: ids, classes / attributes / pseudo-classes, types.
  let s = selector.replace(/::[a-z-]+(\([^)]*\))?/g, ' ');
  const ids = (s.match(/#[\w-]+/g) || []).length;
  const classes = (s.match(/\.[\w-]+|\[[^\]]*\]|:[\w-]+(\([^)]*\))?/g) || []).length;
  s = s.replace(/#[\w-]+|\.[\w-]+|\[[^\]]*\]|:[\w-]+(\([^)]*\))?/g, ' ');
  const types = (s.match(/(^|[\s>+~])[a-z][\w-]*/gi) || []).length;
  return [ids, classes, types];
}

function beats(a, b) {
  if (a.important !== b.important) return a.important;
  for (let k = 0; k < 3; k++) {
    if (a.spec[k] !== b.spec[k]) return a.spec[k] > b.spec[k];
  }
  if (a.order !== b.order) return a.order > b.order;
  return a.index > b.index;
}

// Winning declaration of `prop` among rules whose selector list contains one of
// `candidates`. Returns { decl, selector } or null; rules that do not declare
// the property take no part.
function cascade(candidates, prop) {
  let best = null;
  rules.forEach((rule) => {
    rule.selectors.forEach((sel) => {
      if (!candidates.includes(sel)) return;
      rule.decls.forEach((decl, index) => {
        if (decl.prop !== prop) return;
        const entry = { decl, selector: sel, important: decl.important, spec: specificity(sel), order: rule.order, index };
        if (!best || beats(entry, best)) best = entry;
      });
    });
  });
  return best;
}

function hasCandidate(candidates) {
  return rules.some((rule) => rule.selectors.some((sel) => candidates.includes(sel)));
}

// ---------------------------------------------------------------- probe values

function probeValue(name) {
  const winner = cascade(['.contrast-probe'], name);
  if (!winner) {
    check('theme probe carries ' + name, false, 'probe declaration missing from the compiled CSS');
    return null;
  }
  return colourOf(winner.decl, '.contrast-probe ' + name);
}

const panelStart = probeValue('--probe-panel-start');
const probeOrange = probeValue('--probe-orange');
const probeRed = probeValue('--probe-red');
const probeHeader = probeValue('--probe-header-color');

const panelDecl = cascade(['.tab-content'], 'background-color');
if (!panelDecl) check('panel layer has a candidate rule', false, 'no .tab-content background-color in the compiled CSS');
const panelBg = panelDecl ? colourOf(panelDecl.decl, '.tab-content background-color') : null;

const tableColourDecl = cascade(['.table'], 'color');
if (!tableColourDecl) check('table layer has a candidate rule', false, 'no .table color in the compiled CSS');
const tableColour = tableColourDecl ? colourOf(tableColourDecl.decl, '.table color') : null;

if (!panelStart || !panelBg || !tableColour || !probeOrange || !probeRed || !probeHeader) finish();

const backdrop = over(panelBg, panelStart);
if (panelStart.a !== 1) check('panel gradient start is opaque', false, hex(panelStart) + ' alpha ' + panelStart.a);

// ---------------------------------------------------------------- row checks

const STRIPE = '.table-striped tbody tr:nth-of-type(odd)';

['warning', 'danger'].forEach((v) => {
  const rowBase = ['.table-' + v, 'tr.table-' + v];
  const cellSelectors = ['.table-' + v + '>td', 'tr.table-' + v + '>td', '.table-' + v + ' td', 'tr.table-' + v + ' td'];
  let evenBg = null;

  ['even', 'odd'].forEach((parity) => {
    const rowSelectors = parity === 'odd' ? rowBase.concat([STRIPE]) : rowBase;
    const label = v + ' ' + parity + ' row text contrast';
    if (!hasCandidate(rowSelectors) || !hasCandidate(cellSelectors)) {
      check(label + ' n/a >= ' + MIN_CONTRAST, false, 'a layer has no candidate rule');
      return;
    }
    const rowBgDecl = cascade(rowSelectors, 'background-color');
    const cellBgDecl = cascade(cellSelectors, 'background-color');
    if (!rowBgDecl || !cellBgDecl) {
      check(label + ' n/a >= ' + MIN_CONTRAST, false,
        'no background-color candidate in the ' + (!rowBgDecl ? 'row' : 'cell') + ' layer');
      return;
    }
    const rowBg = colourOf(rowBgDecl.decl, rowBgDecl.selector + ' background-color');
    const cellBg = colourOf(cellBgDecl.decl, cellBgDecl.selector + ' background-color');
    const cellColourDecl = cascade(cellSelectors, 'color');
    const rowColourDecl = cascade(rowSelectors, 'color');
    const fgDecl = cellColourDecl || rowColourDecl;
    const fg = fgDecl ? colourOf(fgDecl.decl, fgDecl.selector + ' color') : tableColour;
    if (!rowBg || !cellBg || !fg) {
      check(label + ' n/a >= ' + MIN_CONTRAST, false, 'unparseable colour, see above');
      return;
    }
    const bg = over(cellBg, over(rowBg, backdrop));
    const text = over(fg, bg);
    const ratio = contrast(text, bg);
    if (parity === 'even') evenBg = bg;
    check(label + ' ' + ratio.toFixed(2) + ' >= ' + MIN_CONTRAST, ratio >= MIN_CONTRAST,
      'text ' + hex(text) + ' on ' + hex(bg) + ', cell ' + cellBgDecl.selector + ', row ' + rowBgDecl.selector
      + ', colour ' + (fgDecl ? fgDecl.selector : '.table'));
  });

  if (evenBg) {
    const lum = luminance(evenBg);
    const tinted = !sameColour(evenBg, backdrop);
    check(v + ' row background is a dark tint', lum <= MAX_TINT_LUMINANCE && tinted,
      'bg ' + hex(evenBg) + ' luminance ' + lum.toFixed(3) + ' <= ' + MAX_TINT_LUMINANCE
      + (tinted ? ', differs from panel ' : ', same as panel ') + hex(backdrop));
  } else {
    check(v + ' row background is a dark tint', false, 'even row background could not be resolved');
  }
});

// ---------------------------------------------------------------- guards

// Only warning and danger rows get a tr.-qualified override; info and
// unflagged (default) rows keep Bootstrap's own variant rules. bootstrap-vue
// ships its own tr.table-active hover rules, which are not row variants of
// History and stay out of this guard.
const otherVariants = [];
rules.forEach((rule) => rule.selectors.forEach((sel) => {
  if (/tr\.table-(info|default)(?![\w-])/.test(sel)) otherVariants.push(sel);
}));
check('info and default rows keep the Bootstrap variant rules', otherVariants.length === 0,
  otherVariants.length ? 'tr.-qualified selectors: ' + otherVariants.slice(0, 3).join(' | ') : 'no tr.-qualified info or default variant');

// Badges keep $orange / $red backgrounds and the theme's $header-color text.
let badgeOk = true;
const badgeDetail = [];
[['warning', probeOrange], ['danger', probeRed]].forEach(([v, expected]) => {
  const decl = cascade(['.badge-' + v], 'background-color');
  const got = decl ? colourOf(decl.decl, '.badge-' + v + ' background-color') : null;
  const same = !!got && sameColour(got, expected);
  if (!same) badgeOk = false;
  badgeDetail.push('.badge-' + v + ' ' + (got ? hex(got) : 'missing') + (same ? '' : ' != ' + hex(expected)));
});
let lastBadgeColour = null;
rules.forEach((rule) => {
  if (!rule.selectors.includes('.badge')) return;
  rule.decls.forEach((decl) => { if (decl.prop === 'color') lastBadgeColour = decl; });
});
const badgeText = lastBadgeColour ? colourOf(lastBadgeColour, '.badge color') : null;
const badgeTextSame = !!badgeText && sameColour(badgeText, probeHeader);
if (!badgeTextSame) badgeOk = false;
badgeDetail.push('.badge color ' + (lastBadgeColour ? lastBadgeColour.value : 'missing') + (badgeTextSame ? '' : ' != $header-color'));
check('flag badges keep their look', badgeOk, badgeDetail.join(', '));

if (parseFailed) failures = Math.max(failures, 1);
finish();

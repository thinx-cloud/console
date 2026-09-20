/* Check deployed HTML, not .vue templates: Vue compiles @click/@submit to JS. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const config = fs.readFileSync(path.join(root, 'default.conf'), 'utf8');
const match = config.match(/add_header\s+"Content-Security-Policy"\s+"([^"]+)"\s+always/);
assert(match, 'nginx must enforce CSP on all responses');
const directives = Object.fromEntries(match[1].split(';').map(part => part.trim().split(/\s+/)).filter(parts => parts[0]).map(([key, ...values]) => [key, values]));
assert(directives['script-src'], 'explicit script-src must override the permissive resource fallback');
assert(directives['script-src'].includes("'self'"), 'local application bundles must be allowed');
for (const name of ['script-src', 'script-src-elem']) {
  for (const value of directives[name] || []) {
    assert(!["'unsafe-inline'", "'unsafe-eval'", 'data:', 'blob:', '*', 'https:'].includes(value), name + ' must not allow ' + value);
  }
}
assert.deepStrictEqual(directives['script-src-attr'], ["'none'"], 'HTML event handlers must be blocked');
assert(directives['style-src'], 'explicit style-src must preserve UI styles');
assert(directives['style-src'].includes("'unsafe-inline'"), 'Vue and UI dependency inline styles must remain supported');

function checkHtml(file) {
  const html = fs.readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    const attrs = script[1];
    if (/\btype\s*=\s*["']application\/(?:ld\+)?json["']/i.test(attrs)) continue;
    assert(/(?:^|\s)src\s*=\s*["'][^"']+["']/i.test(attrs), file + ': executable script must have an external src');
    assert(!script[2].trim(), file + ': external script must not contain an inline body');
  }
  for (const tag of html.matchAll(/<[a-z][^>]*>/gi)) {
    assert(!/\s+on[a-z]+\s*=/i.test(tag[0]), file + ': inline event handler');
    assert(!/\s+(?:href|src|action|formaction)\s*=\s*["']\s*javascript:/i.test(tag[0]), file + ': javascript URL');
  }
  console.log('PASS no inline JavaScript: ' + path.relative(root, file));
}
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.html?$/i.test(entry.name)) checkHtml(file);
  }
}
walk(path.join(root, 'public'));
if (process.argv.includes('--dist')) {
  assert(fs.existsSync(path.join(root, 'dist/index.html')), 'build dist before testing generated HTML');
  walk(path.join(root, 'dist'));
}
console.log('PASS enforced script policy (inline styles retained)');

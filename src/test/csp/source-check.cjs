/* No dependencies: run against source, or pass the built html directory. */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const htmlRoot = process.argv[2] ? path.resolve(process.argv[2]) : root;
const errors = [];
function scanFile(file) {
  const html = fs.readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const label = path.relative(htmlRoot, file);
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (!/\bsrc\s*=/.test(match[1]) && match[2].trim() && !/\btype\s*=\s*["'](?:application\/ld\+json|application\/json|text\/ng-template)["']/i.test(match[1])) {
      errors.push(label + ': inline executable script');
    }
  }
  // Angular's on-select/onaftersave are directives, not native DOM handlers.
  for (const match of html.matchAll(/\s(on[a-z]+)\s*=/gi)) {
    if (match[1].toLowerCase() !== 'onaftersave') errors.push(label + ': native inline event handler ' + match[1]);
  }
  if (/\b(?:href|src|action)\s*=\s*["']\s*javascript:/i.test(html)) errors.push(label + ': javascript URL');
  for (const match of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    if (/^(?:https?:)?\/\//.test(match[1]) || match[1].includes('<ENV::')) continue;
    const target = match[1].startsWith('/') ? path.join(htmlRoot, match[1]) : path.resolve(path.dirname(file), match[1]);
    // This check focuses on the migrated first-party startup assets.
    if (/assets\/thinx\/(?:csp-|analytics|crisp)/.test(match[1]) && !fs.existsSync(target)) errors.push(label + ': missing script ' + match[1]);
  }
}
function scan(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) scan(file);
    else if (file.endsWith('.html')) scanFile(file);
  });
}
fs.readdirSync(htmlRoot).filter(name => name.endsWith('.html')).forEach(name => scanFile(path.join(htmlRoot, name)));
scan(path.join(htmlRoot, 'app'));
scan(path.join(htmlRoot, 'public'));
// ui-select creates runtime HTML from its cached templates; static pages alone
// cannot catch native handlers and JavaScript URLs embedded in those templates.
for (const name of ['select.js', 'select.min.js']) {
  const vendor = path.join(htmlRoot, 'assets/thinx/js/plugins/ui-select', name);
  const source = fs.readFileSync(vendor, 'utf8');
  if (/\son[a-z]+\s*=\s*\\?["']/i.test(source)) errors.push(name + ': native inline event handler in vendor template');
  if (/\b(?:href|src|action)\s*=\s*\\?["']\s*javascript:/i.test(source)) errors.push(name + ': javascript URL in vendor template');
}
// BlockUI's legacy iframe overlay is still an executable URL on HTTPS unless
// its old IE workaround is patched, even though Chromium normally skips it.
for (const name of ['jquery.blockui.js', 'jquery.blockui.min.js']) {
  const source = fs.readFileSync(path.join(htmlRoot, 'assets/global/plugins', name), 'utf8');
  if (/["']javascript\s*:/i.test(source)) errors.push(name + ': javascript URL in iframe overlay');
}
const conf = fs.readFileSync(path.join(root, 'default.conf'), 'utf8');
const policy = conf.match(/add_header\s+"Content-Security-Policy"\s+"([^"]+)"/);
const directives = Object.fromEntries((policy ? policy[1] : '').split(';').map(s => s.trim().split(/\s+/)).map(([key, ...values]) => [key, values]));
if (!directives['script-src'] || directives['script-src'].includes("'unsafe-inline'")) errors.push('CSP must explicitly block inline scripts');
if ((directives['script-src'] || []).some(value => /^(?:data:|blob:|'unsafe-hashes'|'nonce-)/.test(value))) errors.push('CSP script policy contains an unapproved allowance');
if (!directives['style-src'] || !directives['style-src'].includes("'unsafe-inline'")) errors.push('CSP must preserve inline styles separately');
if (!directives['script-src-attr'] || directives['script-src-attr'].join(' ') !== "'none'") errors.push('CSP must block native inline handlers');
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log('CSP source policy and HTML checks passed: ' + htmlRoot);

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');

function run(name, context) {
  const source = fs.readFileSync(path.join(root, 'assets/thinx/csp-' + name + '.js'), 'utf8')
    .replaceAll('<ENV::googleTrackingCode>', 'UA-test-1')
    .replaceAll('<ENV::crispWebsiteId>', 'crisp-test-id');
  vm.runInNewContext(source, context, { filename: name + '.js' });
}

const inserted = [];
const firstScript = { parentNode: { insertBefore: (node, before) => {
  assert.equal(before, firstScript);
  inserted.push(node);
} } };
const analytics = { document: {
  createElement: tag => ({ tag }),
  getElementsByTagName: tag => { assert.equal(tag, 'script'); return [firstScript]; }
} };
analytics.window = analytics;
run('analytics', analytics);
assert.equal(inserted.length, 1);
assert.equal(inserted[0].src, 'https://www.google-analytics.com/analytics.js');
assert.equal(inserted[0].async, 1);
assert.equal(analytics.GoogleAnalyticsObject, 'ga');
assert.deepEqual(Array.from(analytics.ga.q, args => Array.from(args)), [
  ['create', 'UA-test-1', 'auto'], ['send', 'pageview']
]);

const appended = [];
const crisp = { window: {}, document: {
  createElement: tag => ({ tag }),
  getElementsByTagName: tag => {
    assert.equal(tag, 'head');
    return [{ appendChild: node => appended.push(node) }];
  }
} };
run('crisp', crisp);
assert.equal(crisp.window.CRISP_WEBSITE_ID, 'crisp-test-id');
assert.equal(crisp.window.$crisp.length, 0);
assert.equal(appended.length, 1);
assert.equal(appended[0].src, 'https://client.crisp.chat/l.js');
assert.equal(appended[0].async, 1);

function page(href) {
  const calls = [];
  const handlers = {};
  const document = {};
  function jquery(selector) {
    return {
      ready: callback => callback(),
      hide: () => calls.push([selector, 'hide']),
      show: () => calls.push([selector, 'show']),
      text: value => calls.push([selector, 'text', value]),
      on: (event, callback) => { handlers[selector + ':' + event] = callback; }
    };
  }
  return { calls, handlers, context: {
    document, $: jquery, jQuery: jquery,
    window: { location: { href }, addEventListener: (event, callback) => { handlers[event] = callback; } }
  } };
}
const login = page('https://example.test/');
run('login', login.context);
login.handlers.popstate();
assert.deepEqual(login.calls, [
  ['.login-form', 'show'], ['.register-form', 'hide'], ['.forget-form', 'hide']
]);
let prevented = false;
login.handlers['#register-btn, #forget-password:click']({ preventDefault: () => { prevented = true; } });
assert.equal(prevented, true);

const error = page('https://example.test/error.html?success=false&reason=Invalid%20token&title=Oops');
run('error', error.context);
assert.deepEqual(error.calls, [
  ['.msg-success', 'hide'], ['.error-reason', 'text', 'Invalid token'], ['.error-title', 'text', 'Oops']
]);
const success = page('https://example.test/error.html?success=true');
run('error', success.context);
assert.deepEqual(success.calls, [['.msg-error', 'hide']]);
const transfer = page('https://example.test/transfer_result.html?success=true&reason=Transferred');
run('transfer-result', transfer.context);
assert.deepEqual(transfer.calls, [['.msg-error', 'hide'], ['.device-transfer-reason', 'text', 'Transferred']]);
const failedTransfer = page('https://example.test/transfer_result.html?success=false');
run('transfer-result', failedTransfer.context);
assert.deepEqual(failedTransfer.calls, [['.msg-success', 'hide']]);

const pages = ['index.html', 'auth.html', 'password.html', 'error.html', 'transfer_result.html',
  'public/privacy.html', 'public/terms.html', 'public/cookies.html', 'app/index.html'];
for (const page of pages) {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  assert.doesNotMatch(html, /<script\b(?![^>]*\bsrc\s*=)[^>]*>\s*\S[\s\S]*?<\/script>/i, page);
  assert.doesNotMatch(html, /\bhref\s*=\s*["']javascript:/i, page);
  for (const [, src] of html.matchAll(/<script[^>]*src="([^"]*csp-[^"]+)"/g)) {
    assert.ok(fs.existsSync(path.resolve(root, path.dirname(page), src)), page + ': ' + src);
  }
}
const loginHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.match(loginHtml, /<!--removeIf\(!production\)-->\s*<script src="assets\/thinx\/csp-analytics.js"[^>]*><\/script>\s*<!--endRemoveIf\(!production\)-->/);
assert.ok(loginHtml.indexOf('csp-login.js') > loginHtml.indexOf('public/bundle.min.js'));
const appHtml = fs.readFileSync(path.join(root, 'app/index.html'), 'utf8');
assert.match(appHtml, /<!--removeIf\(enterprise\)-->\s*<script src="..\/assets\/thinx\/csp-crisp.js"[^>]*><\/script>\s*<!--endRemoveIf\(enterprise\)-->/);
console.log('Public CSP startup behavior and HTML checks passed');

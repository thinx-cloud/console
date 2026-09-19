/* Run after build:test. Install playwright separately and expose it via NODE_PATH.
 * CHROME_PATH may point to an already-installed Chromium executable. */
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
const built = path.join(root, 'html');
const policy = fs.readFileSync(path.join(root, 'default.conf'), 'utf8')
  .match(/add_header\s+"Content-Security-Policy"\s+"([^"]+)"/)[1].replaceAll('__WEB_HOSTNAME__', 'https://rtm.thinx.cloud');
const setup = `window.RTM = angular.module('RTM', []);
RTM.value('$state', {});
window.Thinx = { init: function() {} };
window.getTimezones = function() { return []; };
window.toastr = { error: function(message) { throw Error(message); } };
window.Profile = { init: function() { window.profileInitializations = (window.profileInitializations || 0) + 1; } };
window.clipboardInstances = [];
var RealClipboard = window.Clipboard;
window.Clipboard = function(selector) {
  var instance = new RealClipboard(selector);
  var destroy = instance.destroy.bind(instance);
  instance.destroy = function() { instance.wasDestroyed = true; destroy(); };
  instance.on('success', function(e) { window.copied = e.text; });
  clipboardInstances.push(instance);
  return instance;
};`;
const mount = `angular.bootstrap(document.body, ['RTM']);
window.injector = angular.element(document.body).injector();
window.mount = function(html, avatar) {
  window.unmount();
  var root = injector.get('$rootScope');
  root.settings = {layout:{}};
  window.viewScope = root.$new();
  if (avatar) injector.get('$controller')('UserProfileController', {$scope: viewScope});
  window.view = angular.element('<section>' + html + '</section>');
  angular.element(document.body).append(view);
  injector.get('$compile')(view)(viewScope);
  viewScope.$digest();
};
window.unmount = function() {
  if (window.viewScope) { viewScope.$destroy(); view.remove(); viewScope = null; }
};
window.fixtureReady = true;`;
const fixture = `<!doctype html><html><body>
<script src="/assets/global/plugins/jquery.min.js"></script>
<script src="/assets/global/plugins/angularjs/angular.js"></script>
<script src="/assets/global/plugins/clipboardjs/clipboard.js"></script>
<script src="/__csp/setup.js"></script>
<script src="/app/js/directives.js"></script>
<script src="/app/js/controllers/UserProfileController.js"></script>
<script src="/__csp/mount.js"></script></body></html>`;
const server = http.createServer((req, res) => {
  res.setHeader('Content-Security-Policy', policy);
  const url = new URL(req.url, 'http://localhost');
  const special = { '/__csp/fixture.html': fixture, '/__csp/setup.js': setup, '/__csp/mount.js': mount };
  const pathname = url.pathname;
  if (special[pathname]) {
    res.setHeader('Content-Type', pathname.endsWith('.js') ? 'application/javascript' : 'text/html');
    return res.end(special[pathname]);
  }
  const file = path.resolve(built, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
  if (!file.startsWith(built + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });
    const context = await browser.newContext();
    // No requests to real accounts or telemetry; third-party loaders are stubbed.
    await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    const failures = [];
    let errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.cspViolations = [];
      document.addEventListener('securitypolicyviolation', e => window.cspViolations.push({ directive: e.effectiveDirective, blocked: e.blockedURI }));
    });
    async function check(name, fn) {
      errors = [];
      try { await fn(); assert.deepStrictEqual(errors, [], 'unexpected page error'); console.log('PASS ' + name); }
      catch (error) { failures.push(name); console.error('FAIL ' + name + ': ' + error.message); }
    }
    await check('inline script and native event handlers are blocked; inline style remains usable', async () => {
      await page.goto(base + '/');
      const value = await page.evaluate(() => {
        const script = document.createElement('script'); script.textContent = 'window.inlineExecuted = true'; document.head.appendChild(script);
        const button = document.createElement('button'); button.setAttribute('onclick', 'window.handlerExecuted = true'); document.body.appendChild(button); button.click();
        const div = document.createElement('div'); div.setAttribute('style', 'width: 123px'); document.body.appendChild(div);
        return { script: !!window.inlineExecuted, handler: !!window.handlerExecuted, width: getComputedStyle(div).width };
      });
      assert.deepStrictEqual(value, { script: false, handler: false, width: '123px' });
      await page.waitForFunction(() => cspViolations.some(v => v.directive === 'script-src-elem') && cspViolations.some(v => v.directive === 'script-src-attr'));
    });
    await check('login registration/reset navigation and browser back', async () => {
      await page.goto(base + '/');
      await page.locator('#register-btn').click();
      assert(await page.locator('.register-form').isVisible());
      await page.goBack();
      assert(await page.locator('.login-form').isVisible());
      assert(!(await page.locator('.register-form').isVisible()));
      await page.locator('#forget-password').click();
      assert(await page.locator('.forget-form').isVisible());
      await page.goBack();
      assert(await page.locator('.login-form').isVisible());
      assert.deepStrictEqual(await page.evaluate(() => cspViolations.filter(v => v.blocked === 'inline')), []);
    });
    await check('error and device transfer result rendering', async () => {
      await page.goto(base + '/error.html?success=false&reason=Test%20reason&title=Test%20title');
      assert.strictEqual(await page.locator('.error-reason').textContent(), 'Test reason');
      assert.strictEqual(await page.locator('.error-title').textContent(), 'Test title');
      await page.goto(base + '/transfer_result.html?success=true&reason=Transfer%20complete');
      assert.strictEqual(await page.locator('.device-transfer-reason').textContent(), 'Transfer complete');
      assert(!(await page.locator('.msg-error').isVisible()));
    });
    await check('Angular quick navigation survives route re-entry and removes handlers', async () => {
      await page.goto(base + '/__csp/fixture.html');
      await page.waitForFunction(() => window.fixtureReady);
      const nav = '<nav class="quick-nav" thinx-quick-nav><a class="quick-nav-trigger" href="#"><span>Open</span></a></nav>';
      for (let i = 0; i < 3; i++) {
        await page.evaluate(html => mount(html), nav);
        await page.locator('.quick-nav-trigger').click();
        assert(await page.locator('.quick-nav').evaluate(el => el.classList.contains('nav-is-visible')));
        await page.evaluate(() => document.body.click());
        assert(!(await page.locator('.quick-nav').evaluate(el => el.classList.contains('nav-is-visible'))));
        await page.evaluate(() => unmount());
        assert.strictEqual(await page.evaluate(() => (($._data(document, 'events') || {}).click || []).length), 0);
      }
    });
    await check('clipboard supports late buttons and is destroyed with the view', async () => {
      await page.evaluate(() => mount('<span thinx-view-init="clipboard"></span><button ng-if="showCopy" class="copy-btn" data-clipboard-text="CSP regression">Copy</button>'));
      await page.waitForFunction(() => clipboardInstances.length === 1);
      await page.evaluate(() => { viewScope.showCopy = true; viewScope.$digest(); });
      await page.locator('.copy-btn').click();
      assert.strictEqual(await page.evaluate(() => copied), 'CSP regression');
      await page.evaluate(() => unmount());
      assert(await page.evaluate(() => clipboardInstances.every(c => c.wasDestroyed)));
    });
    await check('profile initialization runs after linking', async () => {
      await page.evaluate(() => mount('<span thinx-view-init="profile"></span>'));
      await page.waitForFunction(() => profileInitializations === 1);
    });
    await check('avatar selection uses the actual controller without nested digest errors', async () => {
      await page.evaluate(() => mount('<input type="file" id="newAvatarInput" thinx-avatar-change><span id="preview">{{newAvatar}}</span>', true));
      await page.locator('#newAvatarInput').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6thAAAAAASUVORK5CYII=', 'base64') });
      await page.waitForFunction(() => document.querySelector('#preview').textContent.startsWith('data:image/png;base64,'));
      await page.locator('#newAvatarInput').setInputFiles([]);
      assert.strictEqual(await page.locator('#preview').textContent(), '');
      assert.deepStrictEqual(await page.evaluate(() => cspViolations), []);
    });
    if (failures.length) throw Error(failures.length + ' browser regressions: ' + failures.join(', '));
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });

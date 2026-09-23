/* Exercise shipped vendor templates/events under the actual enforced CSP.
 * Run after build:test; Playwright is supplied through NODE_PATH. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
const built = path.join(root, 'html');
const policy = fs.readFileSync(path.join(root, 'default.conf'), 'utf8')
  .match(/add_header\s+"Content-Security-Policy"\s+"([^"]+)"/)[1]
  .replaceAll('__WEB_HOSTNAME__', 'https://rtm.thinx.cloud');
const bootstrap = `
window.violations = [];
document.addEventListener('securitypolicyviolation', function(event) {
  violations.push({ directive: event.effectiveDirective, blocked: event.blockedURI });
});
angular.module('vendorTest', ['ui.select', 'ngSanitize']).controller('VendorController', function() {
  this.selected = ['Alpha']; this.options = ['Alpha', 'Beta'];
});
`;
const server = http.createServer((req, res) => {
  res.setHeader('Content-Security-Policy', policy);
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/fixture.js') {
    res.setHeader('Content-Type', 'application/javascript'); return res.end(bootstrap);
  }
  if (url.pathname === '/') {
    const variant = url.searchParams.get('variant') === 'min' ? 'select.min.js' : 'select.js';
    const theme = ['bootstrap', 'select2', 'selectize'].includes(url.searchParams.get('theme')) ? url.searchParams.get('theme') : 'bootstrap';
    res.setHeader('Content-Type', 'text/html');
    return res.end(`<!doctype html><html ng-app="vendorTest" ng-csp="no-unsafe-eval"><head>
      <link rel="icon" href="data:,">
      <style>.ui-select-match-close { display: inline-block; width: 18px; height: 18px; }</style>
      <link rel="stylesheet" href="/assets/thinx/js/plugins/ui-select/select.css">
      <script src="/assets/global/plugins/jquery.min.js"></script>
      <script src="/assets/global/plugins/jquery.blockui${variant === 'select.min.js' ? '.min' : ''}.js"></script>
      <script src="/assets/global/plugins/angularjs/angular.min.js"></script>
      <script src="/assets/global/plugins/angularjs/angular-sanitize.min.js"></script>
      <script src="/assets/thinx/js/plugins/ui-select/${variant}"></script>
      <script src="/assets/global/plugins/bootstrap-fileinput/bootstrap-fileinput.js"></script>
      <script src="/fixture.js"></script></head><body ng-controller="VendorController as vm">
      <ui-select multiple ng-model="vm.selected" theme="${theme}" style="width: 400px">
        <ui-select-match>{{$item}}</ui-select-match>
        <ui-select-choices repeat="item in vm.options | filter:$select.search">{{item}}</ui-select-choices>
      </ui-select>
      <form><div id="upload" class="fileinput fileinput-new" data-provides="fileinput">
        <div class="fileinput-preview"></div><span class="fileinput-filename"></span>
        <input type="file" name="avatar"><a href="#" data-dismiss="fileinput">Remove</a>
      </div></form></body></html>`);
  }
  const file = path.resolve(built, '.' + url.pathname);
  if (!file.startsWith(built + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); return res.end();
  }
  res.setHeader('Content-Type', path.extname(file) === '.js' ? 'application/javascript' : 'text/css');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });
    for (const variant of ['source', 'min']) for (const theme of ['bootstrap', 'select2', 'selectize']) {
      const page = await browser.newPage();
      page.setDefaultTimeout(10000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      const base = 'http://127.0.0.1:' + server.address().port;
      await page.goto(`${base}/?variant=${variant}&theme=${theme}`);
      await page.waitForFunction(() => document.querySelector('.ui-select-match-item'));
      await page.evaluate(() => $.blockUI({ forceIframe: true, fadeIn: 0, fadeOut: 0, message: 'Loading' }));
      assert.equal(await page.locator('iframe.blockUI').getAttribute('src'), 'about:blank', 'forced iframe uses an inert document');
      await page.evaluate(() => $.unblockUI({ fadeOut: 0 }));
      await page.locator('iframe.blockUI').waitFor({ state: 'detached' });
      const input = page.locator('input.ui-select-search');
      assert.equal(await input.evaluate(element => {
        const event = new DragEvent('drop', { bubbles: true, cancelable: true });
        element.dispatchEvent(event); return event.defaultPrevented;
      }), true, `${variant}/${theme}: dropping text must stay disabled under CSP`);
      const inlineAttributes = await page.evaluate(() => [...document.querySelectorAll('*')].flatMap(element =>
        [...element.attributes].filter(attribute => /^on[a-z]+$/i.test(attribute.name) ||
          /^(href|src|action)$/i.test(attribute.name) && /^javascript:/i.test(attribute.value))
          .map(attribute => element.tagName + ':' + attribute.name)));
      assert.deepEqual(inlineAttributes, [], `${variant}/${theme}: no executable HTML attributes`);
      await input.click();
      await page.locator('.ui-select-choices-row-inner').filter({ hasText: 'Beta' }).waitFor({ state: 'visible' });
      await page.locator('.ui-select-match-close').click();
      await page.waitForFunction(() => angular.element(document.body).scope().vm.selected.length === 0);
      assert.equal(new URL(page.url()).hash, '', 'removing an item must not navigate');
      await input.fill('Beta');
      await page.locator('.ui-select-choices-row-inner').filter({ hasText: 'Beta' }).click();
      await page.waitForFunction(() => angular.element(document.body).scope().vm.selected[0] === 'Beta');
      // Activate the real lazy data API before changing the input, as a user does.
      await page.locator('input[type=file]').click();
      await page.locator('input[type=file]').setInputFiles({ name: 'avatar.png', mimeType: 'image/png',
        buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=', 'base64') });
      await page.waitForFunction(() => document.querySelector('.fileinput-preview img')?.complete);
      assert.equal(await page.locator('.fileinput-filename').textContent(), 'avatar.png');
      assert.equal(await page.locator('#upload').evaluate(element => element.classList.contains('fileinput-exists')), true);
      await page.locator('[data-dismiss=fileinput]').click();
      assert.equal(await page.locator('input[type=file]').inputValue(), '');
      assert.equal(await page.locator('.fileinput-preview').textContent(), '');
      assert.deepEqual(await page.evaluate(() => violations), [], 'vendor behavior must not cause CSP violations');
      assert.deepEqual(errors, [], 'vendor behavior must not cause browser errors');
      console.log(`PASS ui-select ${variant}/${theme}: drop prevention, selection/removal; fileinput preview/removal; BlockUI iframe`);
      await page.close();
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

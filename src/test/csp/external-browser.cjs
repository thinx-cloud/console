/* Opt-in network probe: real hosted GA/Rollbar scripts, isolated telemetry.
 * This deliberately stays outside the offline browser suite. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
const policy = fs.readFileSync(path.join(root, 'default.conf'), 'utf8')
  .match(/add_header\s+"Content-Security-Policy"\s+"([^"]+)"/)[1]
  .replaceAll('__WEB_HOSTNAME__', 'https://rtm.thinx.cloud');
const setup = `angular.module('probe', ['tandibar/ng-rollbar']).config(['RollbarProvider', function(provider) {
  provider.init({accessToken: '00000000000000000000000000000000', enabled: false, captureUncaught: false});
}]); angular.bootstrap(document.body, ['probe']);`;
const html = '<!doctype html><body><script src="/angular.js"></script><script src="/ng-rollbar.js"></script><script src="/analytics.js"></script><script src="/setup.js"></script></body>';
const files = {
  '/angular.js': 'assets/global/plugins/angularjs/angular.js',
  '/ng-rollbar.js': 'assets/thinx/js/plugins/ng-rollbar/ng-rollbar.js',
  '/analytics.js': 'assets/thinx/csp-analytics.js'
};
const server = http.createServer((req, res) => {
  res.setHeader('Content-Security-Policy', policy);
  res.setHeader('Content-Type', req.url === '/' ? 'text/html' : 'application/javascript');
  if (req.url === '/') return res.end(html);
  if (req.url === '/setup.js') return res.end(setup);
  if (files[req.url]) return res.end(fs.readFileSync(path.join(root, files[req.url]), 'utf8').replaceAll('<ENV::googleTrackingCode>', 'UA-000000-1'));
  res.writeHead(404); res.end();
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const hosted = new Set(['https://www.google-analytics.com/analytics.js', 'https://d37gvrvc0wt4s1.cloudfront.net/js/v1.9/rollbar.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/rollbar.js/1.9.0/rollbar.min.js']);
    await context.route('**/*', route => {
      const req = route.request();
      if (req.url().startsWith(base + '/') || (req.method() === 'GET' && req.resourceType() === 'script' && hosted.has(req.url()))) return route.continue();
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    const page = await context.newPage();
    const errors = [], loaded = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (hosted.has(response.url())) loaded.push({ url: response.url(), status: response.status() }); });
    await page.addInitScript(() => {
      window.violations = [];
      document.addEventListener('securitypolicyviolation', e => violations.push({ directive: e.effectiveDirective, blocked: e.blockedURI }));
    });
    await page.goto(base);
    await page.waitForFunction(() => window.ga && ga.loaded && window._rollbarInitialized === true, null, { timeout: 20000 });
    for (const url of hosted) {
      const expectedStatus = url.includes('cloudfront.net') ? 301 : 200;
      assert(loaded.some(response => response.url === url && response.status === expectedStatus), JSON.stringify(loaded));
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(await page.evaluate(() => violations), []);
    console.log('PASS real hosted Google Analytics and Rollbar initialize under enforced CSP; telemetry intercepted');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

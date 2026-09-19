/* Full built application, real legacy libraries, isolated API and telemetry.
 * Run after build:test, with Playwright exposed through NODE_PATH. */
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
const missing = [];
const server = http.createServer((req, res) => {
  res.setHeader('Content-Security-Policy', policy);
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = path.resolve(built, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
  if (!file.startsWith(built + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    missing.push(pathname); res.writeHead(404); return res.end();
  }
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
const profile = {
  owner: 'csp-smoke-owner', avatar: '/assets/thinx/img/default_avatar_sm.png', email: 'csp@example.invalid',
  info: { first_name: 'CSP', last_name: 'Smoke', goals: [], tags: [], transformers: [], security: {},
    timezone_abbr: 'UTC', timezone_offset: 0, timezone_utc: 'Etc/GMT' }
};
const fixtures = {
  '/user/profile': profile, '/user/devices': [{
    udid: 'csp-smoke-device', alias: 'CSP smoke device', platform: 'arduino:esp32',
    lastupdate: '2026-01-01T00:00:00Z', tags: [], transformers: [], mesh_ids: [],
    category: 'test', icon: '01', environment: {}, source: null
  }], '/user/apikey/list': [], '/user/rsakey/list': [],
  '/user/sources/list': {}, '/mesh/list': [], '/user/env/list': [], '/user/logs/audit': [],
  '/user/logs/build/list': [], '/user/stats': { DEVICE_CHECKIN: [], DEVICE_NEW: [], DEVICE_ACTIVE: [], DEVICE_ERROR: [], DEVICE_UPDATE: [] }
};
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const apiCalls = [];
    const unexpectedRequests = [];
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.url().startsWith(base + '/')) return route.continue();
      if (['xhr', 'fetch'].includes(request.resourceType()) && url.hostname === 'rtm.thinx.cloud') {
        const key = url.pathname.replace(/^\/api(?=\/)/, '');
        apiCalls.push(request.method() + ' ' + key);
        // Legacy envelope lookup is a read operation implemented as POST.
        if (request.method() === 'POST' && key === '/device/envelope') {
          assert.deepEqual(request.postDataJSON(), { udid: 'csp-smoke-device' });
          return route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
        }
        if (request.method() !== 'GET' || !Object.hasOwn(fixtures, key)) {
          unexpectedRequests.push(request.method() + ' ' + key);
          return route.fulfill({ status: 400, contentType: 'application/json', body: '{"success":false}' });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, response: fixtures[key] }) });
      }
      // Every external request is intercepted; no telemetry or production writes.
      return route.fulfill({ status: 200, contentType: request.resourceType() === 'stylesheet' ? 'text/css' : 'application/javascript', body: '' });
    });
    await context.routeWebSocket('**/*', socket => { socket.onMessage(() => {}); });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const pageErrors = [];
    const consoleErrors = [];
    const templates = new Set();
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('response', response => {
      if (response.status() === 200 && response.url().includes('/app/views/')) templates.add(new URL(response.url()).pathname);
    });
    await page.addInitScript(() => {
      window.cspViolations = [];
      document.addEventListener('securitypolicyviolation', event => {
        window.cspViolations.push({ directive: event.effectiveDirective, blocked: event.blockedURI, source: event.sourceFile });
      });
    });
    await page.goto(base + '/app/#/dashboard');
    await page.waitForFunction(() => window.angular && angular.element(document.documentElement).injector());
    const routes = [
      ['dashboard', 'dashboard'], ['devices', 'devices'], ['device', 'device', { udid: 'csp-smoke-device' }],
      ['profile.account', 'profile/account'],
      ['profile.dashboard', 'profile/dashboard'], ['profile.delete', 'profile/delete'],
      ['apikey', 'apikey'], ['source', 'source'], ['deploykey', 'deploykey'], ['channel', 'channel'],
      ['enviro', 'enviro'], ['transformer', 'transformer'], ['history', 'history'], ['blank', 'blank'],
      ['devices', 'devices'], ['dashboard', 'dashboard']
    ];
    for (const [state, template, params = {}] of routes) {
      await page.evaluate(({ state, params }) => new Promise((resolve, reject) => {
        const injector = angular.element(document.documentElement).injector();
        injector.get('$rootScope').$apply(() => injector.get('$state').go(state, params).then(() => resolve(), reject));
      }), { state, params });
      await page.waitForFunction(state => {
        const injector = angular.element(document.documentElement).injector();
        return injector.get('$state').current.name === state && document.querySelector('[ui-view]').children.length > 0;
      }, state);
      await page.waitForLoadState('networkidle');
      assert.ok(templates.has('/app/views/' + template + '.html'), state + ': route template was fetched');
      assert.equal(await page.evaluate(() => document.querySelector('[ui-view]').textContent.trim().length > 0), true, state + ': view rendered');
      assert.deepEqual(await page.evaluate(() => cspViolations.filter(event => event.blocked === 'inline')), [], state + ': inline CSP violations');
      console.log('PASS built app route ' + state);
    }
    assert.ok(apiCalls.includes('GET /user/profile'), 'profile API exercised');
    assert.ok(apiCalls.includes('GET /user/devices'), 'devices API exercised');
    assert.deepEqual(unexpectedRequests, [], 'all API calls must match read-only fixtures');
    assert.deepEqual(pageErrors, [], 'uncaught application errors');
    assert.deepEqual(missing, [], 'missing local assets');
    // Both URLs predate this migration. Protocol-relative Google Fonts resolves
    // to HTTP only because this isolated server uses HTTP. The placeholder image
    // is already outside the existing default-src allowlist, including on HTTPS.
    const expectedResourceBlocks = [
      ['style-src-elem', 'http://fonts.googleapis.com/css?family=Open+Sans:400,300,600,700&subset=all'],
      ['img-src', 'http://www.placehold.it/200x150/EFEFEF/AAAAAA&text=no+image']
    ];
    const violations = await page.evaluate(() => cspViolations);
    assert.deepEqual(violations.filter(event => !expectedResourceBlocks.some(
      ([directive, blocked]) => event.directive === directive && event.blocked === blocked
    )), [], 'unexpected CSP violations');
    assert.deepEqual(consoleErrors.filter(message => !(
      message.includes('violates the following Content Security Policy directive') &&
      expectedResourceBlocks.some(([, blocked]) => message.includes(blocked))
    )), [], 'unexpected browser console errors');
    console.log('PASS real app: no page errors, missing local assets, inline CSP violations, or unexpected API calls');
    console.log('Known preexisting/local-HTTP resource blocks: ' + JSON.stringify(violations));
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

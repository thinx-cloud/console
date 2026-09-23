/* Production-bundle CSP smoke test. All API and telemetry traffic is fulfilled
 * locally: no credentials, password changes, consent, or events reach a server.
 * Requires Playwright (or NODE_PATH to an existing installation), optional CHROME_PATH.
 * Build with VUE_APP_API_HOSTNAME=https://rtm.thinx.cloud and a dummy 32-hex
 * VUE_APP_ROLLBAR_ACCESS_TOKEN to cover the configured Rollbar integration too.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
const policy = fs.readFileSync(path.join(root, 'default.conf'), 'utf8')
  .match(/add_header\s+"Content-Security-Policy"\s+"([^"]+)"/)[1]
  .replaceAll('__NGINX_HOST__', 'http://127.0.0.1');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff': 'font/woff', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, 'dist', '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(path.join(root, 'dist') + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404).end(); return;
  }
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Content-Security-Policy': policy });
  fs.createReadStream(file).pipe(res);
});
const token = ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, owner: 'csp-fixture' })).toString('base64url'), 'fixture'].join('.');
// Both bundled libraries catch CSP's EvalError and fall back to window. Match
// only their audited global-object probes at the reported bundle location; a
// new eval call or any inline/external-script violation still fails this test.
function isKnownGlobalProbe(violation, origin) {
  if (violation.directive !== 'script-src' || violation.uri !== 'eval') return false;
  const url = new URL(violation.source);
  if (url.origin !== origin || !/^\/js\/chunk-vendors(?:-legacy)?\.[a-f0-9]+\.js$/.test(url.pathname)) return false;
  const line = fs.readFileSync(path.join(root, 'dist', url.pathname), 'utf8').split('\n')[violation.line - 1] || '';
  const near = line.slice(Math.max(0, violation.column - 100), violation.column + 220);
  return /try\{n=n\|\|Function\("return this"\)\(\)\|\|\(0,eval\)\("this"\)\}catch\(t\)\{"object"==typeof window&&\(n=window\)\}t\.exports=n/.test(near)
    || /try\{n=n\|\|new Function\("return this"\)\(\)\}catch\(r\)\{"object"===typeof window&&\(n=window\)\}t\.exports=n/.test(near);
}
let browser;
let activePage;
const requests = [];
const violations = [];
const errors = [];
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: true });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  let loginSuccess = false;
  await context.exposeBinding('recordCspViolation', (_, violation) => violations.push(violation));
  await context.addInitScript(() => document.addEventListener('securitypolicyviolation', event => window.recordCspViolation({ directive: event.effectiveDirective, uri: event.blockedURI, source: event.sourceFile, line: event.lineNumber, column: event.columnNumber })));
  await context.route('**/*', async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname.startsWith('/api/v2/')) {
      const endpoint = url.pathname.slice('/api/v2'.length);
      requests.push({ endpoint, method: req.method(), body: req.postDataJSON() });
      let body = { success: true, response: [] };
      if (endpoint === '/login') body = loginSuccess ? { success: true, access_token: token, refresh_token: token } : { success: false, message: 'Fixture rejected credentials' };
      if (endpoint === '/profile') body = { success: true, profile: { username: 'CSP fixture', owner: 'csp-fixture', first_name: 'CSP', last_name: 'Fixture', info: { goals: [], transformers: [] } } };
      if (endpoint.startsWith('/stats')) body = { success: true, stats: {} };
      if (endpoint === '/csrf-token') body = { success: true, csrfToken: 'fixture-csrf' };
      if (endpoint === '/gdpr' || endpoint.startsWith('/password/')) body = { success: true, response: 'Fixture accepted' };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body), headers: { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true' } });
    }
    if (url.hostname === 'api.rollbar.com') {
      requests.push({ endpoint: 'rollbar', method: req.method(), body: req.postDataJSON() });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"err":0,"result":{"uuid":"csp-fixture"}}', headers: { 'access-control-allow-origin': origin } });
    }
    if (url.origin === origin) return route.continue();
    // No third-party or unexpected backend requests leave this test.
    return route.abort();
  });
  const page = activePage = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + '/#/login');
  await page.locator('#username').waitFor();
  assert.equal(await page.locator('script#crisp-chat').count(), 0, 'Crisp must stay disabled');
  for (const provider of ['Google', 'GitHub']) {
    const href = new URL(await page.getByRole('link', { name: 'Login with ' + provider }).getAttribute('href'));
    assert.equal(href.pathname, '/api/v2/oauth/' + provider.toLowerCase());
    assert.equal(href.searchParams.get('return'), origin);
  }
  await page.locator('#username').fill('csp-fixture');
  await page.locator('#password').fill('fixture-password');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.getByText('Login failed: Fixture rejected credentials').waitFor();
  console.log('PASS login rendering, OAuth provider links, rejected credential response');

  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await page.locator('#reset-email').fill('csp-fixture@example.invalid');
  await page.getByRole('button', { name: 'Send reset email' }).click();
  await page.getByText('Reset email sent. Check your inbox.').waitFor();
  assert(requests.some(r => r.endpoint === '/password/reset' && r.body.client === 'vue'));
  await page.goto(origin + '/#/password-reset?owner=csp-fixture&reset_key=fixture');
  // Email reset links open a fresh document, rather than reusing the request form.
  await page.reload();
  await page.locator('#reset-password').fill('fixture-password');
  await page.locator('#reset-rpassword').fill('fixture-password');
  await page.getByRole('button', { name: 'Set password', exact: true }).click();
  await page.getByText('Password set. You can now log in.').waitFor();
  assert(requests.some(r => r.endpoint === '/password/set' && r.body.reset_key === 'fixture'));
  console.log('PASS password reset request and confirmation (fixture API)');

  loginSuccess = true;
  await page.goto(origin + '/#/oauth-return?t=fixture-oauth&g=false');
  await page.locator('#gdpr-consent').check();
  await page.locator('#cookies-consent').check();
  await page.getByRole('button', { name: 'Agree and continue' }).click();
  await page.waitForURL('**/#/app/dashboard');
  assert(requests.some(r => r.endpoint === '/gdpr' && r.method === 'PUT' && r.body.gdpr === true));
  assert(requests.some(r => r.endpoint === '/login' && r.body.token === 'fixture-oauth'));
  console.log('PASS OAuth consent and token exchange to authenticated dashboard (fixture API)');

  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto(origin + '/#/login');
  await page.reload();
  await page.locator('#username').fill('csp-fixture');
  await page.locator('#password').fill('fixture-password');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.waitForURL('**/#/app/dashboard');
  console.log('PASS password login to authenticated dashboard (fixture API)');

  if (process.env.EXPECT_ROLLBAR === '1') {
    const emitted = await page.evaluate(() => {
      const component = Array.from(document.querySelectorAll('*')).map(el => el.__vue__).find(vm => vm && vm.$rollbar);
      if (!component) return false;
      component.$rollbar.info('CSP fixture telemetry');
      return true;
    });
    assert(emitted, 'build must include configured Rollbar');
    await page.waitForTimeout(1500);
    assert(requests.some(r => r.endpoint === 'rollbar'), 'bundled Rollbar should send telemetry to fixture');
    console.log('PASS configured bundled Rollbar telemetry (fixture endpoint)');
  }
  // Exercise the two dependencies whose bundled global probes hit the catch
  // fallback, rather than merely accepting their blocked eval diagnostics.
  await page.evaluate(() => {
    const vm = Array.from(document.querySelectorAll('*')).map(el => el.__vue__).find(vm => vm && vm.$toasted);
    vm.$toasted.show('CSP toast dependency probe', { duration: 10000 });
    const calendar = new vm.$options._base({ parent: vm, render: h => h('v-calendar') });
    document.body.appendChild(calendar.$mount().$el);
  });
  await page.getByText('CSP toast dependency probe').waitFor();
  await page.locator('.vc-container').waitFor();
  console.log('PASS vue-toasted and v-calendar render through their CSP-safe window fallback');
  await page.waitForTimeout(250);
  const unexpectedViolations = violations.filter(v => !isKnownGlobalProbe(v, origin));
  assert.deepStrictEqual(unexpectedViolations, [], 'unexpected application CSP violations: ' + JSON.stringify(unexpectedViolations));
  console.log('INFO blocked known library global-object eval probes: ' + violations.length);
  assert.deepStrictEqual(errors, [], 'uncaught application errors: ' + JSON.stringify(errors));

  // Positive control: injected inline script and event attribute must be rejected.
  await page.evaluate(() => {
    const script = document.createElement('script');
    script.textContent = 'window.inlineCspProbeExecuted = true';
    document.body.appendChild(script);
    const button = document.createElement('button');
    button.setAttribute('onclick', 'window.attributeCspProbeExecuted = true');
    document.body.appendChild(button);
    button.click();
  });
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => !!window.inlineCspProbeExecuted || !!window.attributeCspProbeExecuted), false);
  assert(violations.some(v => v.directive === 'script-src-elem'));
  assert(violations.some(v => v.directive === 'script-src-attr'));
  console.log('PASS zero unexpected CSP violations; inline-script and event-handler controls blocked');
})().catch(async error => {
  console.error(error);
  console.error(JSON.stringify({ requests: requests.map(({ endpoint, method }) => ({ endpoint, method })), violations, errors }, null, 2));
  if (activePage) console.error(await activePage.locator('body').innerText().catch(() => 'Page unavailable'));
  process.exitCode = 1;
}).finally(async () => {
  if (browser) await browser.close();
  server.close();
});

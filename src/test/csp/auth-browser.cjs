/* Real built login scripts and validators; every API write is intercepted.
 * Run after build:test with Playwright exposed through NODE_PATH. */
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
  if (pathname === '/app/' || pathname === '/__authenticated') {
    res.setHeader('Content-Type', 'text/html');
    return res.end('<!doctype html><title>Authenticated fixture</title><p>Authenticated</p>');
  }
  const file = path.resolve(built, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(built + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    missing.push(pathname); res.writeHead(404); return res.end();
  }
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await context.addCookies([{ name: 'XSRF-TOKEN', value: 'csp-test-csrf', url: base }]);
    const calls = [], errors = [], violations = [], unexpected = [];
    let loginSuccess = false;
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin === base) return route.continue();
      if (url.hostname === 'rtm.thinx.cloud' && ['xhr', 'fetch'].includes(request.resourceType())) {
        const key = url.pathname.replace(/^\/api(?=\/)/, '');
        calls.push({ key, method: request.method(), body: request.postData(), csrf: request.headers()['x-xsrf-token'] });
        let body;
        if (request.method() === 'GET' && key === '/csrf-token') body = { success: true };
        else if (request.method() === 'POST' && key === '/login') body = loginSuccess ? { success: true, redirectURL: base + '/__authenticated' } : { success: false, response: 'password_mismatch' };
        else if (request.method() === 'POST' && ['/user/password/reset', '/user/create'].includes(key)) body = { success: true, response: 'email_sent' };
        else if (request.method() === 'POST' && key === '/user/password/set') body = { success: true, response: 'password_reset_request_accepted' };
        else if (request.method() === 'POST' && key === '/gdpr') body = { success: true };
        else { unexpected.push(request.method() + ' ' + key); body = { success: false }; }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      }
      if (request.method() !== 'GET') unexpected.push(request.method() + ' ' + url.origin);
      return route.fulfill({ status: 200, contentType: request.resourceType() === 'stylesheet' ? 'text/css' : 'application/javascript', body: '' });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.message));
    await page.exposeFunction('__recordScriptViolation', violation => violations.push(violation));
    await page.addInitScript(() => document.addEventListener('securitypolicyviolation', event => {
      if (event.effectiveDirective.startsWith('script-src')) window.__recordScriptViolation({ directive: event.effectiveDirective, blocked: event.blockedURI });
    }));
    async function open(url = '/') { await page.goto(base + url); await page.waitForLoadState('networkidle'); }
    await open();
    await page.locator('#login-username').fill('csp-test-user');
    await page.locator('#login-password').fill('fixture-password');
    await page.locator('.login-form button[type=submit]').click();
    await page.waitForFunction(() => document.querySelector('#login-error').textContent.includes('does not match'));
    assert(calls.some(call => call.key === '/login' && JSON.parse(call.body).username === 'csp-test-user'));
    loginSuccess = true;
    await page.locator('.login-form button[type=submit]').click();
    await page.waitForURL(base + '/__authenticated');
    console.log('PASS credential login failure/retry/success with CSRF under enforced CSP');

    await open();
    await page.locator('#forget-password').click();
    await page.locator('#reset-email').fill('csp@example.invalid');
    await page.locator('.forget-form button[type=submit]').click();
    await page.locator('.msg-reset-success').waitFor({ state: 'visible' });
    assert(calls.some(call => call.key === '/user/password/reset'));
    await open();
    await page.locator('#register-btn').click();
    for (const [id, value] of Object.entries({ 'register-first-name': 'CSP', 'register-last-name': 'Test', 'register-email': 'csp@example.invalid', 'register-owner': 'csp-fixture' })) await page.locator('#' + id).fill(value);
    await page.locator('label').filter({ has: page.locator('#register-tnc') }).click({ position: { x: 5, y: 5 } });
    await page.locator('#register-submit-btn').click();
    await page.locator('.msg-success').waitFor({ state: 'visible' });
    assert(calls.some(call => call.key === '/user/create'));
    console.log('PASS registration and reset request using API fixtures');

    await open('/password.html?owner=csp-fixture&reset_key=csp-reset');
    await page.locator('#password').fill('fixture-password');
    await page.locator('#rpassword').fill('fixture-password');
    await page.locator('.reset-form button[type=submit]').click();
    await page.locator('.msg-success').waitFor({ state: 'visible' });
    assert(calls.some(call => call.key === '/user/password/set' && JSON.parse(call.body).reset_key === 'csp-reset'));
    console.log('PASS password reset submission using API fixture');

    await open('/auth.html?t=csp-oauth-existing&g=true');
    await page.waitForURL(base + '/app/#/dashboard');
    assert(calls.some(call => call.key === '/login' && call.body === '{"token":"csp-oauth-existing"}'));
    await open('/auth.html?t=csp-oauth-consent&g=false');
    await page.locator('label').filter({ has: page.locator('#gdpr-consent') }).click({ position: { x: 5, y: 5 } });
    await page.locator('label').filter({ has: page.locator('#cookies-consent') }).click({ position: { x: 5, y: 5 } });
    await page.locator('#gdpr-submit-btn').click();
    await page.waitForURL(base + '/app/#/dashboard');
    assert(calls.some(call => call.key === '/gdpr' && JSON.parse(call.body).gdpr === true));
    assert(calls.some(call => call.key === '/login' && call.body === '{"token":"csp-oauth-consent"}'));
    assert(calls.filter(call => call.method === 'POST').every(call => call.csrf === 'csp-test-csrf'), 'CSRF header preserved for all submissions');
    assert.deepEqual(unexpected, []);
    assert.deepEqual(errors, []);
    assert.deepEqual(violations, []);
    assert.deepEqual(missing, []);
    console.log('PASS OAuth callback and consent: external validators, CSRF, token exchange, redirect; zero script CSP violations');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

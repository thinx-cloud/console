# Vue production CSP checks

The nginx policy allows scripts from self, Crisp, and the existing analytics
origin. Inline scripts, event-handler attributes, data/blob scripts, and eval
remain blocked. Inline styles remain enabled for UI dependencies.

Run the source policy/template check with `npm run test:csp`. Docker runs
`npm run test:csp:dist` after building, which also inspects generated HTML.

For the browser check, reuse an installed Playwright via `NODE_PATH` or install
it in a separate test-tools directory. `CHROME_PATH` optionally selects an
existing Chromium executable. The browser test serves `dist` on loopback with
the exact nginx CSP, intercepts all API and Rollbar requests with fixtures, and
blocks all other external traffic. It does not contact real login, password,
consent, or telemetry endpoints.

```sh
VUE_APP_API_HOSTNAME=https://rtm.thinx.cloud \
VUE_APP_ROLLBAR_ACCESS_TOKEN=0123456789abcdef0123456789abcdef npm run build
npm run test:csp:dist
NODE_PATH=/path/to/test-tools/node_modules \
CHROME_PATH=/path/to/chromium EXPECT_ROLLBAR=1 npm run test:csp:browser
```

The dummy Rollbar token deliberately enables the bundled notifier. Omit
`EXPECT_ROLLBAR=1` for a build without a configured token.

Coverage includes password login success/failure, OAuth provider links, consent
and token exchange, password reset request/confirmation, dashboard rendering,
Rollbar delivery to fixtures, toast/calendar rendering, and positive controls
that verify both injected inline scripts and event attributes are blocked.

Dependency audit:

- Vue uses its runtime build and precompiled component render functions. Login,
  OAuth callback, and reset events execute from external production bundles.
- `@dansmaculotte/vue-crisp-chat` 0.1.0 remains `disabled: true` in `src/main.js`.
  Its loader creates a script with `src=https://client.crisp.chat/l.js`; it does
  not inject an inline bootstrap. The browser check verifies it stays disabled.
  This suite therefore does not establish live Crisp widget compatibility.
- `vue-rollbar` uses bundled `rollbar` 2.26.4. The browser check enables it with a
  dummy token and verifies telemetry through the existing `connect-src` origin.
- `vue-toasted` 1.1.28 and `v-calendar` 1.1.1 contain old bundled webpack helpers
  that try `Function("return this")`. CSP blocks those probes; both catch the
  exception and use `window`. Their rendered toast/calendar checks pass with
  eval disabled. The test permits only these exact known helper bodies at the
  CSP-reported bundle locations. Any other eval or script violation fails.
  These blocked probes can still appear in a browser's CSP diagnostics.
- `vue2-google-maps` 0.10.7 has a lazy external-script loader. No current page
  invokes a Maps component. No additional Maps origins were allowed; live Maps
  and unused dependency paths are outside this fixture test's coverage.

The browser regression does not exercise real OAuth providers, email delivery,
or production backend mutations. Existing Sass deprecation and bundle-size
warnings are independent of these CSP checks.

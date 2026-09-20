# CSP regression checks

Run from `src`:

```sh
npm run test:csp
npm run build:test
npm run test:csp:built
```

The Docker build runs source and generated HTML checks. These reject executable inline scripts, native event attributes, JavaScript URLs, missing migrated assets, and permissive script policies.

For browser coverage, install Playwright outside the production dependencies and expose it using `NODE_PATH` (or use an existing installation):

```sh
npm install --prefix /tmp/thinx-csp-browser playwright
/tmp/thinx-csp-browser/node_modules/.bin/playwright install chromium
NODE_PATH=/tmp/thinx-csp-browser/node_modules npm run test:csp:browser
```

`CHROME_PATH` optionally selects an existing Chromium executable. Both suites serve the built HTML with the real policy from `default.conf`. They intercept external API and telemetry requests, so no production accounts or devices are changed.

`browser.cjs` tests browser enforcement, form navigation, result pages, quick-navigation teardown/re-entry, dynamic clipboard controls, profile initialization, and the actual avatar controller. `app-browser.cjs` loads the complete Angular application and visits its routes using read-only API fixtures. Two preexisting resource blocks are explicitly recognized: protocol-relative Google Fonts on the local HTTP server and the external profile placeholder image. Unexpected browser errors, inline violations, missing assets and unmatched API calls fail the tests.

`vendor-browser.cjs` loads both shipped ui-select variants under the enforced policy and exercises all three themes: text-drop prevention, selection, and removal without navigation. It also selects/previews/removes an avatar with the actual Bootstrap fileinput plugin and opens/closes BlockUI's forced iframe overlay. The fixture uses local assets only.

Vendored compatibility patches (retain when replacing these libraries):

- ui-select 0.19.7: the three multiple-select cached templates use an external `uisPreventDrop` directive instead of native `ondrop`; the select2 removal link uses an empty href, which Angular's anchor directive prevents from navigating. The same small directive registration is appended to `select.js` and `select.min.js`, with teardown on scope destruction.
- jQuery BlockUI: both distributed variants use `about:blank` for iframe overlays on HTTPS too, replacing the historic JavaScript URL workaround for old IE. Modern browsers normally skip this branch; the browser regression forces it. Ancient IE's mixed-content workaround is intentionally not retained.

The source/built checks cover those vendor template handlers and JavaScript URLs in addition to first-party HTML. A reference-based audit of local scripts in public/startup pages and Angular lazy routes found no other generated native handlers in the loaded dependencies; unused vendor demos are outside this check. This is targeted coverage, not proof about every dormant code path in the vendored libraries.

Production also bind-mounts `/mnt/gluster/deployment/swarm/console/default.conf`. Deploy the assets first, then back up and update its CSP header, preserving the mounted file inode. Validate using `nginx -t`, reload the running console task, and verify its HTTP response header. An image-only deployment does not update that bind mount.

`auth-browser.cjs` submits credential login (failure/retry/success), registration,
reset request, password change, OAuth token exchange, and consent through real
built validators/scripts. All API calls use fixtures, including CSRF verification.
It does not create accounts, reset real passwords, or authenticate with providers.

`npm run test:csp:external` is an opt-in network test with the same Playwright
setup. It loads actual hosted Analytics and Rollbar (including its legacy CDN
redirect to cdnjs); telemetry is intercepted and credentials are dummy values.
The offline browser suite does not depend on availability of those CDNs.

On 2026-09-20, a fresh headed browser also verified the live classic Crisp widget:
loader, client bundle and language bundle returned 200, `$crisp.is` became available,
and no script CSP violations or page errors occurred. Crisp's current loader skips
HeadlessChrome, so a headless loader-only check cannot establish widget readiness.
The Vue integration remains explicitly disabled as configured; its external-script
bootstrap is separately checked in the Vue suite. No chat messages were sent.

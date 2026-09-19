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

Production also bind-mounts `/mnt/gluster/deployment/swarm/console/default.conf`. Deploy the assets first, then back up and update its CSP header, preserving the mounted file inode. Validate using `nginx -t`, reload the running console task, and verify its HTTP response header. An image-only deployment does not update that bind mount.

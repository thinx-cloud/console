# Cypress TODO Placeholders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all 41 `/* TODO */` placeholder bodies in six Cypress specs with real assertions that run deterministically in CI without credentials.

**Architecture:** Two new Cypress support commands — `cy.stubThinxApi()` intercepts every `/api/v2` route with recorded fixtures behind a catch-all that 500s anything unstubbed, and `cy.visitApp()` boots the app with a forged JWT in `sessionStorage`. The six specs drop their credential gates and `cy.login()` calls. `login.spec.js` and `admin.spec.js` are untouched and remain the live lane against the real API.

**Tech Stack:** Cypress 9.7.0 (`integration/` layout, `cy.intercept`, `cy.selectFile`), Vue 2 + Vuex + BootstrapVue 2.21, `vue-cli-service serve` on port 3000.

**Spec:** `docs/superpowers/specs/2026-09-18-cypress-todo-stubs-design.md`

## Global Constraints

- **Working directory is `vue/`** for every command in this plan. The git root is `services/console`, one level up.
- **`yarn install` in `vue/` before anything.** The checked-out `node_modules` predates `package.json` and is missing `codemirror` / `vue-codemirror`. Until it is refreshed, every spec fails at webpack compile with `Module not found: Can't resolve 'vue-codemirror'` — that is what the committed screenshots under `cypress/screenshots/auth-extras.spec.js/` show, and it is not a test defect.
- **Forge JWTs with plain `btoa`, never base64url.** `store/auth.js` decodes via `vue-jwt-decode`, whose `decode()` is `JSON.parse(atob(segment))` (`node_modules/vue-jwt-decode/src/decoder.js`), and `core/api.js:33` does the same. Neither converts `-`/`_` back to `+`/`/`. A real base64url token makes `atob` throw and the app treats the session as absent.
- **Fixture envelope is `{ "success": true, "response": <payload> }`.** Produced by `Util.responder` in the API (`lib/thinx/util.js:19`); `core/api.js#parseResult` returns the first non-`success` key.
- **Never add an assertion that cannot fail.** Every test gets a verification step that deliberately breaks a fixture value or selector, confirms red, then reverts.
- **Do not modify** `cypress/integration/login.spec.js`, `cypress/integration/admin.spec.js`, or `cypress/support/credentials.js`.
- **`src/` changes are additive `data-cy` attributes only.** No logic, markup structure, or copy changes.
- Commit messages follow Conventional Commits — enforced by the `commit-msg` husky hook (`commitlint.config.js`).

### Deviation from the spec, deliberate

The spec sketched `cy.seedSession()` followed by a plain `cy.visit()`. That needs
module-level state carried between two commands, or a global `cy.visit`
override that would also change behaviour for the live lane. This plan uses a
single command instead — `cy.visitApp(url, { session })` — which has no hidden
state and leaves `cy.visit` untouched for `login.spec.js` and `admin.spec.js`.
Same behaviour, narrower blast radius.

---

## File Structure

**Created**

| Path | Responsibility |
|:--|:--|
| `cypress/support/session.js` | Forge a JWT; `cy.visitApp()` — visit with a known session state |
| `cypress/support/api-stubs.js` | `cy.stubThinxApi()` — catch-all + per-endpoint intercepts |
| `cypress/integration/support-smoke.spec.js` | Proves the support layer itself: authenticated boot, logged-out boot, unstubbed call 500s |
| `cypress/fixtures/api/devices.json` | 4-device list, tuned for filter/sort/search subsets |
| `cypress/fixtures/api/devices-after-revoke.json` | Same minus `udid-a`, for the DEVI-05 refetch |
| `cypress/fixtures/api/profile.json` | Non-admin profile incl. `info.transformers` |
| `cypress/fixtures/api/profile-admin.json` | `admin: true`, for PROF-04 |
| `cypress/fixtures/api/profile-with-avatar.json` | Non-empty `avatar`, for the PROF-02 preview |
| `cypress/fixtures/api/env.json` | Two environment globals, for the push-config modal |
| `cypress/fixtures/api/stats.json` | Metric keys + non-empty `timeline.CHECKINS` |
| `cypress/fixtures/api/stats-today.json` | Smaller values, so today ≠ week is provable |
| `cypress/fixtures/api/audit-log.json` | 4 entries: 1 danger, 1 warning, 2 info, across a date spread |
| `cypress/fixtures/api/build-log.json` | 3 entries in the raw nested API shape |
| `cypress/fixtures/api/avatar.png` | Small PNG for `cy.selectFile()` |

**Modified**

| Path | Change |
|:--|:--|
| `cypress/support/index.ts` | Import the two new support modules |
| `cypress/integration/auth-extras.spec.js` | 4 TODOs → assertions |
| `cypress/integration/devices.spec.js` | 10 TODOs → assertions |
| `cypress/integration/device-detail.spec.js` | 7 TODOs → assertions |
| `cypress/integration/dashboard.spec.js` | 8 TODOs → assertions |
| `cypress/integration/history.spec.js` | 5 TODOs → assertions |
| `cypress/integration/profile.spec.js` | 7 TODOs → assertions |
| `src/pages/Devices/Devices.vue` | `data-cy` attributes |
| `src/pages/Devices/DeviceDetail.vue` | `data-cy` attributes |
| `src/pages/Visits/Visits.vue` | `data-cy` attributes |
| `src/pages/History/History.vue` | `data-cy` attributes |
| `src/pages/Profile/Profile.vue` | `data-cy` attributes |
| `src/components/Header/Header.vue` | `data-cy` attribute |
| `README.md` | CI variable table now describes the stub/live split |

**BootstrapVue selector notes that apply to every task.** `b-button`,
`b-form-input`, `b-form-select` and `b-card` pass unknown attributes through to
their root element, so `data-cy` lands on the rendered `<button>`, `<input>`,
`<select>` and `<div class="card">`. `b-tab` does **not** — its `title` renders
into a separate `<ul class="nav-tabs">`, so tab navigation is always
`cy.get('.nav-tabs').contains('.nav-link', '<Title>')`, never a `data-cy`. The
`.nav-tabs` scope matters: the page header also renders `.nav-link` elements.
Checkbox `<input>`s inside `.abc-checkbox` are visually hidden by CSS, so they
need `.check({ force: true })`.

---

## Task 1: Support layer — stubs, session, fixtures

**Files:**
- Create: `cypress/support/session.js`
- Create: `cypress/support/api-stubs.js`
- Create: `cypress/fixtures/api/*.json` (10 files) and `cypress/fixtures/api/avatar.png`
- Create: `cypress/integration/support-smoke.spec.js`
- Modify: `cypress/support/index.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `cy.visitApp(url: string, options?: { session?: true | { owner?: string, expiresInSeconds?: number } }): Chainable<Window>` — visits `url` after forcing a known session state. With no `session`, both tokens are removed before the app boots (logged out). With `session: true`, a token valid for 1 hour is written to `sessionStorage.accessToken`.
  - `cy.stubThinxApi(overrides?: Record<string, string>): void` — registers all intercepts. Override keys: `profile`, `devices`, `env`, `stats`, `statsToday`, `auditLog`, `buildLog`; values are fixture paths relative to `cypress/fixtures`.
  - Aliases available to every later task: `@getProfile`, `@getDevices`, `@getEnv`, `@getStats`, `@getStatsToday`, `@getAuditLog`, `@getBuildLog`, `@csrfToken`, `@revokeDevices`, `@pushConfiguration`, `@buildFirmware`, `@transferDevices`, `@updateDevice`, `@postProfile`, `@deleteAccount`, `@unstubbed`.

`POST /api/v2/profile` is one alias — `@postProfile` — because `updateProfile`, `saveNotifications` and `uploadAvatar` all use that single route (`store/profile.js:93,98`).

- [ ] **Step 1: Refresh dependencies**

```bash
cd vue && yarn install
```

Expected: completes, and `ls node_modules/vue-codemirror` now resolves. Nothing below can run until this passes.

- [ ] **Step 2: Create the device fixtures**

`cypress/fixtures/api/devices.json` — the `lastupdate` ordering and the aliases are load-bearing: sorting by `alias` must produce a different first row than the default `lastupdate` sort, `category: green` must select exactly 2, and the substring `node` must match exactly 2.

```json
{
  "success": true,
  "response": [
    {
      "udid": "udid-z", "alias": "zephyr-01", "category": "green",
      "platform": "esp32", "firmware": "fw-1.4.0", "version": "1.4.0",
      "status": "connected", "mac": "AA:BB:CC:00:00:01",
      "lastupdate": "2026-09-18T10:00:00.000Z", "commit": "abc1234",
      "rssi": -52, "station": "lab-ap", "lat": 50.08, "lon": 14.44,
      "source": "src-1", "last_build_id": "build-1",
      "transformers": ["utid-1"],
      "environment": { "ssid": "********", "mqtt_host": "********" },
      "description": "reference device"
    },
    {
      "udid": "udid-a", "alias": "alpha-node", "category": "blue",
      "platform": "esp8266", "firmware": "fw-1.2.0", "version": "1.2.0",
      "status": "connected", "mac": "AA:BB:CC:00:00:02",
      "lastupdate": "2026-09-17T10:00:00.000Z", "commit": "def5678",
      "rssi": -60, "station": "lab-ap", "lat": 50.08, "lon": 14.44,
      "source": "src-1", "last_build_id": "", "transformers": [],
      "environment": {}, "description": ""
    },
    {
      "udid": "udid-b", "alias": "beta-node", "category": "green",
      "platform": "esp32", "firmware": "fw-1.3.0", "version": "1.3.0",
      "status": "disconnected", "mac": "AA:BB:CC:00:00:03",
      "lastupdate": "2026-09-16T10:00:00.000Z", "commit": "0011223",
      "rssi": -71, "station": "lab-ap", "lat": 50.08, "lon": 14.44,
      "source": "src-1", "last_build_id": "", "transformers": [],
      "environment": {}, "description": ""
    },
    {
      "udid": "udid-g", "alias": "gamma-probe", "category": "red-intense",
      "platform": "mongoose", "firmware": "fw-0.9.0", "version": "0.9.0",
      "status": "disconnected", "mac": "AA:BB:CC:00:00:04",
      "lastupdate": "2026-09-15T10:00:00.000Z", "commit": "4455667",
      "rssi": -80, "station": "lab-ap", "lat": 50.08, "lon": 14.44,
      "source": "", "last_build_id": "", "transformers": [],
      "environment": {}, "description": ""
    }
  ]
}
```

`cypress/fixtures/api/devices-after-revoke.json` — the same file with the
`udid-a` object removed, leaving `udid-z`, `udid-b`, `udid-g`.

- [ ] **Step 3: Create the profile fixtures**

`cypress/fixtures/api/profile.json`:

```json
{
  "success": true,
  "response": {
    "owner": "test-owner-0000",
    "username": "cypress-test",
    "admin": false,
    "avatar": "",
    "info": {
      "first_name": "Cypress",
      "last_name": "Tester",
      "mobile_phone": "+420123456789",
      "timezone_abbr": "Europe/Prague",
      "email": "cypress@example.test",
      "notifications": { "all": false, "important": false, "info": false },
      "transformers": [
        { "utid": "utid-1", "alias": "passthrough", "body": "dmFyIHRyYW5zZm9ybWVyID0gZnVuY3Rpb24oKXt9Ow==" }
      ]
    }
  }
}
```

`cypress/fixtures/api/profile-admin.json` — identical but `"admin": true`.

`cypress/fixtures/api/profile-with-avatar.json` — identical to `profile.json`
but with a non-empty `avatar` (any valid base64 PNG payload; a 1×1 transparent
PNG is enough):

```json
{
  "success": true,
  "response": {
    "owner": "test-owner-0000",
    "username": "cypress-test",
    "admin": false,
    "avatar": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    "info": {
      "first_name": "Cypress",
      "last_name": "Tester",
      "mobile_phone": "+420123456789",
      "timezone_abbr": "Europe/Prague",
      "email": "cypress@example.test",
      "notifications": { "all": false, "important": false, "info": false },
      "transformers": [
        { "utid": "utid-1", "alias": "passthrough", "body": "dmFyIHRyYW5zZm9ybWVyID0gZnVuY3Rpb24oKXt9Ow==" }
      ]
    }
  }
}
```

- [ ] **Step 4: Create the env and stats fixtures**

`cypress/fixtures/api/env.json` — `store/enviros.js` maps this bare array to
`{ id, label }`, which is what the push-config checkboxes bind to:

```json
{ "success": true, "response": ["ssid", "mqtt_host"] }
```

`cypress/fixtures/api/stats.json` — `timeline.CHECKINS` must be non-empty, or
`CheckinsTimeline.vue` renders "No check-in data for this range." instead of a
`<canvas>` and DASH-03 has nothing to find:

```json
{
  "success": true,
  "response": {
    "DEVICE_CHECKIN": [42],
    "DEVICE_NEW": [5],
    "DEVICE_REVOCATION": [2],
    "BUILD_STARTED": [7],
    "BUILD_SUCCESS": [6],
    "timeline": {
      "CHECKINS": [
        { "date": "2026-09-18T08:00:00.000Z" },
        { "date": "2026-09-18T09:00:00.000Z" },
        { "date": "2026-09-17T08:00:00.000Z" }
      ]
    }
  }
}
```

`cypress/fixtures/api/stats-today.json` — values differ from `stats.json` so
DASH-02 can prove the Today and Week columns bind to different sources:

```json
{
  "success": true,
  "response": {
    "DEVICE_CHECKIN": [4],
    "DEVICE_NEW": [1],
    "DEVICE_REVOCATION": [0],
    "BUILD_STARTED": [1],
    "BUILD_SUCCESS": [1]
  }
}
```

- [ ] **Step 5: Create the log fixtures**

`cypress/fixtures/api/audit-log.json` — exactly one `danger` entry (HIST-05
asserts the count drops by one) and one entry outside the HIST-04 date window:

```json
{
  "success": true,
  "response": [
    { "date": "2026-09-18T09:00:00.000Z", "message": "Device revoked by owner", "flags": ["danger"] },
    { "date": "2026-09-17T09:00:00.000Z", "message": "Build started for zephyr-01", "flags": ["warning"] },
    { "date": "2026-09-16T09:00:00.000Z", "message": "User logged in", "flags": ["info"] },
    { "date": "2026-09-10T09:00:00.000Z", "message": "API key created", "flags": ["info"] }
  ]
}
```

`cypress/fixtures/api/build-log.json` — this is the **raw nested shape**
`store/buildlog.js#normalizeBuildItems` consumes (`item.log[].log[].contents`),
not the flattened shape the components read. The first entry's joined log must
exceed 400 characters or `History.vue#logIsTruncatable` hides the Expand button
and HIST-03 has nothing to click. Each entry gets a distinct `udid` so
`DeviceDetail.vue`'s `buildHistory` filter resolves to exactly one row.

```json
{
  "success": true,
  "response": [
    {
      "_id": "build-1",
      "name": "zephyr-01",
      "state": "completed",
      "log": [
        {
          "build_id": "build-1",
          "udid": "udid-z",
          "alias": "zephyr-01",
          "state": "completed",
          "last_update": "2026-09-18T09:30:00.000Z",
          "log": [
            {
              "udid": "udid-z",
              "alias": "zephyr-01",
              "state": "completed",
              "last_update": "2026-09-18T09:30:00.000Z",
              "contents": "LONG_LOG_PLACEHOLDER"
            }
          ]
        }
      ]
    },
    {
      "_id": "build-2",
      "name": "alpha-node",
      "state": "failed",
      "log": [
        {
          "build_id": "build-2",
          "udid": "udid-a",
          "alias": "alpha-node",
          "state": "failed",
          "last_update": "2026-09-17T09:30:00.000Z",
          "log": [
            {
              "udid": "udid-a",
              "alias": "alpha-node",
              "state": "failed",
              "last_update": "2026-09-17T09:30:00.000Z",
              "contents": "build failed: missing source"
            }
          ]
        }
      ]
    },
    {
      "_id": "build-3",
      "name": "gamma-probe",
      "state": "created",
      "log": [
        {
          "build_id": "build-3",
          "udid": "udid-g",
          "alias": "gamma-probe",
          "state": "created",
          "last_update": "2026-09-16T09:30:00.000Z",
          "log": []
        }
      ]
    }
  ]
}
```

Replace `LONG_LOG_PLACEHOLDER` with a real >400-character single-line string —
generate it rather than typing it:

```bash
cd vue && node -e '
const fs = require("fs");
const p = "cypress/fixtures/api/build-log.json";
const j = JSON.parse(fs.readFileSync(p, "utf8"));
const lines = [];
for (let i = 1; i <= 12; i++) lines.push(`[step ${i}] compiling module ${i} of 12 for platform esp32`);
j.response[0].log[0].log[0].contents = lines.join(" \\n ");
fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
console.log("log length:", j.response[0].log[0].log[0].contents.length);
'
```

Expected: prints a length comfortably above 400.

- [ ] **Step 6: Create the avatar fixture**

```bash
cd vue && node -e '
require("fs").writeFileSync(
  "cypress/fixtures/api/avatar.png",
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64")
);
'
```

Expected: `cypress/fixtures/api/avatar.png` exists and is a valid PNG.

- [ ] **Step 7: Write `cypress/support/session.js`**

```js
// Session seeding for the stub-backed specs.
//
// The app never verifies a JWT signature client-side: store/auth.js#isJwtValid
// decodes with vue-jwt-decode, whose decode() is JSON.parse(atob(segment)), and
// Routes.js's guard plus App.vue#hydrateSession only read `exp`. A forged token
// with a fake signature is therefore indistinguishable from a real one here.

// Plain base64, NOT base64url. vue-jwt-decode and core/api.js:33 both call bare
// atob(), which does not map '-'/'_' back to '+'/'/'. A correctly base64url-
// encoded token makes atob throw and the app silently treats the session as
// absent — which looks exactly like a broken test.
function encodeSegment(value) {
  return btoa(JSON.stringify(value));
}

export function forgeJwt({ owner = 'test-owner-0000', expiresInSeconds = 3600 } = {}) {
  const issuedAt = Math.floor(Date.now() / 1000);
  return [
    encodeSegment({ alg: 'HS256', typ: 'JWT' }),
    encodeSegment({ owner, iat: issuedAt, exp: issuedAt + expiresInSeconds }),
    'test-signature',
  ].join('.');
}

// Visit a route with the session in a known state.
//
//   cy.visitApp('/#/app/devices')                              // logged out
//   cy.visitApp('/#/app/devices', { session: true })           // valid 1h token
//   cy.visitApp('/#/app/dashboard', { session: { expiresInSeconds: 2 } })
//
// Always writing OR clearing (never leaving it alone) is deliberate: Cypress 9
// does not clear sessionStorage between tests of the same spec and offers no
// cy.clearSessionStorage(), so a session seeded in one test would otherwise leak
// into the next — the same failure 5970c2e fixed for cy.login().
Cypress.Commands.add('visitApp', (url, options = {}) => {
  const { session, onBeforeLoad: userOnBeforeLoad, ...visitOptions } = options;
  const token = session ? forgeJwt(session === true ? {} : session) : null;

  return cy.visit(url, {
    ...visitOptions,
    onBeforeLoad(win) {
      if (token) {
        win.sessionStorage.setItem('accessToken', token);
      } else {
        win.sessionStorage.removeItem('accessToken');
      }
      // refreshToken is deliberately never written: hydrateSession rejects the
      // whole session when a PRESENT refreshToken fails isJwtValid, while an
      // absent one is fine (store/auth.js:70).
      win.sessionStorage.removeItem('refreshToken');
      if (userOnBeforeLoad) userOnBeforeLoad(win);
    },
  });
});
```

- [ ] **Step 8: Write `cypress/support/api-stubs.js`**

```js
// Network stubs for the six spec files that do not use live credentials.
//
// Intercepts match on `pathname`, not a full URL, because VUE_APP_API_HOSTNAME
// is a remote host in CI (https://rtm.thinx.cloud) and falls back to
// window.location.origin locally. Matching the path alone works in both.

const API = '/api/v2';

const DEFAULT_FIXTURES = {
  profile: 'api/profile.json',
  devices: 'api/devices.json',
  env: 'api/env.json',
  stats: 'api/stats.json',
  statsToday: 'api/stats-today.json',
  auditLog: 'api/audit-log.json',
  buildLog: 'api/build-log.json',
};

const ok = (response) => ({ statusCode: 200, body: { success: true, response } });

Cypress.Commands.add('stubThinxApi', (overrides = {}) => {
  const fixtures = { ...DEFAULT_FIXTURES, ...overrides };

  // Registered FIRST so that every intercept below outranks it — Cypress matches
  // the most recently defined route first. This is the load-bearing piece: any
  // /api/v2 call not stubbed below lands here instead of reaching production,
  // which is what makes "these specs never touch the real API" an enforced
  // property rather than an intention.
  cy.intercept(/\/api\/v2\//, {
    statusCode: 500,
    body: { success: false, response: 'unstubbed_endpoint' },
  }).as('unstubbed');

  // Reads
  cy.intercept({ method: 'GET', pathname: `${API}/csrf-token` }, ok('test-csrf')).as('csrfToken');
  cy.intercept({ method: 'GET', pathname: `${API}/profile` }, { fixture: fixtures.profile }).as('getProfile');
  cy.intercept({ method: 'GET', pathname: `${API}/device` }, { fixture: fixtures.devices }).as('getDevices');
  cy.intercept({ method: 'GET', pathname: `${API}/env` }, { fixture: fixtures.env }).as('getEnv');
  cy.intercept({ method: 'GET', pathname: `${API}/stats` }, { fixture: fixtures.stats }).as('getStats');
  cy.intercept({ method: 'GET', pathname: `${API}/stats/today` }, { fixture: fixtures.statsToday }).as('getStatsToday');
  cy.intercept({ method: 'GET', pathname: `${API}/logs/audit` }, { fixture: fixtures.auditLog }).as('getAuditLog');
  cy.intercept({ method: 'GET', pathname: `${API}/logs/build` }, { fixture: fixtures.buildLog }).as('getBuildLog');

  // Writes. Specs assert request.body; the side effect never happens.
  cy.intercept({ method: 'DELETE', pathname: `${API}/device` }, ok('devices_revoked')).as('revokeDevices');
  cy.intercept({ method: 'POST', pathname: `${API}/device/configuration` }, ok('configuration_pushed')).as('pushConfiguration');
  cy.intercept({ method: 'POST', pathname: `${API}/build` }, ok('build_started')).as('buildFirmware');
  cy.intercept({ method: 'POST', pathname: `${API}/transfer/request` }, ok('transfer_requested')).as('transferDevices');
  cy.intercept({ method: 'PUT', pathname: `${API}/device` }, ok('device_updated')).as('updateDevice');
  // One alias for all three POST /profile callers — updateProfile,
  // saveNotifications and uploadAvatar share the route (store/profile.js:93,98).
  cy.intercept({ method: 'POST', pathname: `${API}/profile` }, ok('profile_updated')).as('postProfile');
  cy.intercept({ method: 'DELETE', pathname: `${API}/user` }, ok('user_deleted')).as('deleteAccount');
});
```

- [ ] **Step 9: Wire the support modules**

Modify `cypress/support/index.ts` — replace the `import "./commands";` line with:

```ts
import "./commands";
import "./session";
import "./api-stubs";
```

- [ ] **Step 10: Write the support smoke spec**

`cypress/integration/support-smoke.spec.js`:

```js
// Guards the guard. If cy.stubThinxApi's catch-all ever stops working, every
// other stub-backed spec starts silently hitting the real API — these three
// assertions are what would catch that.

describe('Cypress support layer', function() {

  beforeEach(function() {
    cy.viewport(1536, 754);
    cy.stubThinxApi();
  });

  it('boots the app authenticated from a forged session', function() {
    cy.visitApp('/#/app/dashboard', { session: true });
    cy.get('.page-title').should('contain', 'Dashboard');
  });

  it('starts logged out when no session is requested', function() {
    cy.visitApp('/#/app/dashboard');
    cy.hash().should('eq', '#/login');
  });

  it('fails an unstubbed /api/v2 call instead of letting it reach the real API', function() {
    cy.visitApp('/#/app/dashboard', { session: true });
    cy.get('.page-title').should('contain', 'Dashboard');
    cy.window()
      .then((win) => win.fetch('/api/v2/definitely-not-stubbed'))
      .then((response) => {
        expect(response.status).to.eq(500);
      });
  });

});
```

- [ ] **Step 11: Run the smoke spec**

```bash
cd vue && npx start-server-and-test serve http://127.0.0.1:3000/ "npx cypress run --spec cypress/integration/support-smoke.spec.js"
```

Expected: 3 passing. If test 1 fails at `.page-title`, the JWT is not being
accepted — check the `btoa` constraint above before anything else.

- [ ] **Step 12: Verify the tests can fail**

Temporarily change `forgeJwt` in `session.js` to emit base64url
(`btoa(...).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')`) and
re-run.

Expected: test 1 and test 3 FAIL — proving they genuinely depend on a decodable
session rather than passing by accident. Revert the change and confirm green
again.

- [ ] **Step 13: Lint and commit**

```bash
cd vue && yarn eslint
git add cypress/support/session.js cypress/support/api-stubs.js cypress/support/index.ts \
        cypress/fixtures/api cypress/integration/support-smoke.spec.js
git commit -m "test(cypress): add API stub + session support layer

Adds cy.stubThinxApi() and cy.visitApp(), recorded fixtures for every
/api/v2 route the seeded specs touch, and a smoke spec asserting that an
unstubbed call 500s rather than reaching the real API.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `auth-extras.spec.js` — 4 TODOs

Smallest spec and three of its four tests need no session, so it proves the
support layer in the simplest setting before the larger specs depend on it.

**Files:**
- Modify: `cypress/integration/auth-extras.spec.js`
- Test: the spec is the test.

**Interfaces:**
- Consumes: `cy.visitApp`, `cy.stubThinxApi` from Task 1.
- Produces: nothing for later tasks.

AUTH-03 relies on `store/auth.js#scheduleExpiry` setting a `setTimeout` for
`exp * 1000 - Date.now()`, which on fire dispatches `clearSession` and sets
`window.location.hash = '#/login'`. If the app happens to boot after the token
already expired, `hydrateSession` rejects it and `App.vue` pushes `/login`
instead. Both paths land on `#/login`, so the assertion holds either way — this
test cannot flake on timing, only on the destination.

- [ ] **Step 1: Replace the spec body**

```js
describe('Auth Extras feature', function() {

  beforeEach(function() {
    cy.viewport(1536, 754);
    // PasswordReset.vue#created fires GET /csrf-token on mount, so even the
    // unauthenticated routes need the stub layer — without it that call escapes
    // to the real API.
    cy.stubThinxApi();
  });

  it('Should render the password-reset page unauthenticated (AUTH-01)', function() {
    cy.visitApp('/#/password-reset', {
      onBeforeLoad(win) {
        // Cypress fails a test on an uncaught exception by default, but a logged
        // console.error is invisible to it. Stub it so "no console errors" is a
        // real assertion rather than a decorative one.
        cy.stub(win.console, 'error').as('consoleError');
      },
    });
    // Widget.vue renders its `title` prop into <h5 class="title">, and the
    // static class="widget-auth" on <Widget> merges onto that same root section.
    cy.get('.widget-auth .title').should('contain', 'Password Reset').and('be.visible');
    cy.hash().should('eq', '#/password-reset');
    cy.get('@consoleError').should('not.have.been.called');
  });

  it('Should show the initiate (email) form when no token is in the query (AUTH-02)', function() {
    cy.visitApp('/#/password-reset');
    cy.get('#reset-email').should('be.visible');
    cy.get('#reset-password').should('not.exist');
    cy.get('#reset-rpassword').should('not.exist');
  });

  it('Should show the confirm (password) form when reset_key is in the query (AUTH-02)', function() {
    cy.visitApp('/#/password-reset?reset_key=abc&owner=test');
    cy.get('#reset-password').should('be.visible');
    cy.get('#reset-rpassword').should('be.visible');
    cy.get('#reset-email').should('not.exist');
  });

  it('Should redirect to /login when the access token expires (AUTH-03)', function() {
    cy.visitApp('/#/app/dashboard', { session: { expiresInSeconds: 2 } });
    cy.get('.page-title').should('contain', 'Dashboard');
    cy.hash({ timeout: 10000 }).should('eq', '#/login');
  });

});
```

The `import { hasLoginCredentials, MISSING_LOGIN_CREDENTIALS }` line at the top
of the old file is deleted — nothing in this spec needs credentials any more.

- [ ] **Step 2: Run the spec**

```bash
cd vue && npx start-server-and-test serve http://127.0.0.1:3000/ "npx cypress run --spec cypress/integration/auth-extras.spec.js"
```

Expected: 4 passing.

- [ ] **Step 3: Verify the tests can fail**

Change AUTH-02's confirm-form assertion from `#reset-password` to
`#reset-password-typo` and re-run.

Expected: that test FAILS with "Expected to find element". Revert and confirm
green.

- [ ] **Step 4: Lint and commit**

```bash
cd vue && yarn eslint
git add cypress/integration/auth-extras.spec.js
git commit -m "test(cypress): implement AUTH-01..03 assertions

Replaces the four TODO stubs in auth-extras.spec.js with real assertions
against stubbed endpoints. Drops the credential gate: none of these tests
need a live account any more.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `Devices.vue` hooks + `devices.spec.js` read path (DEVI-01…04)

**Files:**
- Modify: `src/pages/Devices/Devices.vue`
- Modify: `cypress/integration/devices.spec.js`

**Interfaces:**
- Consumes: `cy.visitApp`, `cy.stubThinxApi`, `@getDevices`.
- Produces: the `data-cy` contract Task 4 and Task 5 also use —
  `category-pill-{category}`, `device-sort`, `device-search`, `view-list`,
  `view-grid`, `device-row`, `device-card`, `bulk-revoke`, `bulk-transfer`,
  `bulk-push`, `row-detail`, `row-build`, `row-revoke`.

- [ ] **Step 1: Write the four read-path tests first, before adding any attribute**

Replace the top of `cypress/integration/devices.spec.js` (keep the remaining six
TODO stubs untouched for now — Task 4 handles them):

```js
describe('Devices feature', function() {

  beforeEach(function() {
    cy.viewport(1536, 754);
    cy.stubThinxApi();
    cy.visitApp('/#/app/devices', { session: true });
    cy.wait('@getDevices');
  });

  it('Should display category filter pills (DEVI-01)', function() {
    // 'All' plus the seven CATEGORY_COLORS keys.
    cy.get('[data-cy^=category-pill-]').should('have.length', 8);
    cy.get('[data-cy=category-pill-All]').should('have.class', 'btn-primary');
  });

  it('Should filter devices by category (DEVI-01)', function() {
    cy.get('[data-cy=device-row]').should('have.length', 4);
    cy.get('[data-cy=category-pill-green]').click();
    cy.get('[data-cy=device-row]').should('have.length', 2);
    cy.get('[data-cy=device-row]').should('contain', 'zephyr-01').and('contain', 'beta-node');
    cy.get('[data-cy=device-row]').should('not.contain', 'alpha-node');
  });

  it('Should sort devices by alias (DEVI-02)', function() {
    // Default sort is lastupdate descending, which puts zephyr-01 first.
    cy.get('[data-cy=device-row]').first().should('contain', 'zephyr-01');
    cy.get('[data-cy=device-sort]').select('alias');
    cy.get('[data-cy=device-row]').first().should('contain', 'alpha-node');
    cy.get('[data-cy=device-row]').last().should('contain', 'zephyr-01');
  });

  it('Should search devices by alias substring (DEVI-03)', function() {
    cy.get('[data-cy=device-search]').type('node');
    cy.get('[data-cy=device-row]').should('have.length', 2);
    cy.get('[data-cy=device-row]').each(($row) => {
      expect($row.text()).to.contain('node');
    });
  });

  it('Should toggle to grid view (DEVI-04)', function() {
    cy.get('[data-cy=device-card]').should('not.exist');
    cy.get('[data-cy=view-grid]').click();
    cy.get('[data-cy=device-card]').should('have.length', 4);
    cy.get('table.table').should('not.exist');
    cy.get('[data-cy=view-list]').click();
    cy.get('table.table').should('be.visible');
  });

  // ... the six DEVI-05..09 TODO stubs stay exactly as they are for now
});
```

Also delete the `import { hasLoginCredentials, MISSING_LOGIN_CREDENTIALS }` line.

- [ ] **Step 2: Run and watch them fail**

```bash
cd vue && npx start-server-and-test serve http://127.0.0.1:3000/ "npx cypress run --spec cypress/integration/devices.spec.js"
```

Expected: all five FAIL with "Expected to find element: `[data-cy^=category-pill-]`"
and similar — the attributes do not exist yet. This is the red state.

- [ ] **Step 3: Add the attributes to `Devices.vue`**

In the bulk-action paragraph, add `data-cy` to the three buttons:

```html
      <b-button variant="danger" data-cy="bulk-revoke" @click="confirmRevoke" :disabled="!isSelected" class="mr-2">
        Revoke ({{ selectedCount }})
      </b-button>
      <b-button variant="warning" data-cy="bulk-transfer" @click="$bvModal.show('transfer-modal')" :disabled="!isSelected" class="mr-2">
        Transfer ({{ selectedCount }})
      </b-button>
      <b-button variant="info" data-cy="bulk-push" @click="$bvModal.show('push-config-modal')" :disabled="!isSelected">
        Push Config ({{ selectedCount }})
      </b-button>
```

In the toolbar, add `data-cy` to the view toggles, the pills, the sort select and
the search input:

```html
      <b-button size="sm" data-cy="view-list" :variant="viewMode === 'list' ? 'primary' : 'outline-secondary'" @click="viewMode = 'list'" class="mr-1">
        <span>&#9776;</span>
      </b-button>
      <b-button size="sm" data-cy="view-grid" :variant="viewMode === 'grid' ? 'primary' : 'outline-secondary'" @click="viewMode = 'grid'" class="mr-1">
        <span>&#9635;</span>
      </b-button>
      <b-button
        v-for="cat in ['All', 'yellow-crusta', 'red-intense', 'purple-studio', 'blue', 'green', 'green-dark', 'grey-mint']"
        :key="cat"
        :data-cy="'category-pill-' + cat"
        size="sm"
        :variant="filterCategory === cat ? 'primary' : 'outline-secondary'"
        :style="filterCategory !== cat && cat !== 'All' ? { borderColor: categoryColor(cat), color: categoryColor(cat) } : {}"
        @click="filterCategory = cat"
        class="mr-1"
      >{{ cat }}</b-button>
      <div class="ml-auto d-flex align-items-center">
        <b-form-select data-cy="device-sort" v-model="sortBy" :options="[{ value: 'lastupdate', text: 'Last Update' }, { value: 'platform', text: 'Platform' }, { value: 'alias', text: 'Alias' }]" size="sm" style="width:140px" class="mr-2" />
        <b-form-input data-cy="device-search" v-model="searchText" placeholder="Search alias or MAC..." size="sm" style="width:200px" />
      </div>
```

On the table row and its three action buttons:

```html
        <tr v-for="(device, index) in filteredItems" :key="device.udid" data-cy="device-row">
```

```html
            <b-button size="sm" variant="primary" data-cy="row-detail" @click="viewDevice(device.udid)" class="mr-1">Detail</b-button>
            <b-button size="sm" variant="secondary" data-cy="row-build" @click="buildDevice(device)" class="mr-1">Build</b-button>
            <b-button size="sm" variant="danger" data-cy="row-revoke" @click="revokeRow(device.udid)" class="ml-1">Revoke</b-button>
```

On the grid card:

```html
        <b-card class="h-100" data-cy="device-card">
```

- [ ] **Step 4: Run to verify green**

```bash
cd vue && npx start-server-and-test serve http://127.0.0.1:3000/ "npx cypress run --spec cypress/integration/devices.spec.js"
```

Expected: **10 passing** — the five new assertions, plus the five untouched
DEVI-05…09 stubs. Those five still report green because a Mocha `it` whose body
contains only a comment is a passing test, which is exactly why the placeholders
were never noticed. Task 4 replaces them.

- [ ] **Step 5: Verify the filter test can fail**

In `devices.json`, change `beta-node`'s category from `green` to `blue` and
re-run.

Expected: the DEVI-01 filter test FAILS on `have.length 2` (now 1). Revert and
confirm green. This proves the assertion reads the fixture rather than counting
whatever happens to render.

- [ ] **Step 6: Lint and commit**

```bash
cd vue && yarn eslint
git add src/pages/Devices/Devices.vue cypress/integration/devices.spec.js
git commit -m "test(cypress): implement DEVI-01..04 device list assertions

Adds data-cy hooks to Devices.vue and replaces the four read-path TODO
stubs with assertions over a fixed four-device fixture, so filter, sort
and search resolve to known subsets.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `devices.spec.js` write path (DEVI-05…09)

Every test here asserts the outgoing request and never performs the operation.

**Files:**
- Modify: `cypress/integration/devices.spec.js`

**Interfaces:**
- Consumes: the `data-cy` contract from Task 3; aliases `@revokeDevices`,
  `@transferDevices`, `@pushConfiguration`, `@buildFirmware`, `@getDevices`.
- Produces: nothing for later tasks.

`$bvModal.msgBoxConfirm` renders a real `.modal` into the DOM — it is not a
native `window.confirm`, so there is no dialog-blocking hazard and the confirm
button is an ordinary `.modal-footer .btn-danger`.

- [ ] **Step 1: Replace the five remaining TODO stubs**

```js
  it('Should revoke a single device with confirmation (DEVI-05)', function() {
    // Registered after stubThinxApi, so it outranks the base stub and serves the
    // refetch that revokeDevices triggers on success (store/devices.js:47).
    cy.intercept({ method: 'GET', pathname: '/api/v2/device' }, { fixture: 'api/devices-after-revoke.json' }).as('getDevicesAfterRevoke');

    cy.contains('[data-cy=device-row]', 'alpha-node').find('[data-cy=row-revoke]').click();
    cy.get('.modal-footer .btn-danger').click();

    cy.wait('@revokeDevices').its('request.body').should('deep.equal', { udids: ['udid-a'] });
    cy.wait('@getDevicesAfterRevoke');
    cy.get('[data-cy=device-row]').should('have.length', 3);
    cy.get('[data-cy=device-row]').should('not.contain', 'alpha-node');
    cy.get('.alert-success').should('contain', 'Device revoked.');
  });

  it('Should bulk revoke selected devices (DEVI-06)', function() {
    cy.intercept({ method: 'GET', pathname: '/api/v2/device' }, { fixture: 'api/devices-after-revoke.json' }).as('getDevicesAfterRevoke');

    // The inputs are visually hidden by the .abc-checkbox styling.
    cy.get('#checkbox-0').check({ force: true });
    cy.get('#checkbox-1').check({ force: true });
    cy.get('[data-cy=bulk-revoke]').should('contain', 'Revoke (2)').click();
    cy.get('.modal-footer .btn-danger').click();

    cy.wait('@revokeDevices').its('request.body.udids').should('have.length', 2);
    cy.get('.alert-success').should('contain', 'Devices revoked.');
  });

  it('Should transfer a device (DEVI-07)', function() {
    cy.get('#checkbox-0').check({ force: true });
    cy.get('[data-cy=bulk-transfer]').click();
    cy.get('#transfer-modal').should('be.visible');
    cy.get('#transfer-to').type('new-owner@example.test');
    cy.get('#transfer-modal .modal-footer .btn-warning').click();

    cy.wait('@transferDevices').its('request.body').should('deep.equal', {
      udids: ['udid-z'],
      to: 'new-owner@example.test',
      mig_sources: false,
      mig_apikeys: false,
    });
    cy.get('.alert-success').should('contain', 'Transfer request sent.');
  });

  it('Should push configuration to selected devices (DEVI-08)', function() {
    cy.get('#checkbox-0').check({ force: true });
    cy.get('[data-cy=bulk-push]').click();
    cy.get('#push-config-modal').should('be.visible');
    // Both env.json globals render as checkboxes; clicking the label toggles the
    // hidden custom-control input.
    cy.get('#push-config-modal .custom-control-label').should('have.length', 3); // ssid, mqtt_host, reset_devices
    cy.get('#push-config-modal').contains('.custom-control-label', 'ssid').click();
    cy.get('#push-config-modal .modal-footer .btn-info').click();

    cy.wait('@pushConfiguration').its('request.body').should('deep.equal', {
      udids: ['udid-z'],
      enviros: ['ssid'],
      reset_devices: false,
    });
    cy.get('.alert-success').should('contain', 'Configuration pushed.');
  });

  it('Should trigger firmware build (DEVI-09)', function() {
    cy.contains('[data-cy=device-row]', 'zephyr-01').find('[data-cy=row-build]').click();

    cy.wait('@buildFirmware').its('request.body').should('deep.equal', {
      build: { udid: 'udid-z', source_id: 'src-1', dryrun: false },
    });
    cy.get('.alert-success').should('contain', 'Build triggered.');
  });
```

- [ ] **Step 2: Run the spec**

```bash
cd vue && npx start-server-and-test serve http://127.0.0.1:3000/ "npx cypress run --spec cypress/integration/devices.spec.js"
```

Expected: 10 passing. If DEVI-08's `have.length 3` fails, count the
`custom-control-label` elements actually rendered in the modal and correct the
number — the "Reset devices after push" checkbox is the third.

- [ ] **Step 3: Verify the request assertions can fail**

Change DEVI-09's expected `source_id` from `'src-1'` to `'src-wrong'` and re-run.

Expected: FAILS on the deep-equal. Revert and confirm green. Do the same for
DEVI-05's `udids` array.

- [ ] **Step 4: Confirm nothing reached the real API**

```bash
cd vue && npx start-server-and-test serve http://127.0.0.1:3000/ "npx cypress run --spec cypress/integration/devices.spec.js" 2>&1 | grep -i "unstubbed" || echo "no unstubbed calls"
```

Expected: `no unstubbed calls`.

- [ ] **Step 5: Lint and commit**

```bash
cd vue && yarn eslint
git add cypress/integration/devices.spec.js
git commit -m "test(cypress): implement DEVI-05..09 device write-path assertions

Revoke, bulk revoke, transfer, push-config and build now assert the
outgoing request body against a stubbed endpoint instead of mutating a
live account.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `DeviceDetail.vue` hooks + `device-detail.spec.js` — 7 TODOs

**Files:**
- Modify: `src/pages/Devices/DeviceDetail.vue`
- Modify: `cypress/integration/device-detail.spec.js`

**Interfaces:**
- Consumes: `data-cy=row-detail` from Task 3; `@getDevices`, `@getBuildLog`,
  `@getProfile`.
- Produces: `card-device-info`, `card-enviros`, `card-transformers`,
  `card-build-history`, `card-device-logs`, `action-transfer`.

`DeviceDetail.vue#loadDevice` reads from the same `GET /device` list plus
`/logs/build` and `/profile` (transformers live inside the profile document —
`store/transformers.js:30`), so no new endpoint is needed.

- [ ] **Step 1: Add the attributes to `DeviceDetail.vue`**

```html
        <b-card title="Device Info" class="mb-3" data-cy="card-device-info">
```

```html
        <b-card title="Actions" class="mb-3" data-cy="card-actions">
          <b-button variant="secondary" @click="buildDevice" class="mr-2 mb-2">Build Firmware</b-button>
          <b-button variant="danger" @click="revokeDevice" class="mr-2 mb-2">Revoke Device</b-button>
          <b-button variant="warning" data-cy="action-transfer" @click="$bvModal.show('transfer-modal')" class="mr-2 mb-2">Transfer Device</b-button>
        </b-card>
```

```html
        <b-card title="Environment Variables (masked)" class="mb-3" data-cy="card-enviros">
```

```html
        <b-card title="Transformer Assignment" class="mb-3" data-cy="card-transformers">
```

```html
        <b-card title="Build History" class="mb-3" data-cy="card-build-history">
```

```html
        <b-card v-if="device.last_build_id" title="Device Logs (last build)" class="mb-3" data-cy="card-device-logs">
```

- [ ] **Step 2: Replace the spec body**

```js
describe('Device Detail feature', function() {

  beforeEach(function() {
    cy.viewport(1536, 754);
    cy.stubThinxApi();
  });

  it('Should navigate to device detail on Detail button click (DEVI-10)', function() {
    cy.visitApp('/#/app/devices', { session: true });
    cy.wait('@getDevices');
    cy.get('[data-cy=device-row]').first().find('[data-cy=row-detail]').click();
    cy.hash().should('eq', '#/app/device/udid-z');
    cy.get('.page-title').should('contain', 'zephyr-01');
  });

  describe('once on the detail page', function() {

    beforeEach(function() {
      cy.visitApp('/#/app/device/udid-z', { session: true });
      cy.wait(['@getDevices', '@getBuildLog', '@getProfile']);
    });

    it('Should display device info section (DEVI-11)', function() {
      cy.get('[data-cy=card-device-info]').should('be.visible');
      cy.get('[data-cy=card-device-info]').should('contain', 'udid-z');
      cy.get('[data-cy=card-device-info]').should('contain', 'AA:BB:CC:00:00:01');
      cy.get('[data-cy=card-device-info]').should('contain', 'esp32');
    });

    it('Should display environment variables section (DEVI-11)', function() {
      cy.get('[data-cy=card-enviros]').should('be.visible');
      cy.get('[data-cy=card-enviros]').should('contain', 'ssid');
      cy.get('[data-cy=card-enviros]').should('contain', 'mqtt_host');
    });

    it('Should display transformer assignment section (DEVI-11)', function() {
      cy.get('[data-cy=card-transformers]').should('be.visible');
      cy.get('[data-cy=card-transformers] select').should('exist');
      cy.get('[data-cy=card-transformers] select option').should('contain', 'passthrough');
    });

    it('Should display build history section (DEVI-11)', function() {
      cy.get('[data-cy=card-build-history]').should('be.visible');
      // build-log.json gives udid-z exactly one build.
      cy.get('[data-cy=card-build-history] tbody tr').should('have.length', 1);
      cy.get('[data-cy=card-build-history]').should('contain', 'build-1');
    });

    it('Should display device logs section (DEVI-11)', function() {
      // The card is v-if'd on last_build_id, which udid-z sets to build-1.
      cy.get('[data-cy=card-device-logs]').should('be.visible');
      cy.get('[data-cy=card-device-logs] pre').should('contain', 'compiling module');
    });

    it('Should display Transfer button in Actions card (DEVI-11)', function() {
      cy.get('[data-cy=action-transfer]').should('be.visible').and('contain', 'Transfer Device');
    });

  });

});
```

Delete the `import { hasLoginCredentials, MISSING_LOGIN_CREDENTIALS }` line.

- [ ] **Step 3: Run the spec**

```bash
cd vue && npx start-server-and-test serve http://127.0.0.1:3000/ "npx cypress run --spec cypress/integration/device-detail.spec.js"
```

Expected: 7 passing.

- [ ] **Step 4: Verify the device-logs test can fail**

In `devices.json`, set `udid-z`'s `last_build_id` to `""` and re-run.

Expected: the DEVI-11 device-logs test FAILS — the card is `v-if`'d away. Revert
and confirm green.

- [ ] **Step 5: Lint and commit**

```bash
cd vue && yarn eslint
git add src/pages/Devices/DeviceDetail.vue cypress/integration/device-detail.spec.js
git commit -m "test(cypress): implement DEVI-10..11 device detail assertions

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: `Visits.vue` hooks + `dashboard.spec.js` — 8 TODOs

**Files:**
- Modify: `src/pages/Visits/Visits.vue`
- Modify: `cypress/integration/dashboard.spec.js`

**Interfaces:**
- Consumes: `@getStats`, `@getStatsToday`, `@getDevices`, `@getAuditLog`, `@getBuildLog`.
- Produces: `metric-card`, `chart-range-7`, `chart-range-31`, `chart-range-365`,
  `recent-builds`, `recent-audit`, `build-download`.

- [ ] **Step 1: Add the attributes to `Visits.vue`**

```html
          <b-card :class="'text-white bg-' + card.variant" data-cy="metric-card">
```

```html
              <b-button size="sm" class="mr-1" data-cy="chart-range-7" :variant="chartRange === 7 ? 'primary' : 'outline-secondary'" @click="chartRange = 7">7 days</b-button>
              <b-button size="sm" class="mr-1" data-cy="chart-range-31" :variant="chartRange === 31 ? 'primary' : 'outline-secondary'" @click="chartRange = 31">31 days</b-button>
              <b-button size="sm" class="mr-1" data-cy="chart-range-365" :variant="chartRange === 365 ? 'primary' : 'outline-secondary'" @click="chartRange = 365">365 days</b-button>
```

(Keep the existing multi-line formatting of those three buttons; only the
`data-cy` attribute is added to each.)

```html
          <b-card title="Recent Audit Events" data-cy="recent-audit">
```

```html
          <b-card title="Recent Builds" data-cy="recent-builds">
```

```html
                    <b-button
                      v-if="item.build_id"
                      size="sm"
                      variant="primary"
                      data-cy="build-download"
                      @click="downloadArtifact(item)"
                    >Download</b-button>
```

- [ ] **Step 2: Replace the spec body**

```js
describe('Dashboard feature', function() {

  beforeEach(function() {
    cy.viewport(1536, 754);
    cy.stubThinxApi();
  });

  it('Should load the dashboard without JS errors (DASH-01)', function() {
    cy.visitApp('/#/app/dashboard', {
      session: true,
      onBeforeLoad(win) {
        // Cypress already fails on uncaught exceptions; a logged console.error is
        // invisible to it, so stub it to make this assertion real.
        cy.stub(win.console, 'error').as('consoleError');
      },
    });
    cy.get('.page-title').should('contain', 'Dashboard');
    cy.get('@consoleError').should('not.have.been.called');
  });

  it('Should fetch real stats from GET /stats (DASH-01)', function() {
    cy.visitApp('/#/app/dashboard', { session: true });
    cy.wait('@getStats').its('response.statusCode').should('eq', 200);
    cy.wait('@getStatsToday');
    // Devices Checked In binds week to stats.json's DEVICE_CHECKIN: [42].
    cy.contains('[data-cy=metric-card]', 'Devices Checked In').should('contain', 'Week: 42');
  });

  describe('once loaded', function() {

    beforeEach(function() {
      cy.visitApp('/#/app/dashboard', { session: true });
      cy.wait(['@getStats', '@getStatsToday', '@getDevices']);
    });

    it('Should display six metric cards (DASH-02)', function() {
      cy.get('[data-cy=metric-card]').should('have.length', 6);
    });

    it('Should show today/week/month breakdowns on metric cards (DASH-02)', function() {
      cy.get('[data-cy=metric-card]').each(($card) => {
        expect($card.text()).to.contain('Today:');
        expect($card.text()).to.contain('Week:');
        expect($card.text()).to.contain('Month:');
      });
      // Asserted on Devices Checked In, whose today (stats-today.json: 4) and week
      // (stats.json: 42) come from different endpoints. NOT asserted on Active
      // Devices, whose three periods all bind to deviceCount by design.
      cy.contains('[data-cy=metric-card]', 'Devices Checked In')
        .should('contain', 'Today: 4')
        .and('contain', 'Week: 42');
    });

    it('Should render the check-ins timeline chart (DASH-03)', function() {
      cy.contains('.card', 'Device Check-ins').find('canvas').should('exist');
    });

    it('Should update the timeline chart when the range selector changes (DASH-03)', function() {
      // Deliberately shallow. Chart.js paints to a canvas and exposes no DOM
      // signal that the dataset changed, so this asserts the control responds and
      // the chart survives — it will NOT catch a broken dateAxis computation.
      // Making it real would mean reaching into the Chart.js instance or diffing
      // canvas pixels, which is disproportionate here.
      cy.get('[data-cy=chart-range-7]').should('have.class', 'btn-primary');
      cy.get('[data-cy=chart-range-31]').click();
      cy.get('[data-cy=chart-range-31]').should('have.class', 'btn-primary');
      cy.get('[data-cy=chart-range-7]').should('not.have.class', 'btn-primary');
      cy.contains('.card', 'Device Check-ins').find('canvas').should('exist');
    });

    it('Should display the recent builds widget with download links (DASH-04)', function() {
      cy.get('[data-cy=recent-builds]').should('be.visible');
      cy.get('[data-cy=recent-builds] tbody tr').should('have.length', 3);
      cy.get('[data-cy=recent-builds]').should('contain', 'zephyr-01');
      // normalizeBuildItems falls back build_id -> item._id, so every realistic
      // row has one. A row without a download button is not reachable from a real
      // payload, so asserting "only some rows have one" would assert a fiction.
      cy.get('[data-cy=build-download]').should('have.length', 3);
    });

    it('Should display the recent audit events widget (DASH-05)', function() {
      cy.get('[data-cy=recent-audit]').should('be.visible');
      cy.get('[data-cy=recent-audit] tbody tr').should('have.length', 4);
      cy.get('[data-cy=recent-audit]').should('contain', 'Device revoked by owner');
      cy.get('[data-cy=recent-audit]').should('contain', 'User logged in');
    });

  });

});
```

Delete the `import { hasLoginCredentials, MISSING_LOGIN_CREDENTIALS }` line.

- [ ] **Step 3: Run the spec**

```bash
cd vue && npx start-server-and-test serve http://127.0.0.1:3000/ "npx cypress run --spec cypress/integration/dashboard.spec.js"
```

Expected: 8 passing.

- [ ] **Step 4: Verify the stats binding can fail**

Change `stats.json`'s `DEVICE_CHECKIN` from `[42]` to `[43]` and re-run.

Expected: both DASH-01-stats and DASH-02-periods FAIL on `Week: 42`. Revert and
confirm green. This proves the cards read the response rather than rendering a
default.

- [ ] **Step 5: Lint and commit**

```bash
cd vue && yarn eslint
git add src/pages/Visits/Visits.vue cypress/integration/dashboard.spec.js
git commit -m "test(cypress): implement DASH-01..05 dashboard assertions

Metric cards, the check-ins chart and both widgets now assert against
fixed stats/audit/build fixtures. The chart-range test is intentionally
shallow and says so inline.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: `History.vue` hooks + `history.spec.js` — 5 TODOs

**Files:**
- Modify: `src/pages/History/History.vue`
- Modify: `cypress/integration/history.spec.js`

**Interfaces:**
- Consumes: `@getAuditLog`, `@getBuildLog`.
- Produces: `date-from`, `date-to`, `flag-filter`, `audit-row`, `build-row`,
  `build-log-pre`, `build-expand`.

The date inputs appear **twice** — once per tab — with the same `v-model`, so
every selector must be scoped to the visible `.tab-pane.active`, or Cypress
resolves two elements and fails.

- [ ] **Step 1: Add the attributes to `History.vue`**

In the Audit Log tab:

```html
        <b-form-inline class="mb-2">
          <label class="mr-2 mb-0">From</label>
          <b-form-input type="date" data-cy="date-from" v-model="dateFrom" class="mr-3" style="max-width:180px" />
          <label class="mr-2 mb-0">To</label>
          <b-form-input type="date" data-cy="date-to" v-model="dateTo" style="max-width:180px" />
        </b-form-inline>
```

```html
        <b-form-checkbox-group
          v-model="auditFlagFilter"
          :options="flagFilterOptions"
          class="mb-3"
          data-cy="flag-filter"
          switches
        />
```

```html
            <tr v-for="(item, i) in filteredAudit" :key="i" :class="rowClass(item)" data-cy="audit-row">
```

In the Build Log tab — the same two `data-cy="date-from"` / `data-cy="date-to"`
attributes on its copy of the date inputs, plus:

```html
            <tr v-for="(item, i) in filteredBuilds" :key="i" data-cy="build-row">
```

```html
                <pre
                  v-if="hasLog(item)"
                  class="mb-0"
                  data-cy="build-log-pre"
                  :style="logStyle(item)"
                >{{ logFull(item) }}</pre>
                <b-button
                  v-if="logIsTruncatable(item)"
                  size="sm"
                  variant="link"
                  class="p-0"
                  data-cy="build-expand"
                  @click="toggleExpand(item)"
                >{{ isExpanded(item) ? 'Collapse' : 'Expand' }}</b-button>
```

- [ ] **Step 2: Replace the spec body**

```js
describe('History feature', function() {

  beforeEach(function() {
    cy.viewport(1536, 754);
    cy.stubThinxApi();
  });

  it('Should load the history page with both Audit Log and Build Log tabs (HIST-01)', function() {
    cy.visitApp('/#/app/history', {
      session: true,
      onBeforeLoad(win) {
        cy.stub(win.console, 'error').as('consoleError');
      },
    });
    cy.wait(['@getAuditLog', '@getBuildLog']);
    // Scoped to .nav-tabs: the page header also renders .nav-link elements.
    cy.get('.nav-tabs .nav-link').should('contain', 'Audit Log');
    cy.get('.nav-tabs .nav-link').should('contain', 'Build Log');
    cy.get('@consoleError').should('not.have.been.called');
  });

  describe('once loaded', function() {

    beforeEach(function() {
      cy.visitApp('/#/app/history', { session: true });
      cy.wait(['@getAuditLog', '@getBuildLog']);
    });

    it('Should reflect tab state in URL — /app/history/audit and /app/history/builds (HIST-02)', function() {
      cy.hash().should('eq', '#/app/history/audit');
      cy.get('.nav-tabs').contains('.nav-link', 'Build Log').click();
      cy.hash().should('eq', '#/app/history/builds');
      cy.get('.nav-tabs').contains('.nav-link', 'Audit Log').click();
      cy.hash().should('eq', '#/app/history/audit');
    });

    it('Should allow expanding a build row to read the full log inline (HIST-03)', function() {
      cy.get('.nav-tabs').contains('.nav-link', 'Build Log').click();
      // Only build-1's log exceeds the 400-char logIsTruncatable threshold.
      cy.get('[data-cy=build-expand]').should('have.length', 1);
      cy.contains('[data-cy=build-row]', 'zephyr-01').within(() => {
        cy.get('[data-cy=build-log-pre]').should('have.attr', 'style').and('contain', 'max-height');
        cy.get('[data-cy=build-log-pre]').invoke('text').then((collapsedText) => {
          cy.get('[data-cy=build-expand]').should('contain', 'Expand').click();
          cy.get('[data-cy=build-log-pre]').should('have.attr', 'style').and('not.contain', 'max-height');
          cy.get('[data-cy=build-log-pre]').invoke('text').should((expandedText) => {
            expect(expandedText.length).to.be.greaterThan(collapsedText.length);
          });
        });
      });
      cy.get('[data-cy=build-expand]').should('contain', 'Collapse');
    });

    it('Should filter both tabs by a date range (HIST-04)', function() {
      cy.get('[data-cy=audit-row]').should('have.length', 4);
      // audit-log.json's oldest entry is 2026-09-10; this window excludes it.
      cy.get('.tab-pane.active [data-cy=date-from]').type('2026-09-15');
      cy.get('.tab-pane.active [data-cy=date-to]').type('2026-09-18');
      cy.get('[data-cy=audit-row]').should('have.length', 3);
      cy.get('[data-cy=audit-row]').should('not.contain', 'API key created');

      // dateFrom/dateTo are shared across both tabs by a single v-model.
      cy.get('.nav-tabs').contains('.nav-link', 'Build Log').click();
      cy.get('[data-cy=build-row]').should('have.length', 3);
      cy.get('.tab-pane.active [data-cy=date-from]').clear().type('2026-09-18');
      cy.get('[data-cy=build-row]').should('have.length', 1);
      cy.get('[data-cy=build-row]').should('contain', 'zephyr-01');
    });

    it('Should filter audit log by warning/danger flag checkboxes (HIST-05)', function() {
      cy.get('[data-cy=audit-row]').should('have.length', 4);
      cy.get('.table-danger').should('have.length', 1);
      // b-form-checkbox-group with `switches` hides the real input; click the label.
      cy.get('[data-cy=flag-filter]').contains('.custom-control-label', 'Danger').click();
      cy.get('[data-cy=audit-row]').should('have.length', 3);
      cy.get('.table-danger').should('not.exist');
      cy.get('[data-cy=audit-row]').should('not.contain', 'Device revoked by owner');
    });

  });

});
```

Delete the `import { hasLoginCredentials, MISSING_LOGIN_CREDENTIALS }` line.

- [ ] **Step 3: Run the spec**

```bash
cd vue && npx start-server-and-test serve http://127.0.0.1:3000/ "npx cypress run --spec cypress/integration/history.spec.js"
```

Expected: 5 passing. If HIST-04's date `.type()` fails, the input is
`type="date"` — pass the value as `YYYY-MM-DD`, which the code above already
does.

- [ ] **Step 4: Verify HIST-03 can fail**

Shorten the `contents` string in `build-log.json` to under 400 characters and
re-run.

Expected: HIST-03 FAILS at `[data-cy=build-expand]` having length 1 — the button
is `v-if`'d on `logIsTruncatable`. Restore the long string (re-run the Node
snippet from Task 1 Step 5) and confirm green.

- [ ] **Step 5: Lint and commit**

```bash
cd vue && yarn eslint
git add src/pages/History/History.vue cypress/integration/history.spec.js
git commit -m "test(cypress): implement HIST-01..05 history assertions

Tab/URL sync, inline log expansion, date-range filtering and the audit
flag switches now assert against fixed audit and build fixtures.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: `Profile.vue` + `Header.vue` hooks + `profile.spec.js` — 7 TODOs

**Files:**
- Modify: `src/pages/Profile/Profile.vue`
- Modify: `src/components/Header/Header.vue`
- Modify: `cypress/integration/profile.spec.js`

**Interfaces:**
- Consumes: `@getProfile`, `@postProfile`, `@deleteAccount`; the `profile.json`,
  `profile-admin.json`, `profile-with-avatar.json` and `avatar.png` fixtures.
- Produces: `save-profile`, `save-notifications`, `avatar-file`,
  `avatar-preview`, `delete-account`, `settings-dropdown`.

PROF-04 asserts on the **tab title**, which `b-tab` renders into `.nav-tabs` —
not onto the tab pane — so it uses text, not `data-cy`. Nothing is ever
deleted: `DELETE /user` is stubbed.

- [ ] **Step 1: Add the attributes to `Profile.vue`**

```html
          <b-button type="submit" variant="primary" data-cy="save-profile" :disabled="saving">
            {{ saving ? 'Saving...' : 'Save Profile' }}
          </b-button>
```

```html
          <b-button type="submit" variant="primary" data-cy="save-notifications" :disabled="saving">
            {{ saving ? 'Saving...' : 'Save Notifications' }}
          </b-button>
```

```html
            <img
              :src="avatarSrc"
              class="rounded-circle mb-2"
              style="width:96px;height:96px;object-fit:cover"
              alt="Profile avatar"
              data-cy="avatar-preview"
            />
```

```html
            <b-form-file
              accept="image/jpeg,image/png"
              data-cy="avatar-file"
              @change="onAvatarFileChange"
              :disabled="avatarUploading"
            />
```

```html
            <b-button variant="danger" data-cy="delete-account" @click="confirmDeleteAccount">Delete My Account</b-button>
```

- [ ] **Step 2: Add the attribute to `Header.vue`**

On the settings `b-nav-item-dropdown` (the one containing the My Account item,
around line 48):

```html
      <b-nav-item-dropdown
        data-cy="settings-dropdown"
```

The `My Account` item itself is matched by text — `b-dropdown-item` renders a
`<li>` wrapping an `<a>`, and which element receives a passthrough attribute is
version-dependent, so a `data-cy` there would be fragile.

- [ ] **Step 3: Replace the spec body**

```js
describe('Profile feature', function() {

  beforeEach(function() {
    cy.viewport(1536, 754);
  });

  describe('with a non-admin profile', function() {

    beforeEach(function() {
      cy.stubThinxApi();
      cy.visitApp('/#/app/profile', { session: true });
      cy.wait('@getProfile');
    });

    it('Should load the profile page without JS errors (PROF-01)', function() {
      cy.get('.page-title').should('contain', 'My Profile');
      cy.get('.nav-tabs .nav-link').should('contain', 'Profile');
    });

    it('Should display and save profile fields: first name, last name, phone, timezone (PROF-01)', function() {
      cy.get('input').eq(0).should('have.value', 'Cypress');
      cy.get('input').eq(1).should('have.value', 'Tester');
      cy.get('input').eq(2).should('have.value', '+420123456789');
      cy.get('input').eq(3).should('have.value', 'Europe/Prague');

      cy.get('input').eq(0).clear().type('Renamed');
      cy.get('[data-cy=save-profile]').click();

      cy.wait('@postProfile').its('request.body.info').should((info) => {
        expect(info.first_name).to.eq('Renamed');
        expect(info.last_name).to.eq('Tester');
        expect(info.mobile_phone).to.eq('+420123456789');
        expect(info.timezone_abbr).to.eq('Europe/Prague');
      });
      cy.get('.alert-success').should('contain', 'Profile updated.');
    });

    it('Should display avatar upload picker and preview (PROF-02)', function() {
      cy.get('.nav-tabs').contains('.nav-link', 'Avatar').click();
      cy.get('[data-cy=avatar-file]').should('exist');
      cy.get('[data-cy=avatar-preview]').should('be.visible');

      cy.get('[data-cy=avatar-file] input[type=file]').selectFile('cypress/fixtures/api/avatar.png', { force: true });
      // The post-upload refetch must return a profile that HAS an avatar, or
      // avatarSrc falls back to the bundled default and the preview never changes.
      cy.intercept({ method: 'GET', pathname: '/api/v2/profile' }, { fixture: 'api/profile-with-avatar.json' }).as('getProfileWithAvatar');
      cy.contains('button', 'Save Avatar').click();

      cy.wait('@postProfile').its('request.body').should('have.property', 'avatar');
      cy.wait('@getProfileWithAvatar');
      cy.get('[data-cy=avatar-preview]').should('have.attr', 'src').and('match', /^data:image\/png;base64,/);
    });

    it('Should save notification preferences without overwriting profile info (PROF-03)', function() {
      cy.get('.nav-tabs').contains('.nav-link', 'Notifications').click();
      cy.contains('.custom-control-label', 'All notifications').click();
      cy.get('[data-cy=save-notifications]').click();

      cy.wait('@postProfile').its('request.body.info').should((info) => {
        expect(info.notifications.all).to.eq(true);
        // The regression this test exists for: saveNotifications must merge into
        // the existing info blob, not replace it.
        expect(info.first_name).to.eq('Cypress');
        expect(info.email).to.eq('cypress@example.test');
      });
      cy.get('.alert-success').should('contain', 'Notification preferences saved.');
    });

    it('Should require confirmation before deleting account and redirect to /login (PROF-05)', function() {
      cy.get('.nav-tabs').contains('.nav-link', 'Account').click();

      // Cancel must not navigate and must not fire the request.
      cy.get('[data-cy=delete-account]').click();
      cy.get('.modal-footer .btn-secondary').click();
      cy.hash().should('eq', '#/app/profile');

      cy.get('[data-cy=delete-account]').click();
      cy.get('.modal-footer .btn-danger').click();
      cy.wait('@deleteAccount');
      cy.hash().should('eq', '#/login');
    });

    it('Should be reachable via header My Account dropdown link (PROF-06)', function() {
      cy.visitApp('/#/app/dashboard', { session: true });
      cy.get('[data-cy=settings-dropdown] .dropdown-toggle').click();
      cy.get('[data-cy=settings-dropdown]').contains('.dropdown-item', 'My Account').click();
      cy.hash().should('eq', '#/app/profile');
    });

  });

  it('Should show admin tab for admin users and hide it for non-admin (PROF-04)', function() {
    cy.stubThinxApi();
    cy.visitApp('/#/app/profile', { session: true });
    cy.wait('@getProfile');
    // b-tab renders its title into .nav-tabs, never onto the pane, so this is a
    // text assertion rather than a data-cy one.
    cy.get('.nav-tabs .nav-link').should('not.contain', 'Admin');

    cy.stubThinxApi({ profile: 'api/profile-admin.json' });
    cy.visitApp('/#/app/profile', { session: true });
    cy.wait('@getProfile');
    cy.get('.nav-tabs .nav-link').should('contain', 'Admin');
  });

});
```

Delete the `import { hasLoginCredentials, MISSING_LOGIN_CREDENTIALS }` line.

- [ ] **Step 4: Run the spec**

```bash
cd vue && npx start-server-and-test serve http://127.0.0.1:3000/ "npx cypress run --spec cypress/integration/profile.spec.js"
```

Expected: 7 passing. If PROF-01's positional `cy.get('input').eq(n)` picks the
wrong field, replace those four with `data-cy` attributes on the four
`b-form-input`s in the Profile tab — positional input indexing is the one
selector here that is not self-describing.

- [ ] **Step 5: Verify PROF-03 can fail**

In `Profile.vue#saveNotifications`, temporarily replace `existingInfo` with `{}`
so the merge is dropped, and re-run.

Expected: PROF-03 FAILS on `info.first_name` — proving the test actually guards
the data-loss regression rather than just checking the alert text. Revert and
confirm green.

- [ ] **Step 6: Lint and commit**

```bash
cd vue && yarn eslint
git add src/pages/Profile/Profile.vue src/components/Header/Header.vue cypress/integration/profile.spec.js
git commit -m "test(cypress): implement PROF-01..06 profile assertions

Includes a real guard on the saveNotifications info-merge regression, and
a delete-account test that asserts both the cancel and confirm paths
against a stubbed DELETE /user.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Documentation and full-suite verification

**Files:**
- Modify: `README.md` (repo root, `services/console/README.md`)

**Interfaces:**
- Consumes: everything above.
- Produces: nothing.

- [ ] **Step 1: Run the whole suite with NO credentials**

```bash
cd vue && env -u CYPRESS_THINX_TEST_USER -u CYPRESS_THINX_TEST_PASSWORD \
  -u CYPRESS_ADMIN_USER -u CYPRESS_ADMIN_PASS yarn test
```

Expected: the six stub-backed specs plus `support-smoke.spec.js` all run and
pass — 44 tests. `login.spec.js` and `admin.spec.js` skip with their credential
messages. **This is the whole point of the change**: before it, six specs
skipped here.

- [ ] **Step 2: Run the whole suite WITH credentials**

```bash
cd vue && yarn test
```

Expected: the same 44 pass, and the live lane additionally runs. If the live
lane fails, that is a pre-existing live-environment problem, not a regression
from this work — confirm by checking out the previous commit and re-running the
live lane alone.

- [ ] **Step 3: Update the README**

Replace the paragraph beginning "The Cypress variables are optional:" with:

```markdown
The Cypress suite runs in two lanes.

**Stub lane** — `dashboard`, `devices`, `device-detail`, `history`, `profile`,
`auth-extras` and `support-smoke`. These intercept every `/api/v2` call with
fixtures from `vue/cypress/fixtures/api/` and boot the app with a forged
session, so they need **no credentials and no network**. `cy.stubThinxApi()`
registers a catch-all that returns HTTP 500 for any `/api/v2` route it does not
explicitly stub, so an unstubbed call fails the test rather than reaching
production.

**Live lane** — `login.spec.js` and `admin.spec.js`. These use the real API and
skip themselves when `CYPRESS_THINX_TEST_*` / `CYPRESS_ADMIN_*` are unset
(`vue/cypress/support/credentials.js`). They are the only thing in the suite
that would notice a backend contract change, so keep them configured in CI.

The trade this makes: stub-lane fixtures can drift from the real API and the
suite would stay green against a payload shape that no longer exists. The live
lane covers login and the admin user list only — not the device, stats or log
payloads. When a `/api/v2` response shape changes, re-record the matching
fixture under `vue/cypress/fixtures/api/`.
```

- [ ] **Step 4: Check for documentation drift**

```bash
cd vue && npm run doc-drift
```

Expected: exits 0. If it flags the new paths, correct them in the README.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs(cypress): describe the stub and live test lanes

The six seeded specs no longer need credentials; CYPRESS_* now gates only
login.spec.js and admin.spec.js. Records the fixture-drift trade.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Self-review notes

**Spec coverage.** All 41 TODOs map to a task: auth-extras 4 → Task 2;
devices 5 + 5 → Tasks 3 and 4; device-detail 7 → Task 5; dashboard 8 → Task 6;
history 5 → Task 7; profile 7 → Task 8. The spec's support layer, fixtures,
`data-cy` set, CI-wiring and README sections map to Tasks 1, 3–8 and 9.

**Naming consistency.** `cy.visitApp` / `cy.stubThinxApi` are defined in Task 1
and used under exactly those names in Tasks 2–8. `@postProfile` is the single
alias for all three `POST /profile` callers — the spec's separate
`@updateProfile` / `@uploadAvatar` names were consolidated, because the store
routes all three through one endpoint.

**Known soft spots, flagged rather than hidden.** PROF-01 indexes profile inputs
positionally (`cy.get('input').eq(0)`); Task 8 Step 4 says what to do if that
resolves wrong. DEVI-08 asserts a hard count of 3 `custom-control-label`
elements in the push-config modal; Task 4 Step 2 says how to correct it. The
DASH-03 range test is shallow by decision and carries an inline comment saying
so.

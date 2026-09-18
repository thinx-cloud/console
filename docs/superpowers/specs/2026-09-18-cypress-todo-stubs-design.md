# Design — Implementing the Cypress `/* TODO */` placeholders

**Date:** 2026-09-18
**Scope:** `vue/cypress/` + ~30 additive `data-cy` attributes in `vue/src/`
**Status:** approved design, ready for an implementation plan

## Problem

Six Cypress spec files carry 41 placeholder tests whose bodies are a single
`/* TODO ... */` comment. They were seeded per phase during the v1.999 milestone
(`2fae585`, `8bf3024`, `9c86064`, `40c34bb`, `818dc54`, `acee2b2`, `95fba98`) and
never filled in. The features themselves shipped and were verified by hand — see
`.planning/phase-*/`*`-HUMAN-UAT.md`. What is missing is the automated regression
net, not the functionality.

| Spec | TODOs |
|:--|--:|
| `cypress/integration/devices.spec.js` | 10 |
| `cypress/integration/dashboard.spec.js` | 8 |
| `cypress/integration/device-detail.spec.js` | 7 |
| `cypress/integration/profile.spec.js` | 7 |
| `cypress/integration/history.spec.js` | 5 |
| `cypress/integration/auth-extras.spec.js` | 4 |
| **Total** | **41** |

`admin.spec.js` is the one seeded spec that was filled in (`e6dab88`) and is the
existing in-repo pattern. `login.spec.js` carries a different kind of TODO —
loose notes inside tests already skipped for live-API reasons. **Both are out of
scope.**

Two things block simply writing the assertions:

1. **The suite has no stub layer.** It runs against the live production API
   (`VUE_APP_API_HOSTNAME=https://rtm.thinx.cloud`) using a real account.
   Device count, categories, audit rows and build logs are whatever that account
   happens to hold, so data-dependent TODOs — "click pill, verify rows filtered",
   "select Alias, verify order", "assert filtered rows have date within range" —
   have nothing stable to assert against. These TODOs describe client-side
   computed properties (`Devices.filteredItems`, `History.filteredAudit`,
   `History.logIsTruncatable`), not backend behaviour.

2. **Six of the TODOs are destructive against production:** revoke a device
   (DEVI-05), bulk revoke (DEVI-06), transfer (DEVI-07), push config (DEVI-08),
   trigger a build (DEVI-09), and delete the account (PROF-05).

A third fact shapes the payoff: all six specs gate on `hasLoginCredentials()` and
the README documents `CYPRESS_THINX_TEST_*` as optional, so **none of these specs
run in CI today** even as stubs.

## Approach

Stub the API for the six specs; keep `login.spec.js` and `admin.spec.js` as a
live lane.

The six specs get `cy.intercept` fixtures plus a seeded session, so they run
deterministically with no credentials — which is what gets them running in CI at
all. Destructive operations assert the outgoing request instead of performing it,
which is a *stronger* assertion than "the row disappeared on prod". The live lane
is retained because it is the only thing in the repo that would notice backend
contract drift.

Rejected alternatives:

- **Fully live.** Data-dependent TODOs would get invariant-only assertions
  ("a table exists") that pass on an empty account, and the six destructive tests
  could not run at all.
- **Stub everything, including login and admin.** Hermetic and fast, but nothing
  in the repo would touch the real API, so a backend contract change would ship
  green.

## Components

### 1. `cypress/support/session.js` — `cy.seedSession(opts)`

Forges a JWT and writes it to `sessionStorage` from within
`cy.visit(url, { onBeforeLoad })`, so the app boots already authenticated.

No client-side signature verification stands in the way: `store/auth.js`
`isJwtValid()` calls `VueJwtDecode.decode`, which base64-decodes the payload and
reads `exp`; `Routes.js`' `beforeEach` guard and `App.vue#hydrateSession` also
only read `exp`. A token of the form
`base64url(header) + '.' + base64url(payload) + '.' + 'test-signature'` is
therefore sufficient.

```
cy.seedSession()                          // exp = now + 1h
cy.seedSession({ expiresInSeconds: 1 })   // AUTH-03
cy.seedSession({ owner: 'test-owner' })
```

It must write the key names `store/auth-storage.js` uses: `accessToken` and
`refreshToken` in `sessionStorage`. `hydrateSession` rejects the session if a
present `refreshToken` is invalid, so the command either omits it or forges it
with the same `exp`.

### 2. `cypress/support/api-stubs.js` — `cy.stubThinxApi(overrides)`

Registers one `cy.intercept` per endpoint, matching on `pathname` rather than a
full URL. This matters: `VUE_APP_API_HOSTNAME` is a remote host in CI and falls
back to `window.location.origin` locally, and `pathname` matching ignores the
host, so the same stub works in both. (`pathname` is supported in the installed
Cypress 9.7.0 — `node_modules/cypress/types/net-stubbing.ts:363`.)

Reads — `/api/v2/profile`, `/device`, `/env`, `/stats`, `/stats/today`,
`/logs/audit`, `/logs/build`, `/csrf-token`.
Writes — `DELETE /device`, `POST /device/configuration`, `POST /build`,
`POST /transfer/request`, `PUT /device`, `POST /profile`, `DELETE /user`.

Each intercept is aliased (`@getDevices`, `@revokeDevices`, …) so tests can
`cy.wait()` on it and assert `request.body`.

**The catch-all is load-bearing.** Before any specific intercept, the command
registers:

```js
cy.intercept('/api/v2/**', { statusCode: 500, body: { success: false, response: 'unstubbed' } });
```

Any endpoint not explicitly stubbed fails loudly instead of escaping to
production. This is what makes "these tests never touch prod" an enforced
property rather than an intention.

`overrides` swaps a single response per test, e.g.
`cy.stubThinxApi({ profile: 'api/profile-admin.json' })` for PROF-04, or a
function for the DEVI-05 refetch that must return a shorter list on the second
call.

### 3. Fixtures — `cypress/fixtures/api/`

One coherent account, sized so every filter/sort/search assertion resolves to a
strict subset rather than "all rows" or "no rows".

Fixtures are **recorded from the live API once with the test account, then
sanitized and hand-tuned** — not invented — so they start faithful to the real
envelope. The canonical shape is `{ success, response }`, produced by
`Util.responder` in `lib/thinx/util.js`; `core/api.js#parseResult` returns
`result[<first non-success key>]`.

`devices.json` — 4 devices:

| alias | category | platform | lastupdate | udid |
|:--|:--|:--|:--|:--|
| zephyr-01 | green | esp32 | newest | `udid-z` |
| alpha-node | blue | esp8266 | 2nd | `udid-a` |
| beta-node | green | esp32 | 3rd | `udid-b` |
| gamma-probe | red-intense | mongoose | oldest | `udid-g` |

- DEVI-01: pill `green` → exactly 2 rows.
- DEVI-02: default sort (`lastupdate`) puts `zephyr-01` first; sort by `alias`
  puts `alpha-node` first. The orders differ strictly, so the assertion cannot
  pass by accident.
- DEVI-03: search `node` → exactly 2 rows.
- `udid-z` additionally carries `environment: { ssid, mqtt_host }`,
  `transformers: ['utid-1']`, `last_build_id: 'build-1'`, `source: 'src-1'` —
  it is the device-detail fixture. `DeviceDetail.vue#loadDevice` reads from the
  same `GET /device` list plus `/logs/build` and `/profile`, so no extra
  endpoint is needed.

Others:

- `profile.json` — `admin: false`, `info.{first_name,last_name,mobile_phone,timezone_abbr,email,notifications}`,
  and `info.transformers: [{ utid: 'utid-1', alias: 'passthrough', body }]`
  (`store/transformers.js` reads transformers out of `GET /profile`, not a
  dedicated route).
- `profile-admin.json` — identical but `admin: true`, for PROF-04.
- `env.json` — `response: ['ssid', 'mqtt_host']`, so the push-config modal
  renders two checkboxes (DEVI-08); an empty array renders "No environment
  globals defined." instead.
- `stats.json` — metric keys plus **non-empty** `timeline.CHECKINS`.
  `CheckinsTimeline.vue` renders "No check-in data for this range." instead of a
  `<canvas>` when `checkins.length === 0`, so DASH-03 depends on this.
- `stats-today.json` — same keys, smaller values, so DASH-01 can prove the
  today/week columns bind to different sources.
- `audit-log.json` — 4 entries: one `flags: ['danger']`, one `['warning']`, two
  `['info']`, across a date spread wide enough for a from/to range to exclude
  some (HIST-04, HIST-05).
- `build-log.json` — 3 entries in the **raw nested API shape** that
  `store/buildlog.js#normalizeBuildItems` consumes (`item.log[].log[].contents`),
  not the flattened shape the components read. One entry's joined log exceeds
  400 characters (`History.vue#logIsTruncatable` hides the Expand button below
  that threshold, so HIST-03 needs it); one is short; one has no log entries at
  all. Their `udid`s are `udid-z`, `udid-a`, `udid-g` so that
  `DeviceDetail.vue#loadDevice`'s `buildHistory` filter resolves to exactly one
  row, and `build-1` matches `udid-z`'s `last_build_id` for the Device Logs card.
- `avatar.png` — a small PNG for PROF-02's `cy.selectFile()` (available in
  Cypress 9.7.0 — `node_modules/cypress/types/cypress.d.ts:700`).

### 4. `src/` changes — additive `data-cy` attributes

Roughly 30 attributes, no logic changes. Added only where a text- or
class-based selector is genuinely fragile; everything else stays text-based.

- `Devices.vue` — `category-pill-{cat}`, `device-sort`, `device-search`,
  `view-list`, `view-grid`, `device-row`, `device-card`, `bulk-revoke`,
  `bulk-transfer`, `bulk-push`, `row-detail`, `row-build`, `row-revoke`
- `Visits.vue` — `metric-card`, `chart-range-7|31|365`, `recent-builds`,
  `recent-audit`, `build-download`
- `History.vue` — `date-from`, `date-to`, `flag-filter`, `audit-row`,
  `build-row`, `build-log-pre`, `build-expand`
- `Profile.vue` — `profile-tab-admin`, `save-profile`, `save-notifications`,
  `avatar-file`, `avatar-preview`, `delete-account`
- `DeviceDetail.vue` — `card-device-info`, `card-enviros`, `card-transformers`,
  `card-build-history`, `card-device-logs`, `action-transfer`
- `Header.vue` — `settings-dropdown`, `nav-my-account`

### 5. Spec changes

Each of the six specs replaces its `beforeEach` — the `hasLoginCredentials()`
gate and `cy.login()` call both go away — with `cy.stubThinxApi()` +
`cy.seedSession()`. The `credentials.js` module itself is unchanged; it keeps
serving `login.spec.js` and `admin.spec.js`.

## Test mapping

All 41, with the assertion each TODO becomes.

### `devices.spec.js` (10)

| ID | Assertion |
|:--|:--|
| DEVI-01 pills | 8 `[data-cy^=category-pill-]` render; `All` is the active variant |
| DEVI-01 filter | click `category-pill-green` → `[data-cy=device-row]` length 2, containing `zephyr-01` and `beta-node` |
| DEVI-02 sort | select `alias` in `[data-cy=device-sort]` → first row is `alpha-node` (default `lastupdate` gives `zephyr-01`) |
| DEVI-03 search | type `node` → 2 rows, each containing `node` |
| DEVI-04 grid | click `[data-cy=view-grid]` → 4 `[data-cy=device-card]`, `.table` absent |
| DEVI-05 revoke | Revoke on the `alpha-node` row → `.modal` confirm → `@revokeDevices` body `{udids:['udid-a']}`; the follow-up `GET /device` is overridden to return the remaining 3 → 3 rows; success alert |
| DEVI-06 bulk | check 2 rows → `bulk-revoke` reads `Revoke (2)` → confirm → `@revokeDevices` body has 2 udids |
| DEVI-07 transfer | select row → transfer modal → type email → OK → `@transferDevices` body `{udids, to, mig_sources:false, mig_apikeys:false}` |
| DEVI-08 push | select row → push modal → 2 enviro checkboxes; check one → OK → `@pushConfiguration` body `{udids, enviros:['ssid'], reset_devices:false}` |
| DEVI-09 build | row Build → `@buildFirmware` body `{build:{udid:'udid-z', source_id:'src-1', dryrun:false}}`; success alert |

### `device-detail.spec.js` (7)

| ID | Assertion |
|:--|:--|
| DEVI-10 | from `/app/devices`, click first `[data-cy=row-detail]` → hash `#/app/device/udid-z` |
| DEVI-11 info | `[data-cy=card-device-info]` visible, shows the fixture UDID, MAC, platform |
| DEVI-11 enviros | `[data-cy=card-enviros]` lists `ssid` and `mqtt_host` |
| DEVI-11 transformers | `[data-cy=card-transformers]` present; its `select` offers `passthrough` |
| DEVI-11 builds | `[data-cy=card-build-history]` present; row for `build-1` |
| DEVI-11 logs | `[data-cy=card-device-logs]` present (fixture sets `last_build_id`); `<pre>` non-empty |
| DEVI-11/D-12 | `[data-cy=action-transfer]` visible in the Actions card |

### `dashboard.spec.js` (8)

| ID | Assertion |
|:--|:--|
| DASH-01 load | `.page-title` contains `Dashboard`; `console.error` stubbed in `onBeforeLoad` and asserted not called — see the note below on why this is not the same as "no uncaught exception" |
| DASH-01 stats | `cy.wait('@getStats')` fires; a card value equals the fixture number |
| DASH-02 cards | `[data-cy=metric-card]` length 6 |
| DASH-02 periods | each card contains `Today:`, `Week:`, `Month:`; on the `Devices Checked In` card, today ≠ week, since `stats-today.json` and `stats.json` differ. Not asserted on `Active Devices`, whose three periods all bind to `deviceCount` by design |
| DASH-03 chart | `canvas` present inside the Check-ins card |
| DASH-03 range | click `[data-cy=chart-range-31]` → gains `btn-primary`, canvas still present. **Deliberately shallow** — see Known limitations |
| DASH-04 builds | `[data-cy=recent-builds]` rows match the fixture; every row carries a `[data-cy=build-download]` button, which is what the TODO asks for. `normalizeBuildItems` falls back `build_id → item._id`, so a row without a download button is not reachable from a realistic payload — asserting "only some rows have one" would be asserting a fiction |
| DASH-05 audit | `[data-cy=recent-audit]` rows match fixture messages |

### `profile.spec.js` (7)

| ID | Assertion |
|:--|:--|
| PROF-01 load | `.page-title` contains `My Profile` |
| PROF-01 save | fields hydrate from fixture; edit → `save-profile` → `@updateProfile` body carries `info.first_name`/`last_name`/`mobile_phone`/`timezone_abbr`; success alert `Profile updated.` |
| PROF-02 avatar | Avatar tab → `avatar-file` present → `cy.selectFile('cypress/fixtures/api/avatar.png')` → Save Avatar → `@uploadAvatar` body has an `avatar` key; `avatar-preview` `src` starts `data:image/png;base64,` |
| PROF-03 notif | check All → `save-notifications` → `@updateProfile` body sets `notifications.all` **and still carries `info.first_name`** (the data-loss regression this test exists for); success alert |
| PROF-04 admin tab | default fixture (`admin:false`) → `profile-tab-admin` absent; with `profile-admin.json` → present |
| PROF-05 delete | Account tab → `delete-account` → modal; **cancel → still on `#/app/profile` and `@deleteAccount` never fired**; confirm → `@deleteAccount` fires → hash `#/login` |
| PROF-06 nav | `[data-cy=settings-dropdown]` → `[data-cy=nav-my-account]` → hash `#/app/profile` |

### `history.spec.js` (5)

| ID | Assertion |
|:--|:--|
| HIST-01 | both tab titles `Audit Log` and `Build Log` render; no uncaught exception |
| HIST-02 | click Build Log → hash `#/app/history/builds`; click Audit Log → `#/app/history/audit` |
| HIST-03 | long-log row's `[data-cy=build-log-pre]` style contains `max-height:120px`; click `build-expand` → style no longer contains `max-height`; rendered text grows |
| HIST-04 | set `date-from`/`date-to` → `[data-cy=audit-row]` count drops to the in-range subset; same on the builds tab |
| HIST-05 | uncheck `Danger` in `flag-filter` → no row carries a `danger` badge; count drops by exactly 1 |

### `auth-extras.spec.js` (4)

| ID | Assertion |
|:--|:--|
| AUTH-01 | visit `/#/password-reset` with no session → widget title `Password Reset` visible; hash still `#/password-reset` (no bounce to `/login`) |
| AUTH-02 initiate | `#reset-email` visible; `#reset-password` does not exist |
| AUTH-02 confirm | `?reset_key=abc&owner=test` → `#reset-password` and `#reset-rpassword` visible; `#reset-email` does not exist |
| AUTH-03 expiry | `cy.seedSession({ expiresInSeconds: 1 })` → visit `/#/app/dashboard` → `cy.hash({ timeout: 6000 }).should('eq', '#/login')`. Exercises the real `auth/scheduleExpiry` `setTimeout` path without exposing the Vuex store on `window` |

## Things worth stating explicitly

**"No console errors" needs an explicit stub.** Several TODOs (DASH-01, HIST-01,
PROF-01, AUTH-01) ask for "no console errors". Cypress already fails a test on an
*uncaught exception*, so asserting that adds nothing. A logged `console.error` is
a different thing and is invisible to Cypress by default. These tests therefore
stub `console.error` via `cy.visit(url, { onBeforeLoad(win) { cy.stub(win.console, 'error').as('consoleError') } })`
and assert `@consoleError` was not called. Without that, the assertion is
decorative.

**`msgBoxConfirm` is safe to drive.** DEVI-05 and PROF-05 use BootstrapVue's
`$bvModal.msgBoxConfirm`, which renders a real `.modal` into the DOM — not a
native `window.confirm`. There is no dialog-blocking hazard, and the confirm
button is an ordinary `.modal-footer .btn-danger`.

**PROF-05 never deletes anything.** `DELETE /user` is stubbed. The test proves
cancel does not navigate and does not fire the request, then that confirm fires
it and lands on `#/login`.

**Prerequisite: `yarn install` in `vue/`.** The checked-out `node_modules`
predates `package.json` and is missing `codemirror` / `vue-codemirror`. That —
not test design — is what the committed failure screenshots under
`cypress/screenshots/auth-extras.spec.js/` actually show
(`Module not found: Can't resolve 'vue-codemirror'`). Nothing can be validated
locally until the install is refreshed.

## Known limitations

**DASH-03's second test is shallow, by decision.** Chart.js paints to a
`<canvas>`; there is no DOM signal that the dataset changed when the range
toggles. The test asserts the 31-day button becomes active and the canvas
survives. It will not catch a broken `dateAxis` computation. This is recorded in
a code comment in the spec rather than dressed up as verifying a re-render.
Making it real would mean reaching into the Chart.js instance or snapshotting
canvas pixels — both disproportionate here.

**Fixture drift is the standing risk.** Stubs can go green against a backend
shape that no longer exists. The live lane (`login.spec.js`, `admin.spec.js`)
mitigates this but only partially — it covers login and the admin user list, not
the device, stats or log payloads. Recording fixtures from the live API rather
than inventing them limits the initial gap; it does not prevent later drift. An
explicit note goes in the README so this is a known trade, not a surprise.

## Rollout

Wave 0 is blocking; the rest are independent once it lands.

| Wave | Work |
|:--|:--|
| 0 | `session.js`, `api-stubs.js`, `fixtures/api/*`, `support/index.ts` wiring |
| 1 | `auth-extras.spec.js` (4) — smallest and mostly session-free; proves the support layer |
| 2 | `data-cy` attributes in `src/`, then `devices.spec.js` (10) + `device-detail.spec.js` (7) |
| 3 | `dashboard.spec.js` (8) |
| 4 | `history.spec.js` (5) |
| 5 | `profile.spec.js` (7) |
| 6 | README: CI variable table now gates only the live lane; note the stub/live split and the drift trade |

## Verification

Per wave: `yarn cy:test --spec cypress/integration/<spec>.js` green, and
`yarn eslint` clean. At the end, a full `yarn test` run (`start-server-and-test`)
with **no** `CYPRESS_*` variables set — the six specs must all run and pass,
proving the credential dependency is gone. A second full run with credentials set
confirms the live lane still passes alongside them.

## Out of scope

- `login.spec.js` — its 4 skipped tests and 8 loose TODO notes.
- `admin.spec.js` — its 2 `this.skip()`ed destructive tests (ADMIN-02/03).
- Migrating off Cypress 9, or to the `e2e/` layout.
- Any behaviour change to the app beyond adding `data-cy` attributes.

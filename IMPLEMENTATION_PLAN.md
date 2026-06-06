# Vue Console Implementation Plan

Generated: 2026-03-14
Legacy console: `src/` (deployed at rtm.thinx.cloud)
Vue console: `vue/` (deployed at staging.thinx.cloud)

Note: Task grooming and the PR-ready task template live at `dev/TASK_GROOMING.md`. Use that standard before assigning or implementing entries in this plan, especially when a phase item spans more than one focused PR.

---

## Feature Map: Legacy vs Vue

### A. In Legacy Only — Missing from Vue

| Feature | Legacy Location | Priority |
|---------|----------------|----------|
| Device detail page (`/device/:udid`) | `controllers/DeviceController.js`, `views/device.html` | HIGH |
| User profile / account settings | `controllers/UserProfileController.js`, `views/profile/` | HIGH |
| Password reset page | `src/password.html` | MEDIUM |
| Build log viewer (modal overlay) | `controllers/LogviewController.js` | MEDIUM |
| Device category filtering (color-coded) | `views/devices.html` | MEDIUM |
| Device grid/list view toggle | `views/devices.html` | LOW |
| Device sort/order options | `DevicesController.js` | LOW |
| Device transfer (with API key/source migration) | `DevicesController.js` | HIGH |
| Device revoke (single + bulk) | `DevicesController.js` | HIGH |
| Device config push (with env var selection) | `DevicesController.js` | HIGH |
| Build firmware from device/devices page | `DevicesController.js` | HIGH |
| Dashboard goals/journey tracking | `views/profile/account.html` | LOW |
| Header: build history dropdown | `tpl/header.html` | MEDIUM |
| GDPR consent page | `src/auth.html` | LOW |

### B. In Vue Only — Scaffolding/Demo Pages (not in Legacy)

These pages were scaffolded from a UI template and have no equivalent in the legacy console. They should be **removed** (a TODO comment already exists in `Routes.js:97`).

| Page | Path | Action |
|------|------|--------|
| Charts | `/app/components/charts` | Remove |
| Tables | `/app/tables` | Remove |
| Icons | `/app/components/icons` | Remove |
| Maps | `/app/components/maps` | Remove |
| Notifications demo | `/app/notifications` | Remove |
| Typography | `/app/typography` | Remove |
| AnotherPage | — | Remove |

### C. Vue Pages That Exist but Are Read-Only Stubs

All 9 management pages follow an identical pattern with empty `create()` and `deleteSelected()` TODOs. No store module has POST/PUT/DELETE mutations. This is the core gap.

| Page | Read | Create | Edit | Delete | Bulk Delete | Special |
|------|------|--------|------|--------|-------------|---------|
| Devices | ✅ | ❌ | ❌ | ❌ | ❌ | Missing: revoke, transfer, config push, build, detail nav |
| API Keys | ✅ | ❌ | — | ❌ | ❌ | |
| Repositories | ✅ | ❌ | — | ❌ | ❌ | Missing: device associations display |
| RSA Keys | ✅ | ❌ | — | ❌ | ❌ | Generate keypair on create |
| Transformers | ✅ | ❌ | ❌ | ❌ | — | Needs CodeMirror editor |
| Enviros | ✅ | ❌ | — | ❌ | ❌ | |
| Channels | ✅ | ❌ | — | ❌ | ❌ | |
| History | ✅ | — | — | — | — | Missing: tab split (build/audit), log viewer |
| Dashboard | ❌ | — | — | — | — | Fully hardcoded, stats.js getter bug |

### D. Vue-Specific Architecture Improvements (spikes to complete)

These are patterns started in Vue that improve on the legacy AngularJS approach and should be finished:

| Spike | Status | What's needed |
|-------|--------|---------------|
| Vuex store modules | ✅ read actions exist | Add mutations + actions for POST/PUT/DELETE on all modules |
| Generic `List` component | ✅ works for display | Add inline row actions (edit button, delete button per row) |
| Generic `Form` component | ✅ exists | Wire to create/edit modals in each page |
| Route-based navigation | ✅ structure in place | Add `/app/device/:udid` and `/app/profile` routes |

---

## Known Bugs to Fix First

1. **`stats.js:23`** — getter returns `!state.accessToken` (boolean) instead of `state.stats`. Dashboard will never render real data until fixed.
2. **`Devices.vue:155`** — accesses undefined `date` field in timeline data mapping.
3. **`Devices.vue:166-225`** — chart update functions reference undefined `$rootScope` variables (AngularJS pattern copied into Vue). Will throw at runtime.

---

## Implementation Phases

### Phase 1 — Bug Fixes & Cleanup (no new features)

**1.1 Fix stats.js getter**
- Problem statement: `vue/src/store/stats.js:23` returns `!state.accessToken`, so dashboard consumers receive a boolean instead of the fetched stats object.
- User impact: Dashboard metrics cannot render from real stats data until the getter returns `state.stats`.
- Scope: Update only the stats store getter and focused coverage for that getter.
- Non-goals: Dashboard redesign, new stats endpoints, or additional metrics.
- Acceptance criteria:
  - The stats getter returns `state.stats`.
  - A focused unit test or store-level assertion covers the getter behavior.
  - Existing dashboard code can consume the getter without a boolean payload.
- Verification:
  - Run the focused Vue unit test for the stats store, or add and run one if none exists.
  - Smoke check the dashboard after `fetchStats` and confirm the returned value is an object/array payload, not `true` or `false`.
- Dependencies: Existing `/../user/stats` response shape.
- Estimate: XS, 1-2 hours.
- Owner: @maintainer.
- Assumptions: No API change is required.
- Links: `vue/src/store/stats.js`.

**1.2 Remove demo/template routes and pages**
- Problem statement: `vue/src/Routes.js` still registers scaffolded template routes that do not correspond to THiNX console behavior.
- User impact: Users and contributors see dead-end demo pages while evaluating the Vue console.
- Scope: Remove imports, route entries, and corresponding page directories for Typography, Tables, Notifications, Icons, Maps, Charts, and AnotherPage.
- Non-goals: Navigation redesign, replacement feature pages, or layout changes.
- Acceptance criteria:
  - `vue/src/Routes.js` no longer imports or registers the demo pages.
  - The corresponding demo page directories under `vue/src/pages/` are removed.
  - No active references to the removed demo components remain.
  - The Vue build resolves all routes and modules successfully.
- Verification:
  - Run `rg` for the removed component names and routes.
  - Run the Vue build.
  - Manually confirm removed demo routes are not reachable from navigation.
- Dependencies: None.
- Estimate: XS, 1-2 hours.
- Owner: @cleanup.
- Assumptions: Scaffolded demo pages contain no production customization.
- Links: `vue/src/Routes.js`.

**1.3 Fix Devices.vue broken chart references**
- Problem statement: `vue/src/pages/Devices/Devices.vue` contains copied AngularJS `$rootScope` references and timeline mapping that accesses an undefined `date` field.
- User impact: The Devices page can throw runtime errors while rendering timeline and chart data.
- Scope: Replace the broken chart/timeline references with Vue-compatible local state or remove the dead chart update path if it is unused.
- Non-goals: New chart designs, device action features, or backend data changes.
- Acceptance criteria:
  - `updateTimeline()` does not read undefined `date` values.
  - `updateTimeline()` and `updateCharts()` no longer reference `$rootScope`.
  - The Devices page renders without console errors from these chart update methods.
  - Existing device list behavior is unchanged.
- Verification:
  - Run the focused Vue unit test or component smoke test for Devices if available.
  - Run the Vue build.
  - Manually load the Devices page and confirm no `$rootScope` or undefined-date errors appear in the console.
- Dependencies: Existing device list data shape.
- Estimate: S, 2-4 hours.
- Owner: @frontend-team.
- Assumptions: This is a stabilization task, not a chart feature rebuild.
- Links: `vue/src/pages/Devices/Devices.vue`.

---

### Phase 2 — CRUD for Simple Management Pages

All pages share the same pattern. Implement in parallel since the pattern is identical.

**Pattern per page:**
1. Add `create`, `update`, `remove` actions + mutations to the store module
2. Add a create modal (using `b-modal` + `Form` component) triggered by the existing "Add" button
3. Add per-row delete (with `b-modal` confirm) triggered by the existing "Delete selected" button
4. Wire selection from `List` component into `deleteSelected()`

**2.1 API Keys** (`vue/src/pages/Apikeys/`, `vue/src/store/apikeys.js`)
- Create: POST `/apikey` with `{ alias }` — returns generated key
- Display generated key in a one-time modal after creation
- Delete: DELETE `/apikey` with `{ key_hash }`
- Bulk delete: iterate selected hashes

**2.2 Repositories** (`vue/src/pages/Repositories/`, `vue/src/store/repositories.js`)
- Create form fields: git URL, alias (auto-generated from URL), branch, platform, CircleCI token, git secret
- Auto-alias: derive from last path component of git URL (port from `SourceController.js:60-75`)
- Duplicate alias detection before submit
- Create: POST `/source`
- Delete: DELETE `/source` with `{ id }`
- Display associated devices count per repository row

**2.3 RSA Keys** (`vue/src/pages/Rsakeys/`, `vue/src/store/rsakeys.js`)
- Create: POST `/rsakey` — server generates the keypair
- After create, display private key in a one-time modal (copy-to-clipboard)
- Delete: DELETE `/rsakey` with `{ id }`

**2.4 Environment Globals** (`vue/src/pages/Enviros/`, `vue/src/store/enviros.js`)
- Create form fields: key, value
- Create: POST `/enviro`
- Delete: DELETE `/enviro` with `{ id }`

**2.5 Mesh Channels** (`vue/src/pages/Channels/`, `vue/src/store/channels.js`)
- Create form fields: channel name, configuration options
- Create: POST `/channel`
- Delete: DELETE `/channel` with `{ id }`

---

### Phase 3 — Transformers with Code Editor

More complex than Phase 2 due to the CodeMirror integration.

**3.1 Transformer list page** (`vue/src/pages/Transformers/`, `vue/src/store/transformers.js`)
- Decouple store from `/profile` endpoint — use dedicated transformer endpoints
- Create: POST with `{ alias, body (base64) }`; auto-generate `utid` (SHA256 of alias+timestamp)
- Delete: DELETE with `{ utid }`

**3.2 Transformer editor**
- Add new route: `/app/transformer/:utid`
- Create `vue/src/pages/Transformers/TransformerEditor.vue`
- Integrate CodeMirror (or Monaco) for JavaScript editing with syntax highlighting
- Base64 encode body on save, decode on load
- Unsaved-changes detection (prompt before leaving)
- Port logic from `src/app/js/controllers/EditorController.js`

---

### Phase 4 — Device Management (largest phase)

**4.1 Device list enhancements** (`vue/src/pages/Devices/Devices.vue`)
- Add category filter (color/icon-based, port from `views/devices.html`)
- Add sort options: last update, platform, alias
- Add search/filter input
- Add grid vs list view toggle

**4.2 Device actions**
- **Revoke**: DELETE `/device` with `{ udid }` — single and bulk
  - Confirm modal before revoking
- **Transfer**: POST `/transfer` — requires target owner API key
  - Modal with: target owner field, option to migrate source & API key
- **Push config**: POST `/device/push` with selected environment variables
  - Modal with env var multi-select (fetched from enviros store)
- **Build firmware**: POST `/build` with `{ udid }`

**4.3 Device detail page**
- Add route: `/app/device/:udid`
- Create `vue/src/pages/Devices/DeviceDetail.vue`
- Sections to port from `views/device.html`:
  - Device metadata (platform, firmware version, last seen, IP, UDID)
  - Assigned source/repository
  - Build & deployment history for this device
  - Device-specific environment variables
  - Status transformer assignment
  - Device logs viewer
  - Revoke / transfer actions (reuse components from 4.2)

---

### Phase 5 — Real Dashboard

**5.1 Replace Visits.vue** with functional dashboard
- Fetch from `GET /stats` (via `stats/fetchStats` action — already exists, just broken getter)
- Display 6 sparkline-style metric cards:
  - Devices checked in (today / week / month)
  - New devices registered
  - Active devices
  - Errors
  - Updates deployed
  - Build successes
- Timeline chart:
  - Date range selector: 7 / 31 / 365 days
  - Line chart of daily device check-ins
  - Port axis/range logic from `DashboardController.js:55-120`
- Recent builds widget (last 10, with download link)
- Recent audit events widget

**5.2 Fix stats store**
- Fix getter bug (Phase 1.1)
- Add `fetchDashboard` action that fetches stats + audit log + build log in parallel

---

### Phase 6 — User Profile / Account Settings

No profile page exists in Vue at all. Full build required.

**6.1 Add routes**
```
/app/profile          → Profile layout
/app/profile/account  → Settings tabs
/app/profile/delete   → Account deletion
```

**6.2 Create store module** `vue/src/store/profile.js` (already exists, needs mutations)
- `updateProfile`: PUT `/profile` with personal info
- `uploadAvatar`: POST `/profile/avatar`
- `deleteAccount`: DELETE `/user`

**6.3 Create Profile pages**, porting from `views/profile/`:
- **Account.vue**: tabs for Profile, Avatar, Preferences, Notifications
  - Profile tab: first name, last name, email, phone, timezone
  - Avatar tab: upload/preview
  - Preferences tab: notification settings, goals tracking
  - Admin tab: visible only if user is admin
- **Delete.vue**: account deletion with confirmation

**6.4 Wire to sidebar**
- Add "My Profile" link to sidebar Settings submenu and/or header user dropdown

---

### Phase 7 — History Improvements

**7.1 Tab separation**
- Split `History.vue` into two tabs: "Build Log" and "Audit Log"
- Tab state persisted in route: `/app/history/builds` and `/app/history/audit`
- Port tab-switching from `HistoryController.js` + `views/history.html`

**7.2 Build log viewer**
- Clicking a build row opens a modal with full log text
- Port from `LogviewController.js` + `controllers/EditorController.js`
- Use `<pre>` with scrollable container and monospace font

**7.3 Search/filter**
- Add date range filter to both tabs
- Add text search (warning/danger flags filter for audit log)

---

### Phase 8 — Authentication Extras

**8.1 Password reset page**
- Create standalone `vue/src/pages/PasswordReset/PasswordReset.vue`
- Add route `/password-reset`
- Port from `src/password.html`

**8.2 GDPR consent** (optional, lower priority)
- Port from `src/auth.html` if required by deployment

---

## Priority Order Summary

| Phase | Description | Effort | Priority |
|-------|-------------|--------|----------|
| 1 | Bug fixes & scaffolding cleanup | XS | NOW |
| 2 | CRUD for simple pages (API keys, repos, rsakeys, enviros, channels) | M each | HIGH |
| 3 | Transformers + code editor | L | HIGH |
| 4 | Device actions + detail page | XL | HIGH |
| 5 | Real dashboard | L | HIGH |
| 6 | User profile / account settings | L | MEDIUM |
| 7 | History improvements | M | MEDIUM |
| 8 | Auth extras (password reset, GDPR) | S | LOW |

---

## API Endpoints Reference

All endpoints used by legacy console (from `thinx-api.js`), mapped to Vue store modules:

| Endpoint | Method | Store Module | Status in Vue |
|----------|--------|-------------|---------------|
| `/login` | POST | auth | ✅ implemented |
| `/logout` | GET | auth | ✅ implemented |
| `/device` | GET | devices | ✅ read |
| `/device` | DELETE | devices | ❌ missing |
| `/transfer` | POST | devices | ❌ missing |
| `/device/push` | POST | devices | ❌ missing |
| `/build` | POST | devices | ❌ missing |
| `/apikey` | GET | apikeys | ✅ read |
| `/apikey` | POST | apikeys | ❌ missing |
| `/apikey` | DELETE | apikeys | ❌ missing |
| `/source` | GET | repositories | ✅ read |
| `/source` | POST | repositories | ❌ missing |
| `/source` | DELETE | repositories | ❌ missing |
| `/rsakey` | GET | rsakeys | ✅ read |
| `/rsakey` | POST | rsakeys | ❌ missing |
| `/rsakey` | DELETE | rsakeys | ❌ missing |
| `/enviro` | GET | enviros | ✅ read |
| `/enviro` | POST | enviros | ❌ missing |
| `/enviro` | DELETE | enviros | ❌ missing |
| `/channel` | GET | channels | ✅ read |
| `/channel` | POST | channels | ❌ missing |
| `/channel` | DELETE | channels | ❌ missing |
| `/profile` | GET | profile/transformers | ✅ read |
| `/profile` | PUT | profile | ❌ missing |
| `/transformer` | POST | transformers | ❌ missing |
| `/transformer` | DELETE | transformers | ❌ missing |
| `/logs/audit` | GET | auditlog | ✅ read |
| `/logs/build` | GET | buildlog | ✅ read |
| `/../user/stats` | GET | stats | ✅ fetch (getter broken) |

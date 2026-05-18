# Requirements: THiNX Console — Vue Migration

**Defined:** 2026-05-18
**Core Value:** Device owners can fully manage their IoT fleet through the Vue console without ever needing the legacy AngularJS UI.

## v1 Requirements

### Cleanup

- [ ] **CLEAN-01**: `stats.js` getter returns `state.stats` instead of `!state.accessToken`
- [ ] **CLEAN-02**: Demo/template routes removed (Charts, Tables, Icons, Maps, Notifications, Typography, AnotherPage)
- [ ] **CLEAN-03**: Corresponding demo page directories deleted from `vue/src/pages/`
- [ ] **CLEAN-04**: `Devices.vue` AngularJS `$rootScope` references removed from `updateTimeline()` and `updateCharts()`

### API Keys

- [ ] **AKEY-01**: User can create an API key with an alias
- [ ] **AKEY-02**: Generated key is displayed once in a modal after creation (copy-to-clipboard)
- [ ] **AKEY-03**: User can delete a single API key
- [ ] **AKEY-04**: User can bulk-delete selected API keys

### Repositories

- [ ] **REPO-01**: User can add a repository with git URL, alias, branch, platform, CircleCI token, git secret
- [ ] **REPO-02**: Alias is auto-generated from the git URL's last path component
- [ ] **REPO-03**: Duplicate alias is detected and rejected before submit
- [ ] **REPO-04**: User can delete a repository
- [ ] **REPO-05**: Repository list shows associated device count per row

### RSA Keys

- [ ] **RKEY-01**: User can generate an RSA keypair (server-side)
- [ ] **RKEY-02**: Private key is displayed once in a modal after generation (copy-to-clipboard)
- [ ] **RKEY-03**: User can delete an RSA key

### Environment Globals

- [ ] **ENVI-01**: User can create an environment variable (key + value)
- [ ] **ENVI-02**: User can delete an environment variable

### Mesh Channels

- [ ] **CHAN-01**: User can create a mesh channel with name and configuration options
- [ ] **CHAN-02**: User can delete a mesh channel

### Transformers

- [ ] **TRAN-01**: Transformer list uses dedicated transformer endpoints (not `/profile`)
- [ ] **TRAN-02**: User can create a transformer with alias and JavaScript body
- [ ] **TRAN-03**: User can delete a transformer
- [ ] **TRAN-04**: User can navigate to a transformer editor at `/app/transformer/:utid`
- [ ] **TRAN-05**: Transformer editor has JavaScript syntax highlighting (CodeMirror or Monaco)
- [ ] **TRAN-06**: Transformer body is base64-encoded on save and decoded on load
- [ ] **TRAN-07**: Editor warns before navigating away with unsaved changes

### Device Management

- [ ] **DEVI-01**: User can filter devices by category (color/icon-coded)
- [ ] **DEVI-02**: User can sort devices by last update, platform, or alias
- [ ] **DEVI-03**: User can search/filter the device list
- [ ] **DEVI-04**: User can toggle between grid and list view
- [ ] **DEVI-05**: User can revoke a single device (with confirmation)
- [ ] **DEVI-06**: User can bulk-revoke selected devices
- [ ] **DEVI-07**: User can transfer a device to another owner (requires target API key; optionally migrates source and API key)
- [ ] **DEVI-08**: User can push config to a device (select environment variables to push)
- [ ] **DEVI-09**: User can trigger a firmware build for a device
- [ ] **DEVI-10**: User can navigate to a device detail page at `/app/device/:udid`
- [ ] **DEVI-11**: Device detail page shows: metadata, assigned repository, build/deploy history, device enviros, transformer assignment, device logs, revoke/transfer actions

### Dashboard

- [ ] **DASH-01**: Dashboard fetches real data from `GET /stats`
- [ ] **DASH-02**: Dashboard displays 6 metric cards: devices checked in, new devices, active devices, errors, updates deployed, build successes (today/week/month breakdowns)
- [ ] **DASH-03**: Timeline chart shows daily device check-ins with 7/31/365-day range selector
- [ ] **DASH-04**: Recent builds widget shows last 10 builds with download link
- [ ] **DASH-05**: Recent audit events widget is displayed

### Profile

- [ ] **PROF-01**: User can view and update profile (first name, last name, email, phone, timezone)
- [ ] **PROF-02**: User can upload and preview an avatar
- [ ] **PROF-03**: User can update notification preferences
- [ ] **PROF-04**: Admin users see an admin tab in profile
- [ ] **PROF-05**: User can initiate account deletion (with confirmation)
- [ ] **PROF-06**: Profile is accessible from sidebar or header user dropdown

### History

- [ ] **HIST-01**: History page has two tabs: Build Log and Audit Log
- [ ] **HIST-02**: Tab state is reflected in the URL (`/app/history/builds`, `/app/history/audit`)
- [ ] **HIST-03**: Clicking a build row opens a modal with full log text
- [ ] **HIST-04**: Both tabs support date range filtering
- [ ] **HIST-05**: Audit log supports text search (warning/danger flag filtering)

### Authentication Extras

- [ ] **AUTH-01**: Password reset page exists at `/password-reset`
- [ ] **AUTH-02**: Password reset flow ports behaviour from `src/password.html`

## v2 Requirements

### GDPR

- **GDPR-01**: GDPR consent page at `/gdpr` porting from `src/auth.html`

### Statistics Infrastructure

- **STAT-01**: Migrate stats to InfluxDB event logging
- **STAT-02**: Embed Chronograf dashboard views in the Vue console

## Out of Scope

| Feature | Reason |
|---------|--------|
| AngularJS console changes | Legacy UI frozen |
| Mobile app | Web-first strategy |
| Real-time device push | Polling acceptable for v1 |
| InfluxDB / Chronograf migration | Separate infrastructure concern |
| GDPR consent page | Low priority, deferred to v2 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLEAN-01 | Phase 1 | Pending |
| CLEAN-02 | Phase 1 | Pending |
| CLEAN-03 | Phase 1 | Pending |
| CLEAN-04 | Phase 1 | Pending |
| AKEY-01 | Phase 2 | Pending |
| AKEY-02 | Phase 2 | Pending |
| AKEY-03 | Phase 2 | Pending |
| AKEY-04 | Phase 2 | Pending |
| REPO-01 | Phase 2 | Pending |
| REPO-02 | Phase 2 | Pending |
| REPO-03 | Phase 2 | Pending |
| REPO-04 | Phase 2 | Pending |
| REPO-05 | Phase 2 | Pending |
| RKEY-01 | Phase 2 | Pending |
| RKEY-02 | Phase 2 | Pending |
| RKEY-03 | Phase 2 | Pending |
| ENVI-01 | Phase 2 | Pending |
| ENVI-02 | Phase 2 | Pending |
| CHAN-01 | Phase 2 | Pending |
| CHAN-02 | Phase 2 | Pending |
| TRAN-01 | Phase 3 | Pending |
| TRAN-02 | Phase 3 | Pending |
| TRAN-03 | Phase 3 | Pending |
| TRAN-04 | Phase 3 | Pending |
| TRAN-05 | Phase 3 | Pending |
| TRAN-06 | Phase 3 | Pending |
| TRAN-07 | Phase 3 | Pending |
| DEVI-01 | Phase 4 | Pending |
| DEVI-02 | Phase 4 | Pending |
| DEVI-03 | Phase 4 | Pending |
| DEVI-04 | Phase 4 | Pending |
| DEVI-05 | Phase 4 | Pending |
| DEVI-06 | Phase 4 | Pending |
| DEVI-07 | Phase 4 | Pending |
| DEVI-08 | Phase 4 | Pending |
| DEVI-09 | Phase 4 | Pending |
| DEVI-10 | Phase 4 | Pending |
| DEVI-11 | Phase 4 | Pending |
| DASH-01 | Phase 5 | Pending |
| DASH-02 | Phase 5 | Pending |
| DASH-03 | Phase 5 | Pending |
| DASH-04 | Phase 5 | Pending |
| DASH-05 | Phase 5 | Pending |
| PROF-01 | Phase 6 | Pending |
| PROF-02 | Phase 6 | Pending |
| PROF-03 | Phase 6 | Pending |
| PROF-04 | Phase 6 | Pending |
| PROF-05 | Phase 6 | Pending |
| PROF-06 | Phase 6 | Pending |
| HIST-01 | Phase 7 | Pending |
| HIST-02 | Phase 7 | Pending |
| HIST-03 | Phase 7 | Pending |
| HIST-04 | Phase 7 | Pending |
| HIST-05 | Phase 7 | Pending |
| AUTH-01 | Phase 8 | Pending |
| AUTH-02 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 53 total
- Mapped to phases: 53
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-18*
*Last updated: 2026-05-18 after initial definition*

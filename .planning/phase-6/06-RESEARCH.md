# Phase 6: User Profile & Account Settings — Research

**Researched:** 2026-05-23
**Domain:** Vue 2 / Vuex profile management, backend `/api/v2/profile` and `/api/v2/user` endpoints
**Confidence:** HIGH — all findings sourced directly from codebase inspection

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROF-01 | User can view and update profile (first name, last name, email, phone, timezone) | `Profile.vue` has form fields for first_name, last_name, mobile_phone, timezone; store `updateProfile` action exists; backend `POST /api/v2/profile` with `{ info }` body handles it |
| PROF-02 | User can upload and preview an avatar | Avatar upload goes via `POST /api/v2/profile` with `{ avatar: "<base64-string>" }` body — NOT a separate endpoint; backend writes to `<data_root>/<owner>/avatar.json`; no multipart required |
| PROF-03 | User can update notification preferences | Notifications object lives inside `profile.info.notifications`; sent as `{ info: { notifications: { all, important, info } } }` via `POST /api/v2/profile` |
| PROF-04 | Admin users see an admin tab in profile | `profile.admin` boolean is returned by `GET /api/v2/profile` (`owner.js:319`); already in store state |
| PROF-05 | User can initiate account deletion (with confirmation) | `DELETE /api/v2/user` with body `{ owner: "<owner_id>" }`; backend validates `req.body.owner === req.session.owner` before deleting |
| PROF-06 | Profile is accessible from sidebar or header user dropdown | Sidebar already has "My Profile" link at `/app/profile` (`Sidebar.vue:57`); header dropdown has a static "My Account" item that needs to be wired to router |
| G1 | Fix `Notifications.vue` mapGetters spread in `computed:` | `Notifications.vue:57` — `...mapGetters({ getBuildLog: 'buildlog/getItems' })` is in `computed:`; must move to `methods:` so `this.getBuildLog()` works as a function call per project convention |
</phase_requirements>

---

## Summary

Phase 6 is substantially further along than the IMPLEMENTATION_PLAN (`IMPLEMENTATION_PLAN.md:219`) implied ("No profile page exists in Vue at all. Full build required."). A working `Profile.vue` page already exists at `vue/src/pages/Profile/Profile.vue` with three tabs (Profile, Notifications, Account), a confirmation modal for account deletion, and correct use of the project's `mapGetters`-in-`methods` convention. The store module `vue/src/store/profile.js` has `fetchProfile`, `updateProfile`, and `deleteAccount` actions wired to the correct backend endpoints. The route `/app/profile` is registered in `Routes.js:104`.

What is **missing** relative to PROF-01–06: avatar upload (PROF-02) is not implemented in the page or store; the admin tab (PROF-04) is not present; sub-routes `/app/profile/account` and `/app/profile/delete` are not registered; and the header "My Account" dropdown item is not linked to the route (PROF-06 partially done — sidebar has the link, header does not). The G1 bug in `Notifications.vue` is confirmed at line 57 and needs a one-line fix.

The backend API surface is fully confirmed: avatar upload goes to the same `POST /api/v2/profile` endpoint with `{ avatar: "<base64-string>" }` (not multipart/form-data), deletion goes to `DELETE /api/v2/user` with `{ owner }` in the request body, and notification preferences flow through the `info` sub-object of the same profile POST.

**Primary recommendation:** Extend the existing `Profile.vue` and `profile.js` — do not replace them. Add avatar tab, admin tab, and wire the header dropdown link. Register sub-routes. Fix G1 as Wave 0.

---

## 1. Current State

### 1.1 Existing Profile Store

**File:** `vue/src/store/profile.js`

State shape (documented inline as example, lines 6–77):
```javascript
{
  success: true,
  profile: {
    first_name, last_name, username, owner, avatar,
    info: {
      first_name, last_name, mobile_phone, goals,
      security: { important_notifications },
      tags, transformers,
      notifications: { all, important, info },
      email, username, owner
    },
    admin: true
  }
}
```

Actions already present (`profile.js:85–99`):
- `fetchProfile` — `GET /profile` via `this.$api.$get('/profile')`
- `updateProfile(info)` — `POST /profile` with body `JSON.stringify({ info })`
- `deleteAccount()` — `DELETE /user` with body `JSON.stringify({})`

**Missing actions in store:**
- `uploadAvatar(base64String)` — must POST `{ avatar: base64String }` to `/profile`
- (No `uploadAvatar` action exists anywhere in `profile.js`)

Getters: `getProfile(state)` returns `state.profile` (`profile.js:102`).

### 1.2 Existing Profile Page

**File:** `vue/src/pages/Profile/Profile.vue`

Tabs present:
1. **Profile tab** — form fields: first_name, last_name, mobile_phone, timezone (`Profile.vue:16–34`)
2. **Notifications tab** — checkboxes: all, important, info (`Profile.vue:37–48`)
3. **Account tab** — read-only card (username, email, owner), Delete Account button with `$bvModal.msgBoxConfirm` (`Profile.vue:51–64`)

`mapGetters`/`mapActions` placement: CORRECT — both are already spread into `methods:` (`Profile.vue:101–102`), matching project convention.

**Missing from Profile.vue:**
- Avatar upload tab (PROF-02)
- Admin tab (PROF-04) — no `v-if="profile && profile.admin"` tab present
- Email is displayed read-only in Account tab but is NOT in the editable Profile form (the `info` object embeds email but the form only exposes first_name, last_name, mobile_phone, timezone)

### 1.3 Existing Routes

**File:** `vue/src/Routes.js`

Route registered (`Routes.js:104–107`):
```javascript
{
  path: 'profile',
  name: 'Profile',
  component: ProfilePage,
}
```

`ProfilePage` is imported as `@/pages/Profile/Profile` (`Routes.js:21`).

**Missing routes:**
- `profile/account` — not registered
- `profile/delete` — not registered

Per ROADMAP deliverables, these are expected. However, given the existing `Profile.vue` already consolidates all tabs in one page, the planner should decide whether these sub-routes are truly needed or whether a single `/app/profile` with in-page tabs is sufficient. (See Open Questions.)

### 1.4 Sidebar / Header — PROF-06

**Sidebar** (`vue/src/components/Sidebar/Sidebar.vue:57`):
```javascript
{ header: 'My Profile', link: '/app/profile' },
```
Already present under the "Settings" collapsed nav section. No action needed here.

**Header** (`vue/src/components/Header/Header.vue:53`):
```html
<b-dropdown-item><i class="la la-user" /> My Account</b-dropdown-item>
```
This is a static `<b-dropdown-item>` with no `to` attribute and no `@click` handler — it does nothing (`Header.vue:53`). It needs `to="/app/profile"` (or `href="#/app/profile"`) to satisfy PROF-06.

### 1.5 G1 — Notifications.vue Bug

**File:** `vue/src/components/Notifications/Notifications.vue`

**Current state (broken):**
```javascript
// Notifications.vue:56-57
computed: {
  ...mapGetters({ getBuildLog: 'buildlog/getItems' }),  // line 57 — WRONG placement
  recentBuilds() { ... }
},
...
methods: {
  ...mapActions({ fetchBuildLog: 'buildlog/fetchBuildLog' }),
  async loadNotifications() {
    ...
    this.buildItems = this.getBuildLog() || [];  // line 75 — called as function, breaks
  }
}
```

`mapGetters` in `computed:` makes `getBuildLog` a reactive computed property (not a function). Calling `this.getBuildLog()` throws `TypeError: getBuildLog is not a function`.

**Fix:** Move `...mapGetters({ getBuildLog: 'buildlog/getItems' })` from `computed:` into `methods:`. The `recentBuilds` computed property that also uses `this.buildItems` (a data property) is unaffected.

---

## 2. Gap Analysis

| Req | What Exists | What's Missing |
|-----|-------------|----------------|
| PROF-01 | Form with first_name, last_name, mobile_phone, timezone (`Profile.vue:16–34`); `updateProfile` action (`profile.js:92`) | Email field not editable (in Account tab read-only only); confirm whether email should be editable |
| PROF-02 | Nothing — no avatar upload UI, no `uploadAvatar` store action | Avatar tab in `Profile.vue`; `uploadAvatar` action in `profile.js`; base64 FileReader in template |
| PROF-03 | Notifications tab with 3 checkboxes (`Profile.vue:37–48`); saves via `updateProfile({ notifications })` | Nothing missing — but note: the backend `info` whitelist only accepts `info` key, so notifications must be sent nested inside `info` (see §3 below) |
| PROF-04 | `profile.admin` boolean already returned in API response (`owner.js:319`) | Admin tab in `Profile.vue` gated by `v-if="profile && profile.admin"` |
| PROF-05 | `confirmDeleteAccount` method with `$bvModal.msgBoxConfirm` and redirect to `/login` (`Profile.vue:145–157`); `deleteAccount` action (`profile.js:97`) | The `deleteAccount` store action sends `{}` but backend requires `{ owner }` in body — **critical mismatch** (see §3.5) |
| PROF-06 | Sidebar link `/app/profile` exists (`Sidebar.vue:57`) | Header "My Account" dropdown item has no route link (`Header.vue:53`) |
| G1 | Bug confirmed at `Notifications.vue:57` | Move `mapGetters` from `computed:` to `methods:` |

---

## 3. Backend API Surface

All endpoints confirmed by direct inspection of backend source files.

### 3.1 Profile Read

```
GET /api/v2/profile
```
**Auth:** Session cookie (`req.session.owner`) — `router.profile.js:12` uses `Util.validateSession(req)`.
The `$api` client sends `credentials: 'include'` by default (`api.js:18`) so session auth works.

**Response shape** (from `owner.js:312–321`):
```json
{
  "success": true,
  "response": {
    "first_name": "...",
    "last_name": "...",
    "username": "...",
    "owner": "<hash>",
    "avatar": "<base64-string or empty string>",
    "info": {
      "first_name": "...",
      "last_name": "...",
      "mobile_phone": "...",
      "security": { "important_notifications": false },
      "goals": [],
      "notifications": { "all": false, "important": false, "info": false },
      "email": "...",
      "transformers": [...]
    },
    "admin": false
  }
}
```

Note: `api.js` `parseResult` strips the outer `response` key, so in the Vue store the result arrives as `result.response` (the inner profile object). The store commits `result.response` as `state.profile` (`profile.js:88`).

**Source:** `lib/router.profile.js:49`, `lib/thinx/owner.js:296–322`

### 3.2 Profile Update (Personal Info + Notifications)

```
POST /api/v2/profile
Content-Type: application/json
Body: { "info": { "first_name": "...", "last_name": "...", "mobile_phone": "...", "notifications": { ... } } }
```

The backend's `process_update` whitelist (`owner.js:338–341`) only routes to `apply_update` when body has an `info` key. **Notifications must be nested inside `info`**, not sent at the top level.

The existing `updateProfile` action (`profile.js:92–95`) already does `POST /profile` with `JSON.stringify({ info })` where `info` is the caller-supplied object. The current `saveNotifications` method in `Profile.vue` calls `this.updateProfile({ notifications: ... })` — this sends `{ info: { notifications: ... } }` which is correct.

**Source:** `lib/router.profile.js:45–47`, `lib/thinx/owner.js:325–417`

**Timezone note:** The `info` object is a free-form object stored verbatim (atomic CouchDB edit). Timezone is not explicitly validated by the backend — it is accepted as part of the `info` blob and stored as-is. The backend uses `moment-timezone` only for device-level timezone (`device.js:26`), not for profile. Sending `timezone` inside `info` will persist it without server-side validation.

### 3.3 Avatar Upload

```
POST /api/v2/profile
Content-Type: application/json
Body: { "avatar": "<base64-encoded-string>" }
```

**NOT multipart/form-data.** The backend `update()` method checks `typeof body.avatar !== 'undefined'` and branches immediately to `saveAvatar()`, which writes the base64 string directly to `<data_root>/<owner>/avatar.json` as a file (`owner.js:402–407`, `owner.js:258–263`).

The `GET /api/v2/profile` response returns `avatar` as the raw contents of that file (empty string if no file exists, `owner.js:249–256`).

**Frontend contract:**
1. User picks file via `<input type="file">`
2. Component reads file with `FileReader.readAsDataURL()` to get a data URI (`data:image/png;base64,...`)
3. Send the full data URI string or just the base64 portion — **NEEDS CLARIFICATION** (see §7)
4. On success, update local `profile.avatar` to show preview

**No dedicated `/api/v2/profile/avatar` endpoint exists.** The `IMPLEMENTATION_PLAN.md:230` mentions `POST /profile/avatar` — this is INCORRECT. Use `POST /api/v2/profile` with `{ avatar }`.

**Source:** `lib/thinx/owner.js:258–263`, `lib/thinx/owner.js:402–407`

### 3.4 Notification Preferences

No separate endpoint. Sent as `POST /api/v2/profile` with:
```json
{ "info": { "notifications": { "all": false, "important": true, "info": false } } }
```

The `info` object is written atomically — partial update replaces the entire `info` field in CouchDB (`owner.js:375–391`). **This means sending only `{ notifications: ... }` inside `info` will overwrite all other `info` fields** (first_name, last_name, email, etc.) with `undefined`.

**Critical implication:** The `saveNotifications` method in `Profile.vue:132–140` currently sends `{ notifications: { ... } }` as the `info` object, which will wipe out first_name, last_name, and other `info` fields from the database. The fix is to merge the full existing `info` object before sending (read `this.profile.info`, spread it, override `notifications`).

**Source:** `lib/thinx/owner.js:338–341`, `lib/thinx/owner.js:375–391`

### 3.5 Account Deletion — Critical Bug

```
DELETE /api/v2/user
Content-Type: application/json
Body: { "owner": "<owner-hash>" }
```

**Backend validation** (`router.user.js:119–121`):
```javascript
let owner = sanitka.owner(req.body.owner);
if ((owner !== null) && (owner == req.session.owner)) {
    user.delete(owner, Util.responder, res);
} else {
    res.status(403).end();
}
```

The backend requires `req.body.owner` to equal `req.session.owner`. **The existing `deleteAccount` action sends `JSON.stringify({})` — empty body** (`profile.js:98`). This will always return 403.

**Fix required in `profile.js:deleteAccount`:**
```javascript
async deleteAccount({ state }) {
  const owner = state.profile && state.profile.owner;
  return await this.$api.$delete('/user', JSON.stringify({ owner }));
},
```

**Source:** `lib/router.user.js:118–122`, `lib/router.user.js:174`

### 3.6 Admin Check

Admin status is returned in the profile response as `profile.admin` (boolean, `owner.js:319`). This is already part of `state.profile` after `fetchProfile`. No separate admin endpoint exists or is needed.

---

## 4. Recommended Implementation Approach

### Wave Structure

Follow the Phase 4/5 pattern: Wave 0 (Cypress stub) → Wave 1 (store + foundation) → Wave 2 (page composition). G1 fix folds into Wave 0 as it is a standalone 1-line change.

### Wave 0 — Cypress Stub + G1 Fix (06-00-PLAN.md)

No production feature changes except G1 bugfix.

**Tasks (parallelisable):**
1. Create `vue/cypress/integration/profile.spec.js` with stubs for PROF-01–06
2. Fix G1: move `mapGetters` from `computed:` to `methods:` in `Notifications.vue:57`

G1 is safe to ship alone — it is a one-line change with no risk of regression on other components.

### Wave 1 — Store Extensions + Critical Bug Fixes (06-01-PLAN.md)

Focus: get the data layer correct before building UI on top of it.

**Tasks (some parallelisable):**

1. **Fix `deleteAccount` in `profile.js`** — pass `{ owner }` in body (PROF-05 backend contract)
2. **Add `uploadAvatar` action in `profile.js`** — POST `{ avatar: base64String }` to `/profile`
3. **Fix `saveNotifications` in `Profile.vue`** — merge full `info` before sending (prevents data loss)
4. **Wire header "My Account" dropdown** — add `to="/app/profile"` to `Header.vue:53` (PROF-06)

These are all pre-conditions for a correct UI. Items 1, 2, 4 are independent and can be developed in parallel.

### Wave 2 — Page Composition (06-02-PLAN.md)

Focus: complete the UI — avatar tab, admin tab, optional sub-routes.

**Tasks:**
1. **Add Avatar tab to `Profile.vue`** — file input, FileReader preview, call `uploadAvatar` (PROF-02)
2. **Add Admin tab to `Profile.vue`** — conditional on `profile && profile.admin` (PROF-04)
3. **Register sub-routes in `Routes.js`** (if planner decides they are needed — see Open Questions)

Avatar tab and Admin tab are independent and can be developed in parallel.

### Parallelisation Map

```
Wave 0: [Cypress stub] || [G1 fix]

Wave 1 (after Wave 0):
  [deleteAccount fix]
  [uploadAvatar action]      -- can be done in parallel
  [saveNotifications merge]
  [Header dropdown wire]     -- independent, parallel

Wave 2 (after Wave 1):
  [Avatar tab UI]
  [Admin tab UI]             -- parallel
  [Sub-routes if needed]
```

---

## 5. Pitfalls to Avoid

### 5.1 `info` Object Partial-Update Data Loss

**What goes wrong:** Sending only a subset of `info` fields (e.g., just `{ notifications: ... }`) to `POST /api/v2/profile` replaces the entire CouchDB `info` field. Fields not included in the payload (first_name, last_name, email, etc.) become `undefined` in the database.

**Why it happens:** `owner.js:375–391` uses CouchDB atomic edit with `changes[update_key] = update_value` where `update_value` is the entire `body.info` object.

**How to avoid:** Before any `updateProfile` call, read `this.profile.info` from the store, spread it, then override only the changed keys:
```javascript
const info = Object.assign({}, this.profile.info, { notifications: this.notifForm });
await this.updateProfile(info);
```

**Warning signs:** After saving notifications, profile name disappears or becomes empty.

### 5.2 `deleteAccount` Always Returns 403

**What goes wrong:** The existing store action sends `{}` as the body. Backend checks `req.body.owner === req.session.owner` and returns 403.

**Why it happens:** `profile.js:98` — `$delete('/user', JSON.stringify({}))`.

**How to avoid:** Fix the action to include `owner` from `state.profile.owner` before Wave 2 ships the Delete Account button.

### 5.3 Avatar Format — Data URI vs Raw Base64

**What goes wrong:** `FileReader.readAsDataURL()` returns `data:image/png;base64,<payload>`. If you send the full data URI string, the backend stores it verbatim, and displaying it in `<img :src="profile.avatar">` will work. But if the backend or legacy AngularJS app expects raw base64 without the prefix, there will be a mismatch.

**How to avoid:** Check the `test_avatar` example in `spec/_envi.json:28` — it shows `"<no-image>"` as a placeholder, not a real example. The profile store comment at `profile.js:69` shows `"test_avatar": "AABJRU5ErkJggg=="` — this is raw base64 without a data URI prefix. **NEEDS CLARIFICATION** (see §7). Safe default: strip the `data:image/...;base64,` prefix before sending.

**Warning signs:** Avatar uploads succeed but image does not render, or renders as broken image.

### 5.4 `mapGetters` Must Stay in `methods:`, Never `computed:`

**Project convention** (`CONVENTIONS.md:94`): `mapGetters` is spread into `methods:`, not `computed:`. Getters are called as functions: `this.getProfile()`. G1 is the active example of what breaks when this convention is violated.

**New code must follow this convention** — any new `mapGetters` usage in Avatar tab or Admin tab logic must use `methods:`.

### 5.5 Raw `fetch` in Avatar Upload Must Not Bypass `$api`

If avatar upload uses the `$api` client (via `this.$api.$post('/profile', ...)`), no extra steps are needed — it already sends `credentials: 'include'` and `Authorization: Bearer <refreshToken>`.

If a developer mistakenly uses raw `fetch` for the avatar upload, they must:
- Include `mixins: [hostnameMixin]` to get `this.$hostnames.API`
- Include `Authorization: 'Bearer ' + this.$store.$api.refreshToken`
- Include `credentials: 'include'`

Since avatar upload is just `POST /profile` with a JSON body, use `this.$api.$post` — no raw `fetch` needed.

### 5.6 Admin Tab Should Not Flash for Non-Admin Users

**How to avoid:** Use `v-if="profile && profile.admin === true"` on the `<b-tab>` element, not `v-show`. `v-if` removes the tab from the DOM entirely. With `v-show`, a non-admin could inspect the hidden admin tab content in DevTools.

### 5.7 Confirmation Guard for Account Deletion

The existing `confirmDeleteAccount` uses `$bvModal.msgBoxConfirm` which is correct. Do not replace it with a simple `window.confirm` — BootstrapVue modal provides a cancellable, styled confirmation that matches the existing pattern from DeviceDetail.vue.

After confirmed deletion, redirect to `/login` and clear localStorage auth state (pattern from `Header.vue:133–137` logout method).

---

## 6. File-Level Inventory

### Files to Modify

| File | Change | Req |
|------|--------|-----|
| `vue/src/components/Notifications/Notifications.vue` | Move `mapGetters` from `computed:` to `methods:` (line 57, 1-line fix) | G1 |
| `vue/src/store/profile.js` | Add `uploadAvatar` action; fix `deleteAccount` to pass `{ owner }` in body | PROF-02, PROF-05 |
| `vue/src/pages/Profile/Profile.vue` | Add Avatar tab, Admin tab; fix `saveNotifications` info merge | PROF-02, PROF-03, PROF-04 |
| `vue/src/components/Header/Header.vue` | Add `to="/app/profile"` (or router-link) to "My Account" dropdown item | PROF-06 |
| `vue/src/Routes.js` | Add sub-routes `profile/account` and `profile/delete` **if required** | PROF-01–05 |

### Files to Create

| File | Purpose | Req |
|------|---------|-----|
| `vue/cypress/integration/profile.spec.js` | Cypress spec stubs for PROF-01–06 | All |
| `vue/src/pages/Profile/Delete.vue` | Standalone delete page **if sub-route is used** | PROF-05 |

**Note on Delete.vue:** The ROADMAP calls for a separate `Delete.vue` page at `/app/profile/delete`. However, the existing `Profile.vue` already contains a working delete button with modal confirmation in the Account tab. Whether to extract it to a separate route is a planner decision (see §7).

---

## 7. Open Questions / Clarifications Needed

### OQ-1: Avatar — Data URI or Raw Base64?

The backend writes `body.avatar` verbatim to `avatar.json` (`owner.js:261`). The profile response returns the file contents as a string (`owner.js:251`).

The profile store example comment (`profile.js:69`) shows `"test_avatar": "AABJRU5ErkJggg=="` — raw base64 without data URI prefix.

**Options:**
- Send raw base64 → display with `<img :src="'data:image/png;base64,' + profile.avatar">`
- Send full data URI → display with `<img :src="profile.avatar">` directly

**Recommendation:** Send raw base64 (strip the `data:...;base64,` prefix before POST), display with the explicit `data:image/png;base64,` prefix in the `<img>` tag. This matches the store example. But **requires confirmation** if the legacy AngularJS console sends data URIs instead.

### OQ-2: Are `/app/profile/account` and `/app/profile/delete` Sub-Routes Needed?

The ROADMAP specifies these routes, but the existing `Profile.vue` already has all functionality in one page with tabs. Sub-routes add navigation complexity without clear UX benefit for this scope.

**Recommendation:** Skip the sub-routes and use the single-page tabbed layout already in place unless the user specifically wants deep-linkable URLs per tab. If sub-routes are added, `account` could be a redirect to `profile` (with a tab query param), and `delete` could render `Delete.vue` as a separate confirmation page.

### OQ-3: Is Email Editable?

The existing `Profile.vue` form does not include email in the editable section (it shows email read-only in the Account tab). The PROF-01 requirement says "view and update profile (first name, last name, email, phone, timezone)".

The backend `info` object stores email (`owner.js:830`). Changing email would require the `info` object partial-update pattern (OQ from §5.1).

**Clarification needed:** Should email be editable, or is it identity-locked (username-based auth)?

### OQ-4: Admin Tab Content

PROF-04 says admin users see an admin tab — but the content of that tab is unspecified. The legacy AngularJS console's admin section likely has owner/user management capabilities.

**Clarification needed:** What should the admin tab show? Placeholder only, or actual admin controls? Phase 6 scope should be clarified before Wave 2 starts.

### OQ-5: Notification Field Naming Mismatch

The profile `info` object has two different notification-related paths:
- `info.notifications` — object with `{ all, important, info }` boolean keys (shown in store comment, `profile.js:63–67`)
- `info.security.important_notifications` — separate boolean (`spec/_envi.json:15–17`, `owner.js:822–823`)

The current `Profile.vue` binds to `info.notifications` only. It is unclear whether `security.important_notifications` is a legacy field or a separate feature.

**Clarification needed:** Should PROF-03 also surface `security.important_notifications`? Or is `notifications: { all, important, info }` the canonical field?

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Profile read/display | Frontend (Vue component) | Vuex store | Data fetched once on `created()`, rendered locally |
| Profile update (info) | API/Backend | Frontend validation | Backend owns the whitelist; frontend sends `{ info }` |
| Avatar upload | API/Backend | Frontend (FileReader) | Backend writes file; frontend converts file to base64 |
| Notification prefs | API/Backend | Frontend state | Stored in `info.notifications` in CouchDB |
| Admin tab visibility | Frontend (Vue) | Backend (flag) | `profile.admin` flag from API; rendering decision is client-side |
| Account deletion | API/Backend | Frontend guard | Backend validates session + owner match; frontend provides confirmation UX |
| Profile nav link | Frontend (Sidebar/Header) | — | Pure routing / template concern |

---

## Sources

### PRIMARY (verified by direct file inspection)

- `vue/src/store/profile.js` — store module: actions, mutations, state shape
- `vue/src/pages/Profile/Profile.vue` — existing page: tabs, form, delete flow
- `vue/src/Routes.js` — route registration: `/app/profile` confirmed present
- `vue/src/components/Sidebar/Sidebar.vue` — "My Profile" link confirmed at line 57
- `vue/src/components/Header/Header.vue` — unlinked "My Account" item confirmed at line 53
- `vue/src/components/Notifications/Notifications.vue` — G1 bug confirmed at line 57
- `lib/router.profile.js` — `GET /api/v2/profile`, `POST /api/v2/profile` routes confirmed
- `lib/router.user.js` — `DELETE /api/v2/user` route + owner validation confirmed (lines 118–122, 174)
- `lib/thinx/owner.js` — `profile()`, `update()`, `saveAvatar()`, `process_update()`, `delete()` methods: lines 258–263, 296–322, 325–417, 402–407, 660–682
- `vue/src/core/api.js` — API client: `$post`, `$delete`, auth headers
- `vue/src/mixins/hostnames.js` — `$hostnames` mixin implementation
- `spec/_envi.json` — test fixture confirming `info` object structure

### SECONDARY

- `services/console/IMPLEMENTATION_PLAN.md:217–243` — Phase 6 section (partially stale: states "No profile page exists" but page now exists)
- `.planning/codebase/CONVENTIONS.md` — `mapGetters` in methods convention documented at line 94
- `.planning/codebase/CONCERNS.md` — token swap bug documented (Concern #4, affects `deleteAccount` calls)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Timezone is stored as-is in `info` blob without backend validation | §3.2 | None for storage; may need UI validation if backend ever rejects unknown fields |
| A2 | Raw base64 (not data URI) is the correct avatar format for the backend | §5.3 | Avatar uploads would succeed but render incorrectly in legacy console |

All other claims are verified by direct codebase inspection.

---

## Package Legitimacy Audit

**No new npm packages are installed in this phase.** Project convention explicitly forbids new packages. This section is intentionally omitted.

---

## Validation Architecture

Framework: Cypress 9.5.4 (confirmed in `vue/package.json`)
Config: `vue/cypress.json`
Quick run: `cd vue && npx cypress run --spec cypress/integration/profile.spec.js`
Full suite: `cd vue && npx cypress run`

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | File | Exists? |
|--------|----------|-----------|------|---------|
| PROF-01 | Profile form saves first name | E2E smoke | `profile.spec.js` | Wave 0 stub |
| PROF-02 | Avatar upload updates preview | E2E smoke | `profile.spec.js` | Wave 0 stub |
| PROF-03 | Notification checkbox saves | E2E smoke | `profile.spec.js` | Wave 0 stub |
| PROF-04 | Admin tab visible for admin, absent for non-admin | E2E smoke | `profile.spec.js` | Wave 0 stub |
| PROF-05 | Delete confirmation → redirect to /login | E2E smoke | `profile.spec.js` | Wave 0 stub |
| PROF-06 | Profile accessible via sidebar and header | E2E smoke | `profile.spec.js` | Wave 0 stub |
| G1 | No TypeError on authenticated pages | E2E regression | `profile.spec.js` or `dashboard.spec.js` | Wave 0 stub |

### Wave 0 Gaps

- [ ] `vue/cypress/integration/profile.spec.js` — covers PROF-01–06 + G1

---

*Research date: 2026-05-23*
*Valid until: ~2026-06-23 (stable codebase, low churn)*

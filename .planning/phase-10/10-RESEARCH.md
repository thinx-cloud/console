# Phase 10: Admin Features — Research

**Researched:** 2026-05-24
**Domain:** Admin console — backend admin-gated router + Redis session blacklist + JWT impersonation claim; frontend admin user-list page + impersonation banner; Profile.vue Admin-tab placeholder removal.
**Confidence:** HIGH for code patterns (verified by direct inspection at HEAD `b6c6680`); MEDIUM for some CONTEXT.md assumptions that need correction (see §0).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

| Question | Decision | Implication |
|---|---|---|
| Impersonate admins? | **Defer — non-admin only for v1 of Phase 10** | Backend `POST /api/v2/admin/impersonate` must reject when target's `admin === true`. UI hides the Impersonate action on admin rows. Plan a follow-up phase to add cross-admin impersonation behind a multi-admin approval gate if/when real demand surfaces. |
| Session-revocation granularity? | **All sessions (coarse)** | Single "force logout user X" button. Redis blacklist keyed by `owner-id + issued-after-timestamp`; every authenticated request checks the blacklist. No session-tracking table needed. |
| Audit-log shape for impersonation? | **Reuse `/logs/audit` with `flags: ['admin', 'impersonation']`** | Every action taken under an impersonation token logs to the existing audit endpoint with the impersonator's `owner` in the body. Surfaces automatically in the Phase-7 History page. No new endpoint / table for impersonation lifecycle. (NOTE: see §0.3 — there is no POST audit endpoint; the lib `alog.log()` is called directly. The decision still stands; only the wording "POSTs to /logs/audit" needs to read "calls `alog.log()`". And see §0.4 — the audit-log lib accepts a single `flag` string, not an array.) |

### Claude's Discretion

(CONTEXT.md does not split out a Discretion section — every meaningful question was answered. Items in §0 below are corrections/refinements where the locked decision conflicts with the actual codebase shape.)

### Deferred Ideas (OUT OF SCOPE)

- Impersonating other admins (multi-admin approval gate — future phase).
- Per-device / per-session granularity on session revocation (deferred — start coarse).
- A separate Redis impersonation ledger / dedicated `/admin/impersonations` endpoint (audit log alone covers it).
- Role-based access control beyond a single `admin` boolean (no read-only admins, no billing admins).
- Multi-tenant isolation (orgs/teams).
- Account suspension (soft-delete) — current model stays hard-delete only.
- Self-service onboarding flows (signup CAPTCHA, email verification beyond the existing flow).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description (proposed for REQUIREMENTS.md v1.1) | Research Support |
|----|-------------------------------------------------|------------------|
| ADMIN-01 | Admin can view a paginated, sortable list of all users with last-seen + device-count | New CouchDB view (`owners_by_last_seen` desc) OR `_all_docs` with `include_docs=true` on the existing `managed_users` DB; client-side render with plain `<table>` + custom pagination controls (NOT `<b-table>` — see §0.1). Device counts come from a per-row HEAD request OR the existing `/devices` endpoint scoped per owner via a new admin variant. |
| ADMIN-02 | Admin can force-logout a specific user (all sessions invalidated within ~1s) | New Redis blacklist key `revoked:owner:{owner}` storing the latest revocation `iat` (unix seconds). Auth middleware at `lib/router.js:102-113` adds a single `redis.get` after `app.login.verify` succeeds; if `decoded.iat < blacklist_value` → 401. JWT `iat` is auto-added by `jsonwebtoken@9.0.3` (see §3.3). |
| ADMIN-03 | Admin can impersonate a non-admin user for 15 min with a banner + audit trail | `lib/thinx/jwtlogin.js` needs a new method `sign_with_impersonation(target_owner, impersonator_owner, callback)` that emits an access token with payload `{ username: target_owner, scope: '/api/', impersonator_owner, exp: now + 900 }`. The auth middleware passes `impersonator_owner` through to the request context (e.g. `req.session.impersonator_owner`) so downstream handlers can log it. The Vue `Layout.vue` displays a banner when `accessToken` decode reveals an `impersonator_owner` claim. |
</phase_requirements>

---

## 0. CONTEXT.md Corrections (read these first)

Five places where the CONTEXT.md text doesn't quite match the codebase shape. None of these change the locked decisions — only the implementation wording.

### 0.1 The project does NOT use `<b-table>`

`grep -rn '<b-table' vue/src/` returns zero matches. Every list view in the project (Devices, History, Apikeys, Repositories, Transformers, Enviros, Channels, Rsakeys) uses a plain `<table class="table table-striped">` + `v-for` + standard `<th>/<td>` cells. CONTEXT.md says "mirror the Devices.vue pattern with `<b-table>`" — the actual Devices.vue uses raw HTML (verified `vue/src/pages/Devices/Devices.vue:47-92`).

**Implication:** `AdminUsers.vue` follows the existing convention — plain `<table>` with `v-for="user in pagedUsers"`. Pagination is custom (two `<b-button>`s + a `<span>{{ page }} / {{ totalPages }}</span>`), NOT `<b-pagination>` (also not used anywhere in the project — `grep -rn 'b-pagination' vue/src/` returns zero).

### 0.2 Backend uses `redis@5.8.2` (with `.legacy()` mode), NOT ioredis

`package.json:76`: `"redis": "^5.8.2"`. `thinx-core.js:99-100`:

```js
app.redis_store_client = redis.createClient(Globals.redis_options());
app.redis_client = app.redis_store_client.legacy();
```

`.legacy()` returns the v3-style callback API. All existing redis ops in the codebase are callback-style: `redis.set(key, value)`, `redis.get(key, callback)`, `redis.expire(key, seconds)`. The blacklist must follow the same pattern.

**Implication:** No `await redis.get(...)`. Use the callback shape:

```js
app.redis_client.get('revoked:owner:' + owner, (err, ts) => { ... });
```

### 0.3 There is no POST audit-log endpoint

`router.logs.js` exposes ONLY:

- `GET /api/v2/logs/audit` (`router.logs.js:137`) — fetch
- `GET /api/v2/logs/build` (`router.logs.js:148`) — fetch
- `GET /api/v2/logs/build/:bid` — fetch

Audit writes happen via direct library calls: `alog.log(owner, message, flag, callback)` (defined at `lib/thinx/audit.js:13-39`). The audit library writes directly to CouchDB `managed_logs`. CONTEXT.md says "POSTs to `/logs/audit`" — that endpoint doesn't exist.

**Implication:** The admin router (and the impersonation middleware path) must `require("../lib/thinx/audit")` and call `alog.log()` directly, the same way `router.auth.js:80,97,201,206,312` and `router.google.js:63,225` already do. No new HTTP endpoint needed.

### 0.4 `alog.log()` takes a single `flag` string, not an array

`lib/thinx/audit.js:13-29`:

```js
log(owner, message, flag, callback) {
  if ((typeof (flag) === "undefined") || (flag === null)) flag = "info";
  // ...
  let record = {
    message, owner, date: mtime,
    flags: [flag]  // <-- always a single-element array
  };
}
```

Audit storage is `flags: [flag]` — always exactly one flag. CONTEXT.md says `flags: ['admin', 'impersonation']` and `flags: ['admin','impersonation','start']`. The library can't emit those today.

**Implication:** Either (a) extend `audit.js#log` to accept an array (1-line change: `flags: Array.isArray(flag) ? flag : [flag]`) OR (b) pick ONE primary flag and concatenate the rest into the message. Recommend (a) — it's a non-breaking extension (existing callers passing strings continue to work) and avoids losing the flag-filter semantics that the Phase-7 History page already relies on. Verify by checking the History page's `flagFilterOptions` (`vue/src/pages/History/History.vue:122-127`) — it filters by individual flags in the array, so multi-flag entries will appear under multiple filters (correct behaviour for impersonation events).

### 0.5 `req.session.owner` carries owner ID only — no `admin` claim

The auth middleware at `lib/router.js:102-113` does `req.session.owner = payload.username` after JWT verify (where `payload.username` is the owner ID per `jwtlogin.js:86`). There is NO admin flag attached to the request. CONTEXT.md says "gated by `req.session.owner.admin === true` middleware" — that's wrong; `req.session.owner` is a string (owner ID), not an object.

**Implication:** The `requireAdmin` middleware must hit CouchDB to check `admin` for each admin request. Cost: one `userlib.get(owner)` per call. Mitigation options:

- (a) Cache the admin flag in Redis with a short TTL (e.g. 60s) keyed by `admin:{owner}` — adds one redis.get + occasional userlib.get. Acceptable.
- (b) Re-issue admin tokens with an `admin: true` claim in the JWT payload (requires changing `jwtlogin.js#sign_with_refresh` to take a user_data arg, and changes the JWT verify path slightly). More invasive.
- (c) No cache — accept one CouchDB call per admin request. Admin endpoints are low-traffic (single dev clicking buttons), so this is fine for v1.

**Recommendation:** **(c)** — keep it simple. One CouchDB `userlib.get()` per admin request is fine; we're not running a 10k-RPS surface here. Re-evaluate if admin endpoints ever become hot.

---

## Summary

Phase 10 is split cleanly between the **parent monorepo** (`/Users/igraczech/Repositories/thinx-device-api/`) for the three new admin endpoints + Redis blacklist + JWT-claim addition, and the **console submodule** (`services/console/`) for the new `AdminUsers.vue` page, impersonation banner, audit-log wiring, and the Profile.vue placeholder removal. Cross-cutting constraint: NO new npm packages (project rule); backend keeps `redis@5.8.2 / .legacy()` callback API, `jsonwebtoken@9.0.3`, and `nano@10.1.4`; frontend keeps Vue 2.6 + BootstrapVue 2.21.2 + Vuex.

**Backend new surface (parent repo):**

1. `lib/router.admin.js` — new file, mirrors `lib/router.profile.js` shape (factory function `module.exports = function(app) { ... }`), registered in `thinx-core.js:358+` after `router.user.js`.
2. `lib/middleware/requireAdmin.js` — new file, **a thin Express-style middleware** that runs AFTER the existing JWT verify in `lib/router.js:102-113` (which sets `req.session.owner`). It calls `app.owner.profile(req.session.owner, ...)` and 403s if `admin !== true`. Used as the second argument to each `app.get/post/delete("/api/v2/admin/*", requireAdmin, handler)`.
3. Redis blacklist key `revoked:owner:{owner}` storing `Date.now()` (ms) at revocation time. Auth middleware (`lib/router.js:102-113`) gains a single `redis.get` after JWT verify: if `decoded.iat * 1000 < blacklist_ts` → 401.
4. `lib/thinx/jwtlogin.js` gains a new `sign_with_impersonation(target_owner, impersonator_owner, callback)` method emitting an access token with a 15-min exp and an extra `impersonator_owner` claim. No refresh token issued for impersonation (forces re-login after 15 min — matches the locked "Exit impersonation = force re-login" decision).
5. `lib/thinx/audit.js#log` accepts either a string or an array of flag strings (1-line patch). All existing call sites continue to work.

**Frontend new surface (submodule):**

1. `vue/src/pages/AdminUsers/AdminUsers.vue` — new page; plain `<table>` (NOT `<b-table>`); per-row "Revoke sessions" + "Impersonate" with `$bvModal.msgBoxConfirm` confirmation (the `Profile.vue:299-311 confirmDeleteAccount` pattern is the canonical reference).
2. `vue/src/store/admin.js` — new Vuex module mirroring `store/profile.js`: `fetchUsers`, `revokeSession({owner})`, `impersonate({owner})`. Exit-impersonation reuses the existing `auth/clearSession` action + `$router.push('/login')`.
3. `vue/src/Routes.js` — new `/app/admin/users` route under the existing `/app` parent. The router-level guard at `Routes.js:131-144` already gates `/app/*`; we add a second check inside `AdminUsers.vue#created` against `profile.admin === true` (or extend the router guard with an `adminPaths` set — see §6 OQ-4).
4. `vue/src/components/Layout/Layout.vue` — add an `<ImpersonationBanner>` component above `<router-view>` (between line 4 `<Sidebar />` and line 5 `<div ref="content">`). The banner mounts unconditionally; it self-hides via `v-if="impersonatorOwner"` based on a decoded JWT claim read once on `created()` and re-checked when the access token changes.
5. `vue/src/pages/Profile/Profile.vue:140-143` — replace the "not yet available" `<b-card>` block with a `<router-link to="/app/admin/users">Open Admin Console</router-link>` + a brief description.

**Primary recommendation:** Follow the four-wave breakdown from CONTEXT.md (Wave 0 stub, Wave 1 backend, Wave 2 frontend, Wave 3 Profile-tab swap). Estimated new code: ~600 LOC backend + ~400 LOC frontend across 7 new files and 7 modifications. No new dependencies. The biggest watch-out is the parent-repo coupling — Wave 1 is a parent-repo PR; Wave 2/3 are submodule PRs; the submodule deploys via the parent-meta-repo bump per memory `deployment-console-thinx-cloud`.

---

## 1. Existing Patterns to Mirror

### 1.1 Backend Router Factory

**Reference:** `lib/router.profile.js` (66 lines — complete factory).

Shape every new router file follows:

```js
const Util = require("./thinx/util");
const Sanitka = require("./thinx/sanitka"); var sanitka = new Sanitka();

module.exports = function (app) {
  const user = app.owner;  // Owner instance (has profile(), userlib, etc.)

  function handlerName(req, res) {
    if (!Util.validateSession(req)) return res.status(401).end();
    let owner = sanitka.owner(req.session.owner);
    if (typeof (owner) === "undefined") return res.status(401);
    // ... do work, then ...
    Util.responder(res, success, response);
  }

  app.get("/api/v2/admin/users", function (req, res) { /* with middleware */ });
};
```

The session-check helper `Util.validateSession(req)` (`lib/thinx/util.js:56-81`) is the canonical first line of every handler. **Reuse verbatim.** The admin-check is a SECOND check that runs after `validateSession`.

### 1.2 Admin Middleware (does not yet exist — propose)

There is no admin-gated route in the codebase today (`grep -rn 'admin ===' lib/` returns one hit in `owner.js:319` for the profile shape only). Cleanest proposal: a new file `lib/middleware/requireAdmin.js` exporting a factory:

```js
// lib/middleware/requireAdmin.js
const Util = require("../thinx/util");
const Sanitka = require("../thinx/sanitka"); const sanitka = new Sanitka();

module.exports = function (app) {
  return function requireAdmin(req, res, next) {
    if (!Util.validateSession(req)) return res.status(401).end();
    const owner = sanitka.owner(req.session.owner);
    if (typeof (owner) === "undefined") return res.status(401).end();
    app.owner.profile(owner, (success, profile) => {
      if (!success || !profile || profile.admin !== true) {
        return res.status(403).end();
      }
      next();
    });
  };
};
```

Used in `router.admin.js`:

```js
const requireAdmin = require("./middleware/requireAdmin")(app);
app.get("/api/v2/admin/users", requireAdmin, function (req, res) { /* ... */ });
```

**Why a factory:** middleware needs `app.owner` (the `Owner` instance from `thinx-core.js:109`). Passing `app` into the factory matches the rest of the codebase (every `lib/router.*.js` is a factory).

**Alternative:** inline the admin check directly in each handler in `router.admin.js`, no separate file. Saves one file but duplicates ~10 lines three times. **Recommendation: separate file** — the planner notes this as locked.

### 1.3 Redis Blacklist (the parent codebase's redis idioms)

**Existing usage patterns in the repo (all callback-style, `.legacy()` API):**

- `lib/router.auth.js:128-129`: `redis.set(token, JSON.stringify(user_data)); redis.expire(token, 60);`
- `lib/router.github.js:96-97`: `app.redis_client.set(token, JSON.stringify(userWrapper)); app.redis_client.expire(token, 30);`
- `lib/router.gdpr.js:49-53`: `redis_client.expire("ak:" + owner_id, 1); redis_client.keys("/" + owner_id + "/*", function (_err, obj_keys) { ... });`
- `lib/thinx/jwtlogin.js:38,51,56`: `redis.set(JWT_KEY, key, () => {...}); redis.get(JWT_KEY, (error, result) => {...});`

**Proposed blacklist shape:** plain `SET` (no sorted set — overkill for coarse "all sessions" granularity).

```js
// Revoke: store the revocation timestamp (ms since epoch)
app.redis_client.set('revoked:owner:' + owner, String(Date.now()), () => {
  app.redis_client.expire('revoked:owner:' + owner, 7 * 24 * 60 * 60);  // refresh-token max lifetime
});

// Check (hot path, inside lib/router.js auth middleware):
app.redis_client.get('revoked:owner:' + owner, (err, ts) => {
  if (err || !ts) return next();  // no blacklist entry → pass
  const tsMs = parseInt(ts, 10);
  const iatMs = (decoded.iat || 0) * 1000;
  if (iatMs < tsMs) return res.status(401).end();
  next();
});
```

**TTL:** match the refresh-token max lifetime (7 days). After 7 days no JWT issued before the revocation could still be valid anyway, so the entry becomes pointless and can be GC'd by Redis.

**Why not a sorted set:** a SET with one revocation timestamp is sufficient because "all sessions" granularity means we only need the most-recent revoke. A second revoke `SET` overwrites the first — that's correct semantics (subsequent revocations push the cutoff forward). A sorted set would matter only if we wanted per-session revocation (out of scope).

### 1.4 JWT Issuance with Custom Claims

**Reference:** `lib/thinx/jwtlogin.js:83-120`.

Current `sign_with_refresh(uid, callback)` payload:

```js
let access_payload = {
  username: uid,
  scope: '/api/',
  exp: Math.floor(Date.now() / 1000) + (60 * 60)  // 1 hour
};
```

`jsonwebtoken@9.0.3` auto-adds `iat` to every signed token (verified via official docs; see §3.3). So our blacklist's `iat` check works without any payload change.

**For impersonation**, add a sibling method:

```js
sign_with_impersonation(target_owner, impersonator_owner, callback) {
  this.fetchOrCreateSecretKey((secretkey) => {
    let payload = {
      username: target_owner,                  // becomes req.session.owner (the impersonated user)
      scope: '/api/',
      impersonator_owner: impersonator_owner,  // the admin who started impersonation
      exp: Math.floor(Date.now() / 1000) + (15 * 60)  // 15 minutes
    };
    jwt.sign(payload, secretkey, jwt_options, (err, token) => {
      if (err !== null) console.log("[jwt] impersonation sign error", err);
      callback(token);
    });
  });
}
```

No refresh token — impersonation expires hard at 15 min and forces re-login (per locked decision). The verify path in `lib/router.js:103-110` already passes through the full `payload` to the callback — we just need to forward `payload.impersonator_owner` onto the request:

```js
// lib/router.js:103-110 patch:
app.login.verify(req, (error, payload) => {
  if (error == null) {
    req.session.owner = payload.username;
    if (payload.impersonator_owner) {
      req.session.impersonator_owner = payload.impersonator_owner;
    }
    next();
  } else {
    res.status(403).end();
  }
});
```

### 1.5 Audit Log Direct Call Pattern

**Reference call sites:**

- `lib/router.auth.js:80`: `alog.log(owner_id, logline);`
- `lib/router.auth.js:97`: `alog.log(owner_id, "OAuth User logged in: " + doc.username, "info");`
- `lib/router.auth.js:312`: `alog.log(user_data.owner, "User logged in: " + username);`
- `lib/thinx/apikey.js:96`: `this.alog.log(owner, "Attempt to use invalid API Key: " + apikey, "error");`

Pattern: import the audit module, instantiate, call `.log(owner, message, flag)`.

```js
const AuditLog = require("../lib/thinx/audit"); var alog = new AuditLog();
// ...
alog.log(target_owner, "Impersonation started by " + impersonator_owner, ["admin", "impersonation", "start"]);
```

**Patch to `audit.js#log` (one line):** `flags: Array.isArray(flag) ? flag : [flag]` instead of `flags: [flag]`. Existing callers passing strings continue to produce `flags: [flag]`; new callers can pass arrays.

**Why patch instead of stringify the flags into the message:** the Phase-7 History page (`History.vue:122-127, 158`) filters by `item.flags.some(f => this.auditFlagFilter.includes(f))` — if we want impersonation events to appear when admins filter by flags like "admin" or "impersonation", the flags must be in the flags array, not buried in the message. The 1-line patch preserves that semantic.

### 1.6 Frontend `<table>` + Pagination Pattern

**Reference:** `vue/src/pages/Devices/Devices.vue:47-92` (raw table with v-for).

**No `<b-table>` anywhere.** No `<b-pagination>` anywhere. For pagination, use computed `pagedUsers` + two buttons:

```vue
<template>
  <div>
    <table class="table table-striped">
      <thead><tr><th>Username</th><th>Email</th><th>Admin</th><th>Last seen</th><th>Actions</th></tr></thead>
      <tbody>
        <tr v-for="user in pagedUsers" :key="user.owner">
          <td>{{ user.username }}</td>
          <td>{{ user.email }}</td>
          <td><b-badge v-if="user.admin" variant="success">Yes</b-badge></td>
          <td>{{ user.last_seen | fromNow }}</td>
          <td>
            <b-button size="sm" variant="danger" @click="confirmRevoke(user)">Revoke</b-button>
            <b-button v-if="!user.admin" size="sm" variant="warning" @click="confirmImpersonate(user)">Impersonate</b-button>
          </td>
        </tr>
      </tbody>
    </table>
    <div class="d-flex align-items-center">
      <b-button size="sm" :disabled="page === 1" @click="page--">Prev</b-button>
      <span class="mx-2">Page {{ page }} / {{ totalPages }}</span>
      <b-button size="sm" :disabled="page === totalPages" @click="page++">Next</b-button>
    </div>
  </div>
</template>
```

`computed: pagedUsers() { const start = (this.page - 1) * this.pageSize; return this.users.slice(start, start + this.pageSize); }`. For `<=200` users this is fine client-side; for larger fleets defer server-side pagination to a future iteration.

### 1.7 Confirm Modal Pattern

**Reference:** `vue/src/pages/Profile/Profile.vue:299-311` `confirmDeleteAccount`.

```js
async confirmRevoke(user) {
  const ok = await this.$bvModal.msgBoxConfirm(
    `Force-logout ${user.username}? This invalidates all their access and refresh tokens.`,
    { title: 'Revoke Sessions', okVariant: 'danger', okTitle: 'Force logout', size: 'sm' }
  );
  if (!ok) return;
  const result = await this.revokeSession({ owner: user.owner });
  // toast + audit-log entry (already created server-side by the endpoint)
}
```

The endpoint itself records the audit entry (admin action) — no frontend audit-log call needed.

### 1.8 Cypress Spec Stub Format

**Reference:** `vue/cypress/integration/auth-extras.spec.js` (Phase 8 canonical shape).

```js
describe('Admin Features feature', function() {

  beforeEach(() => {
    cy.viewport(1536, 754);
    cy.login();
    cy.visit('http://localhost:3000/#/app/admin/users');
  });

  it('Should render the admin user-list page with pagination controls (ADMIN-01)', function() { /* TODO ADMIN-01: assert table rows visible; pagination Prev/Next visible */ });

  it('Should show a confirmation modal then revoke sessions on confirm (ADMIN-02)', function() { /* TODO ADMIN-02: click Revoke on a row, assert modal opens; click Force logout, assert toast + audit-log entry */ });

  it('Should show a confirmation modal then start impersonation on confirm (ADMIN-03)', function() { /* TODO ADMIN-03: click Impersonate on a non-admin row, assert modal opens; click confirm, assert banner appears with countdown */ });

  it('Should hide the Impersonate action on admin rows (ADMIN-03 negative)', function() { /* TODO ADMIN-03: locate an admin row, assert no Impersonate button rendered */ });

});
```

Note `cy.login()` IS needed for all four — the admin pages live under `/app` which is gated.

### 1.9 mapGetters in `methods:` Convention (Phase 6 G1 — must preserve)

**Verified examples:**

- `vue/src/pages/Profile/Profile.vue:195-197`:
  ```js
  methods: {
    ...mapGetters({ getProfile: 'profile/getProfile' }),
    ...mapActions({ fetchProfile: 'profile/fetchProfile', /* ... */ }),
  ```
- `vue/src/pages/History/History.vue:192-200` — same pattern.
- `vue/src/pages/Login/Login.vue:113-126` — same pattern.

**Rule:** `mapGetters` and `mapActions` both go in `methods:`. Getters are called as functions: `this.getProfile()`, not `this.getProfile`. **All new Vue components in Phase 10 must follow this.** The plan-checker should grep for `computed: { ...mapGetters` and reject.

---

## 2. Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Admin authorization (is this user an admin?) | Backend (CouchDB `userlib.get`) | — | Truth lives on the user doc's `admin: true` flag; client-side `profile.admin` is informational only and easily forged via DevTools |
| Session blacklist storage | Backend (Redis) | — | Auth middleware runs on every request → Redis is the only sub-ms-latency store the codebase already operates |
| JWT issuance with `impersonator_owner` claim | Backend (`jwtlogin.js`) | — | Token signing requires the Redis-held secret key; never exposed to client |
| Impersonation banner display | Frontend (Vue / `Layout.vue`) | — | Pure UI state derived from the JWT's `impersonator_owner` claim (decoded client-side via `vue-jwt-decode`) |
| Audit-log writes for admin actions | Backend (admin router endpoints call `alog.log()`) | — | Single source of truth; client cannot forge audit entries |
| Audit-log filter UI (admin/impersonation flags) | Frontend (History.vue, already exists) | — | Reused from Phase 7 — extending `flagFilterOptions` to include `admin` and `impersonation` is a 4-line patch to History.vue |
| User-list pagination (v1) | Frontend (client-side slice) | — | < 200 users expected for v1; server-side pagination deferred until scale demands it |
| Exit-impersonation = clear session + push /login | Frontend (Vuex `auth/clearSession`) | — | Reuses the existing Phase-8 `clearSession` action verbatim; no new server-side endpoint |
| User → device-count mapping | Backend (admin endpoint joins users with `devices.list` per owner OR a new CouchDB view) | — | Cross-collection join — client can't do this efficiently |

---

## 3. Standard Stack

### Core (no new deps)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `redis` (node-redis) | `^5.8.2` (`.legacy()` callback API) | Session blacklist storage | Already in use across `lib/router.*.js`; the auth secret key, OAuth tokens, session store, and API-key cache all use the same client |
| `jsonwebtoken` | `^9.0.3` | JWT signing/verification with custom claims | Already powers `lib/thinx/jwtlogin.js`; auto-adds `iat` per RFC 7519 |
| `nano` | `^10.1.4` | CouchDB driver for `managed_users` and `managed_logs` queries | Already powers every owner/audit/device lookup |
| `bootstrap-vue` | `2.21.2` | `<b-button>`, `<b-card>`, `<b-modal>`, `<b-tab>`, `$bvModal.msgBoxConfirm` | Already the entire UI toolkit |
| `vue-jwt-decode` | `0.1.0` | Client-side JWT decode for the banner's `impersonator_owner` claim + countdown | Already imported at `vue/src/store/auth.js:1`; the canonical decode pattern in the project |
| `vuex` | (via Vue 2.6) | New `admin.js` store module | Project standard; every page is Vuex-backed |
| `vue-router` | (via Vue 2.6) | `/app/admin/users` route | Project standard |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `cypress` | `9.5.4` (pinned `vue/package.json:67`) | E2E test stubs | Wave 0 deliverable |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain `<table>` + custom pagination | `<b-table>` + `<b-pagination>` | Project convention is plain tables (zero existing `<b-table>` usage); introducing it would be a one-off inconsistency. Stay with plain. |
| Redis `SET` blacklist | Redis sorted set keyed by owner | Sorted set only matters for per-session granularity (out of scope). Plain SET is enough for coarse revocation. |
| `req.session.impersonator_owner` middleware-injected | Decode the JWT a second time in each handler | Inject once at the auth middleware (`lib/router.js:103-110`); cheaper and matches how `req.session.owner` is handled. |
| Re-issue admin JWT with `admin: true` claim | Hit CouchDB per request | Per-request CouchDB lookup is fine for admin-only routes (low traffic). Adding claim later is a smooth migration if it ever becomes hot. |
| Banner in `Layout.vue` template | Subscribe to a Vuex getter `auth/isImpersonating` | Both work; Vuex-getter version makes the banner reactive to mid-session impersonation start/exit. **Recommend Vuex getter** — see §5 OQ-3. |
| `setInterval` countdown | `requestAnimationFrame` polling | Once-per-second is more than enough; `setInterval(updateCountdown, 1000)` is the right tool. RAF is overkill and ties redraws to display refresh rate. **Recommend `setInterval`.** |

**Installation:** None — no new packages. The entire phase reuses existing stack.

**Version verification:**

```bash
# Parent repo
grep -n '"redis"\|"jsonwebtoken"\|"nano"' /Users/igraczech/Repositories/thinx-device-api/package.json
# Yields: redis ^5.8.2, jsonwebtoken ^9.0.3, nano ^10.1.4

# Submodule
grep -n '"bootstrap-vue"\|"vue"\|"vue-jwt-decode"\|"vuex"\|"cypress"' /Users/igraczech/Repositories/thinx-device-api/services/console/vue/package.json
# Yields: bootstrap-vue 2.21.2, vue ^2.6.14, cypress 9.5.4
```

All versions verified by direct `grep` on the lockfiles this session.

---

## Package Legitimacy Audit

**No new npm packages are installed in this phase.** Project hard constraint (memory `thinx-console-vue-conventions`) explicitly forbids new packages. Every backend dep used (`redis`, `jsonwebtoken`, `nano`) is years-old, multi-million-downloads, MIT, with the official org as source. Every frontend dep used (`bootstrap-vue`, `vue`, `vue-jwt-decode`, `vuex`, `vue-router`) is already in `vue/package.json` and exercised by other phases. **This section is intentionally empty** — same as Phase 8's research.

---

## 4. Architecture Patterns

### 4.1 System Architecture Diagram

```
[Admin Browser]
   |
   |  1. GET /api/v2/admin/users
   |  Authorization: Bearer <admin-JWT>
   v
+---------------------+
| lib/router.js auth  |  -- verify JWT, set req.session.owner
| middleware          |  -- NEW: check redis 'revoked:owner:{owner}' against decoded.iat
|                     |  -- NEW: if decoded.impersonator_owner present, set req.session.impersonator_owner
+---------------------+
   |
   v
+---------------------+
| requireAdmin        |  -- userlib.get(owner) -> 403 if !profile.admin
| middleware          |
+---------------------+
   |
   v
+---------------------+
| lib/router.admin.js |  -- handler: list users from managed_users
+---------------------+
   |
   v
+---------------------+   +---------------------+
| CouchDB             |   | alog.log()          |  -- audit entry (admin action)
| managed_users       |   | -> managed_logs     |
+---------------------+   +---------------------+

----- Revocation -----
[Admin clicks "Revoke" for user X]
   |
   v
DELETE /api/v2/admin/session/:owner
   |
   v
redis.set('revoked:owner:X', Date.now())
redis.expire('revoked:owner:X', 7*24*60*60)
   |
   v
alog.log(X, 'Sessions revoked by ' + admin_owner, ['admin', 'revoke'])

[Next API request from user X's stale JWT]
   |
   v
lib/router.js auth middleware:
   redis.get('revoked:owner:X') -> ts
   if decoded.iat * 1000 < ts -> 401

----- Impersonation -----
[Admin clicks "Impersonate" for user X (non-admin)]
   |
   v
POST /api/v2/admin/impersonate { owner: X }
   |  requireAdmin -> validate X.admin !== true
   v
jwtlogin.sign_with_impersonation(X, admin_owner)
   |
   v
{ access_token: <JWT with impersonator_owner=admin_owner, exp=15min> }
   |
   v
alog.log(admin_owner, 'Impersonation started: ' + X, ['admin','impersonation','start'])

[Frontend stores impersonation JWT, replaces admin JWT in localStorage]
[Layout.vue mounts ImpersonationBanner -- decode JWT, show countdown]

[Any action under impersonation token]
   |
   v
lib/router.js auth middleware:
   req.session.owner = X
   req.session.impersonator_owner = admin_owner
   |
   v
Handler runs (as user X) AND
alog.log(admin_owner, 'IMPERSONATED action: ' + req.method + ' ' + req.path, ['admin','impersonation'])
   (called inside requireAdmin or via a separate impersonationAuditMiddleware running before each authenticated handler — see §6 OQ-6)
```

### 4.2 Recommended Project Structure

**Parent repo (`thinx-device-api/`) — new files:**

```
lib/
├── router.admin.js                    # NEW — admin endpoints
└── middleware/
    └── requireAdmin.js                # NEW — admin-check middleware factory
```

**Submodule (`services/console/`) — new files:**

```
vue/src/
├── pages/
│   └── AdminUsers/
│       └── AdminUsers.vue             # NEW — user list page
├── components/
│   └── ImpersonationBanner/
│       └── ImpersonationBanner.vue    # NEW — banner with countdown + Exit button
└── store/
    └── admin.js                       # NEW — Vuex module (fetchUsers, revokeSession, impersonate)

vue/cypress/integration/
└── admin.spec.js                      # NEW — Wave 0 stub
```

### 4.3 Pattern 1: Admin Middleware Factory

**What:** Express-style middleware function returned from a factory that closes over `app`.
**When to use:** Any time you need access to `app.owner`, `app.redis_client`, or other shared services inside a middleware.
**Example:**

```js
// lib/middleware/requireAdmin.js
const Util = require("../thinx/util");
const Sanitka = require("../thinx/sanitka"); const sanitka = new Sanitka();

module.exports = function (app) {
  return function requireAdmin(req, res, next) {
    if (!Util.validateSession(req)) return res.status(401).end();
    const owner = sanitka.owner(req.session.owner);
    if (typeof (owner) === "undefined") return res.status(401).end();
    app.owner.profile(owner, (success, profile) => {
      if (!success || !profile || profile.admin !== true) {
        return res.status(403).end();
      }
      next();
    });
  };
};
```

### 4.4 Pattern 2: Redis Blacklist Check in Auth Middleware

**What:** Patch the existing JWT-verify branch in `lib/router.js:102-113` to do one additional redis.get.
**When to use:** This is the ONLY hot-path change; do it carefully — every authenticated request hits it.
**Example:**

```js
// lib/router.js — patch the existing block at 102-113:
if ((typeof (req.headers['authorization']) !== "undefined") || (typeof (req.headers['Authorization']) !== "undefined")) {
  app.login.verify(req, (error, payload) => {
    if (error == null) {
      req.session.owner = payload.username;
      if (payload.impersonator_owner) req.session.impersonator_owner = payload.impersonator_owner;
      // NEW: blacklist check
      app.redis_client.get('revoked:owner:' + payload.username, (rerr, ts) => {
        if (rerr) {
          // Redis hiccup — fail open (existing behaviour is no blacklist at all).
          // Log so we notice; don't 401 because that'd break login during Redis outages.
          console.log('[warning] blacklist check failed', rerr);
          return next();
        }
        if (ts) {
          const iatMs = (payload.iat || 0) * 1000;
          if (iatMs < parseInt(ts, 10)) {
            return res.status(401).end();
          }
        }
        next();
      });
    } else {
      res.status(403).end();
    }
  });
  return;
}
```

### 4.5 Pattern 3: Vuex Module for Admin Actions

**What:** Mirror `vue/src/store/profile.js` shape.
**Example:**

```js
// vue/src/store/admin.js
export default {
  namespaced: true,
  state: {
    users: [],
  },
  mutations: {
    setUsers(state, users) { state.users = users; },
  },
  actions: {
    async fetchUsers({ commit }) {
      const result = await this.$api.$get('/admin/users');
      if (result.success) commit('setUsers', result.response);
      return result;
    },
    async revokeSession(_, { owner }) {
      return await this.$api.$delete('/admin/session/' + owner);
    },
    async impersonate(_, { owner }) {
      return await this.$api.$post('/admin/impersonate', JSON.stringify({ owner }));
    },
  },
  getters: {
    getUsers(state) { return state.users; },
  },
};
```

Register in `vue/src/store/index.js` alongside `profile`.

### 4.6 Pattern 4: Impersonation Banner Component

**What:** A small Vue component that decodes the current access token and renders a sticky banner.
**Example:**

```vue
<!-- vue/src/components/ImpersonationBanner/ImpersonationBanner.vue -->
<template>
  <div v-if="impersonatorOwner" class="impersonation-banner bg-warning text-dark py-2 px-3 d-flex align-items-center">
    <span class="mr-3">🎭 Impersonating <strong>{{ targetUsername || targetOwner }}</strong> — expires in {{ countdown }}</span>
    <b-button size="sm" variant="dark" @click="exit">Exit impersonation</b-button>
  </div>
</template>

<script>
import VueJwtDecode from "vue-jwt-decode";
import { mapActions } from "vuex";

export default {
  name: "ImpersonationBanner",
  data() {
    return {
      impersonatorOwner: null,
      targetOwner: null,
      targetUsername: null,
      expSeconds: null,
      countdown: '--:--',
      tickerId: null,
    };
  },
  created() {
    this.decode();
    this.tickerId = setInterval(() => this.updateCountdown(), 1000);
  },
  beforeDestroy() {
    if (this.tickerId) clearInterval(this.tickerId);
  },
  watch: {
    '$route'() { this.decode(); },  // re-decode on route change in case the token swapped
  },
  methods: {
    ...mapActions({ clearSession: "auth/clearSession" }),
    decode() {
      try {
        const token = window.localStorage.getItem('accessToken');
        if (!token) { this.impersonatorOwner = null; return; }
        const decoded = VueJwtDecode.decode(token);
        if (decoded && decoded.impersonator_owner) {
          this.impersonatorOwner = decoded.impersonator_owner;
          this.targetOwner = decoded.username;
          this.expSeconds = decoded.exp;
        } else {
          this.impersonatorOwner = null;
        }
      } catch (_e) {
        this.impersonatorOwner = null;
      }
    },
    updateCountdown() {
      if (!this.expSeconds) return;
      const secondsLeft = this.expSeconds - Math.floor(Date.now() / 1000);
      if (secondsLeft <= 0) {
        this.countdown = '00:00';
        // The 15-min exp will trigger auth/scheduleExpiry to clearSession + redirect;
        // belt-and-suspenders: explicitly exit here too.
        this.exit();
        return;
      }
      const m = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
      const s = String(secondsLeft % 60).padStart(2, '0');
      this.countdown = `${m}:${s}`;
    },
    async exit() {
      await this.clearSession();
      this.$router.push('/login');
    },
  },
};
</script>

<style scoped>
.impersonation-banner { position: sticky; top: 0; z-index: 1050; border-bottom: 2px solid #856404; }
</style>
```

Mount in `Layout.vue` before `<router-view>`:

```vue
<template>
  <div :class="{root: true, sidebarClose}">
    <Header />
    <Sidebar />
    <ImpersonationBanner />     <!-- NEW -->
    <div ref="content" class="content animated fadeInUp">
      <router-view />
    </div>
    <!-- ... -->
  </div>
</template>
```

### 4.7 Anti-Patterns to Avoid

- **`<b-table>` in `AdminUsers.vue`:** Inconsistent with the rest of the project; introduces a different DOM shape, harder to style with existing `.table-striped` CSS. Use plain `<table>`.
- **Hand-rolled JWT decode in `ImpersonationBanner.vue`:** The project already has `vue-jwt-decode` for exactly this; don't atob+JSON.parse.
- **`mapGetters` in `computed:`:** Anti-regression — Phase 6 G1 fixed this everywhere; new code must obey.
- **Calling `alog.log()` from the frontend:** Audit entries must be written server-side or they can be forged. Every admin endpoint must call `alog.log()` itself.
- **Caching the admin flag in the Vuex store as the source of truth:** `profile.admin === true` is a DISPLAY hint only; backend MUST re-check on every admin request. The router guard at `Routes.js:131-144` should also check admin, but that's a UX nicety, not the security boundary.
- **Storing the previous admin token in localStorage to "restore admin session on exit impersonation":** Adds state-management complexity and security risk (the admin's original token could be replayed). Force re-login per the locked decision.
- **Setting the blacklist TTL longer than the refresh-token max lifetime:** Wastes Redis memory; entries are useless once no JWT issued before the revoke can still be valid.

---

## 5. Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT signing with custom claims | A custom HMAC + base64 routine | `lib/thinx/jwtlogin.js` extension via `jwt.sign()` from `jsonwebtoken@9.0.3` | RFC 7519 compliance; deterministic `iat`; spec-correct header |
| JWT decoding in the frontend | `atob(parts[1])` + `JSON.parse` (except in `api.js` where it's already there for AUTH-03 belt-and-suspenders) | `VueJwtDecode.decode(token)` | Already a project standard; one less inline boilerplate |
| Admin-check middleware | Inline `if (profile.admin !== true) res.status(403)` in every handler | `requireAdmin(app)` factory in `lib/middleware/requireAdmin.js` | DRY; one place to evolve when caching the flag becomes necessary |
| Redis blacklist sorted-set with per-session granularity | A second new schema with per-jti keys | A flat `revoked:owner:{owner}` SET with a single timestamp | Coarse revocation is the locked decision; per-session is out of scope |
| User-list pagination state machine | A custom pagination controller class | `data: { page: 1, pageSize: 20 }` + computed `pagedUsers` slice | < 200 users; client-side slice is the simplest correct answer |
| Countdown timer | `requestAnimationFrame` driven scheduler | `setInterval(updateCountdown, 1000)` | 1Hz redraw is plenty; matches the JWT-exp granularity (seconds) |
| Audit-log writes from the frontend | A `POST /api/v2/logs/audit` endpoint + Vuex action | Every admin endpoint calls `alog.log()` itself, server-side | Audit entries can't be forged by the client; less code; the backend already has direct lib access |

**Key insight:** Every piece of this phase has a near-zero-LOC answer using what's already in the codebase. The temptation to introduce `<b-table>`, `<b-pagination>`, a postMessage event bus, or a per-session Redis schema is real; all of them are wrong for the current decision space.

---

## 6. Common Pitfalls

### 6.1 The auth middleware blacklist check must not block on Redis outage

**What goes wrong:** Redis goes flaky; the blacklist check times out or errors; every authenticated request fails closed → site is down.
**Why it happens:** Naive `if (rerr) return res.status(401)`.
**How to avoid:** Fail OPEN on Redis errors — log the error, treat as "no blacklist entry", continue. See the `Pattern 2` code above (`if (rerr) { console.log(...); return next(); }`).
**Warning signs:** Cypress login starts failing intermittently; production logs show `'[warning] blacklist check failed'` correlated with Redis incidents.

### 6.2 Race window between revocation and in-flight requests

**What goes wrong:** Admin clicks "Revoke" at T+0; user X's browser fires a request at T+0.001 with their old JWT; the blacklist write hasn't landed in Redis yet (~1ms); the request passes the blacklist check and the action goes through.
**Why it happens:** The blacklist write is async; the auth check is async; there's a small window where both can execute concurrently.
**How to avoid:** The window is sub-millisecond and `redis@5.x` with a local-network Redis is typically < 1ms. **Accept the race** for v1 — the security model already accepts that a stolen JWT is valid until exp anyway. Document the gap (§6.7 ditto for impersonation kill-switch).
**Warning signs:** Audit log shows a user X request 50-500ms AFTER their revocation timestamp — that's the race manifesting.

### 6.3 Stolen impersonation JWT is valid until exp

**What goes wrong:** An admin starts impersonation, copies the JWT out of localStorage to an attacker; the attacker has 15 min of access as the impersonated user even after the admin clicks "Exit impersonation".
**Why it happens:** "Exit impersonation" only clears the admin's local storage — it doesn't invalidate the JWT server-side.
**How to avoid:** When "Exit impersonation" fires, also call `DELETE /api/v2/admin/session/:target_owner` to revoke the impersonated user's sessions (which includes the impersonation token, since its `iat` is < blacklist_ts). Or: add a dedicated "kill impersonation" Redis key that the auth middleware checks alongside the regular blacklist. **For v1, accept the gap** — the impersonation TTL is short (15 min), and the audit log captures the start so a leak is detectable. Document in §7 OQ-5.
**Warning signs:** Audit log shows impersonation activity AFTER the admin's "Exit" event was recorded.

### 6.4 Cold reload during impersonation

**What goes wrong:** Admin closes browser without "Exit impersonation"; reopens; localStorage still has the impersonation JWT (not the admin's original); router boots and the impersonation banner shows, but the user logically should be "back to admin".
**Why it happens:** `localStorage.accessToken` was overwritten when impersonation started; the admin's original token is gone.
**How to avoid:** Two options:
- (a) **Accept the behaviour** — the admin sees the impersonation banner on reload; clicks "Exit impersonation"; logs back in as admin. Matches the locked "Exit = force re-login" decision.
- (b) Store the admin's original token in a separate localStorage key (`admin_pre_impersonation_token`) on impersonation start; restore on exit. Adds restore complexity; partly negates the locked decision.

**Recommendation: (a)** — matches the locked decision; the banner correctly tells the admin what's happening.

### 6.5 `setInterval` keeps ticking after the user navigates away

**What goes wrong:** `setInterval` registered in `ImpersonationBanner.vue#created` keeps firing even when the banner unmounts (e.g. on logout, before route change settles).
**Why it happens:** Missing `clearInterval` in `beforeDestroy`.
**How to avoid:** `beforeDestroy() { if (this.tickerId) clearInterval(this.tickerId); }` — included in the §4.6 example above.
**Warning signs:** Vue dev-tools shows the banner component as destroyed but console logs from `updateCountdown` continue.

### 6.6 The auth middleware is in front of EVERY `/api/*` route, not just `/api/v2/admin/*`

**What goes wrong:** Adding the blacklist check at `lib/router.js:103-110` means the redis.get fires for every `/api/*` JWT request, including device endpoints (`/api/device/*`).
**Why it happens:** The catch-all middleware in `router.js:85-182` applies to every request.
**How to avoid:** **Accept the per-request cost.** A `redis.get` against a local Redis (in the same Docker network) is < 1ms. The current request count is well below the threshold where this matters. If it ever does: add an exception for `/api/device/*` (which uses API-key auth, not JWT, per `router.js:155-175`). For v1, no exception needed.
**Warning signs:** P99 latency on `/api/device/*` jumps; Datadog APM shows a `redis.get` span in every request trace.

### 6.7 No server-side impersonation kill switch

**What goes wrong:** See §6.3. There's no way for an admin to early-terminate an in-flight impersonation token.
**Why it happens:** The locked decision says "audit log only, no separate ledger" — so there's no per-impersonation lookup to invalidate.
**How to avoid:** Accept the gap; document; the 15-min TTL bounds blast radius. If demand surfaces, a future iteration can add `kill:impersonation:{jti}` Redis keys keyed on a new `jti` claim.
**Warning signs:** Security review flags it. Document in §7 OQ-5 so the user can decide.

### 6.8 Sidebar nav doesn't have an Admin link

**What goes wrong:** `vue/src/components/Sidebar/Sidebar.vue:9-60` has no admin entry; admins discover `/app/admin/users` only via the Profile tab link.
**Why it happens:** The placeholder text said "this will be expanded when backend endpoints are implemented" — the redesign should also add a sidebar link.
**How to avoid:** Add a conditional `<NavLink>` in `Sidebar.vue` after line 58, gated on `profile.admin === true`. The sidebar already pulls `mapState('layout', ...)`; an `isAdmin` computed (reading from `profile/getProfile`) is one more mapping.
**Warning signs:** UAT feedback says "admin features are hidden". Add the link in Wave 3 or as a small Wave 2 task.

### 6.9 The router guard at `Routes.js:131-144` only checks `authed`, not `isAdmin`

**What goes wrong:** A non-admin user types `/app/admin/users` into the URL; the router guard passes them through (they're authenticated); the page mounts; the API returns 403; the user sees a broken page.
**Why it happens:** The guard only knows about authentication, not authorization.
**How to avoid:** Extend the guard:

```js
const ADMIN_PATHS = ['/app/admin/users'];
router.beforeEach((to, from, next) => {
  if (PUBLIC_PATHS.includes(to.path)) return next();
  if (!to.path.startsWith('/app')) return next();
  const authed = /* existing check */;
  if (!authed) return next('/login');
  if (ADMIN_PATHS.some(p => to.path.startsWith(p))) {
    // Best-effort admin check — read profile from Vuex if available
    const profile = (store && store.state && store.state.profile && store.state.profile.profile);
    if (!profile || profile.admin !== true) return next('/app/dashboard');
  }
  next();
});
```

**Watch:** `profile` might not be loaded yet on cold-reload (App.vue#created loads it async). For a clean UX, also render an "Access denied" banner inside `AdminUsers.vue#created` as a fallback. The 403 from the backend is the real security boundary; the guard is UX polish.

### 6.10 Audit log payload must NOT include the access token

**What goes wrong:** Helpful-but-wrong code stuffs the impersonation JWT into the audit `message` field for "debuggability".
**Why it happens:** Easy mistake when writing `alog.log(admin_owner, 'Impersonation started: token=' + access_token, ...)`.
**How to avoid:** Never log the token. Log the owner IDs only: `alog.log(admin_owner, 'Impersonation started: target=' + target_owner, ['admin', 'impersonation', 'start'])`.
**Warning signs:** Code review or a security scan flags JWT-looking strings in `managed_logs`.

### 6.11 CouchDB design-doc gap: no `owners_by_last_seen` or `_all_users` view

**What goes wrong:** Phase 1 of the admin endpoint listing all users needs an efficient way to enumerate users. The existing `design_users.json` (`/Users/igraczech/Repositories/thinx-device-api/design/design_users.json`) has `owners_by_username`, `owners_by_email`, `owners_by_id`, `owners_by_resetkey`, `owners_by_activation`, and `unseen_only`. None of them yields "all users sorted by last_seen desc".
**Why it happens:** Until now, every owner lookup was keyed (by username, email, owner_id, etc.) — there was no admin use case.
**How to avoid:** Two options:
- (a) Add a new view `owners_by_last_seen` to `design/design_users.json`:
  ```json
  "owners_by_last_seen": {
    "map": "function (doc) { if (doc.owner) { emit(doc.last_seen || 0, doc); } }"
  }
  ```
  Then call `userlib.view("users", "owners_by_last_seen", { descending: true, limit: 200 }, ...)`.
- (b) Use `userlib.list({ include_docs: true })` — `_all_docs` is always available; the admin endpoint sorts/paginates in memory.

**Recommendation: (b)** for v1 — zero schema change, simpler deploy. Switch to (a) if user count exceeds ~500 and the per-call latency becomes noticeable. Document this as part of the plan's design-doc-change-or-not decision.

**Warning signs:** The admin user-list endpoint takes > 1s; users complain.

---

## 7. Decisions to Call Out for the Planner (NOT for the user)

These are implementation details that need a definitive answer in the PLAN.md, but they're not user-facing decisions — Claude/planner picks.

### OQ-1: Where does the admin-check middleware live?

Two options:
- **(a) `lib/middleware/requireAdmin.js`** — new directory, factory function, importable into `router.admin.js`. Cleaner separation; future admin middleware variants (e.g. `requireSuperAdmin` if RBAC ever lands) live in the same dir.
- (b) Inline in `lib/router.admin.js` — one local function declared at the top of the file.

**Recommend (a).** Matches the architecture map and explicitly future-proofs the location. Cost: one new directory + one new file. Worth it.

### OQ-2: Redis key format for the blacklist

Three options:
- **(a) `revoked:owner:{owner}` → `Date.now()` (ms-since-epoch as a string)** — plain SET; one key per revoked owner; check is one `redis.get` per request.
- (b) Sorted set `revoked_sessions` with `{owner}` as member and `Date.now()` as score — overkill for coarse revocation.
- (c) Hash `revoked` with `{owner}` → `Date.now()` — fine, marginally more memory-efficient at very large scale but adds a `HGET` instead of `GET` and the savings only matter at > 10k revoked owners.

**Recommend (a).** Simplest, matches the existing patterns in `router.auth.js:128-129` / `router.github.js:96-97`. The `redis.expire` line gives natural GC after 7 days.

### OQ-3: ImpersonationBanner subscription model — Layout template, Vuex getter, or both?

- **(a) Banner reads JWT directly via `localStorage.accessToken` in `created()` + watches `$route`.** Re-decodes on every route change. Cost: ~1ms per route change. Pros: no Vuex coupling. Cons: doesn't react to mid-session token swap (e.g. impersonation started but no route change).
- (b) Add a Vuex getter `auth/isImpersonating` that decodes on every access; banner uses `mapGetters` + a `watch` to update. Always reactive. Cons: a bit more glue.
- **(c) Both — fire `decode()` in `created()`, `watch: '$route'`, AND when `setAccessToken` is committed.** The cleanest.

**Recommend (c).** The token swap from "admin → impersonating" happens via `auth/setAccessToken`; we want the banner to pick that up immediately, not on the next route change. Easiest way: emit a custom event in the `setAccessToken` mutation, listen in the banner. OR simpler: the impersonate action already does `setAccessToken` + `$router.push` somewhere; rely on `watch: '$route'` to fire `decode()` and accept that there's a one-tick lag on the same-route case. **Practical recommendation: (a) — accept the route-change-coupling.** It's good enough for v1 and the alternative adds an event bus we don't have.

### OQ-4: Router-guard admin path list — hardcoded array or computed from route metadata?

- **(a) Hardcoded `const ADMIN_PATHS = ['/app/admin']` in `Routes.js`** — checked with `to.path.startsWith(p)`. One place to update if/when more admin pages are added.
- (b) Route metadata: `{ path: 'admin/users', meta: { admin: true }, ... }` + guard reads `to.matched.some(r => r.meta.admin)`. More Vue-idiomatic; scales to N admin pages.

**Recommend (a).** v1 has exactly one admin route. Adding meta is over-engineering. Re-evaluate if Phase 11+ adds more.

### OQ-5: setInterval cadence for the countdown

1-second resolution is the right answer (token exp is in seconds; sub-second is wasted work).

**Recommend `setInterval(..., 1000)`.** No RAF, no per-frame anything.

### OQ-6: Where does the per-action impersonation audit log fire?

Two options:
- (a) **In every admin endpoint individually** — `router.admin.js` handlers each end with `if (req.session.impersonator_owner) alog.log(...)`. Explicit; visible in each handler. But the impersonator does most actions OUTSIDE admin endpoints (the whole point of impersonation is to use the regular console as user X) — so this doesn't actually cover the impersonation traffic.
- **(b) Globally — patch `lib/router.js` to add an audit-log call after JWT verify when `req.session.impersonator_owner` is set.** Covers every authenticated request automatically.

**Recommend (b).** Add a small block in `lib/router.js:103-110` right after setting `req.session.impersonator_owner`:

```js
if (payload.impersonator_owner) {
  req.session.impersonator_owner = payload.impersonator_owner;
  alog.log(payload.impersonator_owner,
    `IMPERSONATED ${req.method} ${req.path} as ${payload.username}`,
    ['admin', 'impersonation']);
}
```

The cost is one CouchDB write per impersonated request. Impersonation is bounded (15 min) and low-traffic (one admin debugging one user) so the overhead is acceptable.

### OQ-7: Exit-impersonation flow

CONTEXT.md locks "force re-login". Two implementations:
- **(a) `clearSession()` + `$router.push('/login')` only** — matches `Header.vue#logout` exactly. No server-side call.
- (b) Same + a backend `POST /api/v2/admin/impersonate/exit` that revokes the impersonation token via the same blacklist (using a `jti` claim, which doesn't exist today — needs to be added).

**Recommend (a).** Matches the locked decision. The impersonation token still expires at 15 min on the server side regardless of whether the client throws it away. (b) only matters if §6.3 stolen-token scenario becomes a real threat — defer.

---

## 8. Suggested Wave Breakdown (confirms CONTEXT.md proposal)

The CONTEXT.md proposal is correct. Refining task counts:

### Wave 0 — Cypress Stub (`10-00-PLAN.md`)

**Prereqs:** none.
**Tasks:** 1 (create `vue/cypress/integration/admin.spec.js` with 4 `it()` blocks: ADMIN-01 user-list rendering, ADMIN-02 revoke flow, ADMIN-03 impersonate flow, ADMIN-03 negative — Impersonate hidden on admin rows).
**Deliverable:** 1 new file. No production code.
**Verification:** `cd vue && npx cypress run --spec cypress/integration/admin.spec.js` (will fail at `cy.visit('/#/app/admin/users')` step until Wave 2 lands — that's expected for the stub).

### Wave 1 — Backend (`10-01-PLAN.md`) — PARENT REPO

**Prereqs:** Wave 0 complete (so admin.spec.js exists as a forward-looking contract).
**Tasks:** ~7
1. Create `lib/middleware/requireAdmin.js` (factory function exporting middleware).
2. Patch `lib/thinx/audit.js#log` to accept `flag` as array OR string (`flags: Array.isArray(flag) ? flag : [flag]`).
3. Patch `lib/thinx/jwtlogin.js` — add `sign_with_impersonation(target_owner, impersonator_owner, callback)` method.
4. Patch `lib/router.js:102-113` — add blacklist `redis.get` check; add `req.session.impersonator_owner` injection; add the impersonation-action audit log call (per §7 OQ-6).
5. Create `lib/router.admin.js` with three handlers:
   - `GET /api/v2/admin/users` — returns `[{ owner, username, email, admin, last_seen, device_count }, ...]`. v1: `userlib.list({ include_docs: true })` (per §6.11 (b)); compute `device_count` lazily via `app.device.list(owner, ...)` per row OR batch (decide in plan).
   - `DELETE /api/v2/admin/session/:owner` — `app.redis_client.set('revoked:owner:' + owner, String(Date.now()))` + `expire(..., 7*24*60*60)` + `alog.log(admin_owner, 'Sessions revoked for ' + owner, ['admin', 'revoke'])` + responds `{ success: true }`.
   - `POST /api/v2/admin/impersonate` body `{ owner }` — fetch target via `app.owner.profile(owner, ...)`; reject if `profile.admin === true`; call `app.login.sign_with_impersonation(owner, admin_owner, token => Util.respond(res, { access_token: token }))`. + `alog.log(admin_owner, 'Impersonation started for ' + owner, ['admin', 'impersonation', 'start'])`.
6. Register the new router in `thinx-core.js:358+` — `require('./lib/router.admin.js')(app);` after the existing `router.user.js` require.
7. Smoke-test manually with curl: login as admin → call all three endpoints → verify expected results.

**Deliverable:** 2 new files (`lib/middleware/requireAdmin.js`, `lib/router.admin.js`) + 4 file patches (`audit.js`, `jwtlogin.js`, `router.js`, `thinx-core.js`).
**Verification:** existing parent-repo test suite still passes (`npm test`); manual curl smoke for the three endpoints.

### Wave 2 — Frontend (`10-02-PLAN.md`) — SUBMODULE

**Prereqs:** Wave 1 deployed (so the endpoints exist; otherwise the Vue page can't fetchUsers).
**Tasks:** ~6
1. Create `vue/src/store/admin.js` — Vuex module per §4.5 (`fetchUsers`, `revokeSession`, `impersonate`).
2. Register `admin` in `vue/src/store/index.js`.
3. Create `vue/src/pages/AdminUsers/AdminUsers.vue` — plain `<table>` + pagination + per-row "Revoke" and "Impersonate" with `$bvModal.msgBoxConfirm` (Impersonate hidden when `user.admin === true`).
4. Register `/app/admin/users` in `vue/src/Routes.js` under the `/app` parent's children.
5. Extend `Routes.js#beforeEach` guard with `ADMIN_PATHS` check (per §7 OQ-4).
6. Create `vue/src/components/ImpersonationBanner/ImpersonationBanner.vue` (per §4.6) + mount in `vue/src/components/Layout/Layout.vue` before `<router-view>`.

**Deliverable:** 4 new files + 3 file patches.
**Verification:** `cd vue && npx cypress run --spec cypress/integration/admin.spec.js` passes (with TODO comments still — actual assertions come in a Phase-9-style live-walk).

### Wave 3 — Profile.vue Admin Tab + Sidebar Link (`10-03-PLAN.md`) — SUBMODULE

**Prereqs:** Wave 2 deployed (so the link target exists).
**Tasks:** 2
1. Patch `vue/src/pages/Profile/Profile.vue:138-144` — replace the "not yet available" `<b-card>` with:
   ```vue
   <b-card border-variant="secondary">
     <p class="mb-2">Open the admin console to manage users, revoke sessions, and impersonate non-admin users for support.</p>
     <router-link to="/app/admin/users" class="btn btn-primary btn-sm">Open Admin Console</router-link>
   </b-card>
   ```
2. Patch `vue/src/components/Sidebar/Sidebar.vue` — add a `<NavLink header="Admin" link="/app/admin/users" .../>` conditional on `profile.admin === true` (read via `mapGetters('profile/getProfile')` placed in `methods:` per project convention).

**Deliverable:** 2 file patches. Optional: HUMAN-UAT entry for the live walk (mirroring `08-HUMAN-UAT.md` shape).
**Verification:** Profile tab no longer shows the placeholder text; clicking the link goes to `/app/admin/users`; sidebar shows "Admin" only for admin users.

**Total estimated effort (confirms CONTEXT.md):** backend ~1 week, frontend ~3-4 days, Cypress + manual UAT ~1-2 days. 2 weeks single-dev, faster parallelized after Wave 0.

---

## 9. Risks & Gotchas (top-level — see §6 for details)

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| R1 | Redis blacklist check fails closed → site down on Redis hiccup | HIGH | Fail OPEN on Redis errors (log + next()); accepted in §6.1 |
| R2 | Stolen impersonation JWT valid until exp (no kill switch) | MEDIUM | 15-min TTL bounds blast radius; audit log captures issuance; document as known gap (§6.3 / §7 OQ-7) |
| R3 | Sub-millisecond revocation race window | LOW | Inherent to async writes; accepted (§6.2) |
| R4 | Cold reload during impersonation leaves the impersonation banner up | LOW | Matches locked "force re-login" decision; banner correctly tells the admin what's happening (§6.4) |
| R5 | `mapGetters` accidentally lands in `computed:` (Phase 6 G1 regression) | MEDIUM | Plan-checker / code review must grep for the anti-pattern (§4.7) |
| R6 | `<b-table>` accidentally introduced (CONTEXT.md says to use it) | MEDIUM | Research §0.1 corrects this; plan must explicitly say "plain `<table>`" |
| R7 | Parent-repo + submodule deploy ordering (Wave 1 must land before Wave 2 deploys) | MEDIUM | Wave-level gating in the plan; the CI build of submodule alone won't break, but the live frontend will 404 on `/api/v2/admin/*` until parent ships |
| R8 | Audit-log flag-array semantics break Phase-7 History filter | LOW | The 1-line `audit.js` patch is non-breaking (existing callers still produce single-element arrays); History.vue's filter is already array-aware (§0.4) |
| R9 | CouchDB `_all_docs` over `managed_users` is slow at scale | LOW | Acceptable for v1 (< 200 users); design-doc view is a simple migration path if needed (§6.11) |
| R10 | The per-request CouchDB lookup for admin-check is hot-path | LOW | Admin endpoints are low-traffic; one CouchDB call per admin request is fine; cache later if needed (§0.5) |

---

## 10. Code Examples

### Backend: Complete `requireAdmin.js`

```js
// lib/middleware/requireAdmin.js
const Util = require("../thinx/util");
const Sanitka = require("../thinx/sanitka"); const sanitka = new Sanitka();

module.exports = function (app) {
  return function requireAdmin(req, res, next) {
    if (!Util.validateSession(req)) return res.status(401).end();
    const owner = sanitka.owner(req.session.owner);
    if (typeof (owner) === "undefined") return res.status(401).end();
    app.owner.profile(owner, (success, profile) => {
      if (!success || !profile || profile.admin !== true) {
        return res.status(403).end();
      }
      next();
    });
  };
};
```

### Backend: Complete `router.admin.js` (sketch)

```js
// lib/router.admin.js
const Util = require("./thinx/util");
const Sanitka = require("./thinx/sanitka"); var sanitka = new Sanitka();
const AuditLog = require("./thinx/audit"); var alog = new AuditLog();

module.exports = function (app) {
  const requireAdmin = require("./middleware/requireAdmin")(app);
  const user = app.owner;
  const userlib = user.userlib;  // nano DB handle

  function listUsers(req, res) {
    userlib.list({ include_docs: true }, (err, body) => {
      if (err) return Util.failureResponse(res, 500, "user_list_failed");
      const users = body.rows
        .filter(r => r.doc && r.doc.owner)
        .map(r => ({
          owner: r.doc.owner,
          username: r.doc.username,
          email: (r.doc.info && r.doc.info.email) || r.doc.email,
          admin: r.doc.admin === true,
          last_seen: r.doc.last_seen,
          device_count: 0,  // computed below or in a follow-up batch query — see plan
        }));
      // For v1: respond now with device_count=0 placeholder.
      // For v1.1: aggregate via app.device.list per owner (parallelized).
      Util.responder(res, true, users);
    });
  }

  function revokeSession(req, res) {
    const target_owner = sanitka.owner(req.params.owner);
    const admin_owner = sanitka.owner(req.session.owner);
    if (!target_owner) return Util.failureResponse(res, 400, "missing_owner");
    const key = "revoked:owner:" + target_owner;
    const now_ms = String(Date.now());
    app.redis_client.set(key, now_ms, (serr) => {
      if (serr) return Util.failureResponse(res, 500, "redis_write_failed");
      app.redis_client.expire(key, 7 * 24 * 60 * 60);
      alog.log(admin_owner, "Sessions revoked for " + target_owner, ["admin", "revoke"]);
      Util.responder(res, true, "sessions_revoked");
    });
  }

  function impersonate(req, res) {
    const target_owner = sanitka.owner(req.body.owner);
    const admin_owner = sanitka.owner(req.session.owner);
    if (!target_owner) return Util.failureResponse(res, 400, "missing_owner");
    user.profile(target_owner, (success, profile) => {
      if (!success) return Util.failureResponse(res, 404, "target_not_found");
      if (profile.admin === true) return Util.failureResponse(res, 403, "cannot_impersonate_admin");
      app.login.sign_with_impersonation(target_owner, admin_owner, (token) => {
        if (!token) return Util.failureResponse(res, 500, "token_sign_failed");
        alog.log(admin_owner, "Impersonation started for " + target_owner, ["admin", "impersonation", "start"]);
        Util.responder(res, true, { access_token: token });
      });
    });
  }

  app.get("/api/v2/admin/users", requireAdmin, listUsers);
  app.delete("/api/v2/admin/session/:owner", requireAdmin, revokeSession);
  app.post("/api/v2/admin/impersonate", requireAdmin, impersonate);
};
```

### Frontend: Vuex module + register

```js
// vue/src/store/admin.js (full)
export default {
  namespaced: true,
  state: { users: [] },
  mutations: {
    setUsers(state, users) { state.users = users; },
  },
  actions: {
    async fetchUsers({ commit }) {
      const result = await this.$api.$get('/admin/users');
      if (result.success) commit('setUsers', result.response);
      return result;
    },
    async revokeSession(_, { owner }) {
      return await this.$api.$delete('/admin/session/' + owner);
    },
    async impersonate(_, { owner }) {
      return await this.$api.$post('/admin/impersonate', JSON.stringify({ owner }));
    },
  },
  getters: {
    getUsers(state) { return state.users; },
  },
};
```

```js
// vue/src/store/index.js (patch)
import admin from './admin';   // NEW
// ...
modules: {
  layout, auth, repositories, apikeys, rsakeys, enviros, channels,
  profile, transformers, devices, buildlog, auditlog, stats,
  admin,   // NEW
}
```

### Frontend: Impersonate then store tokens (in AdminUsers.vue)

```js
async confirmImpersonate(user) {
  const ok = await this.$bvModal.msgBoxConfirm(
    `Impersonate ${user.username}? You will be logged in as them for 15 minutes; every action is audit-logged.`,
    { title: 'Impersonate User', okVariant: 'warning', okTitle: 'Impersonate', size: 'sm' }
  );
  if (!ok) return;
  const result = await this.impersonate({ owner: user.owner });
  if (!result.success) {
    this.error = (result.response && result.response.toString()) || 'Failed to impersonate.';
    return;
  }
  const access_token = result.response.access_token;
  // Replace tokens in localStorage (admin's original tokens are gone — locked decision)
  window.localStorage.setItem('accessToken', access_token);
  window.localStorage.removeItem('refreshToken');  // impersonation has no refresh — re-login required
  this.setAccessToken(access_token);    // mapMutations from 'auth'
  this.scheduleExpiry(access_token);    // re-schedules to 15-min exp
  this.$router.push('/app/dashboard');  // exit the admin page; the banner takes over
}
```

---

## 11. State of the Art / Deprecation Notes

Nothing deprecated this phase. All libraries in use are current.

| Old approach | Current approach | When changed | Impact |
|---|---|---|---|
| (none) | (none) | — | — |

---

## 12. Open Questions for the User

Most decisions are locked in CONTEXT.md. Two genuinely open items:

### **Open Question OQ-A:** Sidebar nav entry for the Admin Console — Wave 2 or Wave 3?

The CONTEXT.md doesn't mention sidebar discoverability. Wave 3 only modifies `Profile.vue`. Without a sidebar entry, admins discover the page only via the Profile tab. Two options:

- (a) Skip the sidebar entirely — admins use the Profile tab link. Minimal scope.
- (b) Add a conditional `<NavLink>` to `Sidebar.vue` in Wave 3 (when `profile.admin === true`). One extra line of UX work.

**Recommendation:** **(b)** — minimal addition, big discoverability win. Risk-free; no impact on non-admins.

### **Open Question OQ-B:** Device-count column — Wave 1 or v1.1 follow-up?

The CONTEXT.md user-list spec includes `device_count`. The simplest implementation is one parallelized `app.device.list(owner, ...)` per owner — N+1 query. For < 200 users, this is fine (~500ms total at 100 devices/owner). For larger user counts, we'd want a CouchDB view or a Redis-cached count. Two options:

- (a) Ship `device_count: 0` placeholder in v1; add a v1.1 follow-up for the real count. Simpler ship.
- (b) Ship N+1 query in v1; live with the latency until it matters. Slightly more code in Wave 1.

**Recommendation:** **(a)** for v1 — the placeholder is honest, the planning surface stays small, and admins can already click into individual users for device details. Add a small follow-up plan if/when needed.

(All other CONTEXT.md decisions are locked and no further user input is needed.)

---

## 13. Files

### To Create

| File | Purpose | Req | Wave |
|------|---------|-----|------|
| `vue/cypress/integration/admin.spec.js` | Cypress stub for ADMIN-01..03 | All | 0 |
| `lib/middleware/requireAdmin.js` | Admin-gating middleware factory | ADMIN-01..03 | 1 |
| `lib/router.admin.js` | Three admin endpoints | ADMIN-01..03 | 1 |
| `vue/src/store/admin.js` | Vuex module for admin actions | ADMIN-01..03 | 2 |
| `vue/src/pages/AdminUsers/AdminUsers.vue` | User list + per-row actions | ADMIN-01..03 | 2 |
| `vue/src/components/ImpersonationBanner/ImpersonationBanner.vue` | Sticky banner with countdown + Exit | ADMIN-03 | 2 |

### To Modify

| File | Change | Req | Wave |
|------|--------|-----|------|
| `lib/thinx/audit.js` | `flags: Array.isArray(flag) ? flag : [flag]` (1-line patch) | ADMIN-02, ADMIN-03 | 1 |
| `lib/thinx/jwtlogin.js` | Add `sign_with_impersonation(target_owner, impersonator_owner, callback)` method | ADMIN-03 | 1 |
| `lib/router.js` | Patch JWT-verify block at 102-113 with blacklist check + `req.session.impersonator_owner` injection + impersonation audit log | ADMIN-02, ADMIN-03 | 1 |
| `thinx-core.js` | Add `require('./lib/router.admin.js')(app);` after line 358 | ADMIN-01..03 | 1 |
| `vue/src/store/index.js` | Register `admin` module | All | 2 |
| `vue/src/Routes.js` | Add `/app/admin/users` route + extend `beforeEach` guard with `ADMIN_PATHS` check | ADMIN-01..03 | 2 |
| `vue/src/components/Layout/Layout.vue` | Mount `<ImpersonationBanner />` before `<router-view>` | ADMIN-03 | 2 |
| `vue/src/pages/Profile/Profile.vue` | Replace `:138-144` placeholder `<b-card>` with `<router-link>` to admin | ADMIN-01..03 | 3 |
| `vue/src/components/Sidebar/Sidebar.vue` | Add conditional Admin NavLink (per §12 OQ-A) | All | 3 |
| `.planning/REQUIREMENTS.md` | Add ADMIN-01..03 to v1.1 section + traceability table | — | 3 (or with each wave) |
| `.planning/ROADMAP.md` | Bump Phase 10 row from "Seed" to "In progress" / "Done" with commit refs | — | 3 |

### Explicitly NOT Touched

- `vue/src/store/auth.js` — the existing `clearSession`/`scheduleExpiry` covers exit-impersonation; no changes needed.
- `vue/src/core/api.js` — the existing pre-request exp check (Phase 8 belt-and-suspenders) catches expired impersonation tokens automatically.
- `lib/router.user.js`, `lib/router.profile.js` — read-only references; no edits.
- `lib/thinx/owner.js` — read-only references; `profile()` already returns `admin` (line 319); no edits.
- `design/design_users.json` — `_all_docs` works for v1; design-doc edits deferred unless scale demands it (§6.11).

---

## 14. Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `jsonwebtoken@9.0.3` auto-adds `iat` to every signed token by default | §3.3, Pattern 2 | Verified via official auth0/node-jsonwebtoken docs in-session; if `noTimestamp: true` were set anywhere in the codebase, `iat` would be missing and the blacklist check would no-op. Grep confirms no `noTimestamp` in `lib/thinx/jwtlogin.js`. |
| A2 | The user count will stay under ~500 for v1, making `_all_docs` + client-side pagination acceptable | §6.11, §13 OQ-B | If exceeded, the admin user-list endpoint will slow to > 1s; mitigation is the `owners_by_last_seen` view (§6.11 (a)) — a single design-doc update. Acceptable risk. |
| A3 | `redis@5.8.2` `.legacy()` callback API behaves identically to v3-style callbacks (the codebase's only redis pattern) | §0.2, §4.4 | Verified by inspecting existing usages in `router.auth.js`, `router.github.js`, `router.gdpr.js`, `jwtlogin.js` — all use the callback shape and run in production today. |
| A4 | `req.session` is always defined when the JWT auth path runs (i.e. `req.session.owner = ...` assignment doesn't throw) | §1.2, §4.4 | Verified by reading `router.js:106` (`req.session.owner = payload.username`) — runs unconditionally without a guard, so the Express session middleware must always provide `req.session` (Express's `express-session` always sets it; verified standard behaviour). |
| A5 | `app.owner.profile(owner, callback)` returns within ~10ms on a healthy CouchDB | §0.5, R10 | Cited via existing `router.profile.js:15-21` usage in production. Acceptable for an admin-only path. |
| A6 | `vue-jwt-decode@0.1.0` correctly extracts an `impersonator_owner` claim from the JWT payload | §4.6 | The library just does `JSON.parse(atob(parts[1]))` — any payload field is extracted. Verified by the canonical use in `auth.js#isTokenValid` extracting `exp`. |
| A7 | The submodule's `Layout.vue` is the correct mount point for the impersonation banner | §4.6, Architectural Map | Verified by reading `Layout.vue` — it's the parent of every `/app/*` page; banner placed before `<router-view>` is visible across all admin-impersonated routes. |
| A8 | `bvModal.msgBoxConfirm` returns a Promise that resolves to `true`/`false`/`null` | §1.7, code samples | Verified by inspecting `Profile.vue:299-311 confirmDeleteAccount` — it uses `await this.$bvModal.msgBoxConfirm(...)` + `if (!confirmed) return;` — confirmed working in production. |
| A9 | The audit-log `flags` array can carry arbitrary string values; the History page's `flagFilterOptions` list (`danger`/`warning`/`info`) is a UI default, not a schema constraint | §0.4, §4.7 | Verified by reading `vue/src/pages/History/History.vue:122-127` — it's a hardcoded array of UI checkboxes; the underlying `flags` field accepts any strings. Admins viewing the log will see new `admin`/`impersonation` flags appear as additional badges (they just won't be filterable until the History page's `flagFilterOptions` is extended — a tiny follow-up patch). |
| A10 | The CONTEXT.md "ioredis usage patterns" wording is a documentation error, not a directive to switch libraries | §0.2 | Verified by `grep -rn 'ioredis' /Users/igraczech/Repositories/thinx-device-api/` returning zero results; `redis@5.8.2` is the actual dep. Acting on this assumption (keeping `redis`); risk is minimal since the alternative would require a multi-day rewrite. |

---

## 15. Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Backend dev | ✓ | (project standard) | — |
| Redis (running) | Backend dev/test | ✓ (assumed; same env as Phases 1-9) | `^5.8.2` | — |
| CouchDB (running) | Backend dev/test | ✓ (assumed; same env as Phases 1-9) | `^3.x` (driver: nano `^10.1.4`) | — |
| Cypress | Wave 0 stub | ✓ | `9.5.4` | — |
| BootstrapVue + Vue | Frontend | ✓ | `2.21.2` + `^2.6.14` | — |

No new external dependencies. No fallbacks needed.

---

## 16. Validation Architecture

`workflow.nyquist_validation` is not explicitly disabled in `.planning/config.json` (verified by reading the file in prior phases). Including this section per the agent contract.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Cypress 9.5.4 |
| Config file | `vue/cypress.json` |
| Quick run | `cd vue && npx cypress run --spec cypress/integration/admin.spec.js` |
| Full suite | `cd vue && npx cypress run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADMIN-01 | `/app/admin/users` renders a table of users with pagination | E2E smoke | `cd vue && npx cypress run --spec cypress/integration/admin.spec.js` | ❌ Wave 0 |
| ADMIN-02 | Revoke confirm modal → DELETE → user X's next request 401s | E2E smoke (frontend) + manual curl (backend) | (same; curl smoke as part of Wave 1 deliverable) | ❌ Wave 0 |
| ADMIN-03 | Impersonate confirm → banner appears + countdown ticks | E2E smoke | (same) | ❌ Wave 0 |
| ADMIN-03 (negative) | Impersonate button hidden on admin rows | E2E smoke | (same) | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd vue && npx cypress run --spec cypress/integration/admin.spec.js` (~5-10s)
- **Per wave merge:** `cd vue && npx cypress run` full suite (~1-2 min)
- **Phase gate:** Full suite green + manual UAT walk (`10-HUMAN-UAT.md`, to be created in Wave 3)

### Wave 0 Gaps

- [ ] `vue/cypress/integration/admin.spec.js` — covers ADMIN-01..03 + the ADMIN-03 negative case.

*(All other test infrastructure already exists.)*

---

## 17. Security Domain

`security_enforcement` is not explicitly `false` in `.planning/config.json`; including this section.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing JWT (`jsonwebtoken@9.0.3` HS512); no change |
| V3 Session Management | yes | NEW — Redis blacklist enables admin-driven session termination (this was the gap before Phase 10) |
| V4 Access Control | yes | NEW — `requireAdmin` middleware adds role-based gating to the admin router; impersonation locked to non-admins |
| V5 Input Validation | yes | `sanitka.owner()` already used on every owner-id input; `req.body.owner` for `/impersonate` MUST go through it |
| V6 Cryptography | yes | Reuses existing JWT HS512 (no hand-rolling); Redis secret key unchanged |
| V7 Error Handling & Logging | yes | NEW — audit log gets new flag values (`admin`, `impersonation`, `revoke`); never log JWTs (§6.10) |
| V8 Data Protection | low | No new PII fields; admin list shows existing user fields only |
| V13 API & Web Service | yes | New admin endpoints follow existing pattern: `Util.responder`, parametrized owner lookups, `validateSession` |
| V14 Configuration | low | No new config required |

### Known Threat Patterns for the Admin Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Privilege escalation via tampered `admin` flag | Elevation | `admin` is read server-side from CouchDB by `requireAdmin`; frontend `profile.admin` is informational only. |
| Replay of stolen JWT after session revoke | Repudiation | Redis blacklist + `iat` check in auth middleware. |
| Stolen impersonation JWT used after admin "Exit" | Tampering / Elevation | 15-min hard exp; audit log captures issuance for forensic trail. **Known gap** — no per-token kill switch in v1 (§6.7). Severity LOW because TTL is short and bounded. |
| SSRF via owner-id in impersonation body | Tampering | `sanitka.owner(req.body.owner)` strips bad chars; pattern proven across the codebase. |
| Audit-log spoofing (forged entries) | Repudiation | All `alog.log` calls happen server-side; no `POST /logs/audit` endpoint exists; no path for the client to inject log entries. |
| Cross-admin impersonation (privilege chain) | Elevation | Locked decision: backend rejects when `target.admin === true`. |
| Information disclosure via user list to non-admins | Disclosure | `requireAdmin` 403s before the handler runs. |
| CSRF on `DELETE /admin/session/:owner` | Tampering | Existing `Access-Control-Allow-Credentials` + JWT-in-header (not cookies) defeats CSRF; same as every other authenticated DELETE in the codebase. |

---

## Sources

### Primary (verified by direct file inspection at HEAD `b6c6680`)

- `lib/thinx/jwtlogin.js:1-160` — full JWT signing implementation (`sign`, `sign_with_refresh`, `verify_impl`)
- `lib/router.js:1-205` — auth middleware shape (JWT verify at `102-113`; CORS / session / API-key paths)
- `lib/router.profile.js:1-66` — factory pattern + `validateSession` + `Util.responder` mirror
- `lib/router.user.js:1-80` — factory pattern, password endpoints, `Util.failureResponse` usage
- `lib/router.logs.js:1-182` — confirmed: NO POST /logs/audit endpoint; only GETs
- `lib/router.auth.js:80,97,128-129,201,206,312` — `alog.log` call sites + redis.set/expire usages
- `lib/router.github.js:96-97,111-112` — second redis.set/expire reference
- `lib/router.gdpr.js:49-53` — redis.expire + redis.keys pattern
- `lib/thinx/audit.js:1-68` — full audit lib; `flags: [flag]` schema confirmed
- `lib/thinx/owner.js:66-74,290-322,427,1058-1068` — Owner constructor, `profile()` shape (returns `admin: boolean`), `userlib`, `trackUserLogin` for `last_seen`
- `lib/thinx/util.js:1-100` — `validateSession`, `responder`, `failureResponse`, `respond`
- `design/design_users.json:1-38` — CouchDB design doc; confirms no `_all_users` or `_by_last_seen` view
- `thinx-core.js:85-130,335-358` — redis client setup with `.legacy()` mode + router registration order
- `package.json:46,60,68,76` — `connect-redis ^9.0.0`, `jsonwebtoken ^9.0.3`, `nano ^10.1.4`, `redis ^5.8.2`
- `vue/src/pages/Profile/Profile.vue:85-150,195-313` — Admin tab placeholder + `mapGetters` in `methods:` + `confirmDeleteAccount` modal pattern
- `vue/src/pages/Devices/Devices.vue:47-92` — plain `<table>` pattern (no `<b-table>`)
- `vue/src/pages/History/History.vue:1-220` — plain `<table>` + flag-filter logic (informs §0.4)
- `vue/src/Routes.js:1-146` — hash-mode router + `/app` parent + Phase-8 router.beforeEach guard at 131-144
- `vue/src/store/auth.js:1-105` — `clearSession`, `scheduleExpiry`, `removeAccessToken` (Phase-8 outputs the impersonation flow reuses)
- `vue/src/store/profile.js:1-112` — Vuex module shape to mirror
- `vue/src/store/index.js:1-43` — module registration pattern
- `vue/src/core/api.js:1-130` — token name swap + pre-request exp check (Phase-8 output)
- `vue/src/components/Layout/Layout.vue:1-52` — mount point for the banner
- `vue/src/components/Sidebar/Sidebar.vue:1-95` — sidebar NavLink pattern
- `vue/src/components/Header/Header.vue:108-148` — `logout()` → `clearSession` + `$router.push('/login')` (the canonical "force re-login" shape)
- `vue/cypress/integration/auth-extras.spec.js:1-17`, `vue/cypress/integration/history.spec.js:1-20` — Cypress stub shape
- `vue/package.json:24,38,43,67,76` — `bootstrap-vue 2.21.2`, `vue ^2.6.14`, `vue-jwt-decode 0.1.0` (already imported), `cypress 9.5.4`

### Secondary (referenced via saved memory)

- Memory `thinx-console-vue-conventions` — no new npm deps; `mapGetters` in `methods:`
- Memory `session-expiry-stale-localstorage` — Phase-8 root cause; relevant to ensuring impersonation tokens follow the same teardown
- Memory `ci-thinx-cloud-console` — token name swap in `api.js`
- Memory `gsd-sdk-flat-phase-dirs` — flat `.planning/phase-N/` layout
- Memory `deployment-console-thinx-cloud` — parent-meta-repo bump triggers swarm redeploy
- `.planning/phase-8/08-RESEARCH.md` — format template (mirrored)
- `.planning/phase-10/10-CONTEXT.md` — locked decisions (corrected in §0 where they conflict with codebase)
- `.planning/admin-features-plan.md` — fuller story breakdowns

### Tertiary (web)

- `github.com/auth0/node-jsonwebtoken` README — confirmed `iat` auto-add behaviour (§3.3 / A1)

---

## Metadata

**Confidence breakdown:**

- Standard stack & versions: HIGH — every dep verified by `grep` on the lockfile this session
- Backend code patterns: HIGH — every reference verified by direct file inspection
- Frontend code patterns: HIGH — every reference verified by direct file inspection
- CONTEXT.md corrections (§0): HIGH — each contradiction confirmed against the live codebase
- Architecture decisions (§7 OQ-1..7): MEDIUM-HIGH — based on existing-pattern fit, not external benchmark
- Risk severities (§9): MEDIUM — based on threat-modelling judgement, not measured production data

**Research date:** 2026-05-24
**Valid until:** ~2026-06-24 (stable backend + frontend; the only volatility risk is if Phase 9 closes out and a Phase 11 reorganizes the auth middleware before Phase 10 lands)

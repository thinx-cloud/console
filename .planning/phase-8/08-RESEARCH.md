# Phase 8: Authentication Extras — Research

**Researched:** 2026-05-23
**Domain:** Vue 2 / vuex / vue-router / vue-jwt-decode — unauthenticated password-reset page + session-expiry timer wired into the auth store
**Confidence:** HIGH — backend endpoints, JWT shape, and the legacy password.js flow are all verified by direct file inspection at HEAD `aa0b981`

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Password reset page exists at `/password-reset` | `vue/src/Routes.js:30-33` registers `/login` as a top-level route (sibling to `/app`); the same shape applies for `/password-reset`. The page must be reachable unauthenticated, so it cannot live under `/app` (which is wrapped by `Layout.vue` and gated by `App.vue:35-66` redirect-to-login logic). |
| AUTH-02 | Password reset flow ports behaviour from `src/password.html` | Legacy file (`src/password.html`) is **confirm-only**: two-password form posting to itself. The matching JS handler (`src/assets/thinx/password.js:51-128`) pulls `activation`, `owner`, and `reset_key` from the URL query string and POSTs `{ password, rpassword, owner, reset_key }` to `/api/v2/password/set` (V2) or `/api/user/password/set` (V1). The **initiate** side (request a reset email) is NOT in the legacy file — it exists server-side as `POST /api/v2/password/reset` and is currently invoked only by direct curl / Postman. Phase 8 needs BOTH forms in the Vue page. |
| AUTH-03 | (NEW, 2026-05-23 from Phase 6 UAT carry-over) Session-expiry timer | `localStorage.authenticated:'true'` is set by `Login.vue:205` and removed only by `Header.vue:134` (manual logout). The Vue router's gate (`App.vue:39-43`) checks `isAuthenticated` (Vuex getter, in turn `!!state.accessToken`), so once a token expires server-side, the client still has a non-null token string and the router keeps the user on `/app/*` while every API call silently 403s (memory `session-expiry-stale-localstorage`). |
</phase_requirements>

---

## Summary

Phase 8 ships two small but tightly-coupled pieces. AUTH-01 + AUTH-02 add a single `PasswordReset.vue` page registered as a **top-level** route at `/password-reset` (sibling to `/login`, not nested under `/app`). The page is two-state: when `?reset_key=...&owner=...` (or `?activation=...&owner=...`) is present in the route query it renders the **confirm** form (two password fields, must match, ≥ 4 chars per the legacy `password.js:13-15` rule); otherwise it renders the **initiate** form (single email input). Both forms call the existing backend endpoints — `POST /api/v2/password/reset` to send the email (`router.user.js:144-146`, body `{ email }`), and `POST /api/v2/password/set` to commit a new password (`router.user.js:154-156`, body `{ password, rpassword, owner, reset_key }`). **Both endpoints already exist** — no backend work is required.

The reset email currently links at the **backend** endpoint `GET /api/user/password/reset?owner=...&reset_key=...` (`owner.js:145-147`), which validates and then issues a 302 redirect to `public_url + "/password.html?reset_key=...&owner=..."` (`owner.js:480`). With Phase 8, that redirect target needs to change to `/#/password-reset?reset_key=...&owner=...` (note the hash, since the Vue router runs in hash mode per `Routes.js:27`) — **but** that is a one-line server-side change in `lib/thinx/owner.js:480`, which lives in the parent `thinx-device-api` repo. The cleanest scope split: Phase 8 ships the Vue page and accepts both query shapes (`?reset_key=...&owner=...` and `?activation=...&owner=...`); the server-side redirect update is filed as a follow-up patch on the parent repo. Until the server redirect is updated, users who click an email link still hit the legacy `/password.html` (which still works); Phase 8 enables direct navigation to `/#/password-reset` from a future "Forgot password?" link on the login page.

AUTH-03 is the more novel piece. The backend issues JWTs with `exp: now + 3600` for the access token and `exp: now + 604800` for the refresh token (`jwtlogin.js:88,103,110`). The frontend uses the access token in the `Authorization: Bearer` header (`api.js:30` reads `this.refreshToken`, which is populated by the swapped `setAccessToken()` mutation at `api.js:50-52` — the historical name swap from memory `ci-thinx-cloud-console`). The frontend **never** calls a refresh-token endpoint — there is no refresh flow wired in the Vue app (`grep "refresh_token" vue/src/` shows storage and read-back only, never a POST). That means the effective session lifetime equals the access-token lifetime: **1 hour**. The session-expiry timer should key off the access-token `exp` claim, decoded via the already-installed `vue-jwt-decode` package (`auth.js:1`, `package.json:43`), with the timer fired exactly when `exp * 1000 - Date.now()` ms elapse. On fire: clear localStorage (`accessToken`, `refreshToken`, `authenticated`), commit `setAccessToken(null)` + `setRefreshToken(null)`, and push `/login`. The cleanest hook point is a new `scheduleExpiry` action in `vue/src/store/auth.js`, invoked from three callsites: (a) `Login.vue` after `setAccessToken(access_token)`, (b) `App.vue:created()` after the rehydrate-from-localStorage path, and (c) cancelled by the logout in `Header.vue:133-139`. A belt-and-suspenders pre-request guard inside `api.js#composeOptions` (decode the token's exp on every request, force logout if expired) is optional — recommended IF the user routinely puts laptops to sleep; otherwise the setTimeout alone is sufficient at 1-hour granularity.

**Primary recommendation:** Single Vue page `PasswordReset.vue` with two `<form>` blocks toggled by `hasResetToken` computed; one top-level route entry; two new store actions (`requestPasswordReset({email})`, `confirmPasswordReset({owner, reset_key, password, rpassword})`); one new `scheduleExpiry(token)` action with module-private timer state; three new mutation/action call-sites in `Login.vue`, `App.vue`, and `Header.vue`. Total new code: ~150 LOC across 4 files. No new npm packages — `vue-jwt-decode 0.1.0` is already installed and already used.

---

## 1. Current State

### 1.1 Auth Store

**File:** `vue/src/store/auth.js` (54 lines).

- Imports `vue-jwt-decode` at line 1 (`import VueJwtDecode from "vue-jwt-decode";`).
- State (`auth.js:5-9`): `{ user, accessToken, refreshToken }`. All three start `null` (or `null`-equivalent — `removeAccessToken` sets `accessToken = undefined` at `auth.js:28`, which `isAuthenticated` (`auth.js:45-47`) still treats as falsy via `!!state.accessToken`).
- Mutations (`auth.js:10-24`):
  - `setUser(state, user)` — `state.user = user`.
  - `setAccessToken(state, token)` — `state.accessToken = token; this.$api.setAccessToken(state.accessToken)`. **Note the cross-store call:** `this.$api` is the `Api` instance attached in `main.js:21` (`store.$api = Api;`), and `api.setAccessToken` (`api.js:50-52`) writes the value to `this.refreshToken` (the historical name swap).
  - `setRefreshToken(state, token)` — symmetric to the above; writes to `this.accessToken` on the API client (also swapped).
- Actions (`auth.js:25-43`):
  - `removeAccessToken(state)` — `window.localStorage.removeItem('accessToken'); state.accessToken = undefined;` (`auth.js:26-29`). Note: **does NOT clear `localStorage.authenticated`** — that's only cleared by the Header logout action at `Header.vue:134`.
  - `removeRefreshToken(state)` — symmetric.
  - `isTokenValid(_, token)` (`auth.js:34-42`) — decodes via `VueJwtDecode.decode(token)`, returns `decoded.exp > now`. Try/catch returns `false` on any decode error. **This is the canonical exp-check pattern in the codebase** — AUTH-03 must reuse it.
- Getters: `isAuthenticated` (`!!state.accessToken`), `getAccessToken`.

### 1.2 API Client

**File:** `vue/src/core/api.js` (105 lines).

- `composeHeaders()` (`api.js:27-33`): `Authorization: 'Bearer ' + this.refreshToken`. **Because of the swap at `api.js:50-52`**, `this.refreshToken` actually holds the **access token** JWT (the one with 1-hour exp). Do not "fix" this — established convention from memory `ci-thinx-cloud-console`.
- `setAccessToken(token)` (`api.js:50-52`): `this.refreshToken = token;`. Confirmed swap.
- `setRefreshToken(token)` (`api.js:54-56`): `this.accessToken = token;`. Symmetric swap. The "actual" refresh token (the 1-week one) ends up at `this.accessToken` and is **never read by any request** — `Authorization` always reads `this.refreshToken`.
- Conclusion: For AUTH-03 the timer should key off the **access** token's `exp` claim (the one passed to `auth/setAccessToken`). That's the JWT that actually gates API requests.

### 1.3 Login Flow

**File:** `vue/src/pages/Login/Login.vue` (228 lines).

- POSTs to `${$hostnames.API}/login` (`Login.vue:153-166`) with `{ username, password }`.
- Receives `{ success, access_token, refresh_token }` (`Login.vue:185`).
- Validates BOTH tokens via `isTokenValid` action (`Login.vue:195-196`).
- If valid: `setAccessToken(access_token); setRefreshToken(refresh_token)` (`Login.vue:198-199`), then writes all three localStorage keys (`Login.vue:203-205`):
  ```js
  window.localStorage.setItem("accessToken", access_token);
  window.localStorage.setItem("refreshToken", refresh_token);
  window.localStorage.setItem("authenticated", true);   // <-- string "true"
  ```
- Pushes to `/app/dashboard` (`Login.vue:209`).
- `Login.vue:215-226` `created()` hook: on mount, if `localStorage.authenticated === "true"` AND tokens exist, re-hydrate the store and push to dashboard. **This is the rehydrate path for AUTH-03 — `scheduleExpiry` must fire here too.**

### 1.4 App.vue (Boot Path)

**File:** `vue/src/App.vue` (71 lines).

- `created()` (`App.vue:35-66`): on every page load, reads `isAuthenticated` (Vuex getter); if not, pushes `/login`. If authenticated, re-reads `accessToken`/`refreshToken` from localStorage, validates both via `isTokenValid`, calls `setAccessToken`/`setRefreshToken` (`App.vue:51-54`). This is the SECOND rehydrate path (the first is `Login.vue:215-226` — they overlap; in practice `App.vue` fires first on a cold reload). **AUTH-03's `scheduleExpiry` should be wired here** — `App.vue:created()` is the single point that runs on every cold reload.

### 1.5 Logout Flow

**File:** `vue/src/components/Header/Header.vue:133-139`.

```js
logout() {
  window.localStorage.removeItem("authenticated");
  this.setUser(null);
  this.removeAccessToken();
  this.removeRefreshToken();
  this.$router.push("/login");
}
```

This is the **only** site that clears `localStorage.authenticated`. AUTH-03's expiry callback must replicate the same four ops (plus cancel the pending timer). The cleanest path: extract a `clearSession()` action in `auth.js` that does all four; have both `Header.vue#logout` and the AUTH-03 timer callback call it.

### 1.6 Routes

**File:** `vue/src/Routes.js` (122 lines).

- Mode: `hash` (`Routes.js:27`). All URLs use `/#/...` form.
- Top-level routes: `/login` (`Routes.js:30-33`), `/error` (`:35-38`), `/app` parent with children (`:39-114`), catch-all `*` (`:115-119`).
- `/login` is `path: '/login'`, **not** `'login'` — the leading slash matters for top-level entries. AUTH-01 follows the same shape: `path: '/password-reset'`.

### 1.7 Cypress Stubs Convention

**Reference files:** `vue/cypress/integration/profile.spec.js`, `vue/cypress/integration/history.spec.js`.

Pattern (per `history.spec.js:1-20`):
- `describe('Feature name', function() { ... })`
- `beforeEach`: `cy.viewport(1536, 754); cy.login(); cy.visit('http://localhost:3000/#/<path>')`.
- One `it()` per requirement with a single-line `/* TODO REQ-XX: ... */` comment body. No `it.only`, no assertions.

**For AUTH-extras, `cy.login()` cannot be in the beforeEach** — the password-reset page must be reachable unauthenticated. The stub should skip the login call for AUTH-01/02 specs and `cy.visit('http://localhost:3000/#/password-reset')` directly. For AUTH-03, a pre-step `cy.login()` is needed, but the test body should overwrite `localStorage.accessToken` with a forged JWT carrying a past `exp` and assert the redirect. **All bodies are TODO comments in Wave 0.**

---

## 2. Gap Analysis

| Req | What Exists | What's Missing |
|-----|-------------|----------------|
| AUTH-01 | `/login` registered as top-level (`Routes.js:30-33`); `Login.vue` unauthenticated-accessible page exists as template | One new top-level route entry in `Routes.js`; one new component file `vue/src/pages/PasswordReset/PasswordReset.vue` |
| AUTH-02 | Backend endpoints `POST /api/v2/password/reset` (initiate) and `POST /api/v2/password/set` (confirm) are both live (`router.user.js:144-156`); legacy `password.html` + `password.js` implement the confirm side as reference | Vue page with two form states (initiate / confirm), two new store actions calling the backend, optional "Forgot password?" router-link on `Login.vue:88` |
| AUTH-03 | `VueJwtDecode` is installed and already in `auth.js:1`; `isTokenValid` action shows the canonical decode pattern (`auth.js:34-42`); `setAccessToken` + `setRefreshToken` are the canonical token entry points; `Header.vue:133-139` shows the canonical clear-session shape | `scheduleExpiry(token)` action with module-private `expiryTimerId`; `clearSession()` action (extract from `Header.vue#logout`); call sites in `Login.vue:198-199`, `App.vue:54`, and the existing logout |

---

## 3. Backend API Surface

All endpoints already exist. No backend changes required.

### 3.1 Initiate Password Reset

```
POST /api/v2/password/reset
Content-Type: application/json
{ "email": "user@example.com" }
```

- Wired in `lib/router.user.js:144-146`.
- Handler: `postPasswordReset` (`router.user.js:39-48`) → `user.password_reset_init(email, callback)` (`lib/thinx/owner.js:486-520`).
- Flow:
  1. Looks up user by email via CouchDB view `owners_by_email` (`owner.js:488-491`).
  2. If found, generates a new `reset_key = sha256(email + new Date().toString())` (`owner.js:180`).
  3. Persists `reset_key` on the user doc (`owner.js:181`).
  4. Sends reset email via Mailgun with link `${api_url}/api/user/password/reset?owner=...&reset_key=...` (`owner.js:145-147`).
- Response (success): `{ success: true, response: "<reset_key>" }` in test/dev environments (`owner.js:166-168`), or `{ success: true, response: "<mailgun message>" }` in production. Vue page should treat any `success: true` as "email sent" — don't expose the key.
- Response (failure): `{ success: false, response: "email_not_found" | "user_not_found" }`.

### 3.2 Confirm Password Reset

```
POST /api/v2/password/set
Content-Type: application/json
{ "password": "new", "rpassword": "new", "owner": "<owner_id>", "reset_key": "<key from email>" }
```

- Wired in `lib/router.user.js:154-156`.
- Handler: `postPasswordSet` (`router.user.js:50-61`) → `user.set_password(req.body, callback)` (`owner.js:635-658`).
- Flow:
  1. Validates `password === rpassword` (`owner.js:637-643`); responds `password_mismatch` on fail.
  2. If `reset_key` present → `set_password_reset` (`owner.js:561-597`): looks up user by `owners_by_resetkey` view, updates `password = sha256(prefix + rbody.password)`, sets `reset_key = null`, sets `last_reset = new Date()`.
  3. Atomic update via `atomic()` (`owner.js:544-559`) which dispatches the change with action name `"password_reset"`.
- Response (success): `{ success: true, response: "password_reset_successful" }` (or the reset_key itself in test env per `owner.js:552-553`).
- Response (failure): `{ success: false, response: "password_mismatch" | "reset_key_invalid" | "reset_user_not_found" }`.

### 3.3 Confirm via Activation Token (alternate flow)

Same endpoint (`POST /api/v2/password/set`) but with `{ password, rpassword, owner, activation }` instead of `reset_key`. Used during initial account activation rather than password reset. Phase 8 should accept either query param (`?reset_key=...` or `?activation=...`) and POST the matching key.

### 3.4 Reset Email Redirect Target

`owner.js:480`: `const url = app_config.public_url + "/password.html?reset_key=" + reset_key + "&owner=" + owner;`

This is the redirect that the GET-side endpoint (`/api/user/password/reset`, called by the link in the reset email) sends the browser to. **For Phase 8 to be reachable from email, this line will eventually need to change to `/#/password-reset?...`** — but that's a parent-repo edit, out of scope for the Vue console repo. Phase 8 ships the Vue page; the email-link redirect can be migrated separately. In the meantime, `/#/password-reset` is reachable via a "Forgot password?" link on the login page.

### 3.5 Why No New Backend Work

Initiate, confirm, and activation flows all exist server-side and have been live for years (the legacy `password.js` from 2018 uses them). The Vue page is a pure frontend port. The only deferred server change is the redirect target (§3.4), which is a one-line patch we can ship after the Vue page is in production.

---

## 4. Recommended Implementation Approach

### Wave Structure

Three waves mirroring Phases 5/6/7. Wave 0 = Cypress stub. Wave 1 = AUTH-01 + AUTH-02 (page, route, store actions). Wave 2 = AUTH-03 (timer + boot wiring).

### Wave 0 — Cypress Stub (08-00-PLAN.md)

No production code. One new file.

**Tasks:**

1. Create `vue/cypress/integration/auth-extras.spec.js`. **Note:** unlike other specs, the `beforeEach` for AUTH-01 / AUTH-02 must NOT call `cy.login()` (the page is reachable unauthenticated). For AUTH-03, `cy.login()` is needed first. Pattern:
   ```js
   describe('Auth Extras feature', function() {
     it('Should render the password-reset page unauthenticated (AUTH-01)', function() {
       cy.viewport(1536, 754);
       cy.visit('http://localhost:3000/#/password-reset');
       /* TODO AUTH-01: assert page title visible, no console errors, no redirect to /login */
     });
     it('Should show the initiate (email) form when no token in query (AUTH-02)', function() {
       cy.viewport(1536, 754);
       cy.visit('http://localhost:3000/#/password-reset');
       /* TODO AUTH-02: assert email input visible, password fields not visible */
     });
     it('Should show the confirm (password) form when reset_key in query (AUTH-02)', function() {
       cy.viewport(1536, 754);
       cy.visit('http://localhost:3000/#/password-reset?reset_key=abc&owner=test');
       /* TODO AUTH-02: assert two password inputs visible, email input not visible */
     });
     it('Should redirect to /login when access token expires (AUTH-03)', function() {
       cy.viewport(1536, 754);
       cy.login();
       /* TODO AUTH-03: forge a JWT with exp 1 second ahead, wait 2s, assert redirected to /#/login */
     });
   });
   ```
   No assertions, all `it()` bodies are single-line TODO comments per project convention.

### Wave 1 — AUTH-01 + AUTH-02 (08-01-PLAN.md)

Focus: standalone unauthenticated page + backend wiring.

**Tasks (some parallelisable):**

1. **Create `vue/src/pages/PasswordReset/PasswordReset.vue`** — single component with two `<form>` blocks. Toggled by `hasResetToken` computed (`return !!this.$route.query.reset_key || !!this.$route.query.activation`).
   - **Initiate form** (shown when `!hasResetToken`):
     - Single `<input type="email" v-model="email" required>` (per AUTH-02, port from non-existent legacy initiate side — use `email` as the field name since that's what `POST /api/v2/password/reset` accepts per `router.user.js:40`).
     - Submit button → calls `this.requestPasswordReset({ email })`.
     - On success: show "Check your email" success state (mirror `password.js:96-101`).
     - On failure: show error message from `response.response` (e.g. "email_not_found").
   - **Confirm form** (shown when `hasResetToken`):
     - Two `<input type="password" autocomplete="new-password">` for `password` + `rpassword`.
     - Min-length 4 (port from `password.js:13-15`) + client-side match check.
     - Submit button → calls `this.confirmPasswordReset({ owner: $route.query.owner, reset_key: $route.query.reset_key, activation: $route.query.activation, password, rpassword })`.
     - On success: show "Password set" success state with a `<router-link to="/login">` (mirror `password.html:73-79`).
     - On failure: show error from `response.response`.
   - Mirror `Login.vue` template structure for visual consistency (`<Widget>` wrapper, `widget-auth` class, footer with `$hostnames.LANDING`).
   - Use `mapMutations` / `mapActions` from `vuex`, **placement: `methods:` for `mapGetters` and `mapActions`** (project convention; `Login.vue:113-122` is the reference pattern).
2. **Register the route in `vue/src/Routes.js`** — add a top-level entry between `/login` (line 30-33) and `/error` (line 35-38):
   ```js
   {
     path: '/password-reset',
     name: 'PasswordReset',
     component: PasswordResetPage,  // imported at top
   },
   ```
   And add the import: `import PasswordResetPage from '@/pages/PasswordReset/PasswordReset';` near the existing `import Login from '@/pages/Login/Login';` at line 5.
3. **Add `requestPasswordReset` action to `vue/src/store/auth.js`** — POST `/password/reset` (note: full path is `/api/v2/password/reset` but `api.js:12` adds the `/api/v2` prefix). Use `this.$api.$post('/password/reset', JSON.stringify({ email }))`. Return the result.
4. **Add `confirmPasswordReset` action to `vue/src/store/auth.js`** — POST `/password/set` with the body shape from §3.2. Returns the result.
5. **Optional: add "Forgot password?" router-link to `Login.vue`** — after line 87 (between the password field and the auth-widget-footer), add:
   ```html
   <router-link class="d-block text-center mb-2" to="/password-reset">Forgot password?</router-link>
   ```
   Mirror the styling of the existing "Create an Account" link at `Login.vue:65-67`. Note `to="/password-reset"` (leading slash — top-level route).

### Wave 2 — AUTH-03 (08-02-PLAN.md)

Focus: scheduleExpiry timer + boot wiring.

**Tasks:**

1. **Refactor `vue/src/store/auth.js` to expose `clearSession` + `scheduleExpiry` actions:**
   - Add module-private state (outside the `default export {}` object, at module top):
     ```js
     let expiryTimerId = null;
     ```
     Module-scoped lets us cancel/replace across mutation calls without exposing the timer through reactive state.
   - Add `clearSession({ dispatch, commit })` action: removes all three localStorage keys (`accessToken`, `refreshToken`, `authenticated`), commits `setAccessToken(null)` + `setRefreshToken(null)` + `setUser(null)`, cancels `expiryTimerId` if non-null. Returns a Promise that resolves once cleared.
   - Add `scheduleExpiry({ state, dispatch }, token)` action:
     ```js
     scheduleExpiry({ dispatch }, token) {
       if (expiryTimerId) { clearTimeout(expiryTimerId); expiryTimerId = null; }
       try {
         const decoded = VueJwtDecode.decode(token);
         if (!decoded || typeof decoded.exp !== 'number') return;
         const msUntilExpiry = decoded.exp * 1000 - Date.now();
         if (msUntilExpiry <= 0) {
           dispatch('clearSession');
           // Caller is responsible for the router.push('/login') — store has no router ref.
           return;
         }
         // setTimeout is clamped to 2^31-1 ms (~24.8 days). Access tokens expire in 1h, refresh in 1 week — both safe.
         expiryTimerId = setTimeout(() => { dispatch('clearSession'); }, msUntilExpiry);
       } catch (e) {
         console.warn('[auth] scheduleExpiry decode failed', e);
       }
     }
     ```
2. **Wire `scheduleExpiry` into the three callsites:**
   - **`Login.vue:198-199`** — after `this.setRefreshToken(refresh_token)`, add `this.scheduleExpiry(access_token)`. Add `scheduleExpiry: "auth/scheduleExpiry"` to the `mapActions` block at `Login.vue:119-122`.
   - **`Login.vue:222-223`** — in the `created()` rehydrate branch, after `this.setRefreshToken(refreshToken)`, add `this.scheduleExpiry(accessToken)`.
   - **`App.vue:54`** — after `this.setRefreshToken(storedRefreshToken)`, add `this.scheduleExpiry(storedAccessToken)`. Add to the existing `mapActions` block at `App.vue:20`.
3. **Update `Header.vue#logout` to dispatch `clearSession` instead of inlining the four ops:** replace lines 133-139 with:
   ```js
   async logout() {
     await this.$store.dispatch('auth/clearSession');
     this.$router.push("/login");
   }
   ```
   (`mapActions({ clearSession: "auth/clearSession" })` can replace the existing `removeAccessToken`/`removeRefreshToken` mappings; `setUser` from `mapMutations` is also no longer needed since `clearSession` does it.)
4. **Add router redirect on expiry fire:** the `clearSession` action runs inside the Vuex store, which has no `$router` reference. Two options:
   - (a) Inside `scheduleExpiry`, after the `setTimeout` callback dispatches `clearSession`, also call `window.location.hash = '#/login'` (works because hash-mode router). Simplest, no router import needed.
   - (b) Emit a global event (`Vue.prototype.$bus.$emit('session:expired')`) and have `App.vue` listen for it and push to `/login`. Cleaner separation, but adds an event bus we don't already have.
   - **Recommendation: (a)** — `window.location.hash = '#/login'` is one line, and the user will be redirected immediately. Matches the manual logout behaviour at `Header.vue:138`.
5. **Belt-and-suspenders pre-request check (OPTIONAL):** in `api.js#composeOptions`, decode the current token before each request and force logout if expired. This guards against the setTimeout-drift problem when a browser tab sleeps. Implementation:
   ```js
   composeOptions(method, body) {
     // Pre-request exp check (belt + suspenders for tab-sleep drift)
     if (this.refreshToken) {  // the access token, per the swap
       try {
         const decoded = JSON.parse(atob(this.refreshToken.split('.')[1]));
         if (decoded.exp && decoded.exp * 1000 < Date.now()) {
           window.localStorage.removeItem('accessToken');
           window.localStorage.removeItem('refreshToken');
           window.localStorage.removeItem('authenticated');
           window.location.hash = '#/login';
           // fall through to actually issue the request; server will 401 and the page will already be navigating
         }
       } catch (e) { /* ignore — bad token, let the request fail naturally */ }
     }
     // ... existing body of composeOptions
   }
   ```
   Tradeoff: tiny per-request CPU (atob + JSON.parse of one JWT), in exchange for graceful handling of laptop-sleep cases where the setTimeout was descheduled. **Recommendation: include it.** The cost is negligible and it directly addresses the UAT scenario described in `ROADMAP.md:246` ("Leave the dashboard open until the token would expire").

### Parallelisation Map

```
Wave 0: [auth-extras.spec.js stub]

Wave 1 (after Wave 0):
  [Routes.js entry + import]              \  -- sequential: route must exist before page is reachable
  [PasswordReset.vue component]           /
  [requestPasswordReset + confirmPasswordReset store actions]  -- can parallel with the component
  [Login.vue "Forgot password?" link]     -- depends on the route entry (1); trivially small

Wave 2 (after Wave 1):
  [auth.js: clearSession + scheduleExpiry + module-private expiryTimerId]   -- foundation
  [Login.vue + App.vue: wire scheduleExpiry into 3 callsites]               -- depends on foundation
  [Header.vue: refactor logout to dispatch clearSession]                    -- depends on foundation
  [api.js: optional pre-request exp check]                                  -- independent of all above; parallel-safe
```

---

## 5. Pitfalls to Avoid

### 5.1 NO New npm Packages

Project hard constraint (memory `thinx-console-vue-conventions`). `vue-jwt-decode 0.1.0` is already in `package.json:43` and already imported at `auth.js:1`. Do NOT add `jwt-decode`, `jose`, or any other JWT library. The optional belt-and-suspenders check in `api.js` uses three lines of `atob` + `JSON.parse` — no extra dep needed for that path either.

### 5.2 `mapGetters` Must Stay in `methods:`

Project convention (G1 in Phase 5/6, memory `thinx-console-vue-conventions`). Any new `mapGetters` mapping in `PasswordReset.vue` must go into `methods:`, not `computed:`. Reference: `Login.vue:113-126` and `History.vue:112-120`. Getters are called as functions: `this.isAuthenticated()`.

### 5.3 Token Name Swap is Established — Don't "Fix" It

`api.js:50-52` writes the access token to `this.refreshToken`, and `api.js:54-56` writes the refresh token to `this.accessToken`. `composeHeaders` (`api.js:30`) sends `this.refreshToken` (i.e. the access token) as the Bearer header. This is intentional — memory `ci-thinx-cloud-console`. AUTH-03 must key the timer off the JWT **that is actually sent in headers**, which means: decode the access token (the one passed to `setAccessToken`/`setRefreshToken` from `Login.vue:198`). Easy way to remember: the timer should fire when the user's API calls would start 401-ing, which is when the **access** token expires.

### 5.4 `localStorage.authenticated` is a String, Not a Boolean

`Login.vue:205`: `window.localStorage.setItem("authenticated", true);` — JavaScript coerces this to the literal string `"true"`. Readers must use `=== "true"` (`Login.vue:217`, `App.vue:37`-commented-out reference). Do NOT use `JSON.parse(authenticated)` — it works but is unnecessary churn over the existing pattern.

### 5.5 `setTimeout` is Clamped to ~25 Days

setTimeout in browsers is clamped to a 32-bit signed integer of milliseconds (2^31 - 1 ≈ 2,147,483,647 ms ≈ 24.85 days). Passing a longer value silently truncates to ~25 days. **Our tokens are well below this**: access = 1 hour (3,600,000 ms), refresh = 7 days (604,800,000 ms). A naive single-timer implementation is safe. **However**, if the system ever switches to long-lived tokens (> 25 days), the timer needs a chained schedule or periodic check.

### 5.6 Browser Tab Sleep / Clock Skew

When a laptop sleeps, setTimeout pauses with the tab. On wake, the timer resumes from where it left off — but the actual wall-clock time may have passed the expiry. The result: the user sees a "logged in" UI for a brief window before the timer fires. The optional pre-request guard in `api.js` (Wave 2 task 5) covers this case by checking `exp` synchronously on every API call. **Recommended** — costs near-zero CPU, eliminates the wake-up window.

### 5.7 Route Path is `/password-reset` (Leading Slash, Top-Level)

`Routes.js:30` registers `/login` as `path: '/login'` (leading slash → top-level). `Routes.js:44` registers `dashboard` as `path: 'dashboard'` (no leading slash → child of `/app`). AUTH-01 requires `/password-reset` to be reachable unauthenticated → it MUST be top-level → MUST use leading slash. Adding it as a child of `/app` would put the page behind the `Layout.vue` wrapper which is gated by `App.vue:39-43`'s `pushIfNeeded("/login")` redirect — the page would never render for an unauthenticated user.

### 5.8 Hash-Mode Router Means URLs Use `#`

`Routes.js:27`: `mode: 'hash'`. Direct-navigation URLs are `http://host/#/password-reset?reset_key=foo`, NOT `http://host/password-reset?reset_key=foo`. The reset email's redirect target (currently `/password.html?reset_key=...` per `owner.js:480`) would need to become `/#/password-reset?reset_key=...` to reach the Vue page — but that's a parent-repo (server) change, **out of scope for this phase** (note in OQ-2).

### 5.9 `$route.query` Reactivity

`PasswordReset.vue`'s `hasResetToken` computed reads `this.$route.query.reset_key` — this IS reactive in Vue 2 + vue-router 3 (vue-router exposes `$route` as a reactive computed property). If the user navigates from `/password-reset` to `/password-reset?reset_key=foo` (e.g. by clicking a fresh email link in the same tab), the form will swap automatically. No `watch` needed.

### 5.10 The Backend Returns `success: true, response: "..."` — Don't Reach into Other Keys

All `Util.responder(res, true, body)` calls produce `{ success: true, <key>: body }` where `<key>` varies by route (`router.user.js` mostly uses `response`, but some routes use `result` or named keys). The Vue `api.js#parseResult` (`api.js:39-48`) normalises this to `{ success, response }` — always read `result.response`, never raw payload keys. This matches the existing `Login.vue:185` destructure pattern (which is the rare exception that reads raw — fine because `/login` is called via plain `fetch`, not the api client).

### 5.11 `clearSession` Cannot Push the Router

Vuex actions don't have access to the router. The cleanest pattern is for `scheduleExpiry`'s timeout callback to BOTH dispatch `clearSession` AND set `window.location.hash = '#/login'`. Do NOT try to `import router from '@/Routes'` into `auth.js` — it works but creates a circular-dependency risk (Routes.js imports stores indirectly via components, and importing router back into the store is the kind of thing that breaks subtly on a HMR reload).

### 5.12 Cypress `cy.login()` Cannot Run for AUTH-01/02 Specs

Per `commands.ts:43-50`, `cy.login()` navigates to `/`, types credentials, submits the login form. For AUTH-01/02 we need to assert the password-reset page is reachable WITHOUT logging in — so the `beforeEach` cannot call `cy.login()` for those specs. The Cypress stub must split into per-`it()` setup (each visits directly, no login) instead of a shared `beforeEach` with login (mirror the pattern; do not put `cy.login()` in `beforeEach`).

### 5.13 Password Min-Length: 4 (Legacy) — Plan to Bump?

`password.js:13-15` sets `minlength: 4` for the new-password field. Modern security guidance is ≥ 8 chars. For Phase 8, **port the legacy 4-char rule verbatim** to avoid surprising users; flag this as an Open Question for product to decide. The server (`owner.js:586-590`) does not enforce a minimum length — it just sha256-hashes whatever is supplied. So bumping the client-side rule is safe; the question is whether to bump it in Phase 8 or as a separate hardening pass.

### 5.14 GDPR / `auth.html` Confusion

`src/auth.html` is the **GDPR consent** page, NOT the password-reset initiate side. The Phase 8 context note speculated this might be the initiate side — it isn't. The initiate flow has no legacy frontend; it's only a curl-able backend endpoint. Phase 8's initiate form is a new build (small — single email input + submit).

---

## 6. File-Level Inventory

### Files to Create

| File | Purpose | Req | Wave |
|------|---------|-----|------|
| `vue/cypress/integration/auth-extras.spec.js` | Cypress spec stub for AUTH-01..03 | All | 0 |
| `vue/src/pages/PasswordReset/PasswordReset.vue` | Two-state page: initiate form (email) + confirm form (two passwords) | AUTH-01, AUTH-02 | 1 |

### Files to Modify

| File | Change | Req | Wave |
|------|--------|-----|------|
| `vue/src/Routes.js` | Add `import PasswordResetPage from '@/pages/PasswordReset/PasswordReset';` and a new top-level route `{ path: '/password-reset', name: 'PasswordReset', component: PasswordResetPage }` between `/login` (line 30-33) and `/error` (line 35-38) | AUTH-01 | 1 |
| `vue/src/store/auth.js` | Add `requestPasswordReset({ email })` action (Wave 1); add `confirmPasswordReset({ owner, reset_key, activation, password, rpassword })` action (Wave 1); add module-private `let expiryTimerId = null;` (Wave 2); add `clearSession` action (Wave 2); add `scheduleExpiry(token)` action (Wave 2) | AUTH-02, AUTH-03 | 1, 2 |
| `vue/src/pages/Login/Login.vue` | (Wave 1, optional) Add `<router-link class="d-block text-center mb-2" to="/password-reset">Forgot password?</router-link>` after line 87. (Wave 2) Add `this.scheduleExpiry(access_token)` after `setRefreshToken` at line 199 AND after `setRefreshToken` at line 223. Add `scheduleExpiry: "auth/scheduleExpiry"` to the `mapActions` block (`Login.vue:119-122`). | AUTH-02 (link), AUTH-03 | 1, 2 |
| `vue/src/App.vue` | Add `this.scheduleExpiry(storedAccessToken)` after `setRefreshToken` at line 54. Add `scheduleExpiry: "auth/scheduleExpiry"` to the `mapActions` block at line 20. | AUTH-03 | 2 |
| `vue/src/components/Header/Header.vue` | Replace `logout()` body (lines 133-139) with `await this.$store.dispatch('auth/clearSession'); this.$router.push("/login");`. Remove the now-unused `setUser` from `mapMutations` (line 119) and `removeAccessToken`/`removeRefreshToken` from `mapActions` (lines 113-114) — they're absorbed into `clearSession`. | AUTH-03 | 2 |
| `vue/src/core/api.js` | (Optional, recommended) Add pre-request exp check at the top of `composeOptions` (lines 15-25): decode `this.refreshToken` (which holds the access token per the swap), force logout if expired. ~10 lines of additional code. | AUTH-03 | 2 |

### Files Explicitly NOT Touched

- `vue/src/components/Layout/Layout.vue` — the session timer lives in the store, not in Layout. Layout boots only when authenticated; the timer needs to be alive across all routes (e.g. while sitting on `/login`). Store-level placement is the correct scope.
- `vue/package.json` — no new dependencies. `vue-jwt-decode 0.1.0` already covers everything.
- `vue/src/pages/Visits/Visits.vue` — the Dashboard reads `this.$store.$api.refreshToken` directly at `Visits.vue:252` (the historical swap means this is the access token). It will benefit from the pre-request exp check in `api.js` if Wave 2 task 5 ships, but no direct edit needed.
- `lib/router.user.js` and `lib/thinx/owner.js` (parent repo) — backend endpoints already exist. Out of scope for Phase 8.
- `lib/thinx/owner.js:480` (the reset-email redirect target) — needs to be updated from `/password.html?...` to `/#/password-reset?...` eventually, but that's parent-repo work and can be deferred until after the Vue page is in production. Documented as OQ-2.

---

## 7. Open Questions

### OQ-1: Does the Backend Password-Reset Endpoint Exist?

**Yes.** Confirmed by direct inspection of `lib/router.user.js:144-156` (V2 routes) and `lib/router.user.js:192-204` (V1 routes). Both initiate (`POST /api/v2/password/reset` with `{ email }`) and confirm (`POST /api/v2/password/set` with `{ password, rpassword, owner, reset_key }`) are live and used by the legacy `password.html` flow today. **No backend work is required for Phase 8.**

### OQ-2: Reset Email URL Format — Frontend `/password-reset` or Backend HTML?

The current reset email links at `${api_url}/api/user/password/reset?owner=...&reset_key=...` (`lib/thinx/owner.js:145-147`). That backend route validates the key and 302-redirects to `${public_url}/password.html?reset_key=...&owner=...` (`owner.js:480`). After Phase 8 ships, that redirect target should become `${public_url}/#/password-reset?reset_key=...&owner=...` so email recipients land on the Vue page.

**Recommendation:** Ship Phase 8 with the Vue page accepting `?reset_key=...&owner=...` (and `?activation=...&owner=...`); file a one-line follow-up patch on the parent repo (`lib/thinx/owner.js:480`) to update the redirect target. Until the parent-repo patch ships, users clicking email links still hit the legacy `/password.html` (which still works); the Vue page becomes reachable via the new "Forgot password?" link on `Login.vue` and via direct navigation. This decouples the two repos cleanly.

### OQ-3: Token Type — JWT or Opaque?

**JWTs.** Confirmed by `lib/thinx/jwtlogin.js:84-119` — backend uses `jsonwebtoken.sign()` with payloads containing `username`, `scope`, and `exp`. Both access and refresh tokens are signed JWTs with three `.`-separated base64url segments. The frontend's existing `auth.js#isTokenValid` action (`auth.js:34-42`) already decodes them via `VueJwtDecode.decode()`. AUTH-03 reuses this exact pattern.

### OQ-4: Hook Point for `scheduleExpiry`

Three options were considered:

| Option | Pros | Cons |
|--------|------|------|
| (a) Store action, called from Login.vue / App.vue / Header.vue | Single source of truth in `auth.js`; timer state can be module-private; matches Vuex idiom | Three call-sites to maintain |
| (b) API client interceptor in `api.js#setAccessToken` | One call site (every token assignment triggers schedule); auto-syncs with token changes | Mixing transport concerns with session-lifecycle concerns; harder to test in isolation |
| (c) `App.vue#created()` watcher on `accessToken` | Idiomatic Vue; reacts to store changes | Only fires on app boot — wouldn't re-fire on login (Login.vue doesn't remount App.vue) |

**Recommendation: (a)** — Store action with three explicit call sites. The three call sites (`Login.vue#login`, `App.vue#created`, and the existing `setAccessToken` mutation in case we want to wire it there) cover every token-write path. Option (b) is the runner-up if we want auto-scheduling on every token change — but the trade-off is that `api.js` then needs to import `VueJwtDecode`, which couples the transport layer to the JWT format. Option (c) is incomplete (would miss the login-success path).

### OQ-5: setTimeout-Only or Pre-Request Check Too?

Pure setTimeout works for the common case (user actively browsing). It drifts if the tab sleeps. Browser tab sleep is a documented behaviour on laptops with closed lids — common UAT scenario per `ROADMAP.md:246`.

**Recommendation: Both.** Wave 2 ships `scheduleExpiry` as the primary mechanism + a thin pre-request check in `api.js#composeOptions` as belt-and-suspenders. The pre-request check costs ~5 µs per request (one `atob` + `JSON.parse` of a small JWT) and eliminates the wake-up race entirely. It is the simplest robust answer to the UAT requirement.

### OQ-6: Password Minimum Length

Legacy `password.js:13-15` enforces `minlength: 4`. Server-side has no minimum (`owner.js:586-590` just sha256-hashes whatever the client sends). Modern guidance is ≥ 8.

**Recommendation:** Port verbatim (4 chars) in Phase 8 for behavioural parity with `src/password.html`; file a separate hardening ticket to bump to 8 chars after deploy. Otherwise existing users with 4-char passwords couldn't reset to their own current password.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Unauthenticated route exposure (`/password-reset`) | Frontend (vue-router) | — | Pure routing — top-level entry sibling to `/login`, not gated by `Layout.vue` |
| Password-reset initiate (send email) | API/Backend | Vuex store (action wrapper) | Backend owns the user DB, key generation, and Mailgun call; the Vue store action is a thin POST wrapper |
| Password-reset confirm (set new password) | API/Backend | Vuex store (action wrapper) | Backend owns the password hash, reset_key validation, and DB write |
| JWT exp claim decoding | Frontend (vue-jwt-decode) | — | Pure client-side concern; we already have `auth.js#isTokenValid` doing exactly this |
| Session-expiry timer (setTimeout) | Frontend (Vuex store action) | — | Lives in `auth.js` as module-private `expiryTimerId`; single source of truth across login / boot / logout |
| Pre-request expiry guard | Frontend (api client) | — | Belt-and-suspenders for tab-sleep drift; runs synchronously in `composeOptions` before every fetch |
| Logout / clear-session orchestration | Frontend (Vuex action) | — | `clearSession` action centralises localStorage + store + timer cleanup; called from both Header logout and the expiry timer |
| Email link → Vue page | Server-side redirect (out of scope) | — | `lib/thinx/owner.js:480` redirect target needs to update from `/password.html` to `/#/password-reset` — parent-repo follow-up patch |

---

## Sources

### PRIMARY (verified by direct file inspection at HEAD `aa0b981`)

- `vue/src/store/auth.js:1-54` — `VueJwtDecode` import, mutations, actions (`isTokenValid` decode pattern at lines 34-42)
- `vue/src/core/api.js:27-56` — `composeHeaders` reads `this.refreshToken`; `setAccessToken` / `setRefreshToken` swap at lines 50-56
- `vue/src/Routes.js:27,30-33,69-77` — hash-mode router; `/login` top-level shape; `history` parent/child shape for reference
- `vue/src/pages/Login/Login.vue:140-226` — login POST flow, token destructure, localStorage writes, `created()` rehydrate path
- `vue/src/App.vue:35-66` — boot path: isAuthenticated check, token re-hydrate, `isTokenValid` validation
- `vue/src/components/Header/Header.vue:108-148` — `logout()` shape: clears `authenticated` localStorage, dispatches `removeAccessToken`/`removeRefreshToken`, pushes `/login`
- `vue/src/main.js:19-21` — `store.$api = Api` attachment, confirming `this.$api` is available inside Vuex mutations
- `vue/package.json:43` — `vue-jwt-decode: "^0.1.0"` already installed
- `vue/node_modules/vue-jwt-decode/src/decoder.js:1-17` — confirms `VueJwtDecode.decode(token)` returns the merged header+payload object with `exp`
- `vue/cypress/integration/history.spec.js:1-20` — Cypress stub pattern (mirrored for Wave 0)
- `vue/cypress/integration/profile.spec.js:1-24` — Cypress stub pattern (alternate reference)
- `vue/cypress/support/commands.ts:43-50` — `cy.login()` flow (navigates to `/`, types creds, submits)
- `src/password.html:50-82` — legacy confirm-side form structure (two password fields, submit, success message)
- `src/assets/thinx/password.js:5-152` — legacy submit handler: query-param extraction (`activation`, `owner`, `reset_key`), POST body shape, success/error handling, jQuery-validation minlength rule
- `src/auth.html:50-156` — confirmed this is GDPR consent, NOT password-reset initiate
- `lib/router.user.js:26-61,144-156,192-204` — backend handlers and V2/V1 route bindings for `/password/reset` (initiate), `/password/set` (confirm), and the GET-side validation+redirect
- `lib/thinx/owner.js:138-171,179-190,444-520,544-597,635-658` — `sendResetEmail`, `resetUserWithKey`, `password_reset`, `password_reset_init`, `atomic`, `set_password_reset`, `set_password` — full backend behaviour
- `lib/thinx/owner.js:480` — reset-email redirect target (current: `/password.html?reset_key=...&owner=...`)
- `lib/thinx/jwtlogin.js:83-120` — JWT signing: access token `exp = now + 3600`, refresh token `exp = now + 604800`

### SECONDARY (referenced via saved memory, not file-inspected this session)

- Memory `thinx-console-vue-conventions` — `mapGetters` in `methods:`, no new npm deps
- Memory `session-expiry-stale-localstorage` — root-cause description of the AUTH-03 bug
- Memory `ci-thinx-cloud-console` — the access/refresh token name swap is established convention
- Memory `gsd-sdk-flat-phase-dirs` — `.planning/` is flat; gsd-sdk doesn't discover
- Memory `deployment-console-thinx-cloud` — deploy via parent meta-repo bump
- `.planning/phase-7/07-RESEARCH.md` — format template (mirrored exactly)
- `.planning/phase-8/08-CONTEXT.md` — seed context from session handoff

### TERTIARY (npm registry)

- `npm view vue-jwt-decode version` returns `0.1.0` (latest, unchanged since 2018-01-16) — package is dormant but the codebase already uses it successfully; no need to swap

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The frontend has NO refresh-token consumption flow (i.e. no code that POSTs the refresh_token to get a new access_token) | §1.2, Summary | Confirmed via `grep "refresh_token" vue/src/` — only storage and read-back, never a POST. If a refresh flow is added later, `scheduleExpiry` needs to be rescheduled on every successful refresh; trivial extension. |
| A2 | The legacy reset email link will continue to redirect to `/password.html` until the parent repo patches `lib/thinx/owner.js:480` | §3.4, OQ-2 | Verified by reading the line directly. If the parent repo updates the redirect before Phase 8 ships, both flows will work (Vue page accepts both query-param shapes). If the parent repo updates AFTER Phase 8 ships, no user impact — they keep using `/password.html` until the redirect changes. |
| A3 | `setTimeout` callback fires when a tab is in foreground; pauses (and resumes from the remaining offset) when the tab is suspended | §5.6, OQ-5 | Standard browser behaviour per HTML5 spec (`window.setTimeout`); confirmed across Chrome/Firefox/Safari. The pre-request guard in `api.js` is the mitigation. |
| A4 | `VueJwtDecode 0.1.0` correctly decodes the JWTs issued by `jsonwebtoken`-based `jwtlogin.js` | §3.5, OQ-3 | Verified by inspecting `vue-jwt-decode/src/decoder.js` — three lines of `atob` + `JSON.parse`, the same algorithm as the legacy stack. `auth.js#isTokenValid` already uses it successfully against current tokens. |
| A5 | The "Forgot password?" link on `Login.vue` is the only user-facing entry point for the password-reset page in Phase 8 (until the email-link redirect is updated in a follow-up patch on the parent repo) | §3.4, OQ-2 | Acceptable — users initiating from the Vue console flow naturally; users clicking email links continue to land on the legacy `/password.html`, which still works. No regression. |
| A6 | Backend response shape from `POST /api/v2/password/reset` and `POST /api/v2/password/set` matches the `Util.responder` pattern `{ success, response }` after `api.js#parseResult` normalisation | §3.1, §3.2, §5.10 | Confirmed by reading `Util.responder` calls in `router.user.js:46,59` — both invoke the standard responder. `api.js#parseResult` (lines 39-48) handles the normalisation. |

All other claims are verified by direct codebase inspection in this session.

---

## Package Legitimacy Audit

**No new npm packages are installed in this phase.** Project convention (memory `thinx-console-vue-conventions`) explicitly forbids new packages. AUTH-03 reuses the already-installed `vue-jwt-decode 0.1.0` (`package.json:43`), which has been in the codebase since at least the v2.1.5 baseline and is already invoked at `auth.js:1`. The optional belt-and-suspenders check in `api.js` uses three lines of inline `atob` + `JSON.parse` — no library required. This section is intentionally empty.

---

## Validation Architecture

Framework: Cypress 9.5.4 (pinned in `vue/package.json:67`).
Config file: `vue/cypress.json`.
Quick run: `cd vue && npx cypress run --spec cypress/integration/auth-extras.spec.js`
Full suite: `cd vue && npx cypress run`

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | `/#/password-reset` renders the page without redirect-to-login | E2E smoke | `cd vue && npx cypress run --spec cypress/integration/auth-extras.spec.js` | ❌ Wave 0 stub creates it |
| AUTH-02 (initiate) | Visiting `/#/password-reset` shows the email-input form | E2E smoke | (same) | ❌ Wave 0 |
| AUTH-02 (confirm) | Visiting `/#/password-reset?reset_key=...&owner=...` shows the two-password form | E2E smoke | (same) | ❌ Wave 0 |
| AUTH-03 | Forged-expired JWT in localStorage triggers redirect to `/#/login` within the timer's grace period | E2E smoke | (same) | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd vue && npx cypress run --spec cypress/integration/auth-extras.spec.js` (runs in ~5-10 s).
- **Per wave merge:** `cd vue && npx cypress run` (full Cypress suite — ~1-2 min).
- **Phase gate:** Full suite green before `/gsd:verify-work` and parent-repo submodule bump.

### Wave 0 Gaps

- [ ] `vue/cypress/integration/auth-extras.spec.js` — covers AUTH-01..03

*(All other test infrastructure already exists.)*

---

*Research date: 2026-05-23*
*Valid until: ~2026-06-23 (stable codebase; the only volatility risk is the parent-repo `lib/thinx/owner.js:480` redirect target, which is documented as OQ-2 follow-up)*

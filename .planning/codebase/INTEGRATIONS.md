# External Integrations
*Generated: 2026-05-18 | Focus: tech*

## Overview

This console frontend integrates with a backend API service (`api` at port 7442) for all data, and several third-party services for monitoring, analytics, maps, and chat. Both the legacy AngularJS app (`src/`) and the Vue app (`vue/`) share the same set of external services but configure them differently.

---

## Internal Service: THiNX API Backend

**The primary integration is the internal THiNX API backend.** The console is a pure frontend; all business logic lives in the API service.

**Vue app client:** `vue/src/core/api.js` — `ThinxApi` class

**Base URL:** `process.env.VUE_APP_API_HOSTNAME` (falls back to `window.location.origin`)

**API path prefix:** `/api/v2`

**Transport:** Fetch API with `credentials: 'include'`; Bearer token in `Authorization` header

**Auth tokens:** Access token and refresh token stored in `window.localStorage`; JWT expiry validated locally with `vue-jwt-decode`

**Endpoints used by Vue Vuex store:**

| Vuex Module | HTTP Methods | Endpoint(s) |
|-------------|-------------|-------------|
| `devices` | GET, POST, DELETE | `/device`, `/device/configuration`, `/build`, `/transfer/request` |
| `repositories` | GET, POST, DELETE | `/source` (inferred) |
| `apikeys` | GET, POST, DELETE | `/apikey` (inferred) |
| `rsakeys` | GET, POST, DELETE | `/rsakey` (inferred) |
| `enviros` | GET, POST, DELETE | `/enviro` (inferred) |
| `channels` (mesh) | GET, PUT, DELETE | `/mesh` |
| `transformers` | GET, POST, DELETE | `/transformer` (inferred) |
| `buildlog` | GET | `/buildlog` (inferred) |
| `auditlog` | GET | `/auditlog` (inferred) |
| `stats` | GET | `/stats`, `/stats/today` |
| `profile` | GET, POST, DELETE | `/profile`, `/user` |

**Legacy app client:** `src/app/js/thinx-api.js` — plain jQuery/Angular `$http` calls using `<ENV::apiBaseUrl>` and `<ENV::wssUrl>` tokens injected at Gulp build time.

**Nginx reverse proxy** (both Dockerfiles) proxies these paths to `http://api:7442`:
- `/api/` — REST API
- `/login` — authentication endpoint
- `/logout` — session teardown
- `/device/` — device-scoped requests
- `^/[0-9a-f]{64}(/[^/]+)?$` — WebSocket upgrade for owner-scoped connections

---

## WebSocket Connection

**Used in:** Legacy AngularJS app only (`src/app/js/controllers/LogviewController.js`)

**Not present** in the Vue app — no WebSocket connections found in `vue/src/`.

**Legacy usage:**
- Connects to `<ENV::wssUrl>/<owner_id>` for real-time build log streaming and notifications
- Opens a second connection at `<ENV::wssUrl>/<owner_id>/<timestamp>` for log tailing
- Configured at Gulp build time via the `wssUrl` env variable (derived from `API_BASEURL` or `API_HOSTNAME`)

---

## Authentication

**Strategy:** Username/password form POST to the backend `/login` endpoint; the backend sets session cookies. Tokens (JWT) are stored in `localStorage` by the Vue app.

**OAuth social login (Vue app only):**
- **GitHub OAuth:** Links to `{API_HOSTNAME}/api/v2/oauth/github` (`vue/src/pages/Login/Login.vue` line 72)
- **Google OAuth:** Links to `{API_HOSTNAME}/api/v2/oauth/google` (`vue/src/pages/Login/Login.vue` line 80)

Both OAuth flows are server-side redirects — the frontend merely links to the API endpoint and receives a session/token on callback.

**JWT validation:** Local check only via `vue-jwt-decode` in `vue/src/store/auth.js` — validates token expiry before considering user authenticated.

---

## Error Monitoring: Rollbar

**SDKs:**
- Vue app: `vue-rollbar` ^1.0.0 (`vue/src/main.js`)
- Legacy app: `tandibar/ng-rollbar` (CDN-loaded AngularJS module, `src/app/js/main.js`)

**Configuration:**
- Vue: conditionally initialized only when `VUE_APP_ROLLBAR_ACCESS_TOKEN` matches `/^[0-9a-f]{32}$/i` — silently skipped if not set
- Legacy: access token injected at build time via `<ENV::rollbarAccessToken>`

**Captures:** Uncaught exceptions; reports environment (`production` / `development`)

**Required env var:**
- Vue: `VUE_APP_ROLLBAR_ACCESS_TOKEN`
- Legacy (Docker build ARG): `ROLLBAR_ACCESS_TOKEN`

---

## Customer Chat: Crisp

**SDKs:**
- Vue app: `@dansmaculotte/vue-crisp-chat` ^0.1.0 (`vue/src/main.js`)
- Legacy app: Inline script snippet in `src/app/index.html` loading `https://client.crisp.chat/l.js`

**Configuration:**
- Vue: `websiteId: process.env.VUE_APP_CRISP_WEBSITE_ID`, initialized with `disabled: true` and `hideOnLoad: true`
- Nginx CSP includes `wss://client.relay.crisp.chat` in `connect-src`

**Required env var:**
- Vue: `VUE_APP_CRISP_WEBSITE_ID`
- Legacy / Docker: `CRISP_WEBSITE_ID`

---

## Analytics: Google Analytics (Universal Analytics)

**Used in:** Legacy app only (`src/app/index.html`)

**Implementation:** Classic `analytics.js` snippet with `ga('create', '<ENV::googleTrackingCode>', 'auto')`

**Not present** in the Vue app (no GA/gtag references found in `vue/src/`)

**Required env var (legacy Docker build):** `GOOGLE_ANALYTICS_ID`

---

## Maps: Google Maps

**SDKs:**
- Vue app: `vue2-google-maps` 0.10.7 — initialized in `vue/src/main.js` with `key: process.env.VUE_APP_GOOGLE_MAPS_APIKEY`
- Legacy app: Google Static Maps API via `<img>` tag in `src/app/views/device.html` with key `<ENV::googleMapsApikey>`

**Usage:** Displaying device geolocation (lat/lon) in device detail view

**Required env var:**
- Vue: `VUE_APP_GOOGLE_MAPS_APIKEY`
- Legacy / Docker: `GOOGLE_MAPS_APIKEY`

---

## Third-Party Fonts and Icons

| Resource | Source | Used in |
|----------|--------|---------|
| Google Fonts (Open Sans) | `//fonts.googleapis.com` | Legacy `src/app/index.html` |
| Font Awesome 4.7.0 | npm package | Vue app |
| Line Awesome 1.3.0 | npm package | Vue app |
| Glyphicons Halflings | npm package | Vue app |
| Simple Line Icons | Local assets | Legacy app |

---

## Slack Integration

**Not a third-party SDK.** The user profile object in the legacy app (`src/app/js/thinx-api.js` line 1091) includes a `slack_token` field — this is data passed to the backend API, not a direct Slack SDK integration in the frontend.

The Gulp build injects a hardcoded `slackClientId: '233115403974.233317554391'` into the env object for use in frontend links.

---

## Environment Variables

### Vue app (`vue/`) — required at build time

| Variable | Purpose |
|----------|---------|
| `VUE_APP_API_HOSTNAME` | Base URL of the THiNX API backend |
| `VUE_APP_CONSOLE_HOSTNAME` | URL of this console app |
| `VUE_APP_LANDING_HOSTNAME` | URL of the marketing/landing site |
| `VUE_APP_ROLLBAR_ACCESS_TOKEN` | Rollbar error tracking token |
| `VUE_APP_CRISP_WEBSITE_ID` | Crisp chat website ID |
| `VUE_APP_GOOGLE_MAPS_APIKEY` | Google Maps JavaScript API key |
| `VUE_APP_GOOGLE_ANALYTICS_ID` | Google Analytics tracking ID (passed through, unused in Vue) |
| `NODE_ENV` | Controls lint-on-save, productionTip, Rollbar environment |

A `.env` file exists at `vue/.env` but its values are not read here (forbidden). Variable names are sourced from `vue/src/main.js`, `vue/src/mixins/hostnames.js`, and `vue/Dockerfile`.

### Legacy app (`src/`) — required at Gulp build time

| Variable | Purpose |
|----------|---------|
| `API_BASEURL` | Full base URL for API (takes precedence for WebSocket URL derivation) |
| `API_HOSTNAME` | API hostname (fallback) |
| `WEB_HOSTNAME` | Console/web hostname |
| `LANDING_HOSTNAME` | Landing page URL |
| `COMPOSE_PROJECT_NAME` | Docker Compose project name |
| `ENVIRONMENT` | `production` enables minification; otherwise development |
| `ENTERPRISE` | `true` removes OSS-specific UI blocks |
| `GOOGLE_ANALYTICS_ID` | GA tracking code |
| `ROLLBAR_ACCESS_TOKEN` | Rollbar token |
| `CRISP_WEBSITE_ID` | Crisp chat ID |
| `GOOGLE_MAPS_APIKEY` | Google Maps API key |
| `COMMIT_ID` | Git commit hash (first 8 chars used as version code) |
| `VERSION_CODE` | Fallback version code if COMMIT_ID not set |

All are injected into JS/HTML/CSS at Gulp build time via `gulp-inject-envs` replacing `<ENV::varName>` tokens.

---

## Network / API Communication Patterns

### Vue app

- All API calls go through the singleton `ThinxApi` instance (`vue/src/core/api.js`) stored on the Vuex store as `this.$api`
- Methods: `$get(path)`, `$post(path, body)`, `$put(path, body)`, `$delete(path, body)`
- Request bodies are serialized with `JSON.stringify()` before passing to the API class
- Responses are parsed: if `result.success === true`, the first non-`success` key is extracted as `response`
- Failed responses (non-ok HTTP, empty body, parse error) return `{ success: false, status, response }`
- No retry logic; no request queuing or cancellation

### Legacy app

- jQuery AJAX / AngularJS `$http` via `src/app/js/thinx-api.js`
- WebSocket for real-time log streaming (`src/app/js/controllers/LogviewController.js`)

---

## Nginx Proxy Configuration

Both apps use `default.conf` to proxy paths to the backend at `http://api:7442`:

```
/api/*         → http://api:7442  (REST API)
/login         → http://api:7442  (auth)
/logout        → http://api:7442  (session end)
/device/*      → http://api:7442  (device endpoints)
/[64-hex-chars] → http://api:7442 (WebSocket upgrade, owner-scoped)
```

Static assets are served from `/usr/share/nginx/html` for all other paths.

---

*Integration audit: 2026-05-18*

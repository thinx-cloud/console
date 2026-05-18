# Technology Stack
*Generated: 2026-05-18 | Focus: tech*

## Overview

This repository contains **two separate frontend applications** that coexist side-by-side:

1. **Legacy AngularJS app** (`src/`) — the original console, built with Gulp + AngularJS 1.x, served as static HTML via Nginx.
2. **Vue console** (`vue/`) — a modern replacement built with Vue 2 + Vue CLI + Webpack, served by the same Nginx container or a Node.js Express server.

---

## Languages

**Primary:**
- JavaScript (ES6+) — all application logic in both `src/` and `vue/src/`
- HTML / CSS — templates and stylesheets throughout

**Secondary:**
- TypeScript ~4.5.5 — present in `vue/` devDependencies; tsconfig.json targets `es5`/`es2015`, but source files are `.js`/`.vue`. TypeScript is declared but not actively used in application code.

---

## Runtime

**Environment:**
- Node.js 22.15 — pinned inside `vue/Dockerfile` via NVM (`NODE_VERSION="22.15"`)
- No `.nvmrc` or `engines` field found; version is Dockerfile-authoritative
- `NODE_OPTIONS=--openssl-legacy-provider` set in Vue Dockerfile (required for Webpack 4 on Node 17+)

**Package Managers:**
- **npm** with `npm-shrinkwrap.json` — used in `src/` (legacy app)
- **Yarn** — used in `vue/` (lockfile: `vue/yarn.lock`); Dockerfile runs both `npm install` and `yarn`

---

## Frameworks

### Vue app (`vue/`)

| Framework | Version | Purpose |
|-----------|---------|---------|
| Vue | ^2.6.14 | Core UI framework |
| Vuex | ^3.6.2 | Centralized state management |
| Vue Router | ^3.5.1 | Client-side routing (hash mode) |
| BootstrapVue | 2.21.2 | UI component library |
| Bootstrap | ^4.6.0 | CSS framework |

### Legacy app (`src/`)

| Framework | Version | Purpose |
|-----------|---------|---------|
| AngularJS 1.x | CDN-loaded (not in package.json) | Core MVC framework |
| ui.router | CDN-loaded | State-based routing |
| ui.bootstrap | CDN-loaded | Bootstrap-wrapped UI components |

---

## Build Tools

### Vue app (`vue/`)

| Tool | Version | Purpose |
|------|---------|---------|
| @vue/cli-service | ^5.0.8 | Webpack-based build + dev server |
| Webpack (via CLI) | 4 (bundled) | Module bundling |
| Babel | via @vue/cli-plugin-babel | ES6+ transpilation |
| Sass | ^1.49.9 | CSS pre-processing |
| sass-loader | ^7.3.1 | Webpack Sass integration |
| Vite | ^2.9.5 | Listed in devDependencies — used for Cypress component dev server only, NOT primary build tool |

**Build command:** `yarn build` → `vue-cli-service build` → outputs to `vue/dist/`

**Dev server:** `vue-cli-service serve --port 3000` with proxy to `https://console.thinx.cloud`

### Legacy app (`src/`)

| Tool | Version | Purpose |
|------|---------|---------|
| Gulp | ^3.9.1 | Task runner (build pipeline) |
| gulp-inject-envs | ^1.1.1 | Replaces `<ENV::varName>` tokens with env values at build time |
| gulp-remove-code | ^3.0.4 | Conditionally strips code blocks for production/enterprise builds |
| gulp-uglify-es | ^3.0.0 | JS minification in production |
| gulp-clean-css | ^4.3.0 | CSS minification |
| gulp-sass | ^5.1.0 | SASS compilation |
| gulp-concat | ^2.6.1 | Bundling |
| gulp-sourcemaps | ^2.6.5 | Source map generation |

**Build commands:**
- `npm run build` → `gulp dev` → outputs to `src/html/`
- `npm run buildAll` → `gulp prod` → outputs to `src/html/` with minification and bundling

---

## Key Dependencies

### Vue app (`vue/`)

**Charts and Visualization:**
- `apexcharts` ^3.24.0 + `vue-apexcharts` ^1.6.0
- `chart.js` ^2.9.4 + `vue-chartjs` ^3.5.1
- `highcharts` ^9.0.0 + `highcharts-vue` ^1.3.5
- `echarts` ^5.5.1 + `vue-echarts` ^4.1.0
- `@amcharts/amcharts4` ^4.10.13 + `@amcharts/amcharts4-geodata` ^4.1.19

**Code Editor:**
- `codemirror` 5 + `vue-codemirror` 4 — used in Transformer editor (`vue/src/pages/Transformers/TransformerEditor.vue`)

**Maps:**
- `vue2-google-maps` 0.10.7

**Date/Time:**
- `vue-moment` ^4.1.0 — wraps moment.js (moment overridden to 2.29.4)

**UI Extras:**
- `v-calendar` ^1.1.1
- `vue-toasted` ^1.1.28
- `animate.css` ^4.1.1

**Auth/Security:**
- `vue-jwt-decode` ^0.1.0 — local JWT expiry validation

**Error Monitoring:**
- `vue-rollbar` ^1.0.0

**Chat:**
- `@dansmaculotte/vue-crisp-chat` ^0.1.0

**Production Server:**
- `express` + `serve-static` + `helmet` — used in `vue/server.js` to serve `dist/` on port 7440

### Legacy app (`src/`)

**Runtime:**
- `negotiator` 0.6.3
- `qs` 6.15.0

---

## Testing

### Vue app (`vue/`)

| Tool | Version | Purpose |
|------|---------|---------|
| Cypress | ^9.5.4 | E2E testing |
| start-server-and-test | ^1.14.0 | Orchestrates dev server + Cypress |
| @cypress/vite-dev-server | ^2.2.2 | Component test server |

**Test commands:**
```bash
yarn test       # start dev server then run cy:test
yarn cy:test    # cypress run (headless)
yarn cy:open    # cypress open (interactive)
```

Config: `vue/cypress.json` — baseUrl `http://localhost:3000`, 10s default timeout

### Legacy app (`src/`)

| Tool | Version | Purpose |
|------|---------|---------|
| Cypress | ^9.4.1 | E2E testing |
| nyc | ^15.1.0 | Code coverage (includes `src/**/*.js`) |
| coveralls | ^3.1.1 | Coverage reporting |

---

## Linting

**Vue app:**
- ESLint ^8.5.0 with `plugin:vue/essential`, `@vue/eslint-config-prettier`, Prettier ^2.5.1
- `eslint-plugin-cypress` ^2.12.1

**Legacy app:**
- ESLint ^8.7.0 with `eslint-config-angular`, `eslint-plugin-angular`, `eslint-plugin-jquery`

---

## Browser Targets (Vue app)

Defined in `vue/package.json` `browserslist`:
```
> 1%
last 2 versions
not ie <= 8
```

---

## Deployment

Both apps are containerized with Docker and served behind Nginx:

- **Base build image:** `thinxcloud/console-build-env` (legacy) / `thinxcloud/console-build-env:vue` (Vue)
- **Serving image:** `nginx:1.29.3-alpine`
- **Port exposed:** 7440 (mapped to container port 80)
- Nginx config: `src/default.conf` and `vue/default.conf` — proxies `/api/`, `/login`, `/logout`, `/device/` to internal `api:7442`

---

## Notable Scripts Summary

### Vue app (`vue/package.json`)
```bash
yarn serve        # dev server on :3000 with proxy to console.thinx.cloud
yarn build        # production webpack build → dist/
yarn lint         # ESLint with auto-fix
yarn start        # node server.js (serves dist/ via Express on PORT || 7440)
yarn test         # start server + run Cypress E2E
yarn cy:open      # open Cypress UI
```

### Legacy app (`src/package.json`)
```bash
npm run build      # gulp dev (development build → html/)
npm run buildAll   # gulp prod (production build with minification)
npm run start      # http-server ./html -p 8080
npm run cy         # start server + run Cypress E2E
npm run lint       # eslint
```

---

*Stack analysis: 2026-05-18*

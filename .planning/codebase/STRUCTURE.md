# Codebase Structure
*Generated: 2026-05-18 | Focus: arch*

## Directory Layout

```
console/                          # Service root
├── .planning/                    # GSD planning documents
│   └── codebase/                 # Generated architecture maps
├── .circleci/                    # CI pipeline configuration
├── dev/                          # Dev helper scripts/configs
├── src/                          # LEGACY AngularJS 1.x app (deprecated)
│   ├── app/
│   │   ├── js/
│   │   │   ├── main.js           # AngularJS app bootstrap (module "RTM")
│   │   │   ├── thinx-api.js      # Legacy API client
│   │   │   ├── directives.js     # AngularJS directives
│   │   │   └── controllers/      # AngularJS controllers (one per page)
│   │   ├── tpl/                  # HTML partial templates (sidebar, header, etc.)
│   │   └── views/                # Full-page HTML views
│   ├── assets/
│   │   ├── global/               # Third-party CSS, plugins (jQuery, moment, etc.)
│   │   └── thinx/               # Auth/login JS, custom dashboard JS
│   ├── html/                     # Duplicate of src/ (built/deployed output copy)
│   ├── cypress/                  # Legacy E2E test suite for AngularJS app
│   └── gulpfile.js               # Legacy build pipeline
└── vue/                          # ACTIVE Vue 2 SPA
    ├── src/                      # Application source (primary development target)
    │   ├── main.js               # Vue app entry point, plugin registration
    │   ├── App.vue               # Root component, auth guard
    │   ├── Routes.js             # Vue Router configuration
    │   ├── config.js             # Static color palette config
    │   ├── core/
    │   │   ├── api.js            # ThinxApi HTTP client class
    │   │   └── screenHelper.js   # Responsive breakpoint utility
    │   ├── mixins/
    │   │   ├── layout.js         # Global mixin: appConfig.colors, decodeHtml
    │   │   └── hostnames.js      # Hostname resolution from env vars
    │   ├── store/
    │   │   ├── index.js          # Vuex store root, module assembly
    │   │   ├── auth.js           # Auth tokens, JWT validation
    │   │   ├── layout.js         # Sidebar open/close state
    │   │   ├── devices.js        # Device list, CRUD, build, transfer
    │   │   ├── profile.js        # User profile fetch/update
    │   │   ├── repositories.js   # Source repository CRUD
    │   │   ├── apikeys.js        # API key management
    │   │   ├── rsakeys.js        # RSA deploy key management
    │   │   ├── enviros.js        # Environment global variables
    │   │   ├── channels.js       # Mesh channel management
    │   │   ├── transformers.js   # Status transformer CRUD
    │   │   ├── buildlog.js       # Build log fetch + normalization
    │   │   ├── auditlog.js       # Audit event log
    │   │   └── stats.js          # Dashboard statistics
    │   ├── components/           # Shared UI components
    │   │   ├── Layout/
    │   │   │   └── Layout.vue    # Authenticated shell (Sidebar + Header + router-view)
    │   │   ├── Sidebar/
    │   │   │   ├── Sidebar.vue   # Nav menu
    │   │   │   └── NavLink/
    │   │   │       └── NavLink.vue
    │   │   ├── Header/
    │   │   │   └── Header.vue    # Top bar, logout, profile avatar
    │   │   ├── Helper/
    │   │   │   └── Helper.vue    # Contextual help widget
    │   │   ├── Notifications/
    │   │   │   └── Notifications.vue
    │   │   ├── Widget/
    │   │   │   └── Widget.vue    # Generic card wrapper
    │   │   ├── List/
    │   │   │   └── List.vue      # Generic table/list component
    │   │   ├── Form/
    │   │   │   └── Form.vue      # Generic form wrapper
    │   │   ├── Loader/
    │   │   │   └── Loader.vue    # Loading spinner
    │   │   └── Sparklines/
    │   │       └── Sparklines.vue
    │   ├── pages/                # Route-level page components
    │   │   ├── Login/
    │   │   │   └── Login.vue     # Username/password + OAuth login
    │   │   ├── Error/
    │   │   │   └── Error.vue     # 404 / error fallback
    │   │   ├── Visits/
    │   │   │   ├── Visits.vue    # Dashboard: stat cards, audit log, build log
    │   │   │   └── components/   # Dashboard sub-components (AreaChart, Calendar, Map)
    │   │   ├── Devices/
    │   │   │   ├── Devices.vue   # Device list, revoke/transfer/push config actions
    │   │   │   └── DeviceDetail.vue  # Single device metadata + edit form
    │   │   ├── Repositories/
    │   │   │   └── Repositories.vue
    │   │   ├── Apikeys/
    │   │   │   └── Apikeys.vue
    │   │   ├── Rsakeys/
    │   │   │   └── Rsakeys.vue
    │   │   ├── Enviros/
    │   │   │   └── Enviros.vue
    │   │   ├── Channels/
    │   │   │   └── Channels.vue
    │   │   ├── Transformers/
    │   │   │   ├── Transformers.vue       # Transformer list
    │   │   │   └── TransformerEditor.vue  # CodeMirror editor for transformer JS body
    │   │   ├── History/
    │   │   │   └── History.vue   # Build + audit log combined view
    │   │   └── Profile/
    │   │       └── Profile.vue   # User profile editing
    │   ├── styles/               # Global SCSS
    │   │   ├── theme.scss        # Main style entry (imported by App.vue)
    │   │   ├── _variables.scss   # SCSS variable definitions
    │   │   ├── _mixins.scss      # SCSS mixins
    │   │   ├── _base.scss        # Base element styles
    │   │   ├── _auth.scss        # Login page styles
    │   │   ├── _general.scss     # General layout styles
    │   │   ├── _icons.scss       # Icon font styles
    │   │   ├── _overrides.scss   # BootstrapVue overrides
    │   │   └── _utils.scss       # Utility classes
    │   ├── assets/               # Static assets
    │   │   ├── thinx/            # Brand images (avatars, logos)
    │   │   ├── icons/            # Icon font files
    │   │   └── people/           # Placeholder avatar images
    │   └── fonts/                # Web font files
    ├── public/                   # Static HTML template (index.html with #app mount)
    ├── cypress/                  # Vue app E2E test suite
    │   ├── integration/          # Test specs
    │   ├── plugins/              # Cypress plugin config (TypeScript)
    │   └── support/              # Custom commands (TypeScript)
    ├── vue.config.js             # Vue CLI config; dev proxy to console.thinx.cloud
    ├── babel.config.js           # Babel preset (@vue/app)
    ├── cypress.json              # Cypress configuration
    ├── server.js                 # Express static server for production dist
    ├── Dockerfile                # Container build for Vue app
    └── yarn.lock                 # Dependency lockfile
```

## Directory Purposes

**`vue/src/` (primary development target):**
- Purpose: All Vue 2 application source code
- Everything new belongs here

**`vue/src/store/` (business logic layer):**
- Purpose: Vuex modules — one file per domain entity
- Contains: Async API calls, state normalization, reactive data
- Key files: `index.js` assembles all modules and attaches `$api`

**`vue/src/pages/` (view layer):**
- Purpose: One directory per route; each contains the top-level Vue component for that page
- Contains: Template markup, local component state, Vuex wiring via `mapGetters`/`mapActions`
- Subdirectories with `components/` are page-local sub-components (e.g., `Visits/components/`)

**`vue/src/components/` (shared UI layer):**
- Purpose: Reusable components used across multiple pages
- Contains: Layout shell, navigation, generic Widget/List/Form wrappers
- Each component is in its own directory alongside its SCSS file

**`vue/src/core/` (infrastructure):**
- Purpose: Framework-agnostic utilities
- Contains: `api.js` (HTTP client), `screenHelper.js` (breakpoint detection)

**`vue/src/mixins/` (cross-cutting behavior):**
- Purpose: Vue mixins applied globally or selectively to components
- Contains: `layout.js` (colors config, injected globally via `Vue.mixin`), `hostnames.js` (env-var hostname resolution, applied selectively)

**`vue/src/styles/` (global styles):**
- Purpose: Application-wide SCSS, imported as a single entrypoint from `App.vue`
- Contains: Variables, mixins, base reset, auth styles, BootstrapVue overrides

**`vue/cypress/` (E2E tests):**
- Purpose: Browser-level integration tests for the Vue app
- Contains: Integration specs (JavaScript), support commands and plugin config (TypeScript)

**`src/` (legacy — do not add new code here):**
- Purpose: Original AngularJS 1.x admin console, superseded by the Vue app
- Contains: Controllers, HTML templates, assets, legacy Gulp build, legacy Cypress suite

## Key File Locations

**Entry Points:**
- `vue/src/main.js`: Vue app bootstrap — registers plugins, creates `ThinxApi`, mounts `#app`
- `vue/src/App.vue`: Root component — auth guard, initial route redirect
- `vue/src/Routes.js`: All route definitions

**Configuration:**
- `vue/vue.config.js`: Vue CLI / webpack config; dev proxy
- `vue/babel.config.js`: Babel preset
- `vue/cypress.json`: Cypress E2E settings
- `vue/src/config.js`: Application color palette (static)

**Core Logic:**
- `vue/src/core/api.js`: HTTP client — all backend communication flows through here
- `vue/src/store/index.js`: Vuex root — module assembly and `$api` attachment
- `vue/src/store/auth.js`: Token management and JWT validation

**Testing:**
- `vue/cypress/integration/login.spec.js`: Login E2E test
- `vue/cypress/support/commands.ts`: Custom Cypress commands

**Production Server:**
- `vue/server.js`: Simple Express server to serve `vue/dist/` static files

## Naming Conventions

**Files:**
- Vue components: PascalCase matching the component name (`Devices.vue`, `DeviceDetail.vue`, `NavLink.vue`)
- Store modules: camelCase domain noun (`devices.js`, `apikeys.js`, `buildlog.js`)
- Utilities and mixins: camelCase (`api.js`, `screenHelper.js`, `hostnames.js`)
- SCSS partials: `_camelCase.scss` or `_kebab-case.scss` with underscore prefix

**Directories:**
- Pages: PascalCase matching route name (`Devices/`, `Transformers/`, `Visits/`)
- Components: PascalCase matching component name (`Layout/`, `Sidebar/`, `NavLink/`)
- Store: flat, no subdirectories

## Where to Add New Code

**New page / route:**
1. Create `vue/src/pages/<PageName>/<PageName>.vue`
2. Create `vue/src/store/<domainName>.js` if new data domain needed
3. Register store module in `vue/src/store/index.js`
4. Add route entry in `vue/src/Routes.js` as a child of the `/app` Layout route
5. Add `NavLink` entry in `vue/src/components/Sidebar/Sidebar.vue`

**New shared component:**
- Implementation: `vue/src/components/<ComponentName>/<ComponentName>.vue`
- Styles (if any): `vue/src/components/<ComponentName>/<ComponentName>.scss`

**New store module (data domain):**
- Implementation: `vue/src/store/<domainName>.js`
- Follow the pattern in `vue/src/store/devices.js`:
  - `namespaced: true`
  - `state: { items: [], headers: [] }`
  - `mutations`: normalize API response into flat array
  - `actions`: call `this.$api.$get/post/put/delete()`, commit results
  - `getters`: `getItems`, `getHeaders`, and any lookup getters
- Register in `vue/src/store/index.js`

**New API endpoint call:**
- Add the action to the relevant store module
- Use `this.$api.$get('/path')` / `this.$api.$post('/path', JSON.stringify(payload))`
- No changes to `ThinxApi` needed for standard CRUD

**Utilities:**
- Pure JS helpers with no Vue dependency: `vue/src/core/<utility>.js`
- Vue-specific cross-cutting behavior: `vue/src/mixins/<name>.js`

## Special Directories

**`vue/dist/`:**
- Purpose: Production build output
- Generated: Yes (by `vue-cli-service build`)
- Committed: No

**`vue/node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes
- Committed: No

**`src/html/`:**
- Purpose: Appears to be a deployed/built copy of the legacy `src/` app
- Generated: Likely yes (Gulp pipeline)
- Committed: Yes (current state of repo includes it)

**`.planning/`:**
- Purpose: GSD architecture and planning documents
- Generated: Yes (by GSD mapping commands)
- Committed: Yes

---

*Structure analysis: 2026-05-18*

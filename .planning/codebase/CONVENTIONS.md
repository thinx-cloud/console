# Coding Conventions
*Generated: 2026-05-18 | Focus: quality*

## Naming Patterns

**Files:**
- Vue component files use PascalCase matching their directory: `Widget/Widget.vue`, `Devices/Devices.vue`
- Each component lives in its own subdirectory with the same name as the component
- SCSS files mirror component names: `Widget/Widget.scss`, `List/List.scss`
- Store modules use lowercase camelCase filenames: `auth.js`, `apikeys.js`, `rsakeys.js`
- Route file is singular and PascalCase: `Routes.js`
- Utility/core files use camelCase: `core/api.js`, `core/screenHelper.js`
- Mixin files use camelCase: `mixins/hostnames.js`, `mixins/layout.js`

**Components:**
- `name` property is PascalCase: `name: "Devices"`, `name: "Widget"`, `name: "LoginPage"`
- Page components registered via router may use a suffix (`LoginPage`) or match the route name (`Devices`, `Profile`)
- Shared UI components: `Widget`, `List`, `Loader`, `Header`, `Sidebar`

**Variables and Methods:**
- camelCase throughout: `selectedUdids`, `transferForm`, `loadData()`, `confirmRevoke()`
- Vuex store actions/getters use camelCase: `fetchItems`, `revokeDevices`, `getByUdid`
- Vuex mutations use camelCase: `setAccessToken`, `saveDevices`
- Boolean data properties use `is` prefix: `isSelected`, `loading` (not consistently)
- Private-ish helpers use trailing underscore: `isSelected_(udid)` (rare, seen in `Devices.vue`)
- Form state grouped in a single `form` or named form object: `transferForm`, `pushForm`, `editForm`

**CSS Classes:**
- Bootstrap 4 utility classes used directly in templates: `mr-2`, `ml-2`, `mb-3`, `text-muted`, `fw-semi-bold`
- Global semantic classes from the theme SCSS: `page-title`, `auth-page`, `widget-auth`, `loading-indicator`
- No BEM methodology — class names are flat, semantic, or Bootstrap utilities
- Component-level SCSS uses nested selectors, not BEM: `.widget { &.loading { ... } }`

## Code Style

**Formatting:**
- Prettier is installed (`prettier: ^2.5.1` in devDependencies) but no `.prettierrc` file is present
- ESLint is the primary enforcer; `vue-cli-service lint` is the lint script
- 2-space indentation used in `.vue` files (observed consistently across components)
- Single quotes for JS imports: `import Widget from '@/components/Widget/Widget'`
- Template attributes follow no strict order; event handlers and `:prop` bindings mixed freely

**Linting:**

Vue app (`vue/.eslintrc` / `package.json` eslintConfig):
- `extends: ["plugin:vue/essential", "eslint:recommended"]`
- `extends: ["plugin:vue/base"]` in the standalone `.eslintrc` at `vue/.eslintrc`
- `ecmaVersion: 2018`
- No rules configured beyond defaults — all rules are at their default severity

Legacy AngularJS/jQuery app (`src/.eslintrc.json`):
- `extends: ["jquery", "eslint:recommended"]`
- Explicitly relaxed: `no-console: off`, `no-unused-vars: off`, `max-len: off`, `camelcase: off`, `eqeqeq: off`
- Global declarations for `angular`, `Thinx`, `moment`, `Morris`, `toastr`, etc.

## Vue Component Patterns

**API in use:** Options API exclusively. No Composition API (`setup()`, `defineComponent`, `<script setup>`) is used anywhere in the codebase.

**Component structure order** (observed pattern):
1. `<template>`
2. `<script>` with `export default { name, components, mixins, filters, data(), computed, created(), methods }`
3. `<style>` (external SCSS file reference)

**Data initialization:**
```javascript
data() {
  return {
    items: [],
    loading: true,
    error: null,
    message: null,
    form: { alias: '' },
  };
},
```

**Lifecycle hooks:**
- `created()` is used for initial data fetching and route watching
- Route param changes trigger reload via `this.$watch(() => this.$route.params, ...)` with `{ immediate: true }`
- `mounted()` used for DOM manipulation (e.g., `Widget.vue` attaches custom control listeners)

**Vuex integration:**
```javascript
import { mapGetters, mapActions } from 'vuex';

export default {
  methods: {
    ...mapGetters({ getItems: 'devices/getItems' }),
    ...mapActions({ fetchItems: 'devices/fetchItems' }),
  }
}
```
Note: `mapGetters` is spread into `methods` (not `computed`), which is non-standard — getters accessed as `this.getItems()` (as functions) rather than reactive properties.

**Mixins:**
- `hostnameMixin` (`src/mixins/hostnames.js`) provides `this.$hostnames` (API, CONSOLE, LANDING URLs)
- `layoutMixin` (`src/mixins/layout.js`) applied globally via `Vue.mixin(layoutMixin)` in `main.js`

**Filters:**
- Local filters defined per component: `fromNow(val)` in `Devices.vue` and `DeviceDetail.vue`
- `vue-moment` installed for global date filters

**Props:**
```javascript
props: {
  customHeader: { type: Boolean, default: false },
  title: { default: '' },
  options: { default: () => ({}) },
  fetchingData: { type: Boolean, default: false },
}
```
- Default factories used for object/array props
- Props without `type` declaration are allowed (`tooltipPlacement`, `className`, `title`)

## Import/Export Patterns

**Imports in `.vue` files:**
```javascript
import Widget from '@/components/Widget/Widget';
import { mapGetters, mapActions } from 'vuex';
import hostnameMixin from '@/mixins/hostnames';
```
- `@` alias resolves to `vue/src/`
- Named imports for Vuex helpers
- Default imports for components and modules
- No barrel/index files for components — always import the specific `.vue` file directly

**Store modules:**
- Each store module is a plain object exported as `export default { namespaced: true, state, mutations, actions, getters }`
- All modules are namespaced

**API client:**
- Instantiated once in `main.js` as `store.$api = new ThinxApi(process.env.VUE_APP_API_HOSTNAME)`
- Accessed in store actions as `this.$api.$get(path)`, `this.$api.$post(path, body)`, etc.

## CSS Methodology

**Approach:** Global utility-first with component-scoped SCSS files.

- **No CSS Modules** — class names are not hashed or module-scoped
- **SCSS files per component** — imported via `<style src="./Widget.scss" lang="scss" />`
- `scoped` attribute used inconsistently: `Sidebar.vue`, `NavLink.vue`, `Helper.vue`, `Error.vue` use `scoped`; most others do not
- Global styles in `vue/src/styles/`: `_variables.scss`, `_base.scss`, `_mixins.scss`, `_overrides.scss`
- Bootstrap 4 + custom theme variables control the design system
- SCSS variables defined in `_variables.scss` (e.g., `$widget-bg`, `$font-family-base`)

## Error Handling Patterns

**API responses:**
- All API calls return `{ success: boolean, response: any }` from `core/api.js`
- Components check `result.success` and set `this.error` or `this.message` string properties
- `b-alert` with `v-if="error"` and `dismissible` renders the error to the user
- Pattern:
```javascript
const result = await this.someAction(params);
if (result.success) {
  this.message = 'Action succeeded.';
} else {
  this.error = result.message || 'Action failed.';
}
```

**Network errors:**
- `core/api.js` catches JSON parse errors and returns `{ success: false, status, response: text }`
- No global error boundary or Vuex error state — each component manages its own `error`/`message` locals

**Navigation:**
- `pushIfNeeded(location)` guards against duplicate navigation errors (`NavigationDuplicated` suppressed)

**Rollbar:**
- Optional error tracking via `vue-rollbar`; only activated when `VUE_APP_ROLLBAR_ACCESS_TOKEN` matches `/^[0-9a-f]{32}$/`

## Comment and Documentation Style

**Style:** Inline comments only; no JSDoc or component-level documentation blocks.

**Patterns observed:**
- `// TODO [description]` — most common, often marks unfinished features
- `// TTODO validate` — typo variant of TODO (seen in `Login.vue:196`)
- Commented-out code blocks left in place (e.g., old email field in `Login.vue`, unused vars in destructuring)
- Template comments use HTML syntax: `<!-- Transfer Modal -->`, `<!-- Left: metadata -->`
- No function-level JSDoc annotations anywhere in the codebase

---

*Convention analysis: 2026-05-18*

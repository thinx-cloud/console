# Phase 1: Bug Fixes & Scaffolding Cleanup - Pattern Map

**Mapped:** 2026-05-18
**Files analyzed:** 4 fix targets
**Analogs found:** 4 / 4

---

## File Classification

| Fix Target | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `vue/src/store/stats.js` (getter bug) | store | request-response | `vue/src/store/devices.js` | exact |
| `vue/src/Routes.js` (remove demo routes) | route config | — | `vue/src/Routes.js` itself (current clean state) | n/a — already clean |
| `vue/src/pages/` demo dirs (delete) | pages | — | none — deletion only | n/a |
| `vue/src/pages/Devices/Devices.vue` ($rootScope removal) | component | — | `vue/src/pages/Devices/Devices.vue` itself (current clean state) | n/a — already clean |

---

## Pattern Assignments

### Fix 1: `vue/src/store/stats.js` — getter returns wrong value

**Current state (lines 32–39):**
```javascript
getters: {
    getStats(state) {
        return state.stats;
    },
    getToday(state) {
        return state.today;
    },
},
```

**The bug:** The task description says line 23 returns the wrong value. Line 23 is the `return state.stats;` inside `fetchStats` action. The action commits the result, then returns `state.stats` — but because Vuex state mutations are synchronous while the local reference `state` captured before commit may be stale, callers in `Visits.vue` (line 167: `this.statsData = this.getStats()`) call the **getter** after `await fetchStats()` returns. The action's own return value is discarded; only the getter matters.

**Actual bug location — `fetchStats` action, line 22:**
```javascript
async fetchStats({ state, commit }) {
    const result = await this.$api.$get('/stats');
    if (result.success) {
        commit('saveStats', result.response);
    }
    return state.stats;   // line 22 — returns pre-commit snapshot of state
},
```

The same pattern exists in `fetchToday` at line 29: `return state.today;`

**Working analog — `vue/src/store/devices.js` lines 39–44:**
```javascript
async fetchItems({ state, commit }) {
    const result = await this.$api.$get('/device');
    if (result.success) {
        commit('saveDevices', { items: result.response });
    }
    return state.items;   // same pattern — state ref IS live after commit in Vuex
},
```

**Finding:** The `devices` store uses the identical `return state.X` pattern and works correctly because Vuex mutates the reactive state object in place — `state` in the action destructuring is the same reactive object, so `state.stats` after `commit('saveStats', ...)` is already the updated value. The getter return path through `Visits.vue` (mapGetters → `this.getStats()` called after await) is correct.

**Real diagnosis:** The stated bug at line 23 is most likely that `return state.stats` appears inside the `if (result.success)` block guard — meaning if the API call fails, the action returns `null` (the uninitialised state). Confirm by checking whether the `return` should be moved **outside** the `if` block, matching the devices pattern.

**Fix to apply:**
```javascript
// BEFORE (stats.js lines 17–23)
async fetchStats({ state, commit }) {
    const result = await this.$api.$get('/stats');
    if (result.success) {
        commit('saveStats', result.response);
    }
    return state.stats;          // currently INSIDE the action body — verify indentation
},

// AFTER — ensure return is unconditional (outside if block), matching devices.js:44
async fetchStats({ state, commit }) {
    const result = await this.$api.$get('/stats');
    if (result.success) {
        commit('saveStats', result.response);
    }
    return state.stats;          // must be at action body level, not inside if
},
```

**Copy getter pattern exactly from `vue/src/store/devices.js` lines 68–78** — the getter simply returns state, no transformation needed.

---

### Fix 2: `vue/src/Routes.js` — remove demo routes

**Current state of Routes.js (lines 1–117):** The file is **already clean**. It contains only production routes:
- Login, Error, Layout wrapper
- Dashboard (Visits), Devices, DeviceDetail
- API Keys, Repositories, History, RSA Keys
- Transformers, TransformerEditor, Enviros, Channels, Profile
- Catch-all RootError

**No demo routes present** (Charts, Tables, Icons, Maps, Notifications, Typography, AnotherPage are absent from both imports and the route array).

**Action:** Verify against git history whether demo routes were already removed in a prior commit, or whether the task description refers to a different branch. No changes needed to Routes.js in its current state.

**Reference pattern for what a clean route entry looks like (lines 49–53):**
```javascript
{
  path: 'devices',
  name: 'Devices',
  component: DeviceManager,
},
```

If demo routes are found on another branch, remove: (a) the `import` line at top, (b) the route object from the `children` array. No other files need changing per route removal.

---

### Fix 3: Delete demo page directories under `vue/src/pages/`

**Current `vue/src/pages/` contents:**
```
Apikeys/   Channels/  Devices/   Enviros/   Error/
History/   Login/     Profile/   Repositories/  Rsakeys/
Transformers/  Visits/
```

**No demo page directories exist** (Charts/, Tables/, Icons/, Maps/, Notifications/, Typography/, AnotherPage/ are all absent).

**Action:** Verify against branch state. If demo directories appear on another branch, delete entire directory trees. No import cleanup needed in Routes.js since imports would be removed as part of Fix 2.

**Pattern — what a legitimate page directory looks like:**
Each live page dir contains `ComponentName.vue` and optionally `ComponentName.scss`. No index barrel files. Example: `vue/src/pages/Devices/Devices.vue`.

---

### Fix 4: `vue/src/pages/Devices/Devices.vue` — remove AngularJS `$rootScope` references

**Current state:** The file contains **no `$rootScope` references**. A full-text search across `vue/src/` for `$rootScope`, `updateTimeline`, and `updateCharts` returned zero matches.

**The component is already Vue-idiomatic** (lines 100–222):
- Uses `mapGetters` / `mapActions` from Vuex (lines 137–145)
- Calls `this.$api`, `this.$router`, `this.$bvModal` — all Vue instance properties
- No AngularJS lifecycle hooks (`$scope`, `$rootScope`, `$watch` via AngularJS)
- Uses Vue's `created()` hook with `this.$watch(() => this.$route.params, ...)` (line 134) — correct Vue pattern

**Action:** Verify against branch state. The `$rootScope` references may exist on a feature branch not yet merged. No changes needed in current branch state.

**Working Vue pattern to model any replacement after** — `vue/src/pages/Devices/Devices.vue` lines 133–135:
```javascript
created() {
  this.$watch(() => this.$route.params, () => { this.loadData(); }, { immediate: true });
},
```

**If `updateTimeline()` / `updateCharts()` exist on another branch**, replace any `$rootScope.$broadcast(...)` or `$rootScope.someData = ...` with:
- Data sharing: move to Vuex store state + commit mutation
- Event emission: use `this.$emit('event-name', payload)` or Vuex action
- DOM updates: use reactive `data()` properties bound in template

**Analog for Vuex-based reactive data update pattern — `vue/src/pages/Visits/Visits.vue` lines 158–173:**
```javascript
async loadData() {
  this.loading = true;
  await Promise.allSettled([
    this.fetchStats(),
    this.fetchToday(),
    this.fetchDevices(),
    this.fetchAudit(),
    this.fetchBuildLog(),
  ]);
  this.statsData = this.getStats();
  this.todayData = this.getToday();
  this.deviceCount = (this.getDevices() || []).length;
  this.loading = false;
},
```

---

## Shared Patterns

### Vuex Store Structure
**Source:** `vue/src/store/devices.js` (lines 1–79) and `vue/src/store/auth.js` (lines 1–53)
**Apply to:** Any store module modifications

All store modules are plain objects (not classes), namespaced, with four sections in order: `state`, `mutations`, `actions`, `getters`. Actions use `async/await` with `this.$api.$get/post/delete`. Getters are simple state accessors, no logic.

```javascript
export default {
    namespaced: true,
    state: { /* flat key-value */ },
    mutations: { saveFoo(state, data) { state.foo = data; } },
    actions: {
        async fetchFoo({ state, commit }) {
            const result = await this.$api.$get('/foo');
            if (result.success) { commit('saveFoo', result.response); }
            return state.foo;
        },
    },
    getters: {
        getFoo(state) { return state.foo; },
    },
};
```

### Component Data-Loading Pattern
**Source:** `vue/src/pages/Devices/Devices.vue` lines 212–219
**Apply to:** All page components

```javascript
loadData() {
  this.loading = true;
  Promise.all([this.fetchItems(), this.fetchEnviros()]).then(() => {
    this.items = this.getItems();
    this.enviros = this.getEnviros();
    this.loading = false;
  });
},
```

Store getters are spread via `mapGetters` into `methods` (not `computed`), then called as functions: `this.getItems()`. This is the established pattern across Devices and Visits pages.

### Route Entry Pattern
**Source:** `vue/src/Routes.js` lines 26–117
**Apply to:** Any route additions or removals

Routes are Vue Router 3 hash-mode entries. Top-level routes (login, error) are flat. All app pages are `children` of the `/app` Layout route. No lazy-loading (`() => import(...)`) — all imports are static at top of file.

---

## No Analog Found

| Fix | Reason |
|---|---|
| Demo page directory deletion | Deletion-only operation; no pattern needed beyond `rm -rf` |

---

## Summary of Actions Required (by branch verification)

All four targets appear **already fixed** on the current branch (`thinx-staging`). Before planning any edits, verify the fix targets exist by checking:

```bash
grep -n '\$rootScope\|updateTimeline\|updateCharts' vue/src/pages/Devices/Devices.vue
grep -n 'Charts\|Tables\|Icons\|AnotherPage\|Typography' vue/src/Routes.js
ls vue/src/pages/
```

If targets are confirmed missing, these fixes may belong to a different branch or have already been applied. The planner should gate each task on a pre-check grep before writing any changes.

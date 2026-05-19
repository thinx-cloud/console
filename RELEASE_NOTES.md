# Release Notes — thinx-staging (2026-05-19)

Changes since baseline commit `4d88280` (TASK_GROOMING.md). Intended audience: operators and developers reviewing the staging release.

---

## Features

### Duplicate alias guard in Repositories create modal

**Commit:** `5d18b27` · `feat(REPO-03)`

Attempting to create a repository with an alias that already exists in the list now shows an inline error inside the create modal instead of silently overwriting or failing at the API level. The guard runs client-side before any network request is made.

**Files:** `vue/src/pages/Repositories/Repositories.vue`

---

### Copy-to-clipboard button in one-time key reveal modals

**Commits:** `8611ec1` · `feat(AKEY-02, RKEY-02)`

API key and RSA key modals that reveal one-time secrets now include a **Copy** button alongside the displayed value. This removes the need for users to manually select and copy text from the modal before dismissing it — the secret cannot be retrieved again after the modal is closed.

**Files:** `vue/src/pages/Apikeys/Apikeys.vue`, `vue/src/pages/Rsakeys/Rsakeys.vue`

---

## Bug Fixes

### Transformer ID generation uses `crypto.randomUUID()`

**Commit:** `716166f` · `fix(TRAN)`

Transformer records were previously assigned IDs using `String(Date.now())`. Under rapid creation this produced duplicate IDs and caused silent overwrites. The store now calls `crypto.randomUUID()`, falling back to `Date.now()` only in environments where the Web Crypto API is unavailable.

**Files:** `vue/src/store/transformers.js`

---

### Device list restores when search is cleared

**Commit:** `6587bf1`

Clearing the search box on the device list page left the list empty instead of showing all devices. The filter function returned nothing when `searchText` was an empty string because the per-property guard used `continue` unconditionally, preventing any device from matching. An early return for the no-filter case restores the full list.

**Files:** `src/app/js/main.js`

---

### Auth redirect guard in Vue console

**Commit:** `e0b106e`

The Vue router and login page could loop or redirect to an invalid route when a user was already authenticated. Guards now check session state before issuing a redirect, preventing spurious navigation on page load.

**Files:** `vue/src/App.vue`, `vue/src/pages/Login/Login.vue`

---

### Login form autocomplete attributes corrected

**Commit:** `7dfb483`

The login form lacked explicit `autocomplete` attributes, causing browsers to misidentify the fields or suppress credential autofill. Correct `autocomplete="username"` and `autocomplete="current-password"` values are now set.

**Files:** `vue/src/pages/Login/Login.vue`

---

## Known Gaps

### Repositories page cannot display device counts (REPO-05)

The Repositories page design calls for a device count column showing how many devices are linked to each repository. The `GET /source` backend endpoint does not return a device count field in its response payload. The column has been omitted from the UI rather than showing placeholder zeros.

**Status:** Backend API change required — out of scope for this release.

---

## Housekeeping

- `a09187e` — JSDoc added for Vue core components, store modules, and mixins (no runtime change).
- `7165797` — `commitlint` and `husky` commit-msg hook added to enforce conventional commit format.

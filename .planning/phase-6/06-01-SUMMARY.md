---
phase: 06-user-profile
plan: "01"
subsystem: profile-store
tags:
  - vuex
  - store
  - bugfix
  - vue
  - frontend
dependency_graph:
  requires:
    - "06-00: profile route exists in Routes.js"
  provides:
    - "profile/deleteAccount sends { owner } body — backend returns 200 instead of 403"
    - "profile/uploadAvatar action posts base64 avatar to /profile"
    - "Header.vue My Account item navigates to /app/profile"
  affects:
    - "vue/src/store/profile.js"
    - "vue/src/components/Header/Header.vue"
tech_stack:
  added: []
  patterns:
    - "Vuex action reads owner from state.profile.owner for defensive null guard"
    - "b-dropdown-item uses to prop for Vue Router navigation"
key_files:
  created: []
  modified:
    - "vue/src/store/profile.js"
    - "vue/src/components/Header/Header.vue"
decisions:
  - "uploadAvatar does not strip data-URI prefix — caller (Wave 2 Profile.vue) is responsible"
  - "deleteAccount reads owner from state.profile.owner with null guard to prevent undefined in body"
metrics:
  duration: "10 minutes"
  completed: "2026-05-23"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 6 Plan 01: Profile Store Fix + Header Link Summary

Fixed the deleteAccount store action (sent `{}`, backend required `{ owner }`) and added the missing uploadAvatar store action; wired the Header.vue My Account dropdown to the `/app/profile` Vue Router route.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix deleteAccount body and add uploadAvatar action | 541b01a | vue/src/store/profile.js |
| 2 | Wire Header.vue My Account dropdown to /app/profile | a9220cb | vue/src/components/Header/Header.vue |

## What Was Built

**profile.js changes (Task 1):**
- `deleteAccount` now destructures `{ state }` and sends `JSON.stringify({ owner })` where `owner = state.profile && state.profile.owner`. The backend validates `req.body.owner === req.session.owner` — previously the empty body `{}` caused a 403 on every delete attempt.
- New `uploadAvatar({ dispatch }, base64String)` action POSTs `{ avatar: base64String }` to `/profile` and re-fetches the profile on success so `state.profile.avatar` reflects the new value. The base64String parameter is raw base64 without the data-URI prefix (the Wave 2 caller strips it).
- All pre-existing actions (`fetchProfile`, `updateProfile`) and mutations (`saveProfile`) are byte-for-byte unchanged. No new imports added. Module remains namespaced.

**Header.vue changes (Task 2):**
- Added `to="/app/profile"` to the My Account `b-dropdown-item` at line 53. BootstrapVue renders it as a Vue Router link — no `@click` handler needed. All other template content, the `logout` method, and `avatarFallback` computed property are unchanged.

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

All grep acceptance criteria passed:

| Check | Expected | Actual |
|-------|----------|--------|
| `grep -c uploadAvatar profile.js` | 1 | 1 |
| `grep -c "JSON.stringify({ owner })" profile.js` | 1 | 1 |
| `grep -c "JSON.stringify({})" profile.js` | 0 | 0 |
| `grep -c "state.profile && state.profile.owner" profile.js` | 1 | 1 |
| `grep -c fetchProfile profile.js` | >=3 | 3 |
| `grep -c namespaced profile.js` | 1 | 1 |
| `grep -c "^import " profile.js` | 0 | 0 |
| `grep -c 'to="/app/profile"' Header.vue` | 1 | 1 |
| `grep -c "la la-user" Header.vue` | 1 | 1 |
| `grep -c logout Header.vue` | >=2 | 3 |

## Known Stubs

None — both changes are fully wired. Wave 2 (Profile.vue UI) will call `profile/uploadAvatar` and `profile/deleteAccount` from the component layer.

## Threat Flags

No new network endpoints, auth paths, or schema changes introduced beyond what is documented in the plan's threat model. All threat dispositions accepted or mitigated per plan.

## Self-Check: PASSED

- `vue/src/store/profile.js` — exists and contains `uploadAvatar` and fixed `deleteAccount`
- `vue/src/components/Header/Header.vue` — exists and contains `to="/app/profile"` on My Account item
- Commit `541b01a` — confirmed in git log
- Commit `a9220cb` — confirmed in git log

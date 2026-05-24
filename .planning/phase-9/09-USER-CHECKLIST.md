---
phase: 09-manual-uat-review
audience: user (human walk required)
created: 2026-05-24
updated: 2026-05-24 (second user-walk — passes pruned; only unfinished items remain)
prereq: parent-repo d5169e61 propagated to console.thinx.cloud (CI ~5min + swarm pull ~2min)
---

# Phase 9 — Outstanding UAT Steps

Failed and unfinished items remaining after the 2026-05-24 user walk.
Items the user already passed have been moved into the summary
(`09-UAT-SUMMARY.md`) and the matching `REQUIREMENTS.md` rows flipped
to Verified.

The failed items below are **blocked on engineering follow-ups** —
gaps **G7–G11** are filed in `09-UAT-SUMMARY.md`. The remaining
unwalked items are blanks that the user couldn't complete in the
walk (DASH-04 needs an artifact-bearing account; AUTH-03 laptop-sleep
needs a >1h sleep test).

## Failed — engineering fix required

### 1. PROF-05 Confirm path — gap G7

- [❌] **PROF-05 Confirm path** — account deletion succeeds but no
  redirect / no localStorage clear
  - Walk (already done by user on a throwaway account):
    `/#/app/profile` → **Account** tab → **Delete My Account** →
    **Confirm** in the modal.
  - **Observed:** `DELETE /api/v2/user` returns 200 (the account is
    actually gone — re-login fails as expected), but the UI stays on
    the now-orphaned profile page with stale localStorage and no
    redirect to `/#/login`.
  - **Required fix:** in the delete-success handler, dispatch
    `auth/clearSession` (the Phase 8 Wave 2 chokepoint) and redirect
    to `/login` (router push or `window.location.hash = '#/login'`).
    See `09-UAT-SUMMARY.md#G7`.
  - **Re-walk after fix:** create a second throwaway account, repeat
    the click path, confirm `/#/login` is reached and `localStorage`
    keys are gone.

### 2. AUTH-02 full email round-trip — gap G8

- [❌] **AUTH-02 full flow** — `POST /api/v2/password/reset` returns
  403; the whole reset flow is broken on the live API.
  - Walk (already done by user): Logout → `/#/login` → **Forgot
    password?** → enter email → **Send reset email**.
  - **Observed in browser console:**
    ```
    Failed to load resource: the server responded with a status of 403 ()
    /api/v2/password/reset:1  Failed to load resource: the server responded with a status of 403 ()
    api.js:94  POST https://console.thinx.cloud/api/v2/password/reset 403 (Forbidden)
    ```
  - **Required fix:** backend — confirm `/api/v2/password/reset` is a
    public route (no session required); check CORS / CSRF; verify
    request body matches the route validator. The legacy console hit
    the same endpoint without auth — something downstream is now
    rejecting it. See `09-UAT-SUMMARY.md#G8`.
  - **Re-walk after fix:** same path; expect `POST → 200`, "Reset
    email sent" message, then complete the full email round-trip
    described in the original checklist (rewrite legacy URL to
    `/#/password-reset?reset_key=...&owner=...`, enter new password,
    log in with the new password).

### 3. DEVI-05 per-row Revoke — gap G9

- [❌] **DEVI-05** — per-row Revoke succeeds but bulk-action counter
  stays at count(1)
  - Walk (already done by user): `/#/app/devices` → throwaway device
    row → **Revoke** → confirm modal.
  - **Observed:** device disappears from the list and
    `DELETE /api/v2/device` returns 200 (the requirement-level Pass
    criterion is met), **but** the toolbar buttons "Revoke / Transfer /
    Push Config" all stay labelled `(1)` as if a device remained
    selected. Selection state isn't pruned when a row is removed.
  - **Required fix:** `vue/src/pages/Devices/Devices.vue` — in the
    per-row Revoke success handler, also splice the removed udid out
    of the `selected` array before re-fetching the list. The bulk
    Revoke action (DEVI-06) works because it clears `selected` on
    success. See `09-UAT-SUMMARY.md#G9`.
  - **Re-walk after fix:** repeat the click path; confirm toolbar
    drops to `(0)` after the row disappears.

### 4. DEVI-09 worker infrastructure — gap G10

- [❌ infra] **DEVI-09 worker** — `POST /api/v2/build` succeeds (200)
  but the build never runs; `thinx_worker` loops on `docker pull`
  failure
  - Walk (already done by user): `/#/app/devices` → device with repo
    assigned → row **Build** action.
  - **Observed (worker log on `core` node):**
    ```
    [<build-id>] »» 1/1: No such image: suculent/arduino-docker-build:latest@sha256:bc85d98271bd6bd…
    overall progress: 0 out of 1 tasks
    ```
    Loops indefinitely. Manual `docker pull suculent/arduino-docker-build`
    on the `core` node succeeds (image lands at the pinned digest),
    but builds still don't kick in. Pulling on `micro` doesn't help
    either — image isn't propagating to the actually-scheduled worker
    node, or the worker is pinned to a node without the image.
  - **This is NOT a Vue console regression** — Phase 4 DEVI-09 passes
    at the requirement level (POST 200, build row appears in
    `/#/app/history/builds`). It's a swarm/worker infrastructure
    issue that needs investigation outside the console repo.
  - **Required fix (worker code, not in this repo):**
    1. Terminate the build on persistent "No such image" errors
       instead of looping.
    2. Emit a build-log line the user can see in
       `/#/app/history/builds`.
    3. Pre-pull `suculent/arduino-docker-build` on worker startup OR
       refuse to schedule builds on nodes that lack the image OR
       pin the worker to nodes that always have the registry image.
  - See `09-UAT-SUMMARY.md#G10` for full investigation hints.
  - **Re-walk after fix:** repeat the click path on a device with a
    repo assigned; expect the build to succeed (or fail with a
    user-visible error in the build log, never silent-loop).

## Pending walk — blocked on external state

### 5. DASH-04 — Recent Builds download round-trip

- [ ] **DASH-04 — full zip download**
  - Needs an account with at least one successful build (status: OK)
    that has an artifact zip on disk. The `test` account's builds
    are all ERROR — they have no artifacts. Switch to an account
    that builds firmware regularly.
  - **Walk:** `/#/app/dashboard` → Recent Builds widget → row with a
    `build_id` → click **Download**.
  - **Pass when:** browser saves `<build_id>.zip`; `unzip -l <file>.zip`
    succeeds; no console errors. Code path + auth + URL already
    verified at code level in Phase 5 (commit `04f78e0`).
  - **Note:** likely blocked on **G10** (no successful builds while
    the worker is stuck), so this walk is gated until G10 is fixed
    and the test account has at least one OK build.

### 6. AUTH-03 — Laptop-sleep belt-and-suspenders

- [ ] **AUTH-03 laptop-sleep**
  - Real edge case for the OS-suspension scenario where `setTimeout`
    doesn't fire on schedule.
  - **Walk:** Log in → close laptop lid → wait >1 hour → reopen → any
    UI action that triggers an API call.
  - **Pass when:** as soon as the first API call goes out, the
    `api.js#composeOptions` pre-request `exp` check fires; the page
    redirects to `/#/login`; no silent 403 chain. The new
    `router.beforeEach` guard also prevents any subsequent push to
    `/app/*`.
  - The foreground 1-hour timer was already confirmed in the second
    user-walk (already flipped to Verified for AUTH-03 row); this
    item is a separate edge case.

## Out-of-scope side-finding (not a Phase 9 closure item)

### 7. Vue console signup is missing — gap G11

- The user needed a throwaway account for PROF-05 Confirm path; the
  account had to be created via the legacy console because the Vue
  console exposes no signup form.
- This is **not** a Phase 9 closure item — it requires a scoping
  decision. Recommendation: file as **AUTH-04** under the v1.1
  milestone alongside Phase 10 Admin Features. See
  `09-UAT-SUMMARY.md#G11`.

## Wrap-up

When G7–G10 ship and DASH-04 + AUTH-03 laptop-sleep walks complete,
flip the matching `REQUIREMENTS.md` rows to plain
`Verified (Phase 9 user-walk 2026-MM-DD)`. Phase 9 then closes and
Phase 10 (Admin Features) opens. G11 routes to v1.1.

## What's already verified — no action needed

See `09-UAT-SUMMARY.md` for the full traceability flip lists. Quick
recap of items the user confirmed in the second walk
(2026-05-24):

- **In-prod deploy markers:** G5 router-guard + G6 buildHash both
  observed live on `console.thinx.cloud`.
- **Profile:** PROF-01, PROF-02, PROF-04 (both positive AND negative),
  PROF-06.
- **Devices:** DEVI-06 (bulk Revoke); DEVI-09 narrow Pass (POST 200 +
  history-row appears — the worker infra problem is G10, separately
  tracked).
- **Auth:** AUTH-03 foreground 1-hour timer (the synthetic short-exp
  JWT path also passed).

Already AI-verified in the first walk:
DASH-01/02/03/05, HIST-01/02/04/05, HIST-03 (code-only), PROF-03,
AUTH-01, AUTH-02 page + form-mode toggle + Login link (real round-trip
is now blocked by **G8**), AUTH-03 belt-and-suspenders (observed live).

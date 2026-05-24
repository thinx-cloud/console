---
phase: 09-manual-uat-review
audience: user (human walk required)
created: 2026-05-24
prereq: parent-repo d5169e61 propagated to console.thinx.cloud (CI ~5min + swarm pull ~2min)
---

# Phase 9 — Remaining UAT Steps

Items the AI couldn't auto-confirm during the live walk because they
need real-mouse / real-email / non-admin / throwaway-account / long-wait.
Each item lists the exact click path, expected outcome, and what to
record back.

## 0. Verify the just-pushed G5 + G6 fixes (do these first)

These confirm the redeploy landed cleanly.

- [ ] **G6 buildHash live in production**
  - Log out (or open a private window).
  - Visit `https://console.thinx.cloud/#/login`.
  - The tiny grey text under the "THiNX Console by THiNX Cloud" footer
    should now show a 7-char git SHA (the head of `thinx-staging` on
    the console repo, or the parent's submodule pointer SHA — the
    first 7 chars of `a462ff8`).
  - **Pass when:** the footer reads `a462ff8` (or whatever the next
    deployed SHA is), not `dev`.

- [ ] **G5 router guard prevents ghost-authed pages**
  - Logged out, paste `https://console.thinx.cloud/#/app/dashboard`
    into the URL bar.
  - **Pass when:** the page immediately redirects to `/#/login`.
  - Before G5, this would have rendered the dashboard frame and silently
    403'd every API call.

- [ ] **G5 covers expired-session case**
  - Log in normally.
  - Open DevTools → Application → Local Storage → console.thinx.cloud.
  - Find the `accessToken` value; copy it; replace it with a JWT whose
    `exp` is in the past:
    ```js
    // Paste in the Console tab to mint a short-exp JWT (no signature
    // needed — only the exp is checked client-side):
    const header  = btoa(JSON.stringify({alg:'HS256',typ:'JWT'}));
    const payload = btoa(JSON.stringify({exp: Math.floor(Date.now()/1000) - 60, owner: 'test'}));
    localStorage.setItem('accessToken', `${header}.${payload}.sig`);
    location.reload();
    ```
  - **Pass when:** the page redirects to `/#/login` (the
    api.js#composeOptions pre-request check + the new router.beforeEach
    guard both kick in).

## 1. Profile (PROF-01, PROF-02, PROF-05, PROF-06)

These edit the **shared** `test` account, so do them in this order
and either accept the mutations or use a throwaway account.

- [ ] **PROF-01 — Profile field update persists**
  - Log in as `test`.
  - Visit `/#/app/profile`.
  - Edit First Name → "TestRound2".
  - Click **Save Profile** → expect a success alert.
  - Reload — First Name should still be "TestRound2".
  - **Critical regression check:** Email, mobile_phone, timezone,
    notifications, transformers should all still be present (the
    saveProfile data-loss fix from `4afe3ad` made this safe).
  - **Pass when:** reload preserves all of those.

- [ ] **PROF-02 — Avatar upload round-trip**
  - Same login.
  - Visit `/#/app/profile`, click the **Avatar** tab.
  - Pick a small (< 100 KB) PNG/JPG.
  - Preview should update immediately.
  - Click **Save Avatar** → success alert.
  - Reload; avatar persists. The user dropdown in the top-right header
    should also show the new avatar.
  - **Pass when:** both the preview and the dropdown avatar update.

- [ ] **PROF-05 — Delete Account modal Cancel path** (Confirm path needs throwaway account)
  - Same login.
  - `/#/app/profile` → **Account** tab → click **Delete My Account**.
  - **Confirm modal appears.** Click **Cancel**.
  - **Pass when:** modal closes; no API call fires; you remain on the
    Profile page. The page should NOT navigate to `/#/login`.
  - To test the **Confirm** path, register a throwaway account (signup
    via the legacy console or via the API directly), log in as that
    account, walk the same flow, and **Confirm**. Expect:
    `DELETE /api/v2/user` → 200, redirect to `/#/login`, all
    localStorage cleared.

- [ ] **PROF-06 — Header My Account link**
  - Logged in.
  - Click the user icon at the top-right → **My Account**.
  - **Pass when:** URL becomes `/#/app/profile`.
  - Phase 6 UAT noted Chrome DevTools click was flaky on `b-dropdown-item`;
    a real mouse click should fire fine.

## 2. PROF-04 negative case (Admin tab hidden for non-admin)

- [ ] **PROF-04 negative**
  - You'll need a second account where `profile.admin === false`. If
    you have one, log in as that account.
  - Visit `/#/app/profile`.
  - **Pass when:** the tabs are `Profile, Notifications, Avatar, Account`
    — **no `Admin` tab**. Open DevTools, confirm there's no hidden
    `[role="tab"]` containing "Admin" in the DOM (the v-if removes it
    entirely, not just hides it).
  - For comparison, the admin account (`test`) should show a 5th
    `Admin` tab.

## 3. Dashboard download (DASH-04)

- [ ] **DASH-04 — Recent Builds download link round-trip**
  - Needs an account with at least one successful build (status: OK)
    that has an artifact zip on disk. The `test` account's builds are
    all ERROR — they have no artifacts. Switch to an account that does
    build firmware regularly.
  - Visit `/#/app/dashboard`. Recent Builds widget should show rows.
  - For a row with a `build_id`, click **Download**.
  - **Pass when:** the browser saves `<build_id>.zip`; the file is a
    valid zip (try `unzip -l <file>.zip`); no console errors.
  - Code path + auth + URL already verified in Phase 5 (commit
    `04f78e0`). This is the final live confirmation.

## 4. AUTH-02 email round-trip

- [ ] **AUTH-02 full flow**
  - Log out.
  - Visit `/#/login`, click **Forgot password?** → lands on
    `/#/password-reset` (email form).
  - Enter your real account email; click **Send reset email**.
  - **Pass when:** success message appears ("Reset email sent.
    Check your inbox.").
  - Check the inbox. The email currently links to the **legacy**
    `/password.html?reset_key=...&owner=...` confirmation page (the
    parent-repo redirect target update at `lib/thinx/owner.js:480` is
    a known follow-up). For the Vue confirm form, manually rewrite the
    URL to `/#/password-reset?reset_key=<key>&owner=<owner>` (replace
    `/password.html?` with `/#/password-reset?`).
  - Enter a new password twice (≥ 4 chars, matching).
  - Click **Set password**.
  - **Pass when:** success message ("Password set. You can now log in.")
    + the link **Go to login** appears.
  - Log in with the new password. **Pass when:** login succeeds.
  - (Optional cleanup: change the password back via the same flow.)

## 5. AUTH-03 1-hour timer

- [ ] **AUTH-03 — Real foreground timer test**
  - Log in.
  - In DevTools Application → Local Storage, note the `accessToken`'s
    `exp` (decode the middle JWT segment — the synthetic script in
    section 0 above shows the encoding).
  - Open multiple tabs and leave the dashboard open for ≥ 60 minutes.
  - At T=exp, the foreground tab should automatically redirect to
    `/#/login` (the `scheduleExpiry` setTimeout fires + the new
    router.beforeEach guard prevents any subsequent push to `/app/*`).
  - **Pass when:** the dashboard goes to `/#/login` without manual
    interaction and without 403 errors on subsequent clicks.

- [ ] **AUTH-03 — Laptop-sleep belt-and-suspenders**
  - Log in.
  - Close the laptop lid; wait >1 hour; open it.
  - As soon as any UI action triggers an API call, the page should
    redirect to `/#/login` (the api.js#composeOptions pre-request exp
    check kicks in before the doomed request lands).
  - **Pass when:** redirect fires; no silent 403 chain.

## 6. Device destructive ops (DEVI-05, DEVI-06, DEVI-09)

These work in code (API-verified in Phase 4 round 2) but a live click
mutates real device data. Decide whether to walk on a throwaway device.

- [ ] **DEVI-05 — Per-row Revoke**
  - `/#/app/devices` → pick a throwaway device row → click **Revoke** →
    confirm in the modal.
  - **Pass when:** the device disappears from the list and
    `DELETE /api/v2/device` returns 200.

- [ ] **DEVI-06 — Bulk Revoke**
  - Select 2-3 throwaway devices via the row checkboxes → click the
    top **Revoke (N)** button → confirm.
  - **Pass when:** all selected devices disappear.

- [ ] **DEVI-09 — Build firmware**
  - `/#/app/devices` → pick a device with a repo assigned → click
    **Build** in the row actions.
  - **Pass when:** `POST /api/v2/build` returns 200 (not the previous
    `rejecting request for invalid input` — the G2 fix sends
    `{ build: { udid, source_id, dryrun: false } }`).
  - You can then follow up at `/#/app/history/builds` to confirm the
    new build entry appears.

## 7. Wrap-up

Once you've walked the above, flip the matching rows in
`.planning/REQUIREMENTS.md` from their current `Code-verified;
deferred (AC-DEST/HN)` form to plain `Verified (Phase 9 user-walk
2026-MM-DD)`. The Phase 9 summary doc will then reflect a
fully-passed v1.

## What I (the AI) already verified

For context — what's already confirmed live, no action needed:

- DASH-01, DASH-02, DASH-03 (empty state), DASH-05
- HIST-01, HIST-02, HIST-04, HIST-05
- HIST-03 — code-only (test account has no builds, code path verified)
- PROF-03 (Phase 6 AI-UAT, API round-trip)
- AUTH-01
- AUTH-02 — page + initiate-form + confirm-form mode toggle + Login
  link (real email round-trip is in section 4 above)
- AUTH-03 belt-and-suspenders — observed live on your own expired
  session (10× 403 chain triggered the api.js teardown)

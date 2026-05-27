---
phase: 09-manual-uat-review
status: in_progress
created: 2026-05-24
sources: [03 (none — never captured), 04-HUMAN-UAT.md, 05-HUMAN-UAT.md, 06-HUMAN-UAT.md, 07-HUMAN-UAT.md, 08-HUMAN-UAT.md]
---

# Phase 9 — Manual UAT Review — Consolidated Worklist

Aggregates every open UAT item from Phases 4-8 (Phase 3 transformer UAT was never formally captured as a HUMAN-UAT.md — its TRAN-01..07 items are tracked via VERIFICATION + the existing `transformers.spec.js`).

## Classification key

- **AC** (auto-confirmable): can be walked headlessly via chrome-devtools against the live console without destructive side effects. AI walks it; result → respective HUMAN-UAT.md.
- **AC-DEST** (auto-confirmable, destructive on shared account): the click works but would corrupt the shared `test` account (e.g. overwrite avatar, delete an entry). Deferred — needs user-owned action, possibly on a throwaway account.
- **HN** (human-needed): cannot be done without external state — real email, non-admin account, 1-hour wait, etc.
- **PASS** (already passed): already confirmed in a prior round, no action needed in Phase 9.

## Worklist

### Phase 4 — Device Management (12 items + G2..G5 fixes)

| # | Req | Item | Class | Notes |
|---|---|---|---|---|
| 4.1 | DEVI-01 | Category filter pills | PASS | Already browser-confirmed round 2 |
| 4.2 | DEVI-02 | Sort dropdown | PASS | Already passed |
| 4.3 | DEVI-03 | Search input | PASS | Already passed |
| 4.4 | DEVI-04 | Grid/list toggle | PASS | Already passed |
| 4.5 | DEVI-05 | Per-row Revoke (token-refresh open) | AC | Click button → modal appears; do NOT confirm (would revoke). G1 deferred to AUTH-03 (now shipped in Phase 8 — re-test). |
| 4.6 | DEVI-06/07/08/09 | Bulk Revoke/Transfer/Push Config | AC-DEST | Modals + dispatched store actions; do NOT submit on shared account. |
| 4.7 | DEVI-10 | Detail navigation | PASS | Already browser-confirmed round 2 |
| 4.8 | DEVI-11 | Env Vars card | PASS | Already passed (FloodController, 5 vars) |
| 4.9 | DEVI-11 | Transformer multi-select + Save | AC | Post-deploy: re-test save (G6 fix was deploy-blocked in round 2; deploy is now live as of 2026-05-24). |
| 4.10 | DEVI-11 | Build History card | PASS | Already passed (empty state) |
| 4.11 | DEVI-11 | Device Logs card conditional rendering | PASS | Already passed (v-if guard) |
| 4.12 | DEVI-11 / D-12 | Transfer Device modal | PASS | Already passed (real email round-trip) |
| 4.G2 | DEVI-09 | buildFirmware payload | AC-DEST | Code fix applied; click triggers real backend build. Do NOT trigger on shared account. |

### Phase 5 — Real Dashboard (5 items)

| # | Req | Item | Class | Notes |
|---|---|---|---|---|
| 5.1 | DASH-01 | 6 metric cards from real `/stats` | AC | Just visit `/#/app/dashboard` and confirm cards render numbers, not undefined/zero placeholders. |
| 5.2 | DASH-02 | Today/week/month period breakdowns on each card | AC | Visible on the same page. |
| 5.3 | DASH-03 | Timeline + 7/31/365 range selector | AC | Click each range, confirm chart re-renders. |
| 5.4 | DASH-04 | Recent Builds widget download link | BLOCKED | **2026-05-27 production-fs audit (`/mnt/gluster/thinx/deploy` on swarm `188.166.23.244`) confirms NO successful build artifacts exist for ANY account** — 6 FAILED + 1 aborted builds, 0 firmware.bin files. Walk blocked on `OPS-builder-broken` (G10 worker fix) — see `.planning/v1.x-backlog.md`. Widget rendering + download-link presence already AI-verified at `04f78e0`; only the live "successful zip download" sub-criterion remains, and it's gated on a working build pipeline. |
| 5.5 | DASH-05 | Recent Audit Events widget | AC | Just confirm widget renders. |

### Phase 6 — User Profile (6 items)

| # | Req | Item | Class | Notes |
|---|---|---|---|---|
| 6.1 | PROF-01 | Profile field update + reload persists | AC-DEST | Would change shared test account's first_name etc. Defer or use throwaway account. |
| 6.2 | PROF-02 | Avatar upload round-trip | AC-DEST | Would overwrite shared account's avatar. |
| 6.3 | PROF-03 | Notifications save preserves info fields | PASS | Already API-verified end-to-end; in vivo merge-fix confirmed. |
| 6.4 | PROF-04 | Admin tab visible for admin | AC | Visit `/#/app/profile` — test account is admin so the Admin tab should appear. Negative case (hidden for non-admin) is HN — needs non-admin account. |
| 6.5 | PROF-05 | Delete Account confirmation flow | AC-DEST | Cancel path is safe to walk; Confirm path needs throwaway account. |
| 6.6 | PROF-06 | Header My Account dropdown link | AC | Click header dropdown → click "My Account" → confirm URL navigates to `/#/app/profile`. |

### Phase 7 — History Improvements (5 items)

| # | Req | Item | Class | Notes |
|---|---|---|---|---|
| 7.1 | HIST-01 | Two tabs (Audit, Build) render | AC | Already pre-verified earlier this session. |
| 7.2 | HIST-02 | URL reflects active tab | AC | Click "Build Log" tab; URL should change to `/#/app/history/builds`. Reload — should stay on builds. |
| 7.3 | HIST-03 | Inline Expand toggle for long logs | AC | Test account has only short ERROR logs → button may not render (correct behaviour). Confirm `logIsTruncatable` predicate by inspecting DOM. |
| 7.4 | HIST-04 | Date-range filter on both tabs | AC | Set From/To → confirm rows filter. URL query `?from=...&to=...` updates. |
| 7.5 | HIST-05 | Audit text search + flag filter | AC | Uncheck "Danger" → confirm matching audit rows disappear. URL `?flags=warning,info` updates. |

### Phase 8 — Authentication Extras (6 items)

| # | Req | Item | Class | Notes |
|---|---|---|---|---|
| 8.1 | AUTH-01 | `/#/password-reset` unauthenticated | AC | Logout first; visit `/#/password-reset`; confirm no redirect to /login. |
| 8.2 | AUTH-02 | Initiate form (no token) | AC | Just check the page renders the email-input form. Do NOT actually submit (would trigger reset email to whatever address typed). |
| 8.3 | AUTH-02 | Confirm form (with token) | AC | Visit `/#/password-reset?reset_key=abc&owner=test` — confirm the two-password form renders instead of the email form. Do NOT submit (backend would 400 on the bogus key). |
| 8.4 | AUTH-02 | Forgot-password link on Login | AC | Logout, visit `/login`, confirm "Forgot password?" router-link exists between password field and footer. |
| 8.5 | AUTH-03 | Session-expiry timer (foreground) | PASS | Foreground 1-hour confirmed live 2026-05-24 (second user-walk, in vivo). |
| 8.6 | AUTH-03 | Belt-and-suspenders pre-request check | PASS | Synthetic walk 2026-05-27 via chrome-devtools MCP: backdated `localStorage.accessToken` exp → 60s ago, reloaded; verified redirect to `/#/login` + all 3 localStorage keys wiped + zero post-reload XHR calls. Code path: App.vue rehydrate → `setAccessToken(backdated)` → `scheduleExpiry` → `clearSession` chokepoint. `composeOptions` direct in-memory isolation not possible (prod bundle lacks `__vue__` exposure) but converges on same chokepoint; mitigation by code inspection. Full walk evidence: `09-UAT-SUMMARY.md` §"AUTH-03 laptop-sleep synthetic walk". |

## Summary by class

- **AC** (will walk now): 19 items
- **AC-DEST** (deferred, user-owned): 5 items
- **HN** (human needed — out-of-AI-scope): 1 item (PROF-04 negative; AUTH-03 1-hr closed 2026-05-24, laptop-sleep closed 2026-05-27 via synthetic walk)
- **BLOCKED** (blocked on external work): 1 item (DASH-04 zip — gated on `OPS-builder-broken`/G10 worker fix per 2026-05-27 audit)
- **PASS** (no action): 14 items (was 12 — added AUTH-03 8.5 + 8.6 after Phase 9 close-out walks)

Total: 33 items

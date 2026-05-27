# Milestones — THiNX Console Vue Migration

Index of shipped milestones. Each row links to its archived ROADMAP + REQUIREMENTS snapshot under `.planning/milestones/`.

---

## v1.999 — Vue Console Feature-Parity GA

**Shipped:** 2026-05-27
**Phases:** 11 (1-11)
**Plans executed:** 21 (via plan docs) + 2 quick tasks (`260520-w52` button polish, `260526-2d3` G9 selection-prune)
**Timeline:** 2026-05-18 → 2026-05-27 (9 days from kickoff to GA close-out)
**Tag:** v1.999
**Archives:** [v1.999-ROADMAP.md](milestones/v1.999-ROADMAP.md), [v1.999-REQUIREMENTS.md](milestones/v1.999-REQUIREMENTS.md)

### Delivered

Full feature parity between Vue console and the legacy AngularJS console, with AngularJS UI frozen. Device owners can now manage their IoT fleet end-to-end through the Vue SPA at `console.thinx.cloud` — devices, API keys, repositories, RSA keys, environment globals, mesh channels, transformers, firmware builds, profile + account settings, history (audit + build logs), password reset, session-expiry hygiene, and (v1.1 add-on) admin features (user list, session revocation, impersonation with banner+countdown).

### Key accomplishments

1. **Bug fixes + scaffolding cleanup (Phase 1)** — `stats.js` getter fix (boolean → state), 7 demo/template routes + page directories removed (Charts, Tables, Icons, Maps, Notifications, Typography, AnotherPage), AngularJS `$rootScope` refs cleaned from `Devices.vue#updateTimeline/updateCharts`.
2. **Full CRUD on 5 management pages (Phase 2)** — API Keys (with one-time key display modal), Repositories (auto-alias + duplicate detection + device count), RSA Keys (server-side generate + one-time private-key modal), Environment Globals, Mesh Channels.
3. **Transformers with code editor (Phase 3)** — Dedicated transformer endpoints (decoupled from `/profile`), `/app/transformer/:utid` route with CodeMirror/Monaco JavaScript editing, base64 round-trip on save/load, unsaved-changes guard.
4. **Device management parity (Phase 4)** — Category filter, sort, search, grid/list toggle, per-row + bulk Revoke/Transfer/Push Config, Build firmware (`POST /build`), Device Detail page (`/app/device/:udid`) with metadata + repository + build history + enviros + transformer assignment + logs + actions.
5. **Real dashboard (Phase 5)** — 6 metric cards from real `/stats` with today/week/month breakdowns, Timeline chart with 7/31/365-day range selector, Recent Builds widget, Recent Audit Events widget.
6. **User profile + account (Phase 6)** — Profile/Avatar/Notifications/Admin tabs, account-delete flow, header dropdown access, in-vivo merge-fix for notifications preserving info fields.
7. **History improvements (Phase 7)** — Split into Build Log / Audit Log tabs with URL state (`/app/history/builds` and `/audit`), inline log expand (HIST-03 scope revised mid-phase from modal to inline), date-range filter + flag filter with URL deep-link hydration.
8. **Authentication extras (Phase 8)** — `/password-reset` page with both initiate + confirm form modes, `auth/scheduleExpiry` + `clearSession` chokepoint (single teardown path: wipes 3 localStorage keys + commits null to 3 Vuex state pieces + cancels pending timer + redirects to `/#/login`), `Header.vue logout()` refactored onto the same chokepoint, `api.js#composeOptions` belt-and-suspenders pre-request exp check covers laptop-sleep edge case.
9. **Manual UAT close-out (Phase 9)** — 21/22 actionable items live-walked against `console.thinx.cloud` and Verified; G7/G8/G9 surfaced and all subsequently closed (G7 PROF-05 delete-success teardown at `0ac0811`, G8 password-reset 403 closed in parent monorepo's Phase 1 as AUTH-API-01, G9 Devices.vue selection-prune at `4be39f3`); AUTH-03 laptop-sleep belt-and-suspenders verified 2026-05-27 via synthetic JWT-backdate walk.
10. **Admin features v1.1 (Phase 10)** — Backend `requireAdmin` middleware + `lib/router.admin.js` (3 endpoints: paginated user list, session revocation via Redis blacklist, impersonation with 15-min JWT bearing `impersonator_owner` claim); frontend `/app/admin/users` route, `AdminUsers.vue` with plain `<table>` + custom pagination, sticky `ImpersonationBanner` above `<router-view>` with MM:SS countdown + Exit button, conditional sidebar nav, `Profile.vue` Admin tab now links to the admin console.
11. **v1 GA gap closures (Phase 11)** — Wave 1 (G8 backend `POST /api/v2/password/reset` 403) closed in parent monorepo as AUTH-API-01 (Bearer-null class-fix + response normalization, deployed as image `0a0e6b32`); Wave 2 (G9 Vue `revokeRow` selection-prune) shipped 2026-05-26 + live UAT Verified 2026-05-27.

### Process / context observations

- **Atomic commit discipline** — each phase shipped with checkpoint commits per plan + a phase SUMMARY commit; phase-9 added an UAT-SUMMARY artifact instead of a code-bearing SUMMARY. ~565 commits across the 9-day window.
- **Cross-repo coordination** — Phase 10 + Phase 11 spanned both this submodule and the parent monorepo (`thinx-device-api`); deploy unit was a parent submodule bump + `./restart.sh` on swarm host `188.166.23.244` (swarm auto-pull broken since 2026-05-25 — filed as `OPS-swarmpull` in v1.x backlog).
- **GPG signing degraded** — pinentry unreachable from 2026-05-26 onwards; ~22 commits across both repos intentionally unsigned by user authorization (see project memory `unsigned-commits-260526`).
- **Production build artifacts gap** — 2026-05-27 audit of `/mnt/gluster/thinx/deploy` confirmed `thinx_worker` has been broken since at least 2023 (6 FAILED + 1 aborted; 0 `firmware.bin` artifacts platform-wide); filed as `OPS-builder-broken` (G10) in v1.x backlog. This blocks the DASH-04 zip-download live-walk sub-criterion; widget render itself Verified.

### Known carry-over

- **DASH-04 zip-download sub-criterion** — Blocked on G10/OPS-builder-broken (no successful firmware build artifacts exist on the platform; needs worker fix before walk can complete). Widget render itself is Verified — this is purely the live-download confirmation gap.
- **PROF-04 negative case** — Still HN (needs a non-admin account to confirm Admin tab is hidden); not GA-blocking — positive case Verified.

### v1.x backlog seeded during v1.999

- `ADMIN-search` — Admin user-list search/filter (S)
- `AUTH-04` — Vue console signup form (M)
- `ADMIN-devcount` — Real `device_count` per user, currently placeholder 0 (S–M)
- `HIST-flags` — Native admin/impersonation flag chips on History page (XS)
- `OPS-swarmpull` — Diagnose swarm auto-pull failure (unknown)
- `OPS-builder-broken` (G10) — Fix `thinx_worker` so firmware builds succeed (unknown — out-of-repo)
- `CY-loginargs` — `cy.login(user, pass)` ignores its args (XS)
- `AUTH-bearer-null` — Vue console stops sending `Bearer null` on logged-out requests (XS — harmless under parent's class-fix backend guard, hygiene fix only)

Full per-item context: `.planning/v1.x-backlog.md`.

---

*Next: `/gsd-new-milestone` to scope v1.x from the backlog candidates above.*

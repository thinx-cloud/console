# Phase 10 Plan Review

**Date:** 2026-05-24
**Reviewer:** gsd-plan-checker
**Verdict:** PASS-WITH-NOTES

Plans verified:
- `.planning/phase-10/10-00-PLAN.md` (Wave 0 — Cypress stub, console submodule)
- `.planning/phase-10/10-01-PLAN.md` (Wave 1 — backend, parent monorepo)
- `.planning/phase-10/10-02-PLAN.md` (Wave 2 — frontend, console submodule)
- `.planning/phase-10/10-03-PLAN.md` (Wave 3 — close-out, console submodule)

Inputs cross-checked against the live tree:
- `vue/src/pages/Profile/Profile.vue:138-144` — placeholder block matches Wave 3 Task 1 target byte-for-byte.
- `vue/src/components/Sidebar/Sidebar.vue:1-95` — structure matches Wave 3 Task 2 assumptions; `</ul>` at line 62, Settings NavLink ends at line 59, blank line at 60-61.
- `vue/src/Routes.js:1-147` — children block at 51-121, profile child at 115-119, guard at 131-144, PUBLIC_PATHS at line 135 — all match Wave 2 Task 5 anchors.
- `vue/src/components/Layout/Layout.vue:1-14` — Header/Sidebar/content arrangement matches Wave 2 Task 6 insertion point.
- `vue/src/store/index.js:1-43` — import/modules layout matches Wave 2 Task 2 patch shape.
- `lib/router.js:102-113` (parent monorepo) — JWT-verify block matches Wave 1 Task 4 source verbatim.
- `lib/thinx/audit.js:13-29` — line 27 `"flags": [flag]` matches Wave 1 Task 2 target.
- `lib/thinx/jwtlogin.js:80-124` — `sign_with_refresh` closes at line 120, `// Step 3: Verify` at line 122, `verify_impl` at line 124 — matches Wave 1 Task 3 insertion point.
- `thinx-core.js:335-358` — router require block matches Wave 1 Task 6 insertion point; `router.user.js` at line 358 is the last existing entry.
- `vue/cypress/integration/history.spec.js` — canonical stub shape that Wave 0 mirrors.

---

## 1. Goal coverage

| ADMIN-XX | Delivered by | Verifiable? | Notes |
|---|---|---|---|
| ADMIN-01 (user list page + 403 for non-admins + `device_count: 0` placeholder) | Wave 1 Task 5 (`listUsers` handler) + Wave 1 Task 1 (`requireAdmin` returns 403) + Wave 2 Task 3 (`AdminUsers.vue` renders the table) + Wave 2 Task 5 (`ADMIN_PATHS` guard redirects non-admins) + Wave 3 Task 3 (Cypress ADMIN-01 assertion: `.table.table-striped` visible + rows > 0 + Prev/Next + `Page 1 /`) | yes | Cypress ADMIN-01 asserts on a deployed bundle; `device_count: 0` literal is grep-gated in Wave 1 Task 5 verify and rendered by Wave 2 Task 3 template column 5 |
| ADMIN-02 (force-logout via Redis blacklist + audit) | Wave 1 Task 5 (`revokeSession` writes `revoked:owner:{owner}` = `Date.now()` with TTL `7*24*60*60`; emits `["admin","revoke"]` audit) + Wave 1 Task 4 (router.js JWT-verify blacklist check 401s when `payload.iat * 1000 < parseInt(ts, 10)`) + Wave 2 Task 3 (`confirmRevoke` with `$bvModal.msgBoxConfirm`) + Wave 3 Task 3 (it.skip with HN-deferred justification → 10-HUMAN-UAT.md walk) | yes (mixed — code-verified + live-walk) | Cypress is `this.skip()` because revoking the test-fixture's own session would lock the CI suite out for the rest of the run; mirrors the documented PROF-04/AUTH-02 HN-deferred pattern. REQUIREMENTS.md row carries the explicit "Code-verified; live walk HN-deferred" wording |
| ADMIN-03 (impersonate non-admins, 15-min JWT, banner, exit, reject admin targets) | Wave 1 Task 3 (`sign_with_impersonation`: 15-min exp, `impersonator_owner` claim, no refresh) + Wave 1 Task 5 (`impersonate` handler: 403 with `"cannot_impersonate_admin"` on admin target, emits `["admin","impersonation","start"]`) + Wave 1 Task 4 (router.js injects `req.session.impersonator_owner` + per-request `["admin","impersonation"]` audit) + Wave 2 Task 3 (`confirmImpersonate`: localStorage swap + `removeItem('refreshToken')` + `setAccessToken` + `scheduleExpiry` + `$router.push('/app/dashboard')`) + Wave 2 Task 4 (`ImpersonationBanner.vue` with `decode()` in `created()` + `watch:$route` + 1s setInterval + `beforeDestroy` clearInterval + Exit → clearSession + push `/login`) + Wave 2 Task 6 (banner mount in Layout) + Wave 3 Task 3 (Cypress ADMIN-03 negative asserts no Impersonate button on rows containing "Yes") | yes (mixed) | Positive case (banner countdown, exit-to-login) is HN-deferred per Wave 3 Task 3 / REQUIREMENTS.md row; negative case (button hidden on admin rows) is Cypress-asserted on the test fixture's own row |

All UAT bullets in the ROADMAP.md Phase 10 section (lines 347-353) are concretely covered:
- "sidebar Admin link → user list loads" → Wave 3 Task 2 Sidebar NavLink + Wave 2 Task 3 AdminUsers.vue
- "device_count shows 0" → Wave 1 Task 5 listUsers + Wave 2 Task 3 template column 5
- "Revoke sessions on a non-admin row → confirm modal → success" → Wave 2 Task 3 confirmRevoke
- "Impersonate on a non-admin → banner with username + MM:SS countdown" → Wave 2 Tasks 3, 4
- "Under impersonation: audit entry with `flags: ['admin','impersonation']`" → Wave 1 Task 4 router.js per-request audit
- "Exit impersonation → /login, re-login as admin works" → Wave 2 Task 4 `exit()` calls `auth/clearSession` then `$router.push('/login')`
- "Non-admin gets 403 on every `/api/v2/admin/*`" → Wave 1 Task 1 requireAdmin
- "Impersonating an admin → 403, no token issued, UI shows error toast" → Wave 1 Task 5 `profile.admin === true` branch + Wave 2 Task 3 error surfacing

## 2. Locked-decision fidelity

| Decision | Honored? | Evidence |
|---|---|---|
| C1 plain `<table class="table table-striped">` + custom pagination, NOT `<b-table>` / `<b-pagination>` | yes | Wave 2 Task 3 template (10-02-PLAN.md lines 328-364) renders `<table class="table table-striped">` with `v-for="user in pagedUsers"`; custom Prev/Next b-button pair + `<span class="mx-2">Page {{ page }} / {{ totalPages }}</span>`. Verify gate (line 676) enforces `<b-table` count = 0 AND `<b-pagination` count = 0 AND `table table-striped` count = 1. Wave 3 verification step 6 (line 672) re-greps `<b-table` recursively across `vue/src/` as an anti-regression sweep. |
| C2 `redis@5.8.2` `.legacy()` callback API, NOT ioredis, NOT async/await | yes | Wave 1 Task 4 router.js patch (10-01-PLAN.md lines 412-425) uses `app.redis_client.get(..., (rerr, ts) => {...})`; Wave 1 Task 5 revokeSession (lines 533-540) uses `app.redis_client.set(key, now_ms, (serr) => {...})` + `app.redis_client.expire(key, 7*24*60*60)`. Action prose explicitly bans async/await (line 442, line 577). |
| C3 `alog.log()` direct library call, NOT a POST endpoint | yes | Wave 1 Task 4 (line 406-410) calls `alog.log(payload.impersonator_owner, "IMPERSONATED ...", ["admin", "impersonation"])` directly. Wave 1 Task 5 revokeSession (line 537) and impersonate (line 559) both use direct alog.log calls. The router.logs.js file is read-only (GETs only) and is NOT modified in any plan. |
| C4 1-line audit.js patch (`flags: Array.isArray(flag) ? flag : [flag]`) | yes | Wave 1 Task 2 (10-01-PLAN.md lines 264-298) replaces exactly line 27 of lib/thinx/audit.js with the canonical patch. Verify gate (line 286) asserts the new string appears 1x AND the old string appears 0x; acceptance criteria additionally require non-breaking semantics for existing string-flag callers (router.auth.js, apikey.js, router.google.js). |
| C5 `requireAdmin` uses `app.owner.profile(owner, cb)`, NOT `req.session.owner.admin` | yes | Wave 1 Task 1 (10-01-PLAN.md lines 213-223) — the canonical middleware body calls `app.owner.profile(owner, (success, profile) => { if (!success || !profile || profile.admin !== true) return res.status(403).end(); next(); });`. Verify gate (line 239) enforces `app.owner.profile(owner` count = 1 AND `profile.admin !== true` count = 1. |
| OQ-A Sidebar conditional Admin NavLink in Wave 3 | yes | Wave 3 Task 2 (10-03-PLAN.md lines 332-341) inserts `<template v-if="isAdmin"><h5 class="navTitle">ADMIN</h5><NavLink header="Admin Users" link="/app/admin/users" .../></template>`. `isAdmin` is a computed reading `this.getProfile()` via a `mapGetters` spread placed INSIDE `methods:` (Phase 6 G1). Verify gate (line 415) asserts the v-if appears and `navTitle">ADMIN` appears exactly once. |
| OQ-B `device_count: 0` placeholder | yes | Wave 1 Task 5 (line 513) emits `device_count: 0   // v1.1 follow-up (locked OQ-B)`. Verify gate (line 581) enforces `device_count: 0` count = 1. Wave 2 Task 3 template renders `{{ user.device_count }}` in column 5 with no client-side fallback computation. v1.1 follow-up is listed in the Out of Scope sections of all three plans. |
| Impersonating an admin → 403 | yes | Wave 1 Task 5 (line 556) — `if (profile.admin === true) return Util.failureResponse(res, 403, "cannot_impersonate_admin");`. Verify gate (line 581) asserts `cannot_impersonate_admin` appears 1x. Wave 2 Task 3 (line 351) — `<b-button v-if="!user.admin" ... @click="confirmImpersonate(user)">Impersonate</b-button>` AND Wave 3 Task 3 Cypress ADMIN-03 negative asserts `cy.contains('button', 'Impersonate').should('not.exist')` inside a row containing "Yes". |
| Audit log multi-flag `['admin', 'impersonation']` via library call | yes | Wave 1 Task 4 router.js per-request audit (line 409) — `["admin", "impersonation"]`. Wave 1 Task 5 revokeSession (line 537) — `["admin", "revoke"]`. Wave 1 Task 5 impersonate start (line 559) — `["admin", "impersonation", "start"]`. Verify gates (line 581) enforce both the `["admin", "revoke"]` and `["admin", "impersonation", "start"]` literal occurrences. The multi-flag form is only possible because Task 2 patched audit.js — the dependency chain is correct. |
| Coarse session revocation, Redis blacklist `revoked:owner:{owner}` storing `Date.now()` | yes | Wave 1 Task 5 (line 532-533) — `const key = "revoked:owner:" + target_owner; const now_ms = String(Date.now());`. TTL `7 * 24 * 60 * 60` (1 week) matches the refresh-token max lifetime (research §1.3). The auth-middleware check (Task 4 line 413) reads the same key and `parseInt(ts, 10)` compares to `payload.iat * 1000`. Coarse-only — no per-jti or per-session keys anywhere. |

## 3. Risk mitigation

| Risk | Mitigated? | Evidence |
|---|---|---|
| R1 Redis blacklist check fail-open on Redis outage | yes | Wave 1 Task 4 (10-01-PLAN.md lines 412-417) — `if (rerr) { console.log("[warning] blacklist check failed", rerr); return next(); }`. Acceptance criteria (line 459) require this branch; success criteria (line 705) require that bringing Redis down does NOT cause /api/v2/profile to 401. Threat T-10-01-03 documents the trade-off. |
| R3 (prompt label) / R4 (RESEARCH label) cold reload during impersonation | yes — banner re-reads JWT on both `created()` and `watch:$route` | Wave 2 Task 4 interfaces (10-02-PLAN.md lines 259-268) — `created() { this.decode(); ...setInterval(...) }`, `watch: { '$route'() { this.decode(); } }`. Note: the prompt labels this R3 but the actual RESEARCH §9 numbering has it as R4; substance is identical (cold-reload during impersonation). The decode-on-mount AND decode-on-route-change paths both reload the JWT claim, so the banner correctly appears after refresh or new-route entry. R/§6.4 also accepted as a known UX gap if the admin reloads mid-impersonation — banner correctly tells them what's happening; Exit clears it. |
| R5 setInterval leak | yes | Wave 2 Task 4 (10-02-PLAN.md line 263-265) — `beforeDestroy() { if (this.tickerId) clearInterval(this.tickerId); }`. Verify gate (line 734) enforces `setInterval` count = 1, `clearInterval` count = 1, `beforeDestroy` count = 1. Threat T-10-02-04 ties this to the auth/clearSession teardown path. |
| R10 per-request `userlib.get` (via `app.owner.profile`) cost | yes — explicitly acknowledged with rationale | Wave 1 Task 1 (10-01-PLAN.md line 233) — `Cache the admin flag in Redis (research §0.5 (c) — admin endpoints are low-traffic; one CouchDB lookup per call is fine for v1).` and threat T-10-01-01 (line 661) — `No JWT-claim cache — the admin flag is read from CouchDB on every admin call.`. The plan does NOT take a shortcut here; the per-request cost is accepted as the v1 trade-off, with research §0.5 documenting the future Redis-cache path. |

## 4. Findings

### F-1 (severity: low): Wave 1 Task 2 verify gate swallows npm-test failures

- Location: `.planning/phase-10/10-01-PLAN.md` line 286 (verify automated block)
- Issue: The automated gate ends with `... npm test --silent 2>&1 | tail -20 || true`. The `|| true` makes any test failure invisible to the executor's pass/fail evaluation. Acceptance criteria (line 294) does require "Existing parent-repo `npm test` suite still passes" but the gate won't catch it.
- Fix: Remove the `|| true` so the verify step fails loudly if existing tests regress. Or move `npm test` out of the per-task verify and into the wave-level `<verification>` block where it already lives (line 677).

### F-2 (severity: low): Wave 2 Task 1 plan cites wrong line numbers in `core/api.js`

- Location: `.planning/phase-10/10-02-PLAN.md` line 99, line 150, line 480-481
- Issue: Plan repeatedly references `core/api.js:50-52` as the source of the `/api/v2` prefix injection, but the actual location is line 12 (`this.apiPath = '/api/v2';`).
- Fix: Update three references to point at line 12. Cosmetic — does not change behavior since the plan's prescribed paths (`/admin/users`, etc.) are correct.

### F-3 (severity: low): Wave 1 Task 3 has two slightly inconsistent anchor descriptions

- Location: `.planning/phase-10/10-01-PLAN.md` line 310 vs line 354
- Issue: Line 310 says "BEFORE the `// Step 3: Verify` comment block (current line 122)" but line 354 acceptance text says "sits BETWEEN sign_with_refresh (closing `}` at original line 120) and the `// Step 3: Verify` comment block". Actual file: `}` at 120, comment at 122, `verify_impl` at 124. Both anchors point to the same place; wording is fine, but a curious executor might double-check.
- Fix: None required — both descriptions resolve to the same insertion point. Consider unifying for clarity.

### F-4 (severity: low): Wave 3 Task 3's `this.skip()` strategy carries documented HN-deferred risk

- Location: `.planning/phase-10/10-03-PLAN.md` lines 466-475 + REQUIREMENTS row wording at 540-542
- Issue: ADMIN-02 and ADMIN-03 positive Cypress assertions are runtime-skipped because the test fixture is itself an admin and the destructive actions would either lock out the CI account (revoke) or have no non-admin target row (impersonate). REQUIREMENTS.md is updated with "Code-verified; live walk HN-deferred per 10-HUMAN-UAT.md" wording. Threat T-10-03-03 explicitly accepts this gap.
- Fix: None required — mirrors the project's documented PROF-04 / AUTH-02 / HIST-03 deferral pattern. Authoring 10-HUMAN-UAT.md is listed as an out-of-scope follow-up in Wave 3 (line 708); recommend authoring it BEFORE flipping the REQUIREMENTS rows so the "per 10-HUMAN-UAT.md" pointer is not a dangling reference at close-out.

### F-5 (severity: low): Wave 3 Task 5's ROADMAP grep gate is too loose

- Location: `.planning/phase-10/10-03-PLAN.md` line 625
- Issue: The verify gate `grep -c 'Status:\\*\\* Complete' .planning/ROADMAP.md >= 1` will match the Status line for any phase, not specifically Phase 10. Phases 4, 5, 6, 7, 8 already say "Complete" in their status. The gate would pass even if Phase 10 was not flipped.
- Fix: Tighten to `grep -c 'Phase 10.*Complete'` or anchor on the exact wording inserted (e.g. `Wave 0 stub`).

### F-6 (severity: low): R6 (b-table accidentally introduced) and R7 (deploy ordering) are well-covered but not enumerated in the prompt's risk list

- Location: across plans
- Issue: The prompt asked to verify R1, R5, R3, R10. The RESEARCH.md §9 risk register has 10 risks; R6 (b-table regression) is also a stated risk and is mitigated by Wave 2 Task 3 verify gate `<b-table` count = 0 + Wave 3 verification step 6 recursive sweep. R7 (deploy ordering) is mitigated by the explicit Wave 2 objective note "Wave 1 must merge to parent thinx-staging FIRST" (line 93). Worth flagging that all enumerated risks (not just the prompt's four) are addressed.
- Fix: None — informational only.

---

## 5. Verdict

**PASS-WITH-NOTES.** Plans deliver the Phase 10 goal end-to-end. The union of Wave 0 + Wave 1 + Wave 2 + Wave 3 replaces the Profile.vue Admin tab placeholder with three real, user-driven capabilities (user list, session revocation, impersonation with banner + countdown + exit). All five locked CONTEXT.md corrections (C1-C5) are honored at the implementation-instruction level, not merely referenced — each plan task encodes the corrected behavior in the action body and enforces it via grep-based verify gates. Both newly locked decisions (OQ-A sidebar NavLink in Wave 3 Task 2; OQ-B `device_count: 0` placeholder in Wave 1 Task 5) are implemented as specified. The four highest-impact risks called out in the prompt (R1 Redis fail-open, R5 setInterval leak, R3 cold-reload banner refresh, R10 per-request `userlib.get` cost) are mitigated in the right places with the right wording; R6 (b-table anti-regression) and R7 (cross-repo deploy ordering) get equal treatment via verify gates and explicit "Wave 1 must merge first" notes.

Cross-cutting constraints hold: no new npm packages (success criteria + verify gates across all four plans); `mapGetters` stays in `methods:` (Phase 6 G1 — enforced in Wave 2 Task 3 + Wave 3 Task 2 verify gates and acceptance criteria); plain `<table>` + custom pagination (C1 — Wave 2 Task 3 verify gate `<b-table` count = 0 + Wave 3 verification step 6 recursive sweep). Cross-repo coupling is unambiguous: Wave 1 frontmatter declares `repo: parent-monorepo`; Waves 0/2/3 declare `repo: console-submodule`; Wave 2 objective explicitly states it depends on Wave 1 being live in parent `thinx-staging` before deploy. Out-of-scope hygiene is consistent — each plan declares what it does NOT do, and `device_count` v1.1 + cross-admin impersonation + per-session granularity are explicitly deferred at all four plan boundaries.

The six findings are all low-severity polish items: a too-permissive `|| true` in one verify gate (F-1), three cosmetic line-number/wording references (F-2, F-3, F-6), an HN-deferred Cypress pattern that mirrors existing project precedent (F-4), and one loose grep gate that could pass on a Phase 10 non-flip (F-5). None of them disqualify the plans for execution. The plans can ship as-is; F-1 and F-5 are worth tightening opportunistically (each is a 1-line edit), and F-4 has a meaningful follow-up (author `10-HUMAN-UAT.md` before flipping REQUIREMENTS rows so the cross-references aren't dangling at close-out).

**Recommendation:** Proceed to execute Wave 0, then Wave 1, then Wave 2 (after Wave 1 is live in parent `thinx-staging`), then Wave 3. Address F-1 and F-5 inline during execution if convenient; do not block waves on them.

---
phase: 4
slug: device-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-20
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Cypress 9.5.4 |
| **Config file** | `vue/cypress.json` |
| **Quick run command** | `yarn cy:open` (interactive) |
| **Full suite command** | `yarn test` (requires dev server on :3000) |
| **Estimated runtime** | ~2–5 minutes (e2e, server required) |

---

## Sampling Rate

- **After every task commit:** Manual browser review (dev server at :3000)
- **After every plan wave:** `yarn cy:open` — run devices + device-detail specs interactively
- **Before `/gsd:verify-work`:** All spec assertions green
- **Max feedback latency:** Browser reload

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-xx-01 | xx | 1 | DEVI-01 | — | N/A | e2e | `yarn cy:open` → devices spec | ❌ Wave 0 | ⬜ pending |
| 4-xx-02 | xx | 1 | DEVI-02 | — | N/A | e2e | `yarn cy:open` → devices spec | ❌ Wave 0 | ⬜ pending |
| 4-xx-03 | xx | 1 | DEVI-03 | — | N/A | e2e | `yarn cy:open` → devices spec | ❌ Wave 0 | ⬜ pending |
| 4-xx-04 | xx | 1 | DEVI-04 | — | N/A | e2e | `yarn cy:open` → devices spec | ❌ Wave 0 | ⬜ pending |
| 4-xx-05 | xx | 1 | DEVI-05 | — | N/A | e2e | `yarn cy:open` → devices spec | ❌ Wave 0 | ⬜ pending |
| 4-xx-06 | xx | 1 | DEVI-10 | — | N/A | e2e | `yarn cy:open` → device-detail spec | ❌ Wave 0 | ⬜ pending |
| 4-xx-07 | xx | 1 | DEVI-11 | — | N/A | e2e | `yarn cy:open` → device-detail spec | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vue/cypress/integration/devices.spec.js` — covers DEVI-01 through DEVI-09 (filter, sort, search, toggle, per-row revoke)
- [ ] `vue/cypress/integration/device-detail.spec.js` — covers DEVI-10 and DEVI-11 (navigation, all sections render)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| One-time build toast appears | DEVI-09 | Requires real device + server | Trigger build, verify success/error message |
| Transfer dispatches to correct API | DEVI-07 | Requires real device + owner | Open transfer modal, submit, check network tab |
| Push config sends selected env vars | DEVI-08 | Requires real device + env vars | Open push modal, select vars, submit |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency acceptable (browser reload)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

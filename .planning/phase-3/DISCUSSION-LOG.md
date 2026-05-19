# Phase 3: Transformers with Code Editor - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 3-Transformers with Code Editor
**Areas discussed:** TRAN-01 scope, Duplicate alias guard, Post-save navigation, btoa safety

---

## TRAN-01 Scope

First clarified that the user expected editing without submitting the whole profile. Explained the backend constraint: no dedicated `/transformer` CRUD endpoints exist; `POST /api/v2/profile` with `{ transformers: [...] }` is the only write path, and it updates only the `transformers` field (not the full profile blob).

| Option | Description | Selected |
|--------|-------------|----------|
| Verify and document only | Store is already isolated; planner adds a comment explaining the constraint | |
| Rename/restructure fetchItems | Refactor to make the profile dependency less surprising | |
| User's initial response | "Seems to allow editing transformers without submitting whole /profile" | (clarification needed) |
| Accept current behavior | Current POST /profile approach is correct; verify isolation + add comment | ✓ |
| Raise backend gap | Document TRAN-01 as partial gap like REPO-05 | |

**User's choice:** Accept current behavior (after constraint clarification)
**Notes:** User initially expected a dedicated transformer endpoint but accepted the profile-based approach once the backend constraint was confirmed.

---

## Duplicate Alias Guard

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — add it | Mirror REPO-03 pattern from Repositories.vue | ✓ |
| No — skip it | Allow duplicate aliases, let backend handle | |

**User's choice:** Yes — add it
**Notes:** No additional notes.

---

## Post-save Navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Stay on editor page | Show green banner, keep editor open (current behavior) | |
| Navigate back to list | Redirect to /app/transformers on successful save | ✓ |

**User's choice:** Navigate back to transformer list
**Notes:** Clear `hasChanges = false` before navigating to avoid triggering the `beforeRouteLeave` guard.

---

## btoa Safety

| Option | Description | Selected |
|--------|-------------|----------|
| Add UTF-8 safe wrapper | btoa(unescape(encodeURIComponent(body))) encode; decodeURIComponent(escape(atob(s))) decode | ✓ |
| Keep as-is, show error on failure | Leave btoa/atob raw; catch and show error banner | |

**User's choice:** Add UTF-8 safe wrapper
**Notes:** Standard browser-safe pattern; no new dependencies. Existing try/catch on decode remains as a fallback.

---

## Claude's Discretion

- CodeMirror editor height (400px), theme (material), tab size (2), line numbers — maintain current values
- Success feedback UX on save — redirect to list is the primary signal; brief toast optional

## Deferred Ideas

None — discussion stayed within phase scope.

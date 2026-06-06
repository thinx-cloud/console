# Task Grooming

## Purpose

Provide a concise, consistent standard for turning backlog ideas, implementation plan entries, and GitHub issues into PR-ready tasks.

## PR-Ready Task Template

Use this format when a task is ready to assign or implement:

- Title: Short, imperative, and specific.
- Problem statement: What is broken, missing, unclear, or risky today.
- User impact: Who is affected and what improves when the task is done.
- Scope: Files, behavior, or surfaces expected to change.
- Non-goals: Adjacent work that is intentionally excluded.
- Acceptance criteria: Measurable conditions that must be true before the PR is complete.
- Verification: Commands, manual checks, or review steps that prove the acceptance criteria.
- Dependencies: Required backend endpoints, design decisions, credentials, feature flags, or prior tasks.
- Estimate: T-shirt size or hours/days.
- Owner: GitHub username or team.
- Assumptions: Scope constraints or facts that must hold for the estimate to stay valid.
- Links: Related docs, decisions, legacy files, issues, or PRs.

## Grooming Checklist

- Ambiguity: The problem, expected behavior, and excluded work are explicit.
- Testability: Every acceptance criterion has a matching verification step.
- Scope size: The task is small enough for one focused PR, preferably no more than two days.
- Dependencies: Blockers, API contracts, credentials, and sequencing requirements are named.
- Definition of done: The task states what must be changed, reviewed, tested, and documented.

## When To Use

Use this template when creating or refining issues, project board cards, implementation plan entries, or deferred backend work. Keep entries small, measurable, and linked to the source context that justifies the work.

## Examples

### 1. Fix Stats Getter In Vue Store

- Title: Fix stats getter in Vue store.
- Problem statement: The stats getter returns `!state.accessToken`, so dashboard consumers receive a boolean instead of stats data.
- User impact: Console users cannot rely on dashboard metrics until the store returns the fetched stats payload.
- Scope: Update `vue/src/store/stats.js` and add focused store coverage.
- Non-goals: Redesign dashboard cards, change `/../user/stats`, or add new dashboard metrics.
- Acceptance criteria:
  - `stats.getter` returns `state.stats`.
  - Existing dashboard code receives the stats object after `fetchStats` completes.
  - A unit test fails on the old getter behavior and passes with the fix.
- Verification:
  - Run the Vue unit test that covers the stats getter.
  - Run a smoke check confirming the dashboard renders metrics instead of a boolean value.
- Dependencies: Existing stats store and `/../user/stats` response shape.
- Estimate: 1-2 hours.
- Owner: @maintainer.
- Assumptions: No API contract changes are required.
- Links: `IMPLEMENTATION_PLAN.md` Phase 1.1, `vue/src/store/stats.js`.

### 2. Implement Create And Delete For API Keys

- Title: Implement create and delete for API keys.
- Problem statement: The API Keys page can list keys but cannot create, revoke, or remove selected keys from the visible list.
- User impact: Console users must leave the Vue console to manage API keys, which blocks migration from the legacy console.
- Scope: Update `vue/src/store/apikeys.js` and `vue/src/pages/Apikeys/` create/delete flows.
- Non-goals: API key editing, permission model changes, or backend endpoint changes.
- Acceptance criteria:
  - The existing "Add" action opens a create modal with an alias field.
  - Submitting the modal sends `POST /apikey` with `{ alias }`.
  - The generated key is shown exactly once after creation.
  - Single-row delete sends `DELETE /apikey` with `{ key_hash }` and removes the row after success.
  - Bulk delete iterates selected key hashes and refreshes or updates the list after success.
- Verification:
  - Run the API key store unit tests for create and delete mutations/actions.
  - Manually create an API key in staging and confirm the generated key appears once.
  - Manually delete one key and a selected group, then confirm the table updates.
- Dependencies: `POST /apikey` and `DELETE /apikey` endpoints exist and match the documented payloads.
- Estimate: 2-4 days.
- Owner: @frontend-team.
- Assumptions: Generated key material is returned only in the create response and is not retrievable later.
- Links: `IMPLEMENTATION_PLAN.md` Phase 2.1.

### 3. Remove Demo And Template Routes

- Title: Remove demo and template routes.
- Problem statement: The Vue console still exposes scaffolded template pages that have no legacy-console equivalent.
- User impact: Users see navigation entries that do not manage THiNX devices or account data.
- Scope: Remove demo route imports, route entries, and unused page directories under `vue/src/pages/`.
- Non-goals: Sidebar redesign, route guard changes, or replacement feature pages.
- Acceptance criteria:
  - `vue/src/Routes.js` no longer imports or registers Typography, Tables, Notifications, Icons, Maps, Charts, or AnotherPage.
  - The corresponding demo page directories are removed.
  - No remaining import references point at the removed pages.
  - The Vue build completes without route or module resolution errors.
- Verification:
  - Run `rg` for the removed route component names and confirm no active references remain.
  - Run the Vue build.
  - Manually load the app navigation and confirm the removed demo routes are not reachable.
- Dependencies: None.
- Estimate: 1-2 hours.
- Owner: @cleanup.
- Assumptions: No production customization is stored in the scaffolded demo pages.
- Links: `IMPLEMENTATION_PLAN.md` Phase 1.2, `vue/src/Routes.js`.

## Notes

Prefer one groomed task per PR. Split tasks when acceptance criteria span unrelated modules, require different owners, or cannot be verified with one coherent test plan.

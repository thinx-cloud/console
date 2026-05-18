TASK_GROOMING.md

Purpose

Provide a concise, consistent task template and examples for grooming and PR-ready task descriptions.

Task template

- Title: Short, imperative
- Goal: One-sentence objective
- Acceptance criteria: Measurable conditions for done (list)
- Steps: Minimal implementation steps (ordered)
- Estimate: T-shirt or hours
- Owner: GitHub username or team
- Assumptions: Any scope constraints, environment, or exclusions

When to use

Use this template when creating or refining issues, project board cards, or implementation plan entries. Keep entries small and testable.

Examples

1) Title: Fix stats getter in Vue store
Goal: Ensure dashboard receives real stats data
Acceptance criteria:
- stats.getter returns state.stats
- Dashboard displays metrics (smoke test)
Steps:
1. Edit vue/src/store/stats.js getter to return state.stats
2. Add unit test asserting getter value
3. Deploy to staging and confirm dashboard renders
Estimate: 1-2 hours
Owner: @maintainer
Assumptions: No API changes; only frontend fix

2) Title: Implement create/delete for API Keys
Goal: Enable creating and revoking API keys in Vue console
Acceptance criteria:
- Create modal posts to POST /apikey and shows generated key in one-time modal
- Delete sends DELETE /apikey and removes key from list
Steps:
1. Add create/delete actions+mutations in vue/src/store/apikeys.js
2. Add create modal wired to existing "Add" button
3. Add per-row delete and bulk-delete handling
Estimate: 2-4 days
Owner: @frontend-team
Assumptions: Backend endpoints exist as documented

3) Title: Remove demo/template routes
Goal: Remove scaffold demo pages from Routes.js and delete unused pages
Acceptance criteria:
- Routes.js no longer imports demo pages
- Corresponding demo page directories removed
- No runtime errors in build
Steps:
1. Remove demo route imports in vue/src/Routes.js
2. Delete demo page directories under vue/src/pages/
3. Run build to verify
Estimate: 1-2 hours
Owner: @cleanup
Assumptions: No customizations in demo pages are required

Notes

Keep groomed tasks small (<= 2 days) and include owner and acceptance criteria. Link back to this file in implementation docs and README.

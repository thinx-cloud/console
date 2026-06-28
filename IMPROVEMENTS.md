# THiNX Console — Improvements & Deferred Backend Work

This file tracks backend and cross-cutting improvement items that were surfaced during the Vue console migration but deferred because they require backend changes, infrastructure work, or significant cross-cutting effort not in scope for the current migration phase.

## Backend API Improvements

### Add Per-Device Build History Endpoint

- Title: Add `GET /device/:udid/builds`.
- Problem statement: The Vue console currently fetches the full account-wide build log via `GET /logs/build` and filters client-side by `udid` in `DeviceDetail.vue`.
- User impact: Device detail pages can load more data than needed and cannot rely on server-side pagination for per-device build history.
- Scope: Add a backend endpoint that returns build history for one device UDID, with pagination metadata or documented pagination parameters.
- Non-goals: Reworking account-wide build logs, changing audit log behavior, or redesigning the Device Detail UI.
- Acceptance criteria:
  - `GET /device/:udid/builds` returns only build records for the requested `udid`.
  - The endpoint supports pagination or documents a bounded response limit.
  - Authorization matches existing device/build-log access rules.
  - The response shape is documented for the Vue console.
- Verification:
  - Add backend tests for authorized access, unauthorized access, missing device, and pagination or response-limit behavior.
  - Run the backend test suite that covers device build history.
  - Manually compare one device's endpoint response with the filtered `GET /logs/build` result for the same `udid`.
- Dependencies: Existing build log storage and device authorization rules.
- Estimate: M, 1-2 days.
- Owner: @backend-team.
- Assumptions: Existing build log records include `udid` or another stable device identifier.
- Links: `IMPLEMENTATION_PLAN.md` Phase 4, plan 04-02; surfaced by Phase 4 (DEVI-11); decision ref D-08.

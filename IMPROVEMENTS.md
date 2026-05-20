# THiNX Console — Improvements & Deferred Backend Work

This file tracks backend and cross-cutting improvement items that were surfaced during the Vue console migration but deferred because they require backend changes, infrastructure work, or significant cross-cutting effort not in scope for the current migration phase.

## Backend API Improvements

- **GET /device/:udid/builds** — Per-device build history endpoint. Currently the Vue console fetches the full account-wide build log via `GET /logs/build` and filters client-side by `udid` in `DeviceDetail.vue` (see Phase 4, plan 04-02). A dedicated endpoint would reduce payload size and allow server-side pagination. Surfaced by: Phase 4 (DEVI-11). Decision ref: D-08.

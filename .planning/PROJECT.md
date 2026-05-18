# THiNX Console — Vue Migration

## What This Is

THiNX is an IoT device management platform. This project is the web console service: a Vue 2 SPA (`vue/`) that manages devices, API keys, firmware builds, transformers, and user accounts. A legacy AngularJS console (`src/`) remains frozen and deployed; all new feature work targets the Vue console only.

## Core Value

Device owners can fully manage their IoT fleet through the Vue console without ever needing the legacy AngularJS UI.

## Requirements

### Validated

- ✓ User can log in and log out — Phase 0 (existing)
- ✓ User can view device list — Phase 0 (existing, read-only)
- ✓ User can view API keys, repositories, RSA keys, enviros, channels, history — Phase 0 (existing, read-only)

### Active

- [ ] Bug fixes and scaffolding cleanup (broken getters, AngularJS refs in Vue, demo pages removed)
- [ ] Full CRUD for API keys, repositories, RSA keys, environment globals, mesh channels
- [ ] Transformer editor with code editor (CodeMirror/Monaco)
- [ ] Device actions: revoke, transfer, config push, build firmware
- [ ] Device detail page (`/app/device/:udid`)
- [ ] Functional dashboard with real stats from `/stats` endpoint
- [ ] User profile and account settings page
- [ ] History improvements: tab split, build log viewer, search/filter
- [ ] Password reset page

### Out of Scope

- InfluxDB / Chronograf migration — existing `/stats` endpoint is sufficient for v1 dashboard
- AngularJS console enhancements — legacy UI is frozen
- Mobile app — web-first
- Real-time push updates — polling/refresh is acceptable for v1
- GDPR consent page — low priority, deferred

## Context

- Legacy console lives in `src/` — deployed at rtm.thinx.cloud — **do not modify**
- Vue console lives in `vue/` — deployed at staging.thinx.cloud
- Vue console uses Vuex for state, Vue Router for navigation, BootstrapVue for UI
- All 9 management pages exist as read-only stubs — store modules have fetch actions but no create/update/delete mutations
- Detailed implementation plan with API endpoint mapping: `services/console/IMPLEMENTATION_PLAN.md`
- Codebase map: `.planning/codebase/`

## Constraints

- **Tech stack**: Vue 2 + Vuex + Vue Router + BootstrapVue — do not introduce Vue 3 or other frameworks
- **API**: All endpoints are already defined in the legacy console (`thinx-api.js`) — no backend changes needed
- **Legacy**: `src/` directory is frozen — no changes, no feature parity obligation
- **Dockerfile**: Fix `NODE_ENV=development` hardcode before any production deploy

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Freeze AngularJS, grow Vue only | Dual-maintenance is unsustainable; Vue is the future | — Pending |
| Use existing `/stats` endpoint for dashboard | InfluxDB migration is a separate infrastructure concern | — Pending |
| Fine-grained phases (8) | Changes are risky; atomic phases allow safe rollback | — Pending |

---
*Last updated: 2026-05-18 after initial project setup*

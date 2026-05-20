# Phase 4: Device Management - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 4-Device Management
**Areas discussed:** Filter / Sort / Search toolbar, Grid view card design, Device detail sections, Single revoke from list

---

## Filter / Sort / Search Toolbar

| Option | Description | Selected |
|--------|-------------|----------|
| Colored pill buttons | Row of b-button pills, one per category + "All" | ✓ |
| Dropdown select | Single b-form-select with color-coded options | |
| You decide | Claude chooses | |

**User's choice:** Colored pill buttons

---

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcode same 7 from legacy | Values from src/app/js/main.js | ✓ |
| Configurable via config.js | Add to vue/src/config.js | |
| You decide | Claude picks | |

**User's choice:** Hardcode same 7 (yellow-crusta, red-intense, purple-studio, blue, green, green-dark, grey-mint)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Client-side only (Recommended) | All filtering computed from in-memory list, no API calls | ✓ |
| Server-side via query params | Would require backend changes | |

**User's choice:** Client-side only

---

| Option | Description | Selected |
|--------|-------------|----------|
| Clickable column headers | Click column to sort, click again to reverse | |
| Dropdown select above the table | Separate sort dropdown | ✓ |

**User's choice:** Dropdown select above the table

---

| Option | Description | Selected |
|--------|-------------|----------|
| Single toolbar row (Recommended) | grid/list toggle \| category pills \| spacer \| sort dropdown \| search input | ✓ |
| Two rows | Category pills on top, sort + search below | |

**User's choice:** Single toolbar row

---

| Option | Description | Selected |
|--------|-------------|----------|
| Alias + MAC (Recommended) | Matches legacy propsFilter behavior | ✓ |
| Alias only | Simpler | |

**User's choice:** Alias + MAC

---

## Grid View Card Design

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal | Category dot + alias + platform + status | |
| Rich | Category icon + alias + platform + firmware + last seen + actions | ✓ |
| You decide | Claude picks | |

**User's choice:** Rich grid card

---

| Option | Description | Selected |
|--------|-------------|----------|
| Icon buttons in toolbar row (Recommended) | Two small icon buttons, active highlighted | ✓ |
| Separate toggle above toolbar | Explicit label with list/grid options | |

**User's choice:** Icon buttons in toolbar row

---

| Option | Description | Selected |
|--------|-------------|----------|
| Bootstrap responsive (Recommended) | col-12 col-sm-6 col-md-4 | ✓ |
| Fixed 3 columns | Breaks on mobile | |

**User's choice:** Bootstrap responsive (col-12 col-sm-6 col-md-4)

---

## Device Detail Sections

| Option | Description | Selected |
|--------|-------------|----------|
| Filter buildlog store by udid (Recommended) | Client-side filter of existing buildlog store | ✓ (with note) |
| Dedicated devices/fetchBuildLog action | New backend endpoint | |

**User's choice:** Filter buildlog by udid; also add task to IMPROVEMENTS.md for dedicated per-device endpoint
**Notes:** User requested adding "Add a new devices/fetchBuildLog action for this device's specific history" to IMPROVEMENTS.md

---

| Option | Description | Selected |
|--------|-------------|----------|
| Show global enviro list as read-only | Enviros from enviros store | |
| Skip this section | Mark DEVI-11 partial | |
| POST /api/device/envs endpoint exists | backend endpoint exists, device.environment in payload | ✓ |

**User's choice:** Device enviros are part of the device list payload as `device.environment` (masked). Display from existing data.
**Notes:** User provided backend code showing `environment: this.maskedEnvironment(dvc)` in the device list response

---

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only list of transformer aliases (Recommended) | Look up UTIDs in transformers store | |
| Editable dropdown | Full add/remove management | ✓ |

**User's choice:** Editable dropdown to add/remove transformer assignments

---

| Option | Description | Selected |
|--------|-------------|----------|
| POST /device with changes.transformers (Recommended) | Uses existing updateDevice action | ✓ |
| Dedicated transformer assignment endpoint | Requires backend investigation | |

**User's choice:** POST /device with { udid, changes: { transformers: [...utids] } }

---

| Option | Description | Selected |
|--------|-------------|----------|
| Build log filtered by last_build_id (Recommended) | Use buildlog store + filter | ✓ |
| Live log stream via websocket | Real-time, out of scope | |
| You decide | Claude determines feasibility | |

**User's choice:** Build log entries filtered by device's last_build_id

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — add Transfer button to Actions card (Recommended) | Reuse transfer modal, transferDevices([udid]) | ✓ |
| No — transfer from list only | Skip on detail page | |

**User's choice:** Yes — add Transfer button to detail page Actions card

---

## Single Revoke from List

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — per-row Revoke button in table (Recommended) | Danger button, msgBoxConfirm, revokeDevices([udid]) | ✓ |
| No — detail page is sufficient | Keep list Actions column minimal | |

**User's choice:** Add per-row Revoke button in the device list table Actions column

---

## Claude's Discretion

- SCSS/styling for category color pills — mapping category names to BootstrapVue variants or inline styles
- Exact sort behavior (stable sort, tie-breaking)
- Empty state for build history
- Whether transformer dropdown shows alias or UTID (alias preferred)
- IoT icon display (device.icon, values 1–72) — deferred to Deferred Ideas

## Deferred Ideas

- Dedicated per-device build history API endpoint — add to IMPROVEMENTS.md as backend improvement
- Real-time device log streaming via WebSocket — out of scope for v1
- Category assignment editing from list/detail — not in Phase 4 scope
- IoT icon display (device.icon 1–72) — deferred

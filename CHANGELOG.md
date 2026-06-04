# Changelog

All notable changes to the THiNX Device Console are documented here.
Changes are grouped by release date and conventional-commit type.

---

## [Unreleased] — Phase 3 (2026-05-19+)

### Fixed
- **TRAN**: Replace `Math.random()`-based utid with `crypto.randomUUID()` for cryptographically secure transaction IDs

---

## [2026-05-19] — Phase 2 Feature Completion

### Added
- **AKEY-02 / RKEY-02**: Copy-to-clipboard button in one-time API key modals (both add-key and revoke-key flows)
- **REPO-03**: Duplicate alias guard in the Repositories create modal — prevents creating a repository with an existing alias

### Documented
- **REPO-05**: Backend gap noted — `GET /source` returns no device count field; UI falls back gracefully

### Fixed
- Re-enabled test step in CI pipeline after earlier temporary skip

---

## [2026-03] — Vue Console Migration

### Added
- Vue console: initial implementation plan and step 1 scaffold
- Vue console: phase 2 — routing and store integration
- Vue console: phase 3 — CodeMirror transformer editor
- Vue console: phase 4/5 — device detail views
- Vue console: phase 7 — history and profile page fixes
- Allow building Vue console as a parallel build target

### Changed
- Guard auth redirects in Vue console to prevent unauthenticated navigation
- Reduce noisy `console.*` calls in Vue navigation
- Clean up unused template features and legacy header notification menus

### Fixed
- Login autocomplete attributes (`autocomplete="username"` / `"current-password"`)
- Vue navigation console errors during route transitions
- Transformer editor data flow fix
- Restore device list display when search input is cleared
- Dependency updates merged (March 31)

---

## [2026-02] — Content Security Policy

### Added
- CSP response headers for the Vue console and legacy AngularJS console
- CSP fix for GitHub OAuth redirect sources

---

## [2025-11] — Infrastructure

### Changed
- Extracted developer environment builds to external git/Docker repos to reduce main repo surface
- Updated base dependency (November)

---

## [2025-05] — Build Pipeline Stabilisation

### Fixed
- Pinned Node.js to v22 in build image; forced re-install inside the build process to fix `vue-cli-service: not found`
- Resolved `nvm.sh command not found` in CircleCI shell environment
- Fixed missing `vue-cli` pre-install step and legacy peer deps issue
- Corrected production server URL and port defaults
- Reverted XHR datatype after API-side JSON content-type fix
- Eliminated ESLint warnings blocking Vue console build
- Vue console loading fix (two passes)
- Downgraded echarts to restore compatibility

### Changed
- Updated alpine base image to `3.21-slim`
- Removed deprecated "deploy" terminology from step names
- Updated `.gitignore` and registry restart after SSL certificate change
- Updated base images to reduce known vulnerabilities; removed unused SonarCloud integration
- Updated AppSec validation rules (March 2025)

---

## [2024-10 – 2024-11] — CI & Security Tooling

### Added
- Snyk container and code security scanning workflows (GitHub Actions)
- `procps` package to Alpine image to fix `spawn ps ENOENT` runtime error

### Changed
- CircleCI Docker Orb updated
- Updated dev environment to reduce vulnerabilities and prepare for Node.js v23
- Nginx version updated
- Renamed CI step names to remove "deploy" string

### Fixed
- Fix for Vue console deployment step (legacy already fixed)
- Cypress fixture updated with production `serverUrl`
- Build step ordering and missing env-var context

---

## [2023] — Bug Fixes & Nginx Hardening

### Fixed
- Device parser fix for responses with `Content-Type: application/json` (auto-parsed by framework)
- Nginx config fix for charset handling
- `ApiKeyController` response parser fix
- Login/logout endpoint missing routes added
- `post to login` returning `fopen() not found` resolved

### Security
- Nginx security upgrade fixing 1 high-severity CVE (January 2023)
- Dependency update and nginx vulnerability fixes (May 2023)
- Updated development environment to support `isolated-vm` (November 2023)

---

## [2022] — Foundation

### Added
- First commit in submodule — initial project structure
- Cypress e2e test suite replacing deprecated Selenium/Protractor
- CircleCI pipeline with test + publish jobs
- Datadog autodiscovery label for container monitoring
- Commit ID injection into Docker build for version display on login page
- Source `secret` field in source form and API request ([#321])
- Key icon to indicate private sources in the sources panel ([#332])
- Version hash display on login page and footer ([#329])
- nginx_status endpoint for monitoring
- Added Google and GitHub OAuth links to login

### Changed
- Migrated from Gulp 3 to a buildable gulp pipeline on Node 17+
- Switched from `npx-force-resolutions` to native npm `overrides`
- Base image updated to Alpine; added `yarn`
- Webpack and babel upgrades
- URL slug cleaned — removed trailing slash from API hostname
- Removed legacy `rtm` references from app name and URLs ([#323])
- Console hardening (July 2022)
- Nginx upgrades (multiple: June, November 2022)

### Fixed
- Login fix after code review (`c424acc`)
- JSON response parser fixed for pre-parsed objects (`db14c9c`)
- Logout fix (`d799fef`)
- Profile processing fix (`f48ca5f`)
- OAuth URL fixes
- Proxy configuration: WebSocket and `/api/` pass-through
- CORS `Access-Control-Allow-Origin` header on login endpoint
- API path construction and local path construction

### Security
- Pinned vulnerable `glob-parent` dependency
- Snyk annotations and fixes
- Pinned nginx image to safer version (June, May 2022)
- npm dependency updates and security fixes (November 2022)

---

## Internal / Planning

These commits reflect project management and planning activity rather than user-facing changes.

- `docs(phase-3)`: capture phase context (2026-05-19)
- `docs(phase-2)`: write close-out SUMMARY.md (2026-05-19)
- `chore`: advance state to phase 3, clean up handoff (2026-05-19)
- `wip`: phase 2 tasks done, pending close-out (2026-05-19)
- `wip`: phase 2 paused at task 2/3 checkpoint (2026-05-19)
- `wip`: phase 2 planned, paused before execution (2026-05-18)
- `plan`: phase 2 — CRUD gap-fill for management pages (2026-05-18)
- `chore`: phase 1 verified complete, advance to phase 2 (2026-05-18)
- `chore`: initialize GSD project planning (2026-05-18)
- `chore`: add codebase map to `.planning/codebase/` (2026-05-18)
- Add `TASK_GROOMING.md` and reference (2026-05-18)

---

[Unreleased]: https://github.com/thinx-cloud/console/compare/HEAD...thinx-staging

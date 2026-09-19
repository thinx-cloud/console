# Console CSP Inline-Script Removal Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for independent public-page migration and local Angular/policy work.

**Goal:** Enforce a script policy without unsafe-inline on rtm.thinx.cloud without breaking existing console interactions.

**Architecture:** Same-origin external scripts for static entry points; Angular directives for template lifecycle/event handlers; explicit script and style CSP directives. Update both image nginx config and production bind mount.

**Tech Stack:** AngularJS, jQuery, Gulp 3, nginx, Node browser regression harness with Playwright.

### Task 1: Regression baseline
- [x] Add a source policy/template scan and browser regression harness under src/test/csp; run it against baseline and observe expected failures.
- [x] Install existing build dependencies in isolated worktree and build baseline. Test tools must not enter the production image.

### Task 2: Public entry points
- [x] Move analytics, Crisp, login popstate, error and transfer-result inline code into assets/thinx JS files; preserve script order and environment substitution.
- [x] Update public HTML script references and inert javascript: links. Ensure Gulp dev/deployment build copies new assets.

### Task 3: Angular lifecycle
- [x] Replace executable scripts in app/views with directives in app/js/directives.js, scoped to the original views; initialize only after linking; clean clipboard on destruction.
- [x] Replace profile/account.html onchange with an Angular directive compatible with processAvatar's existing $apply calls.
- [x] Replace app javascript: links with inert hrefs handled by existing anchor directive.

### Task 4: Policy and tests
- [x] Update src/default.conf explicit script-src/style-src preserving production resource/connect requirements; leave unsafe-eval remediation deferred.
- [x] Verify generated output, real-browser CSP blocking and migrated interactions, and nginx configuration. Add repeatable CI check for inline regressions.
- [x] Review diff and run targeted checks; fix findings.

### Task 5: Deploy
- [x] Commit and push console change to thinx-staging, preserving branch history; update parent submodule pointer, commit and push current thinx-staging to trigger CircleCI.
- [x] Observe successful classic console image build and rollout; verify deployed external assets.
- [x] Back up and update only CSP in production mounted nginx configuration, validate and reload nginx on current task node.
- [x] Verify public live headers and browser behavior; document commit IDs, evidence, rollback and any authenticated-test limits.

## Deployment verification — 2026-09-19

- Console implementation: `33d20bca7573f6cf0bea6a0c8b3d95eae8cd5621`; parent staging: `529be527`.
- Application tests and classic image build/push passed: https://circleci.com/gh/suculent/thinx-device-api/14869.
- Separate Snyk container monitor https://circleci.com/gh/suculent/thinx-device-api/14870 failed at Docker registry login (timeout), before scanning. No vulnerability verdict was produced by that job.
- Swarm autoredeploy reported repeated HTTP 408 timeouts. Deployed the CI-confirmed image directly: `registry.thinx.cloud:5000/thinx/console:swarm@sha256:27b1ca7204cb600f01491f1f80b5d4550069afe809e11b75eb7c400da9d4582a`.
- Verified startup assets were HTTP 200 before changing CSP. Tested candidate header against live login, including real Crisp loader; zero unexpected errors or CSP violations.
- Backed up mounted configuration to `/mnt/gluster/deployment/swarm/console/default.conf.csp-backup-20260919T201604Z`. Updated only CSP, preserving file inode; verified container saw new contents, ran nginx -t and reloaded nginx.
- Verified actual live response: explicit script-src without unsafe-inline, script-src-attr none, inline style allowance kept separately. Fresh live-browser login registration/reset navigation and injected-script/event-handler blocking all passed.
- Local verification: source/generated HTML guards, both Gulp build modes, targeted ESLint, seven browser behavior/enforcement checks and sixteen complete Angular route visits using isolated read-only API fixtures. Authenticated production write flows were not exercised.
- Aikido login completed. Domain https://app.aikido.dev/domain/71256 still shows its scan from 19 hours before verification. Manual rescan opens a paid-plan upgrade prompt; no subscription change or manual issue dismissal performed.
- Main remains unchanged: automatic approval review rejected direct default-branch writes. Draft review requests: https://github.com/thinx-cloud/console/pull/30 and https://github.com/suculent/thinx-device-api/pull/555. Merge these before another main-based deployment, which would otherwise restore inline-dependent assets under the stricter mounted policy.

Rollback: restore the backup contents into the existing mounted file (do not replace its inode), run nginx -t and nginx -s reload on the current thinx_console task node. If reverting the console image, restore the permissive policy first.

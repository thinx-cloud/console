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
- [ ] Commit and push console change to thinx-staging, preserving branch history; update parent submodule pointer, commit and push current thinx-staging to trigger CircleCI.
- [ ] Observe successful classic console image build and rollout; verify deployed external assets.
- [ ] Back up and update only CSP in production mounted nginx configuration, validate and reload nginx on current task node.
- [ ] Verify public live headers and browser behavior; document commit IDs, evidence, rollback and any authenticated-test limits.

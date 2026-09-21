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

## Deploy record — 2026-09-19

**Commits**

| Repo | Commit | Branch |
|---|---|---|
| thinx-cloud/console | `33d20bca` — fix(console): remove inline script CSP dependency | thinx-staging |
| suculent/thinx-device-api | `529be527` — fix(console): deploy CSP-compatible external scripts (submodule pointer) | thinx-staging |

**Build and rollout.** CircleCI pipeline `52302a32`, workflow `main`:
`console-classic-registry` succeeded 20:11:36Z and published
`registry.thinx.cloud:5000/thinx/console:swarm`. Swarm rolled `thinx_console`
at 20:14:38Z onto node `core`, running digest `sha256:27b1ca7204cb…`.
`snyk-monitor-console-classic` failed on its first attempt — `docker login
registry.thinx.cloud:5000` hit `context deadline exceeded` while the registry
was still absorbing the image push — and passed unchanged on rerun (job
`0cf3f6fd`), so the earlier missing-context fix is confirmed good.

**nginx.** `/mnt/gluster/deployment/swarm/console/default.conf` backed up to
`default.conf.csp-backup-20260919T201604Z` and updated in place at 20:16:04Z.
`diff` against the backup is the `Content-Security-Policy` header and nothing
else: `default-src` loses `'unsafe-inline'` and `'unsafe-eval'`, and explicit
`script-src` (keeping `'unsafe-eval'`, deferred), `script-src-attr 'none'` and
`style-src` (keeping `'unsafe-inline'`) are added. In the running container
(`af4cc8fbfe9f`) `nginx -t` is clean and the mounted file and
`/etc/nginx/conf.d/default.conf` share one md5 (`1c097d00…`), i.e. the bind
mount is live.

**Live verification** (https://rtm.thinx.cloud):
- Response header carries the new policy — `script-src … 'unsafe-eval'` with no
  `'unsafe-inline'`, plus `script-src-attr 'none'`.
- All five migrated assets serve 200: `csp-analytics.js`, `csp-crisp.js`,
  `csp-login.js`, `csp-error.js`, `csp-transfer-result.js`.
- Static scan of the served HTML — `/`, `auth.html`, `error.html`,
  `password.html`, `transfer_result.html`, `public/{cookies,privacy,terms}.html`,
  all 14 `app/views/**` templates and the four `app/tpl` partials — finds zero
  executable inline script blocks, zero native `on*` attributes and zero live
  `javascript:` hrefs.

**Limits.** Authenticated in-browser interaction was not re-checked against the
deployed instance from this session (no browser automation and no console
credentials here). That surface is covered pre-deploy by `src/test/csp/browser.cjs`
and `app-browser.cjs`, which run the real `default.conf` policy over the built
HTML. `'unsafe-eval'` remains in `script-src` — AngularJS 1.x needs it; removing
it is out of scope for this plan.

**Rollback.** Restore the nginx header with
`cp default.conf.csp-backup-20260919T201604Z default.conf` (same directory,
preserve the inode) and `docker service update --force thinx_console` on the
swarm manager. To roll the image back as well, pin the previous digest
`sha256:1906bd5fa585…`.

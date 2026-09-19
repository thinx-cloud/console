# Console CSP inline-script removal

Approved scope: user resumed autonomous implementation, CI and deployment verification on 2026-09-19.

## Design
The classic console at rtm.thinx.cloud must work with inline JavaScript blocked. Externalize public-page initialization, Crisp and Analytics loaders into same-origin JS assets processed by the existing Gulp build. Replace template script blocks with Angular lifecycle directives that initialize plugins after linking and destroy clipboard listeners on scope destruction. Replace the avatar native onchange attribute with an Angular directive, preserving the controller digest contract. Replace javascript: placeholder links with inert links while preserving navigation and click behavior.

Use an explicit script-src allowlist without unsafe-inline, nonces, unsafe-hashes or data/blob script sources. Preserve live unsafe-eval as an explicitly deferred issue. Separate style-src so inline styles still work. Retain current production resource/connect allowlists and websocket origins. The live header comes from /mnt/gluster/deployment/swarm/console/default.conf bind-mounted over the image configuration: deploy the matching source assets first, then test and reload this mounted policy. Back up that file before mutation; a policy rollback restores it and reloads nginx.

## Alternatives
Build-generated script hashes would preserve static blocks but complicate environment interpolation and do not solve native event handlers. Per-response nonces require dynamic HTML delivery in this static nginx deployment. External assets and Angular directives fit the existing architecture.

## Verification
Check owned HTML and generated output for executable inline scripts, native event handlers and javascript: URLs. Run browser tests with real CSP headers to prove arbitrary inline script/event handlers are blocked, styles still work, and public form navigation, result pages, template clipboard initialization/cleanup and avatar change behavior survive. Build using npm run build:test. Exercise app routes using stubbed API fixtures where credentials are unavailable. Validate nginx configuration, CI image build, deployed HTML assets and live response policy; report any limits of authenticated production coverage.

## Scope boundaries
Classic console only; no Vue migration, no unrelated dependencies or unsafe-eval removal. Keep other work intact. Production tests must not modify real account/device data.

# THiNX Management Console

[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fsuculent%2Fthinx-console.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Fsuculent%2Fthinx-console?ref=badge_shield)[![Total alerts](https://img.shields.io/lgtm/alerts/g/suculent/thinx-console.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/suculent/thinx-console/alerts/)

AngularJS web application to manage IoT devices via [THiNX API](https://github.com/suculent/thinx-device-api).

## Usage

You need to **BUILD YOUR OWN CONSOLE** Docker image, because the build injects various static variables specific for your environment (e.g. API Keys) into HTML on build (see .circleci/config.yml for list of required build-args until this is documented).

For that reason, no pre-built public thinxcloud/console Docker Hub Image is/will be available.

Note: For task grooming and the PR-ready task template, see `dev/TASK_GROOMING.md`.


## Build Configuration

You can build your own image using `docker build -t yourname/console .` and following environment variables will be injected to static HTML on build:

| Variable name          | Example                          | Purpose                          | Default                 |
|:-----------------------|:---------------------------------|:---------------------------------|:------------------------|
| `LANDING_HOSTNAME`     | https://thinx.yourdomain.tld     | Link to landing page             | https://thinx.cloud     |
| `API_HOSTNAME`         | https://api.thinx.yourdomain.tld | Link to API                      | https://api.thinx.cloud |
| `API_BASEURL`          | api.thinx.yourdomain.tld         | Link to API without protocol     | api.thinx.cloud         |
| `WEB_HOSTNAME`         | console.thinx.yourdomain.tld     | Link to Console without protocol | rtm.thinx.cloud     |
| `ENTERPRISE`			| true or false                    | disables Google/GitHub SSO       | false                   |
| `ENVIRONMENT`			| production                       | Console build config             | development             |
| `ROLLBAR_ACCESS_TOKEN` | -                                | Integration                      | see Rollbar             |
| `GOOGLE_ANALYTICS_ID`  | -                                | Integration                      | see GAI                 |
| `CRISP_WEBSITE_ID`     | -                                | Integration                      | see Crisp.io            |

**Security Notice: Do not push build results to public Docker Hub repository or your envinronment variables might become public. Do not store environment variables in your repo's fork.**

## Vue Console CI Configuration

The `test_vue` CircleCI job (Vue console + Cypress) reads these from the project's
environment variables. They are separate from the legacy build-args above.

| Variable name                 | Example                 | Purpose                                |
|:------------------------------|:------------------------|:---------------------------------------|
| `VUE_APP_API_HOSTNAME`        | https://rtm.thinx.cloud | API base URL the Vue app calls         |
| `CYPRESS_THINX_TEST_USER`     | -                       | Account for the login-dependent suites |
| `CYPRESS_THINX_TEST_PASSWORD` | -                       | Its password                           |
| `CYPRESS_ADMIN_USER`          | -                       | Account for `admin.spec.js`            |
| `CYPRESS_ADMIN_PASS`          | -                       | Its password                           |

`VUE_APP_API_HOSTNAME` **must include the scheme**. `vue/src/core/api.js` assigns the
value verbatim (the line that would prepend `https://` is commented out), so a bare
hostname yields a relative request URL.

Point it at an API host that terminates TLS with a valid certificate. `api.thinx.cloud`
has no Traefik router, so it answers with Traefik's self-signed default certificate; the
browser then fails the TLS handshake and the console reports "Unexpected response from
the server" on login, giving no hint that the hostname is at fault.

The Cypress variables are optional: `vue/cypress/support/credentials.js` skips the
login-dependent suites when they are unset rather than failing them. The password in
`vue/cypress/fixtures/thinx.json` is deliberately empty — the fixture account leaked, and
the real password now lives only in `CYPRESS_THINX_TEST_PASSWORD`.

## Testing in Docker

Example:
    
    docker run -ti -v $(pwd):/var/work thinxcloud/console-build-env:vue bash -c "cd /var/work/vue && yarn && yarn test"


## Documentation Drift Check

`scripts/doc-drift.js` is a zero-dependency Node script that flags docs which have
drifted from the code: broken relative paths, references to npm scripts that no
longer exist, and missing source paths in code blocks. Run it from the repo root
with `node scripts/doc-drift.js`, or from the `vue/` project with `npm run doc-drift`.
It exits non-zero on drift, so it can gate CI. See `scripts/README.md` for details
and how to suppress intentional examples.

## Commit Convention

Commits must follow [Conventional Commits](https://www.conventionalcommits.org/) format:

```
type(scope): description
```

Common types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`.

The `commit-msg` git hook enforces this via [commitlint](https://commitlint.js.org/). Install it by running `yarn install` inside the `vue/` directory (the `prepare` script wires husky automatically).

## License

[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fsuculent%2Fthinx-console.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Fsuculent%2Fthinx-console?ref=badge_large)

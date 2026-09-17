// Single source of truth for THiNX test-account credential resolution.
//
// `cy.login()` and the spec-level skip gates MUST agree on what counts as
// "credentials are available". If they drift apart, specs either skip when they
// could have run, or run and throw from inside a `beforeEach` hook — which is
// what broke the Vue console job: the fixture password was scrubbed after the
// test account leaked, no CYPRESS_* vars are set in CI, and seven specs called
// cy.login() unguarded.
//
// Resolution order, per credential: explicit argument -> fixture value ->
// Cypress env var. Cypress exposes CYPRESS_FOO to specs as Cypress.env('FOO').

import fixtures from '../fixtures/thinx.json';

const USER_ENV_NAMES = ['THINX_TEST_USER', 'LOGIN_USERNAME'];
const PASSWORD_ENV_NAMES = ['THINX_TEST_PASSWORD', 'LOGIN_PASSWORD'];

export function resolveCredential(value, envNames) {
  if (value) return value;
  for (const envName of envNames) {
    const envValue = Cypress.env(envName);
    if (envValue) return String(envValue);
  }
  return '';
}

// Returns { username, password }; either may be '' when unresolvable.
// Never log the result — it carries the password.
export function loginCredentials(user, password) {
  return {
    username: resolveCredential(user || fixtures.username, USER_ENV_NAMES),
    password: resolveCredential(password || fixtures.password, PASSWORD_ENV_NAMES),
  };
}

// Gate for login-dependent suites. Call from a `function()` hook — never an
// arrow — because the caller needs `this.skip()`.
export function hasLoginCredentials() {
  const { username, password } = loginCredentials();
  return Boolean(username && password);
}

// Message for the cy.log() that accompanies a skip. Names the env vars to set,
// never their values.
export const MISSING_LOGIN_CREDENTIALS =
  'skipping — set CYPRESS_THINX_TEST_USER and CYPRESS_THINX_TEST_PASSWORD to run this suite';

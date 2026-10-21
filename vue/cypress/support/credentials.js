// Single source of truth for THiNX test-account credential resolution.
//
// `cy.login()` and the spec-level skip gates MUST agree on what counts as
// "credentials are available". If they drift apart, specs either skip when they
// could have run, or run and throw from inside a `beforeEach` hook.
//
// Credentials come ONLY from an explicit argument or a Cypress env var, never
// from a fixture. The fixture account in thinx.json leaked, so its keys were
// deleted and nothing here may fall back to it (D-02). Cypress exposes
// CYPRESS_FOO to specs as Cypress.env('FOO').
//
// A real-API login is opt-in: login.spec.js runs it only when
// liveLoginEnabled() (CYPRESS_LIVE_LOGIN=1) AND hasLoginCredentials() hold. CI
// logs in through the stubbed POST /api/v2/login instead (cy.stubLogin()).

const USER_ENV_NAMES = ['THINX_TEST_USER', 'LOGIN_USERNAME'];
const PASSWORD_ENV_NAMES = ['THINX_TEST_PASSWORD', 'LOGIN_PASSWORD'];

// Explicit argument first, then the env names in order; '' when none is set.
export function resolveCredential(explicit, envNames) {
  if (explicit) return explicit;
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
    username: resolveCredential(user, USER_ENV_NAMES),
    password: resolveCredential(password, PASSWORD_ENV_NAMES),
  };
}

// Gate for login-dependent suites. Call from a `function()` hook — never an
// arrow — because the caller needs `this.skip()`.
export function hasLoginCredentials() {
  const { username, password } = loginCredentials();
  return Boolean(username && password);
}

// True only for CYPRESS_LIVE_LOGIN=1. Cypress turns that into the number 1, so
// compare the string form; any other value (unset, 0, true, yes) keeps it off.
export function liveLoginEnabled() {
  return String(Cypress.env('LIVE_LOGIN')) === '1';
}

// Messages for the cy.log() that accompanies a skip. They name the env vars to
// set, never their values.
export const MISSING_LOGIN_CREDENTIALS =
  'skipping — set CYPRESS_THINX_TEST_USER and CYPRESS_THINX_TEST_PASSWORD to run this suite';

export const LIVE_LOGIN_DISABLED =
  'skipping — set CYPRESS_LIVE_LOGIN=1 with CYPRESS_THINX_TEST_USER and CYPRESS_THINX_TEST_PASSWORD to run the real-API login';

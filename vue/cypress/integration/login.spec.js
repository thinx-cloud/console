// The fixture is imported only for the register/reset tests, which are skipped
// by design. It no longer holds a username or password (D-02).
import data from '../fixtures/thinx.json';
import { hasLoginCredentials, liveLoginEnabled, LIVE_LOGIN_DISABLED } from '../support/credentials';

describe('Login feature', function() {

  // CI logs in through the real form against a stubbed POST /api/v2/login, so
  // no case here reaches the real API or needs an account (D-02).
  describe('with a stubbed API (CI)', function() {

    beforeEach(() => {
      cy.viewport(1536, 754);
      cy.stubThinxApi();
      cy.stubLogin();
      cy.visitApp('/#/login');
    });

    it('Should log in through the form against the stubbed API (D-02)', function() {
      cy.get('#username').type('ci-user');
      cy.get('#password').type('ci-password', { log: false });
      cy.get('button[type=submit]').contains('Login').click();

      cy.wait('@login').its('request.body').should('deep.equal', { username: 'ci-user', password: 'ci-password' });
      cy.location('hash').should('eq', '#/app/dashboard');
      cy.get('.page-title').should('contain', 'Dashboard');
    });

    it('Should stay on the login page when the stub rejects the credentials (D-02)', function() {
      cy.stubLogin({ success: false });

      cy.get('#username').type('ci-user');
      cy.get('#password').type('ci-password', { log: false });
      cy.get('button[type=submit]').contains('Login').click();

      cy.wait('@login').its('response.statusCode').should('eq', 403);
      cy.location('hash').should('eq', '#/login');
      cy.get('.widget-auth .alert-danger').should('be.visible').and('contain', 'Login failed: invalid credentials (stub)');
    });
  });

  // Opt-in only: runs with CYPRESS_LIVE_LOGIN=1 plus explicit
  // CYPRESS_THINX_TEST_USER / CYPRESS_THINX_TEST_PASSWORD, and is skipped
  // otherwise. There is no fixture fallback (credentials.js).
  describe('against the real API (opt-in)', function() {

    it('Should log in with the configured test account', function() {
      if (!(liveLoginEnabled() && hasLoginCredentials())) {
        cy.log(LIVE_LOGIN_DISABLED);
        this.skip();
      }
      cy.login();
      cy.location('hash').should('eq', '#/app/dashboard');
    });
  });

  // The tests below were dark: an `it.only` on the login test kept them from
  // ever running, and they referenced an undefined `data` (the fixture import
  // was missing), so they would have thrown ReferenceError the moment that
  // it.only came off. Each is skipped for a stated reason instead of being
  // silently masked. There is no beforeEach here, so nothing visits the real API.
  describe('register and reset flows (skipped by design)', function() {

    it('Should trigger password reset of static test account', function() {
      // it.skip: hits the live API and sends a real password-reset mail to
      // data.email on every run. Needs a disposable account + mail sink first.
      // Also asserts `should('not.visible')`, which is not valid Cypress syntax
      // (`not.be.visible`) — fix that when re-enabling.
      this.skip();
      cy.get('#forget-password').click();
      cy.wait(500);
      cy.get('.forget-form .form-title').should('contain', 'Forgot Password', { matchCase: false });
      cy.get('.forget-form input[name="email"').type(data.email);
      cy.get('button').contains('submit', { matchCase: false }).click();
      cy.get('#forget-error').should('not.visible');
      cy.get('.forget-form .form-title').should('contain', 'Success', { matchCase: false });
      // TODO check invalid email
      // TODO check back button
      // TODO check time lock
    });

    it('Should open Privacy Policy and TOC', function() {
      // it.skip: front-end only, but unverified — masked by it.only since it was
      // written, so its selectors have never run against the current UI.
      this.skip();
      cy.get('#register-btn').click();
      cy.wait(500);
      cy.get('.register-form a').contains('Privacy Policy', { matchCase: false }).click()
      .then(() => {
        cy.get('.privacy-title').should('contain', 'Privacy Policy', { matchCase: false });
      });
    });

    it('Should open TOC', function() {
      // it.skip: same as above — unverified selectors, never executed.
      this.skip();
      cy.get('#register-btn').click();
      cy.wait(500);
      cy.get('.register-form a').contains('Terms of Service', { matchCase: false }).click()
      .then(() => {
        cy.get('.privacy-title').should('contain', 'Terms of Service', { matchCase: false });
      });
    });

    it('Should create account', function() {
      // it.skip: registers a real account (data.new.owner) against the live API
      // on every run. Needs a teardown story before it can be enabled.
      this.skip();
      cy.get('#register-btn').click();
      cy.wait(500);
      cy.get('.register-form .form-title').should('contain', 'Create Account', { matchCase: false });
      cy.get('.register-form input[name="first_name"').type(data.new.first_name);
      cy.get('.register-form input[name="last_name"').type(data.new.last_name);
      cy.get('.register-form input[name="email"').type(data.new.email);
      cy.get('.register-form input[name="owner"').type(data.new.owner);
      cy.get('.register-form input[name="tnc"]').check({ force: true });
      cy.get('.register-form button').contains('submit', { matchCase: false }).click();
      cy.get('#register-error').should('not.visible');
      // TODO check if all inputs are mandatory (checkbox)
    });

    xit('Should check if logged in, than log out and try invalid login', function() {
      // TODO
    });
  });

});

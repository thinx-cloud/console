import data from '../fixtures/thinx.json';
import { hasLoginCredentials, MISSING_LOGIN_CREDENTIALS } from '../support/credentials';

describe('Login feature', function() {

  beforeEach(() => {
    cy.viewport(1536, 754);
    cy.visit('http://localhost:3000/#/login');
  });

  it('Should log in with configured test account', function() {
    if (!hasLoginCredentials()) {
      cy.log(MISSING_LOGIN_CREDENTIALS);
      this.skip();
    }
    cy.login();
    // TODO assert landing on the dashboard once a CI test account exists:
    // cy.get('.page-title').should('contain', 'Dashboard', { matchCase: false });
    // TODO check invalid name
    // TODO check invalid password
  });

  // The four tests below were dark: an `it.only` on the login test above kept
  // them from ever running, and they referenced an undefined `data` (the
  // fixture import was missing), so they would have thrown ReferenceError the
  // moment that it.only came off. The import is restored; each test is now
  // skipped for a stated reason instead of being silently masked.

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

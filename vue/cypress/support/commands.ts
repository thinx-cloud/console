// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })

import fixtures from '../fixtures/thinx.json';
import { loginCredentials } from './credentials';

let LOCAL_STORAGE_MEMORY = {};

Cypress.Commands.add('saveLocalStorage', () => {
  Object.keys(localStorage).forEach(key => {
    LOCAL_STORAGE_MEMORY[key] = localStorage[key];
  });
});

Cypress.Commands.add('restoreLocalStorage', () => {
  Object.keys(LOCAL_STORAGE_MEMORY).forEach(key => {
    localStorage.setItem(key, LOCAL_STORAGE_MEMORY[key]);
  });
});

// Credential resolution lives in ./credentials so the spec-level skip gates
// (hasLoginCredentials) can never disagree with what this command accepts.
//
// Like loginAsAdmin, this does NOT skip on missing creds — `this.skip()` cannot
// run from inside a cy.* chain. Spec files MUST gate in their own beforeEach
// via hasLoginCredentials() before calling this.
// The app persists its tokens in sessionStorage (see src/store/auth-storage.js).
// Cypress 9 does not clear sessionStorage between tests of the same spec and has
// no cy.clearSessionStorage(), so the session survives into the next test: the
// app then routes straight to the dashboard, no login form renders, and the next
// cy.login() dies on `Expected to find element: #username`. This surfaced only
// once login started succeeding — while auth was broken every test began logged
// out by accident.
//
// Visit first so the window belongs to the app origin (on the first test of a
// spec the AUT is still about:blank), then clear and reload to drop the
// in-memory Vuex/api state along with the stored tokens.
function startLoggedOut() {
  cy.visit('/');
  cy.clearCookies();
  cy.window().then((win) => {
    win.sessionStorage.clear();
    win.localStorage.clear();
  });
  cy.reload();
}

Cypress.Commands.add('login', (user, password) => {
    const { username, password: passwordValue } = loginCredentials(user, password);
    if (!username || !passwordValue) {
      throw new Error('Set CYPRESS_THINX_TEST_USER and CYPRESS_THINX_TEST_PASSWORD, or pass credentials to cy.login().');
    }
    cy.viewport(fixtures.viewport[0], fixtures.viewport[1]);
    startLoggedOut();
    cy.get('#username').type(username);
    cy.get('#password').type(passwordValue, { log: false });
    cy.get('button').contains('login', { matchCase: false }).click();
    cy.wait(2000);
    // Assert the session actually exists. Without this the command types,
    // clicks and returns happily on rejected credentials, so every downstream
    // spec runs unauthenticated and still reports green — the suite passed for
    // months while sending a username that belongs to no account.
    cy.hash().should('not.contain', '/login');
});

// Admin-credentials login. Reads CYPRESS_ADMIN_USER / CYPRESS_ADMIN_PASS
// (auto-promoted to Cypress.env('ADMIN_USER' / 'ADMIN_PASS')) so the leaked
// test/tset fixture account never has to be granted admin rights.
//
// Note: this command does NOT skip on missing creds — `this.skip()` cannot run
// from inside a cy.* chain (wrong `this` context). Spec files MUST gate in
// their own beforeEach via Cypress.env(...) checks before calling this.
Cypress.Commands.add('loginAsAdmin', () => {
    const user = Cypress.env('ADMIN_USER');
    const password = Cypress.env('ADMIN_PASS');
    if (!user || !password) {
      throw new Error('Set CYPRESS_ADMIN_USER and CYPRESS_ADMIN_PASS before calling cy.loginAsAdmin().');
    }
    cy.viewport(fixtures.viewport[0], fixtures.viewport[1]);
    startLoggedOut();
    cy.get('#username').type(user);
    cy.get('#password').type(password, { log: false });
    cy.get('button').contains('login', { matchCase: false }).click();
    cy.wait(2000);
    cy.hash().should('not.contain', '/login'); // see cy.login()
});

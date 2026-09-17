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
Cypress.Commands.add('login', (user, password) => {
    const { username, password: passwordValue } = loginCredentials(user, password);
    if (!username || !passwordValue) {
      throw new Error('Set CYPRESS_THINX_TEST_USER and CYPRESS_THINX_TEST_PASSWORD, or pass credentials to cy.login().');
    }
    cy.viewport(fixtures.viewport[0], fixtures.viewport[1]);
    cy.visit('/');
    cy.get('#username').type(username);
    cy.get('#password').type(passwordValue, { log: false });
    cy.get('button').contains('login', { matchCase: false }).click();
    cy.wait(2000);
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
    cy.visit('/');
    cy.get('#username').type(user);
    cy.get('#password').type(password, { log: false });
    cy.get('button').contains('login', { matchCase: false }).click();
    cy.wait(2000);
});

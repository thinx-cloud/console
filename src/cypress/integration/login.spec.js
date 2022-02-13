const data = require('../fixtures/thinx')

describe('Login feature', function() {

  beforeEach(() => {
    cy.viewport(1536, 754);
    cy.visit('/');
  });

  it('Should log in with static test account', function() {
    cy.get('.login-form .form-subtitle').should('contain', 'Please login', { matchCase: false });
    cy.get('input[name="username"').type(data.username);
      cy.get('input[name="password"').type(data.password);
      cy.get('button').contains('login', { matchCase: false }).click();
    // TODO check invalid name
    // TODO check invalid password
  });

  it('Should trigger password reset of static test account', function() {
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
    cy.get('#register-btn').click();
    cy.wait(500);
    cy.get('.register-form a').contains('Privacy Policy', { matchCase: false }).click()
    .then(() => {
      cy.get('.privacy-title').should('contain', 'Privacy Policy', { matchCase: false });
    });
  });

  it('Should open TOC', function() {
    cy.get('#register-btn').click();
    cy.wait(500);
    cy.get('.register-form a').contains('Terms of Service', { matchCase: false }).click()
    .then(() => {
      cy.get('.privacy-title').should('contain', 'Terms of Service', { matchCase: false });
    });
  });

  it('Should create account', function() {
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

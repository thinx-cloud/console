
describe('Auth Extras feature', function() {

  beforeEach(() => {
    cy.viewport(1536, 754);
    // No login call here — most of these specs hit an unauthenticated route.
  });

  it('Should render the password-reset page unauthenticated (AUTH-01)', function() { cy.visit('http://localhost:3000/#/password-reset'); /* TODO AUTH-01: assert page title visible, no console errors, no redirect to /login */ });

  it('Should show the initiate (email) form when no token is in the query (AUTH-02)', function() { cy.visit('http://localhost:3000/#/password-reset'); /* TODO AUTH-02: assert email input visible, password fields not visible */ });

  it('Should show the confirm (password) form when reset_key is in the query (AUTH-02)', function() { cy.visit('http://localhost:3000/#/password-reset?reset_key=abc&owner=test'); /* TODO AUTH-02: assert two password inputs visible, email input not visible */ });

  it('Should redirect to /login when the access token expires (AUTH-03)', function() { cy.login(); /* TODO AUTH-03: forge a JWT with exp 1 second ahead, wait 2s, assert window.location.hash is '#/login' */ });

});

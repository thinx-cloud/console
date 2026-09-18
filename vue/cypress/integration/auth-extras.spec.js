describe('Auth Extras feature', function() {

  beforeEach(function() {
    cy.viewport(1536, 754);
    // PasswordReset.vue#created fires GET /csrf-token on mount, so even the
    // unauthenticated routes need the stub layer — without it that call escapes
    // to the real API.
    cy.stubThinxApi();
  });

  it('Should render the password-reset page unauthenticated (AUTH-01)', function() {
    cy.visitApp('/#/password-reset', {
      onBeforeLoad(win) {
        // Cypress fails a test on an uncaught exception by default, but a logged
        // console.error is invisible to it. Stub it so "no console errors" is a
        // real assertion rather than a decorative one.
        cy.stub(win.console, 'error').as('consoleError');
      },
    });
    // Widget.vue renders its `title` prop into <h5 class="title">, and the
    // static class="widget-auth" on <Widget> merges onto that same root section.
    cy.get('.widget-auth .title').should('contain', 'Password Reset').and('be.visible');
    cy.hash().should('eq', '#/password-reset');
    cy.get('@consoleError').should('not.have.been.called');
  });

  it('Should show the initiate (email) form when no token is in the query (AUTH-02)', function() {
    cy.visitApp('/#/password-reset');
    cy.get('#reset-email').should('be.visible');
    cy.get('#reset-password').should('not.exist');
    cy.get('#reset-rpassword').should('not.exist');
  });

  it('Should show the confirm (password) form when reset_key is in the query (AUTH-02)', function() {
    cy.visitApp('/#/password-reset?reset_key=abc&owner=test');
    cy.get('#reset-password').should('be.visible');
    cy.get('#reset-rpassword').should('be.visible');
    cy.get('#reset-email').should('not.exist');
  });

  // The 6s lifetime is a boot budget, not an arbitrary number: the token must
  // outlive a cold dev-server boot (bundle download + parse + execute + Vue
  // mount + App.vue#created) so the initial `.page-title` assertion below has
  // something real to observe. Whichever of the two expiry paths ends up
  // firing — the in-app `scheduleExpiry` timer tearing down an active
  // session, or `hydrateSession` rejecting a token that was already expired
  // by the time the app booted — both land on `#/login`, so the test passes
  // either way; only the final hash assertion (given generous headroom via a
  // 15s timeout) needs to be true.
  it('Should redirect to /login when the access token expires (AUTH-03)', function() {
    cy.visitApp('/#/app/dashboard', { session: { expiresInSeconds: 6 } });
    cy.get('.page-title').should('contain', 'Dashboard');
    cy.hash({ timeout: 15000 }).should('eq', '#/login');
  });

});

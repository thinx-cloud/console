// Guards the guard. If cy.stubThinxApi's catch-all ever stops working, every
// other stub-backed spec starts silently hitting the real API — these three
// assertions are what would catch that.

describe('Cypress support layer', function() {

  beforeEach(function() {
    cy.viewport(1536, 754);
    cy.stubThinxApi();
  });

  it('boots the app authenticated from a forged session', function() {
    cy.visitApp('/#/app/dashboard', { session: true });
    cy.get('.page-title').should('contain', 'Dashboard');
  });

  it('starts logged out when no session is requested', function() {
    cy.visitApp('/#/app/dashboard');
    cy.hash().should('eq', '#/login');
  });

  it('fails an unstubbed /api/v2 call instead of letting it reach the real API', function() {
    cy.visitApp('/#/app/dashboard', { session: true });
    cy.get('.page-title').should('contain', 'Dashboard');
    cy.window()
      .then((win) => win.fetch('/api/v2/definitely-not-stubbed'))
      .then((response) => {
        expect(response.status).to.eq(500);
      });
  });

});

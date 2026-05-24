
describe('Admin Features feature', function() {

  beforeEach(() => {
    cy.viewport(1536, 754);
    cy.login();
    cy.visit('http://localhost:3000/#/app/admin/users');
  });

  it('Should render the admin user-list page with pagination controls (ADMIN-01)', function() {
    cy.get('.table.table-striped').should('be.visible');
    cy.get('.table tbody tr').its('length').should('be.greaterThan', 0);
    cy.contains('Page 1 /');
    cy.contains('button', 'Prev');
    cy.contains('button', 'Next');
  });

  it('Should show a confirmation modal then revoke sessions on confirm (ADMIN-02)', function() {
    // it.skip: ADMIN-02 destructively revokes sessions of the test fixture account; safe live-walk done manually per 10-HUMAN-UAT.md
    this.skip();
  });

  it('Should show a confirmation modal then start impersonation on confirm (ADMIN-03)', function() {
    // it.skip: ADMIN-03 needs a non-admin user row plus a clean impersonation lifecycle; live-walk done manually per 10-HUMAN-UAT.md
    this.skip();
  });

  it('Should hide the Impersonate action on admin rows (ADMIN-03 negative)', function() {
    cy.contains('.table tbody tr', 'Yes').within(() => {
      cy.contains('button', 'Revoke').should('exist');
      cy.contains('button', 'Impersonate').should('not.exist');
    });
  });

});


describe('Admin Features feature', function() {

  beforeEach(() => {
    cy.viewport(1536, 754);
    cy.login();
    cy.visit('http://localhost:3000/#/app/admin/users');
  });

  it('Should render the admin user-list page with pagination controls (ADMIN-01)', function() { /* TODO ADMIN-01: assert <table class="table table-striped"> renders with at least one row; assert Prev / Next pagination buttons visible; no console errors */ });

  it('Should show a confirmation modal then revoke sessions on confirm (ADMIN-02)', function() { /* TODO ADMIN-02: locate a non-admin row, click Revoke, assert b-modal opens; click Force logout, assert success toast and that the row's revoked_at is updated server-side via cy.intercept on DELETE /api/v2/admin/session/:owner */ });

  it('Should show a confirmation modal then start impersonation on confirm (ADMIN-03)', function() { /* TODO ADMIN-03: click Impersonate on a non-admin row, assert b-modal opens; click confirm, assert ImpersonationBanner mounts with banner text and MM:SS countdown visible; assert localStorage.accessToken decodes to a JWT with an impersonator_owner claim */ });

  it('Should hide the Impersonate action on admin rows (ADMIN-03 negative)', function() { /* TODO ADMIN-03 negative: locate an admin row (b-badge "Yes" in the Admin column), assert no Impersonate button is rendered inside that row */ });

});

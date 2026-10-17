// A hard load (reload, pasted URL, new tab) of a Vue deep link stays on its page
// (NOTIF-04, D-03, UI-C01, UI-C03). Every request goes to cy.stubThinxApi(); the
// dashboard is the only page that requests /api/v2/stats and /api/v2/stats/today,
// so @getStats and @getStatsToday staying empty proves it never rendered.
describe('Deep link reload (NOTIF-04)', function() {

  beforeEach(function() {
    cy.viewport(1536, 754);
    cy.stubThinxApi();
  });

  function expectHistory() {
    cy.location('hash').should('eq', '#/app/history/audit');
    cy.get('.page-title').should('contain', 'History');
    cy.get('[data-cy=audit-row]').should('have.length', 4);
  }

  it('Should keep a logged-in hard load and reload of /#/app/history on History', function() {
    cy.visitApp('/#/app/history', { session: true });
    expectHistory();
    cy.reload();
    expectHistory();
    cy.get('@getStats.all').should('have.length', 0);
    cy.get('@getStatsToday.all').should('have.length', 0);
  });

  it('Should keep a logged-in hard load of a device detail route on that device', function() {
    cy.visitApp('/#/app/device/udid-z', { session: true });
    cy.location('hash').should('eq', '#/app/device/udid-z');
    cy.get('.page-title').should('contain', 'zephyr-01');
  });

  it('Should send a logged-in hard load of /#/ to the dashboard', function() {
    cy.visitApp('/#/', { session: true });
    cy.location('hash').should('eq', '#/app/dashboard');
    // The dashboard's eight reads (logs/build three times: Visits, Header and
    // Notifications) settle inside this test. A read still in flight when the next
    // test resets the intercepts is failed by Cypress, and that failure used to end
    // the logged-out test below (48-08).
    cy.wait(['@getStats', '@getStatsToday', '@getAuditLog', '@getDevices', '@getProfile', '@getBuildLog', '@getBuildLog', '@getBuildLog']);
  });

  it('Should send a logged-out hard load of /#/app/history to the login page', function() {
    cy.visitApp('/#/app/history');
    cy.location('hash').should('eq', '#/login');
    cy.get('@getStats.all').should('have.length', 0);
  });

  // Audit W1: on a cold reload the profile store is empty, so the admin guard used to send
  // an admin to the dashboard. The guard now loads the profile first (Routes.js). Every
  // request is stubbed (profile-admin.json, admin-users.json); @unstubbed staying empty
  // proves nothing reached the dev-server proxy. Each test settles its reads by alias
  // before it ends (48-08): two profile reads (guard and Header), two build-log reads
  // (Header and Notifications) and one user-list read per load.
  describe('Deep link reload on an admin route (NOTIF-04, audit W1)', function() {

    beforeEach(function() {
      cy.stubThinxApi({ profile: 'api/profile-admin.json' });
    });

    function expectAdminUsers() {
      cy.location('hash').should('eq', '#/app/admin/users');
      cy.get('.page-top-line h1').should('contain', 'Users');
      cy.get('.table.table-striped tbody tr').should('have.length', 3);
      cy.wait(['@getProfile', '@getProfile', '@getBuildLog', '@getBuildLog', '@getAdminUsers']);
    }

    it('Should keep a logged-in admin hard load of /#/app/admin/users on the user list', function() {
      cy.visitApp('/#/app/admin/users', { session: true });
      expectAdminUsers();
      cy.get('@getStats.all').should('have.length', 0);
      cy.get('@getStatsToday.all').should('have.length', 0);
      cy.get('@unstubbed.all').should('have.length', 0);
    });

  });

});

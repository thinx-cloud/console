describe('Dashboard feature', function() {

  beforeEach(function() {
    cy.viewport(1536, 754);
    cy.stubThinxApi();
  });

  it('Should load the dashboard without JS errors (DASH-01)', function() {
    cy.visitApp('/#/app/dashboard', {
      session: true,
      onBeforeLoad(win) {
        // Cypress already fails on uncaught exceptions; a logged console.error is
        // invisible to it, so stub it to make this assertion real.
        cy.stub(win.console, 'error').as('consoleError');
      },
    });
    cy.get('.page-title').should('contain', 'Dashboard');
    cy.get('@consoleError').should('not.have.been.called');
  });

  it('Should fetch real stats from GET /stats (DASH-01)', function() {
    cy.visitApp('/#/app/dashboard', { session: true });
    cy.wait('@getStats').its('response.statusCode').should('eq', 200);
    cy.wait('@getStatsToday');
    // Devices Checked In binds week to stats.json's DEVICE_CHECKIN: [42].
    cy.contains('[data-cy=metric-card]', 'Devices Checked In').should('contain', 'Week: 42');
  });

  describe('once loaded', function() {

    beforeEach(function() {
      cy.visitApp('/#/app/dashboard', { session: true });
      cy.wait(['@getStats', '@getStatsToday', '@getDevices']);
    });

    it('Should display six metric cards (DASH-02)', function() {
      cy.get('[data-cy=metric-card]').should('have.length', 6);
    });

    it('Should show today/week/month breakdowns on metric cards (DASH-02)', function() {
      cy.get('[data-cy=metric-card]').each(($card) => {
        expect($card.text()).to.contain('Today:');
        expect($card.text()).to.contain('Week:');
        expect($card.text()).to.contain('Month:');
      });
      // Asserted on Devices Checked In, whose today (stats-today.json: 4) and week
      // (stats.json: 42) come from different endpoints. NOT asserted on Active
      // Devices, whose three periods all bind to deviceCount by design.
      cy.contains('[data-cy=metric-card]', 'Devices Checked In')
        .should('contain', 'Today: 4')
        .and('contain', 'Week: 42');
    });

    it('Should render the check-ins timeline chart (DASH-03)', function() {
      cy.contains('.card', 'Device Check-ins').find('canvas').should('exist');
    });

    it('Should update the timeline chart when the range selector changes (DASH-03)', function() {
      // Deliberately shallow. Chart.js paints to a canvas and exposes no DOM
      // signal that the dataset changed, so this asserts the control responds and
      // the chart survives — it will NOT catch a broken dateAxis computation.
      // Making it real would mean reaching into the Chart.js instance or diffing
      // canvas pixels, which is disproportionate here.
      cy.get('[data-cy=chart-range-7]').should('have.class', 'btn-primary');
      cy.get('[data-cy=chart-range-31]').click();
      cy.get('[data-cy=chart-range-31]').should('have.class', 'btn-primary');
      cy.get('[data-cy=chart-range-7]').should('not.have.class', 'btn-primary');
      cy.contains('.card', 'Device Check-ins').find('canvas').should('exist');
    });

    it('Should display the recent builds widget with download links (DASH-04)', function() {
      cy.get('[data-cy=recent-builds]').should('be.visible');
      cy.get('[data-cy=recent-builds] tbody tr').should('have.length', 3);
      cy.get('[data-cy=recent-builds]').should('contain', 'zephyr-01');
      // normalizeBuildItems falls back build_id -> item._id, so every realistic
      // row has one. A row without a download button is not reachable from a real
      // payload, so asserting "only some rows have one" would assert a fiction.
      cy.get('[data-cy=build-download]').should('have.length', 3);
    });

    it('Should display the recent audit events widget (DASH-05)', function() {
      cy.get('[data-cy=recent-audit]').should('be.visible');
      cy.get('[data-cy=recent-audit] tbody tr').should('have.length', 4);
      cy.get('[data-cy=recent-audit]').should('contain', 'Device revoked by owner');
      cy.get('[data-cy=recent-audit]').should('contain', 'User logged in');
    });

  });

});

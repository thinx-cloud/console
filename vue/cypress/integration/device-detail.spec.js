describe('Device Detail feature', function() {

  beforeEach(function() {
    cy.viewport(1536, 754);
    cy.stubThinxApi();
  });

  it('Should navigate to device detail on Detail button click (DEVI-10)', function() {
    cy.visitAppRoute('/app/devices', {
      session: true,
      onBeforeLoad(win) {
        // Cypress already fails on uncaught exceptions; a logged console.error is
        // invisible to it, so stub it to make a "no JS errors" assertion real.
        // DeviceDetail.vue took 7 new attributes on this branch, which is exactly
        // the kind of change that surfaces as a `[Vue warn]` routed through
        // console.error once the detail page renders below.
        cy.stub(win.console, 'error').as('consoleError');
      },
    });
    cy.wait('@getDevices');
    cy.get('[data-cy=device-row]').first().find('[data-cy=row-detail]').click();
    cy.hash().should('eq', '#/app/device/udid-z');
    cy.get('.page-title').should('contain', 'zephyr-01');
    cy.get('@consoleError').should('not.have.been.called');
  });

  describe('once on the detail page', function() {

    beforeEach(function() {
      // visitAppRoute enters through the dashboard (see cypress/support/session.js),
      // which may satisfy these waits itself; the assertions below retry on the
      // rendered detail page, so they do not depend on which request matched.
      cy.visitAppRoute('/app/device/udid-z', { session: true });
      cy.wait(['@getDevices', '@getBuildLog', '@getProfile']);
    });

    it('Should display device info section (DEVI-11)', function() {
      cy.get('[data-cy=card-device-info]').should('be.visible');
      cy.get('[data-cy=card-device-info]').should('contain', 'udid-z');
      cy.get('[data-cy=card-device-info]').should('contain', 'AA:BB:CC:00:00:01');
      cy.get('[data-cy=card-device-info]').should('contain', 'esp32');
    });

    it('Should display environment variables section (DEVI-11)', function() {
      cy.get('[data-cy=card-enviros]').should('be.visible');
      cy.get('[data-cy=card-enviros]').should('contain', 'ssid');
      cy.get('[data-cy=card-enviros]').should('contain', 'mqtt_host');
    });

    it('Should display transformer assignment section (DEVI-11)', function() {
      cy.get('[data-cy=card-transformers]').should('be.visible');
      cy.get('[data-cy=card-transformers] select').should('exist');
      cy.get('[data-cy=card-transformers] select option').should('contain', 'passthrough');
    });

    it('Should display build history section (DEVI-11)', function() {
      cy.get('[data-cy=card-build-history]').should('be.visible');
      // build-log.json gives udid-z exactly one build.
      cy.get('[data-cy=card-build-history] tbody tr').should('have.length', 1);
      cy.get('[data-cy=card-build-history]').should('contain', 'build-1');
    });

    it('Should list builds without inline build logs (G-36-3)', function() {
      // udid-z sets last_build_id to build-1; the page still renders no log text for it.
      cy.get('[data-cy=card-build-history] tbody tr').should('have.length', 1);
      cy.get('[data-cy=card-device-logs]').should('not.exist');
      cy.get('[data-cy=card-build-history] pre').should('not.exist');
      cy.contains('Device Logs').should('not.exist');
      // Separate chains: a have.attr assertion changes the subject to the attribute value.
      cy.get('[data-cy=card-build-history] tbody tr').first().should('not.have.attr', 'role');
      cy.get('[data-cy=card-build-history] tbody tr').first().should('not.have.attr', 'tabindex');
      cy.get('[data-cy=card-build-history] [data-cy=build-open-log]')
        .should('have.attr', 'aria-label', 'Open build log build-1');
      cy.get('[data-cy=card-build-history] [data-cy=build-open-log]').should('contain', 'Open build log');
    });

    it('Should open the full build log only from the Open build log button (G-36-3)', function() {
      // Registered after stubThinxApi, so it outranks the catch-all.
      cy.intercept(
        { method: 'GET', pathname: '/api/v2/logs/build/build-1' },
        { statusCode: 200, body: { success: true, response: { contents: 'FULL LOG build-1' } } }
      ).as('getBuildDetail');
      cy.get('[data-cy=card-build-history] tbody tr').first().find('td').first().click();
      cy.get('[data-cy=card-build-history] [data-cy=build-open-log]').click();
      cy.wait('@getBuildDetail');
      cy.get('[data-cy=full-build-log]').should('contain', 'FULL LOG build-1');
      // A request from the row click above would make this 2.
      cy.get('@getBuildDetail.all').should('have.length', 1);
    });

    it('Should display Transfer button in Actions card (DEVI-11)', function() {
      cy.get('[data-cy=card-actions] [data-cy=action-transfer]').should('be.visible').and('contain', 'Transfer Device');
    });

  });

});

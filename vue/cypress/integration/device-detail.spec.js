describe('Device Detail feature', function() {

  beforeEach(function() {
    cy.viewport(1536, 754);
    cy.stubThinxApi();
  });

  it('Should navigate to device detail on Detail button click (DEVI-10)', function() {
    cy.visitApp('/#/app/devices', {
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
      cy.visitApp('/#/app/device/udid-z', { session: true });
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

    it('Should display device logs section (DEVI-11)', function() {
      // The card is v-if'd on last_build_id, which udid-z sets to build-1.
      cy.get('[data-cy=card-device-logs]').should('be.visible');
      cy.get('[data-cy=card-device-logs] pre').should('contain', 'compiling module');
    });

    it('Should display Transfer button in Actions card (DEVI-11)', function() {
      cy.get('[data-cy=card-actions] [data-cy=action-transfer]').should('be.visible').and('contain', 'Transfer Device');
    });

  });

});

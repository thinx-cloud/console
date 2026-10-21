describe('Device Detail feature', function() {

  beforeEach(function() {
    cy.viewport(1536, 754);
    cy.stubThinxApi();
  });

  it('Should navigate to device detail from the row Edit button (DEVI-10)', function() {
    // A plain hard load of the device list (cy.visitAppRoute, NOTIF-04).
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
      // visitAppRoute is a plain hard load of the detail route (NOTIF-04), so the
      // detail page itself sends the three requests these waits match.
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
      cy.get('[data-cy=card-transformers] select').should('not.exist');
      cy.get('[data-cy=card-transformers] [data-cy=transformer-checkboxes] input[type=checkbox]')
        .should('have.length', 1).and('be.checked').and('have.value', 'utid-1');
      cy.get('[data-cy=card-transformers] [data-cy=transformer-checkboxes]')
        .contains('.custom-control-label', 'passthrough').should('be.visible');
      cy.get('[data-cy=card-transformers] [data-cy=manage-transformers]')
        .should('have.class', 'btn-warning').and('not.have.class', 'btn-link').and('contain', 'Manage Transformers');
      // Separate chains: have.attr and have.css assertions change the subject.
      cy.get('[data-cy=card-transformers] [data-cy=manage-transformers]')
        .should('have.attr', 'href').and('include', '/app/transformers');
      // Operator 2026-10-12: an orange background, not a transparent link.
      // $orange: #E49400 (src/styles/_variables.scss:47) → .btn-warning
      cy.get('[data-cy=card-transformers] [data-cy=manage-transformers]')
        .should('have.css', 'background-color', 'rgb(228, 148, 0)');
    });

    it('Should save the transformer assignment from the checkboxes (G-37-5)', function() {
      cy.get('[data-cy=transformer-checkboxes] input[type=checkbox]').should('be.checked');
      cy.get('[data-cy=transformer-checkboxes]').contains('.custom-control-label', 'passthrough').click();
      cy.get('[data-cy=transformer-checkboxes] input[type=checkbox]').should('not.be.checked');
      cy.get('[data-cy=transformers-dirty]').should('contain', 'Unsaved changes');
      cy.get('[data-cy=transformers-save]').should('be.enabled').click();
      cy.wait('@updateDevice').its('request.body')
        .should('deep.equal', { changes: { udid: 'udid-z', transformers: [] } });
      // 37 IN-03: the save result is shown inside the card, not only sent.
      cy.contains('[data-cy=card-transformers] .alert-success', 'Transformers saved.').should('be.visible');
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
        .should('have.attr', 'aria-label', 'View build log build-1');
      cy.get('[data-cy=card-build-history] [data-cy=build-open-log]').should('contain', 'View');
    });

    it('Should open the full build log only from the Open build log button (G-36-3)', function() {
      // Registered after stubThinxApi, so it outranks the catch-all.
      cy.intercept(
        { method: 'GET', pathname: '/api/v2/logs/build/build-1' },
        { statusCode: 200, body: { success: true, response: { contents: 'FULL LOG build-1' } } }
      ).as('getBuildDetail');
      // 36 WR-01: click every cell except the last (the one holding the View button).
      cy.get('[data-cy=card-build-history] tbody tr').first().find('td').not(':last').each($td => cy.wrap($td).click());
      // 36 IN-03: this length-0 check is what proves the cell clicks sent no request.
      cy.get('@getBuildDetail.all').should('have.length', 0);
      cy.get('[data-cy=card-build-history] [data-cy=build-open-log]').click();
      cy.wait('@getBuildDetail');
      cy.get('[data-cy=full-build-log]').should('contain', 'FULL LOG build-1');
      // The View click made exactly one request; the cells were already checked above.
      cy.get('@getBuildDetail.all').should('have.length', 1);
    });

    it('Should display Transfer button in Actions card (DEVI-11)', function() {
      cy.get('[data-cy=card-actions] [data-cy=action-transfer]').should('be.visible').and('contain', 'Transfer Device');
    });

    it('Should send one build request for a double click on Build Firmware (POL-01, D-17)', function() {
      // Registered after stubThinxApi, so it outranks the base build stub. The delay
      // keeps the first request in flight while the second click lands.
      cy.intercept({ method: 'POST', pathname: '/api/v2/build' }, (req) => req.reply({
        delay: 800,
        statusCode: 200,
        body: { success: true, response: 'build_started' },
      })).as('buildFirmware');

      // Two native clicks in the same tick, before Vue re-renders the disabled button.
      cy.get('[data-cy=action-build]').then(($b) => {
        $b[0].click();
        $b[0].click();
      });
      cy.get('[data-cy=action-build]').should('be.disabled');
      cy.get('[data-cy=action-build-spinner]').should('exist');
      cy.get('[data-cy=action-build-status]').should('have.text', 'Requesting build…');

      cy.wait('@buildFirmware');
      cy.get('[data-cy=device-detail-content] .alert-success').should('contain', 'Build triggered.');
      cy.get('[data-cy=action-build]').should('be.enabled');
      cy.get('[data-cy=action-build-spinner]').should('not.exist');
      cy.get('@buildFirmware.all').should('have.length', 1);
    });

    it('Should cap the content column at 1140px (POL-01, D-18)', function() {
      cy.get('[data-cy=device-detail-content]').should('have.css', 'max-width', '1140px');
      cy.get('[data-cy=device-detail-content]').find('[data-cy=card-actions]').should('exist');
      cy.get('[data-cy=device-detail-content] .page-title').should('not.exist');
      cy.get('.page-title').should('exist');
    });

  });

});

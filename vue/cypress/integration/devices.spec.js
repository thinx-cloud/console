describe('Devices feature', function() {

  beforeEach(function() {
    cy.viewport(1536, 754);
    cy.stubThinxApi();
    cy.visitApp('/#/app/devices', {
      session: true,
      onBeforeLoad(win) {
        // Cypress already fails on uncaught exceptions; a logged console.error is
        // invisible to it, so stub it to make the "no JS errors" assertion on the
        // first test real. Devices.vue is the most-modified component on this
        // branch (13 new attributes), which is exactly the kind of change that
        // surfaces as a `[Vue warn]` routed through console.error.
        cy.stub(win.console, 'error').as('consoleError');
      },
    });
    cy.wait('@getDevices');
  });

  it('Should display platform filter pills (DEVI-01, Phase 44)', function() {
    // 'All' plus one pill per platform in devices.json: gamma-probe is MongooseOS
    // (mongoose); esp32 and esp8266 are not PLATFORMS keys, so they share unknown.
    cy.get('[data-cy^=platform-pill-]').should('have.length', 3);
    cy.get('[data-cy=platform-pill-All]').should('have.class', 'btn-light');
    cy.get('[data-cy=platform-pill-All]').should('have.attr', 'aria-pressed', 'true');
    cy.get('[data-cy=platform-pill-mongoose]').should('have.attr', 'aria-pressed', 'false');
    cy.get('[data-cy=platform-pill-unknown]').should('have.attr', 'aria-pressed', 'false');
    cy.get('@consoleError').should('not.have.been.called');
  });

  it('Should filter devices by platform (DEVI-01)', function() {
    cy.get('[data-cy=device-row]').should('have.length', 4);
    cy.get('[data-cy=platform-pill-mongoose]').click();
    cy.get('[data-cy=platform-pill-mongoose]').should('have.attr', 'aria-pressed', 'true');
    cy.get('[data-cy=device-row]').should('have.length', 1).and('contain', 'gamma-probe');
    cy.get('[data-cy=platform-pill-unknown]').click();
    cy.get('[data-cy=device-row]').should('have.length', 3);
    cy.get('[data-cy=device-row]').should('contain', 'zephyr-01').and('contain', 'alpha-node').and('contain', 'beta-node');
    cy.get('[data-cy=device-row]').should('not.contain', 'gamma-probe');
    cy.get('[data-cy=platform-pill-All]').click();
    cy.get('[data-cy=device-row]').should('have.length', 4);
  });

  it('Should sort devices by alias (DEVI-02)', function() {
    // Default sort is lastupdate descending, which puts zephyr-01 first.
    cy.get('[data-cy=device-row]').first().should('contain', 'zephyr-01');
    cy.get('[data-cy=device-sort]').select('alias');
    // Function-style .should() re-runs the whole cy.get() on every retry, so it
    // observes the reordered rows. A `.first().should('contain', ...)` chain does
    // NOT: before Cypress 12, .first()/.last() are commands rather than queries and
    // are not re-evaluated on retry, so after Vue reorders the existing <tr> nodes
    // in place (same :key, moved not recreated) the chain keeps asserting against
    // the stale first element until it times out.
    cy.get('[data-cy=device-row]').should(($rows) => {
      expect($rows.first().text()).to.contain('alpha-node');
      expect($rows.last().text()).to.contain('zephyr-01');
    });
  });

  it('Should sort by platform label with unknown last (D-14)', function() {
    cy.get('[data-cy=device-sort]').select('platform');
    // MongooseOS first, then the unknown platforms, each group by alias. Function-style
    // .should() for the same reason as DEVI-02.
    cy.get('[data-cy=device-row]').should(($rows) => {
      const aliases = $rows.toArray().map((row) => Cypress.$(row).find('td').eq(2).text().trim());
      expect(aliases).to.deep.equal(['gamma-probe', 'alpha-node', 'beta-node', 'zephyr-01']);
    });
  });

  it('Should search devices by alias substring (DEVI-03)', function() {
    cy.get('[data-cy=device-search]').type('node');
    cy.get('[data-cy=device-row]').should('have.length', 2);
    cy.get('[data-cy=device-row]').each(($row) => {
      expect($row.text()).to.contain('node');
    });
  });

  it('Should toggle to grid view (DEVI-04)', function() {
    // The glyph-only toggles carry a name and a pressed state (D-14).
    cy.get('[data-cy=view-list]').should('have.attr', 'aria-label', 'List view');
    cy.get('[data-cy=view-list]').should('have.attr', 'title', 'List view');
    cy.get('[data-cy=view-grid]').should('have.attr', 'aria-label', 'Grid view');
    cy.get('[data-cy=view-grid]').should('have.attr', 'title', 'Grid view');
    cy.get('[data-cy=view-list]').should('have.attr', 'aria-pressed', 'true');
    cy.get('[data-cy=view-grid]').should('have.attr', 'aria-pressed', 'false');
    cy.get('[data-cy=device-card]').should('not.exist');
    cy.get('[data-cy=view-grid]').click();
    cy.get('[data-cy=device-card]').should('have.length', 4);
    cy.get('table.table').should('not.exist');
    cy.get('[data-cy=view-grid]').should('have.attr', 'aria-pressed', 'true');
    cy.get('[data-cy=view-list]').should('have.attr', 'aria-pressed', 'false');
    cy.get('[data-cy=view-list]').click();
    cy.get('table.table').should('be.visible');
    cy.get('[data-cy=view-list]').should('have.attr', 'aria-pressed', 'true');
    cy.get('[data-cy=view-grid]').should('have.attr', 'aria-pressed', 'false');
  });

  it('Should revoke a single device with confirmation (DEVI-05)', function() {
    // Registered after stubThinxApi, so it outranks the base stub and serves the
    // refetch that revokeDevices triggers on success (store/devices.js:48).
    cy.intercept({ method: 'GET', pathname: '/api/v2/device' }, { fixture: 'api/devices-after-revoke.json' }).as('getDevicesAfterRevoke');

    cy.contains('[data-cy=device-row]', 'alpha-node').find('[data-cy=row-revoke]').click();
    cy.get('.modal-footer .btn-danger').click();

    cy.wait('@revokeDevices').its('request.body').should('deep.equal', { udids: ['udid-a'] });
    cy.wait('@getDevicesAfterRevoke');
    cy.get('[data-cy=device-row]').should('have.length', 3);
    cy.get('[data-cy=device-row]').should('not.contain', 'alpha-node');
    cy.get('.alert-success').should('contain', 'Device revoked.');
  });

  it('Should bulk revoke selected devices (DEVI-06)', function() {
    cy.intercept({ method: 'GET', pathname: '/api/v2/device' }, { fixture: 'api/devices-after-revoke.json' }).as('getDevicesAfterRevoke');

    // Rows are picked by content; checkbox ids come from the udid (D-14). The inputs
    // are visually hidden by the .abc-checkbox styling.
    cy.contains('[data-cy=device-row]', 'zephyr-01').find('input[type=checkbox]')
      .should('have.attr', 'id', 'checkbox-udid-z')
      .check({ force: true });
    cy.contains('[data-cy=device-row]', 'alpha-node').find('input[type=checkbox]').check({ force: true });
    cy.get('[data-cy=bulk-revoke]').should('contain', 'Revoke (2)').click();
    cy.get('.modal-footer .btn-danger').click();

    cy.wait('@revokeDevices').its('request.body.udids').should('have.length', 2)
      .and('have.members', ['udid-z', 'udid-a']);
    cy.get('.alert-success').should('contain', 'Devices revoked.');
  });

  it('Should transfer a device (DEVI-07)', function() {
    cy.contains('[data-cy=device-row]', 'zephyr-01').find('input[type=checkbox]').check({ force: true });
    cy.get('[data-cy=bulk-transfer]').click();
    cy.get('#transfer-modal').should('be.visible');
    cy.get('#transfer-to').type('new-owner@example.test');
    cy.get('#transfer-modal .modal-footer .btn-warning').click();

    cy.wait('@transferDevices').its('request.body').should('deep.equal', {
      udids: ['udid-z'],
      to: 'new-owner@example.test',
      mig_sources: false,
      mig_apikeys: false,
    });
    cy.get('.alert-success').should('contain', 'Transfer request sent.');
  });

  it('Should push configuration to selected devices (DEVI-08)', function() {
    cy.contains('[data-cy=device-row]', 'zephyr-01').find('input[type=checkbox]').check({ force: true });
    cy.get('[data-cy=bulk-push]').click();
    cy.get('#push-config-modal').should('be.visible');
    // Both env.json globals render as checkboxes; clicking the label toggles the
    // hidden custom-control input.
    cy.get('#push-config-modal .custom-control-label').should('have.length', 3); // ssid, mqtt_host, reset_devices
    cy.get('#push-config-modal').contains('.custom-control-label', 'ssid').click();
    cy.get('#push-config-modal .modal-footer .btn-info').click();

    cy.wait('@pushConfiguration').its('request.body').should('deep.equal', {
      udids: ['udid-z'],
      enviros: ['ssid'],
      reset_devices: false,
    });
    cy.get('.alert-success').should('contain', 'Configuration pushed.');
  });

  it('Should trigger firmware build (DEVI-09)', function() {
    cy.contains('[data-cy=device-row]', 'zephyr-01').find('[data-cy=row-build]').click();

    cy.wait('@buildFirmware').its('request.body').should('deep.equal', {
      build: { udid: 'udid-z', source_id: 'src-1', dryrun: false },
    });
    cy.get('.alert-success').should('contain', 'Build triggered.');
  });

  it('Should reach the API-key marker by keyboard and show its tip (D-14)', function() {
    // No device in devices.json has a keyhash, so every row shows the marker.
    cy.get('[data-cy=api-key-warning]').first().as('apiKeyMarker');
    cy.get('@apiKeyMarker').should('have.attr', 'tabindex', '0');
    cy.get('@apiKeyMarker').focus();
    cy.get('.tooltip-inner').should('be.visible').and('contain', 'No API Key assigned');
    cy.get('@apiKeyMarker').blur();
    cy.get('.tooltip-inner').should('not.exist');
  });

});

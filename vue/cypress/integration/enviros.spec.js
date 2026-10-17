describe('Environment Globals feature', function() {

  beforeEach(function() {
    cy.viewport(1536, 754);
    cy.stubThinxApi();
  });

  describe('once loaded', function() {

    beforeEach(function() {
      // A plain hard load of the Environment Globals route (NOTIF-04). The page reads GET /env
      // once; the Header reads the profile once and the build log twice.
      cy.visitAppRoute('/app/enviros', { session: true });
      cy.wait(['@getEnv', '@getProfile', '@getBuildLog', '@getBuildLog']);
      // env.json: ssid and mqtt_host.
      cy.get('[data-cy=enviro-row]').should('have.length', 2);
      cy.get('[data-cy=enviro-row]').should(($rows) => {
        const keys = $rows.toArray().map((row) => Cypress.$(row).find('[data-cy=enviro-key]').text().trim());
        expect(keys).to.deep.equal(['ssid', 'mqtt_host']);
      });
    });

    it('Should replace a variable value with one PUT and never show the value (ENV-01)', function() {
      cy.contains('[data-cy=enviro-row]', 'ssid').find('[data-cy=enviro-edit]').click();
      cy.get('#enviro-edit-modal').should('be.visible');
      cy.get('[data-cy=enviro-edit-key]').should('have.text', 'ssid');
      cy.get('[data-cy=enviro-edit-save]').should('be.disabled');
      cy.get('[data-cy=enviro-edit-value]').type('fixture-value-1');
      cy.get('[data-cy=enviro-edit-save]').should('be.enabled');
      cy.get('[data-cy=enviro-edit-save]').click();

      cy.wait('@putEnv').its('request.body').should('deep.equal', { key: 'ssid', value: 'fixture-value-1' });
      // The store re-reads the list after the write (the beforeEach consumed the first read).
      cy.wait('@getEnv');
      cy.get('#enviro-edit-modal').should('not.exist');
      // D-03: the value never appears on the page (no toast text, no row, no error).
      cy.get('body').should('not.contain', 'fixture-value-1');
      cy.get('@putEnv.all').should('have.length', 1);
      cy.get('[data-cy=enviro-row]').should('have.length', 2);
      cy.get('@unstubbed.all').should('have.length', 0);
    });

    it('Should keep the dialog, the typed value and the old value when the write fails (ENV-01)', function() {
      // Registered after stubThinxApi, so it outranks the default putEnv stub.
      cy.intercept({ method: 'PUT', pathname: '/api/v2/env' }, {
        statusCode: 500,
        body: { success: false, response: 'env_write_failed' },
      }).as('putEnvFails');

      cy.contains('[data-cy=enviro-row]', 'ssid').find('[data-cy=enviro-edit]').click();
      cy.get('#enviro-edit-modal').should('be.visible');
      cy.get('[data-cy=enviro-edit-value]').type('fixture-value-2');
      cy.get('[data-cy=enviro-edit-save]').click();

      cy.wait('@putEnvFails');
      cy.get('[data-cy=enviro-edit-feedback]').should('contain', 'ssid keeps its current value');
      cy.get('#enviro-edit-modal').should('be.visible');
      cy.get('[data-cy=enviro-edit-value]').should('have.value', 'fixture-value-2');
      // D-04: the list is re-read after a failed write.
      cy.wait('@getEnv');
      cy.get('[data-cy=enviro-row]').should('have.length', 2);
      // The failing route took the request; the default stub saw none.
      cy.get('@putEnv.all').should('have.length', 0);
      cy.get('@unstubbed.all').should('have.length', 0);
    });

  });

});

describe('Repositories feature', function() {

  beforeEach(function() {
    cy.viewport(1536, 754);
    cy.stubThinxApi();
  });

  it('Should show the shared platform bullet in the platform column (REPO-01)', function() {
    // GET /source is opt-in (DeviceDetail reads it too; the device specs rely on the
    // catch-all answering it), registered after stubThinxApi so it outranks the catch-all.
    cy.stubSources();
    // A plain hard load of the Repositories route (NOTIF-04). The page reads GET /source
    // once; the Header reads the profile once and the build log twice.
    cy.visitAppRoute('/app/repositories', { session: true });
    cy.wait(['@getSource', '@getProfile', '@getBuildLog', '@getBuildLog']);

    // sources.json: four repositories; the List renders alias, branch and platform.
    cy.get('table.table tbody tr').should('have.length', 4);
    const expected = [
      ['esp-arduino', 'platform-arduino', 'Arduino'],
      ['pio-sensor', 'platform-platformio', 'Platform.io'],
      ['mongoose-node', 'platform-mongoose', 'MongooseOS'],
      ['legacy-repo', 'platform-unknown', 'unknown'],
    ];
    expected.forEach(([alias, platformClass, label]) => {
      cy.contains('table.table tbody tr', alias).find('.platform-bullet').should('have.length', 1);
      cy.contains('table.table tbody tr', alias).find('.platform-bullet').should('have.class', platformClass);
      cy.contains('table.table tbody tr', alias).find('.platform-bullet').should('have.text', label);
    });
    // The bullet shows the fixed label, never the raw platform string or a "Platform:" prefix.
    cy.get('table.table').should('not.contain', 'unknown_platform');
    cy.get('table.table').should('not.contain', 'Platform:');
    cy.get('@unstubbed.all').should('have.length', 0);
  });

  it('Should show one load error and no table when the network fails (W2, ROADMAP criterion 2)', function() {
    // A request that never gets a response: Api.request() resolves { networkError: true },
    // repositories/fetchRepositories throws, the page shows its load error (audit W2).
    cy.intercept({ method: 'GET', pathname: '/api/v2/source' }, { forceNetworkError: true }).as('getSourceDown');
    cy.visitAppRoute('/app/repositories', { session: true });
    cy.wait('@getSourceDown');

    cy.get('[data-cy=repositories-load-error]').should('have.length', 1);
    cy.get('[data-cy=repositories-load-error]').should('contain', 'Could not load repositories. Refresh to retry.');
    cy.get('table.table').should('not.exist');
    cy.get('.alert-danger').should('have.length', 1);
    // Nothing stale can be selected or deleted.
    cy.contains('button', 'Delete (0)').should('be.disabled');

    // The Header's own reads settle before the test ends (48-08).
    cy.wait(['@getProfile', '@getBuildLog', '@getBuildLog']);
    cy.get('@unstubbed.all').should('have.length', 0);
  });

});

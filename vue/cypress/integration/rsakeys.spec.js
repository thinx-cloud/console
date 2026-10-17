describe('Deploy Keys feature', function() {

  beforeEach(function() {
    cy.viewport(1536, 754);
    cy.stubThinxApi();
  });

  describe('once loaded', function() {

    beforeEach(function() {
      // A plain hard load of the Deploy Keys route (NOTIF-04). The page reads GET /rsakey
      // once; the Header reads the profile once and the build log twice (Header and
      // Notifications). Every read is settled by alias before a test runs.
      cy.visitAppRoute('/app/rsakeys', { session: true });
      cy.wait(['@getRsakeys', '@getProfile', '@getBuildLog', '@getBuildLog']);
      // rsakeys.json: two keys, newest first by date (store/rsakeys.js saveItems).
      cy.get('[data-cy=deploy-key-row]').should('have.length', 2);
      cy.get('[data-cy=deploy-key-row]').first().should('contain', 'Firmware repo key');
    });

    it('Should rename a deploy key and show the new name after the reload (KEY-04)', function() {
      // Registered after stubThinxApi, so it outranks the base stub and serves the reload
      // that saveRename triggers on success (Rsakeys.vue loadData).
      cy.intercept({ method: 'GET', pathname: '/api/v2/rsakey' }, { fixture: 'api/rsakeys-after-rename.json' }).as('getRsakeysAfterRename');

      cy.contains('[data-cy=deploy-key-row]', 'Firmware repo key').find('[data-cy=key-rename]').click();
      cy.get('#rsakey-rename-modal').should('be.visible');
      cy.get('[data-cy=rename-key-input]').should('have.value', 'Firmware repo key');
      cy.get('[data-cy=rename-key-input]').clear();
      cy.get('[data-cy=rename-key-input]').type('Renamed key');
      cy.get('[data-cy=rename-key-save]').click();

      cy.wait('@renameRsakey').its('request.body').should('deep.equal', { filename: 'fixture-key-one', name: 'Renamed key' });
      cy.wait('@getRsakeysAfterRename');
      // A non-static b-modal leaves the DOM when hidden.
      cy.get('#rsakey-rename-modal').should('not.exist');
      cy.get('[data-cy=deploy-key-row]').should('have.length', 2);
      cy.contains('[data-cy=deploy-key-row]', 'Renamed key').should('exist');
      cy.get('[data-cy=deploy-key-row]').should('not.contain', 'Firmware repo key');
      cy.get('@unstubbed.all').should('have.length', 0);
    });

    it('Should delete a deploy key after the confirmation (KEY-05)', function() {
      cy.intercept({ method: 'GET', pathname: '/api/v2/rsakey' }, { fixture: 'api/rsakeys-after-delete.json' }).as('getRsakeysAfterDelete');

      cy.contains('[data-cy=deploy-key-row]', 'Firmware repo key').find('[data-cy=key-delete]').click();
      // $bvModal.msgBoxConfirm: title Confirm Delete, buttons Keep key and Delete (danger).
      cy.get('.modal-body').should('contain', 'Delete the deploy key "Firmware repo key"?');
      cy.get('.modal-footer .btn-danger').click();

      cy.wait('@deleteRsakeys').its('request.body').should('deep.equal', { filenames: ['fixture-key-one'] });
      cy.wait('@getRsakeysAfterDelete');
      cy.get('[data-cy=deploy-key-row]').should('have.length', 1);
      cy.get('[data-cy=deploy-key-row]').should('contain', 'Staging key');
      cy.get('@unstubbed.all').should('have.length', 0);
    });

    it('Should send nothing when the delete is declined (KEY-05)', function() {
      cy.contains('[data-cy=deploy-key-row]', 'Firmware repo key').find('[data-cy=key-delete]').click();
      cy.get('.modal-body').should('contain', 'Delete the deploy key "Firmware repo key"?');
      cy.get('.modal-footer').contains('button', 'Keep key').click();
      cy.get('.modal-body').should('not.exist');

      cy.get('@deleteRsakeys.all').should('have.length', 0);
      cy.get('[data-cy=deploy-key-row]').should('have.length', 2);
      cy.get('@unstubbed.all').should('have.length', 0);
    });

  });

});

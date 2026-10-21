describe('Transformers feature', function() {

  // profile.json's one transformer (utid-1 passthrough) is replaced by a three-transformer
  // profile: utid-1 passthrough, utid-2 battery, utid-3 sigfox. devices.json has exactly one
  // device (udid-z) using utid-1, which fixes the usage sentence of the delete dialog.
  const FIXTURE_BODY = 'dmFyIHRyYW5zZm9ybWVyID0gZnVuY3Rpb24oKXt9Ow==';

  beforeEach(function() {
    cy.viewport(1536, 754);
    cy.stubThinxApi({ profile: 'api/profile-transformers.json' });
  });

  describe('once loaded', function() {

    beforeEach(function() {
      // A plain hard load of the Transformers route (NOTIF-04). The page reads the profile
      // (the transformers live in it) and the device list; the Header reads the profile
      // once and the build log twice (Header and Notifications).
      cy.visitAppRoute('/app/transformers', { session: true });
      cy.wait(['@getProfile', '@getProfile', '@getDevices', '@getBuildLog', '@getBuildLog']);
      cy.get('[data-cy=transformer-row]').should('have.length', 3);
    });

    it('Should delete several transformers after typing confirm (TRANS-04)', function() {
      // transformers/deleteItems reads the profile, writes one POST /profile with the kept
      // transformers and reads the profile again. The read before the write must still see
      // the old list, so the GET handler switches fixtures only once the POST was seen.
      let deleted = false;
      cy.intercept({ method: 'POST', pathname: '/api/v2/profile' }, (req) => {
        deleted = true;
        req.reply({ statusCode: 200, body: { success: true, response: 'profile_updated' } });
      }).as('postTransformers');
      cy.intercept({ method: 'GET', pathname: '/api/v2/profile' }, (req) => {
        req.reply({ fixture: deleted ? 'api/profile-transformers-after-delete.json' : 'api/profile-transformers.json' });
      }).as('getProfileStateful');

      // The b-form-checkbox inputs are visually hidden by the custom-control styling.
      cy.contains('[data-cy=transformer-row]', 'passthrough').find('input[type=checkbox]').check({ force: true });
      cy.contains('[data-cy=transformer-row]', 'battery').find('input[type=checkbox]').check({ force: true });
      cy.get('[data-cy=transformer-bulk-delete]').should('contain', 'Delete selected (2)');
      cy.get('[data-cy=transformer-bulk-delete]').click();

      cy.get('#transformer-delete-modal').should('be.visible');
      cy.get('[data-cy=transformer-delete-question]').should('contain', 'Delete these 2 transformers? This cannot be undone.');
      cy.get('[data-cy=transformer-delete-names] li').should('have.length', 2);
      cy.get('[data-cy=transformer-delete-names]').should('contain', 'passthrough');
      cy.get('[data-cy=transformer-delete-names]').should('contain', 'battery');
      cy.get('[data-cy=transformer-delete-usage]').should('contain', '1 device will stop applying them.');
      // D-07: exactly the word confirm enables the submit; anything else keeps it disabled.
      cy.get('[data-cy=transformer-delete-submit]').should('be.disabled');
      cy.get('[data-cy=transformer-delete-input]').type('confirmx');
      cy.get('[data-cy=transformer-delete-submit]').should('be.disabled');
      cy.get('[data-cy=transformer-delete-input]').clear();
      cy.get('[data-cy=transformer-delete-input]').type('confirm');
      cy.get('[data-cy=transformer-delete-submit]').should('be.enabled');
      cy.get('[data-cy=transformer-delete-submit]').click();

      // Exactly the key `info`, whose transformers hold only the kept sigfox entry.
      cy.wait('@postTransformers').its('request.body').should('deep.equal', {
        info: { transformers: [{ utid: 'utid-3', alias: 'sigfox', body: FIXTURE_BODY }] },
      });
      cy.wait(['@getProfileStateful', '@getProfileStateful']);
      cy.get('#transformer-delete-modal').should('not.exist');
      cy.get('[data-cy=transformer-row]').should('have.length', 1);
      cy.get('[data-cy=transformer-row]').should('contain', 'sigfox');
      cy.get('@unstubbed.all').should('have.length', 0);
    });

    it('Should send nothing when the delete dialog is dismissed (TRANS-04)', function() {
      cy.contains('[data-cy=transformer-row]', 'battery').find('input[type=checkbox]').check({ force: true });
      cy.get('[data-cy=transformer-bulk-delete]').should('contain', 'Delete selected (1)');
      cy.get('[data-cy=transformer-bulk-delete]').click();
      cy.get('#transformer-delete-modal').should('be.visible');
      cy.get('[data-cy=transformer-delete-submit]').should('be.disabled');
      cy.get('[data-cy=transformer-delete-keep]').click();
      cy.get('#transformer-delete-modal').should('not.exist');

      // The default POST /profile alias: no write left the page.
      cy.get('@postProfile.all').should('have.length', 0);
      cy.get('[data-cy=transformer-row]').should('have.length', 3);
      cy.get('@unstubbed.all').should('have.length', 0);
    });

  });

});

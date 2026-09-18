describe('Devices feature', function() {

  beforeEach(function() {
    cy.viewport(1536, 754);
    cy.stubThinxApi();
    cy.visitApp('/#/app/devices', { session: true });
    cy.wait('@getDevices');
  });

  it('Should display category filter pills (DEVI-01)', function() {
    // 'All' plus the seven CATEGORY_COLORS keys.
    cy.get('[data-cy^=category-pill-]').should('have.length', 8);
    cy.get('[data-cy=category-pill-All]').should('have.class', 'btn-primary');
  });

  it('Should filter devices by category (DEVI-01)', function() {
    cy.get('[data-cy=device-row]').should('have.length', 4);
    cy.get('[data-cy=category-pill-green]').click();
    cy.get('[data-cy=device-row]').should('have.length', 2);
    cy.get('[data-cy=device-row]').should('contain', 'zephyr-01').and('contain', 'beta-node');
    cy.get('[data-cy=device-row]').should('not.contain', 'alpha-node');
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

  it('Should search devices by alias substring (DEVI-03)', function() {
    cy.get('[data-cy=device-search]').type('node');
    cy.get('[data-cy=device-row]').should('have.length', 2);
    cy.get('[data-cy=device-row]').each(($row) => {
      expect($row.text()).to.contain('node');
    });
  });

  it('Should toggle to grid view (DEVI-04)', function() {
    cy.get('[data-cy=device-card]').should('not.exist');
    cy.get('[data-cy=view-grid]').click();
    cy.get('[data-cy=device-card]').should('have.length', 4);
    cy.get('table.table').should('not.exist');
    cy.get('[data-cy=view-list]').click();
    cy.get('table.table').should('be.visible');
  });

  it('Should revoke a single device with confirmation (DEVI-05)', function() { /* TODO DEVI-05: click row Revoke button, confirm dialog, verify device removed */ });

  it('Should bulk revoke selected devices (DEVI-06)', function() { /* TODO DEVI-06 smoke: bulk revoke already implemented; verify pre-existing flow still works */ });

  it('Should transfer a device (DEVI-07)', function() { /* TODO DEVI-07 smoke: transfer modal opens and dispatches */ });

  it('Should push configuration to selected devices (DEVI-08)', function() { /* TODO DEVI-08 smoke: push-config modal opens */ });

  it('Should trigger firmware build (DEVI-09)', function() { /* TODO DEVI-09 smoke: build button triggers store action */ });

});

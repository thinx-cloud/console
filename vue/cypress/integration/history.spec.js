describe('History feature', function() {

  beforeEach(function() {
    cy.viewport(1536, 754);
    cy.stubThinxApi();
  });

  it('Should load the history page with both Audit Log and Build Log tabs (HIST-01)', function() {
    cy.visitApp('/#/app/history', {
      session: true,
      onBeforeLoad(win) {
        cy.stub(win.console, 'error').as('consoleError');
      },
    });
    cy.wait(['@getAuditLog', '@getBuildLog']);
    // Scoped to .nav-tabs: the page header also renders .nav-link elements.
    cy.get('.nav-tabs .nav-link').should('contain', 'Audit Log');
    cy.get('.nav-tabs .nav-link').should('contain', 'Build Log');
    cy.get('@consoleError').should('not.have.been.called');
  });

  describe('once loaded', function() {

    beforeEach(function() {
      cy.visitApp('/#/app/history', { session: true });
      cy.wait(['@getAuditLog', '@getBuildLog']);
    });

    it('Should reflect tab state in URL — /app/history/audit and /app/history/builds (HIST-02)', function() {
      cy.hash().should('eq', '#/app/history/audit');
      cy.get('.nav-tabs').contains('.nav-link', 'Build Log').click();
      cy.hash().should('eq', '#/app/history/builds');
      cy.get('.nav-tabs').contains('.nav-link', 'Audit Log').click();
      cy.hash().should('eq', '#/app/history/audit');
    });

    it('Should allow expanding a build row to read the full log inline (HIST-03)', function() {
      cy.get('.nav-tabs').contains('.nav-link', 'Build Log').click();
      // Only build-1's log exceeds the 400-char logIsTruncatable threshold.
      cy.get('[data-cy=build-expand]').should('have.length', 1);
      cy.contains('[data-cy=build-row]', 'zephyr-01').within(() => {
        cy.get('[data-cy=build-log-pre]').should('have.attr', 'style').and('contain', 'max-height');
        cy.get('[data-cy=build-log-pre]').invoke('text').then((collapsedText) => {
          cy.get('[data-cy=build-expand]').should('contain', 'Expand').click();
          cy.get('[data-cy=build-log-pre]').should('have.attr', 'style').and('not.contain', 'max-height');
          cy.get('[data-cy=build-log-pre]').invoke('text').should((expandedText) => {
            expect(expandedText.length).to.be.greaterThan(collapsedText.length);
          });
        });
      });
      cy.get('[data-cy=build-expand]').should('contain', 'Collapse');
    });

    it('Should filter both tabs by a date range (HIST-04)', function() {
      cy.get('[data-cy=audit-row]').should('have.length', 4);
      // audit-log.json's oldest entry is 2026-09-10; this window excludes it.
      cy.get('.tab-pane.active [data-cy=date-from]').type('2026-09-15');
      cy.get('.tab-pane.active [data-cy=date-to]').type('2026-09-18');
      cy.get('[data-cy=audit-row]').should('have.length', 3);
      cy.get('[data-cy=audit-row]').should('not.contain', 'API key created');

      // dateFrom/dateTo are shared across both tabs by a single v-model.
      cy.get('.nav-tabs').contains('.nav-link', 'Build Log').click();
      cy.get('[data-cy=build-row]').should('have.length', 3);
      cy.get('.tab-pane.active [data-cy=date-from]').clear().type('2026-09-18');
      cy.get('[data-cy=build-row]').should('have.length', 1);
      cy.get('[data-cy=build-row]').should('contain', 'zephyr-01');
    });

    it('Should filter audit log by warning/danger flag checkboxes (HIST-05)', function() {
      cy.get('[data-cy=audit-row]').should('have.length', 4);
      cy.get('.table-danger').should('have.length', 1);
      // b-form-checkbox-group with `switches` hides the real input; click the label.
      cy.get('[data-cy=flag-filter]').contains('.custom-control-label', 'Danger').click();
      cy.get('[data-cy=audit-row]').should('have.length', 3);
      cy.get('.table-danger').should('not.exist');
      cy.get('[data-cy=audit-row]').should('not.contain', 'Device revoked by owner');
    });

  });

});

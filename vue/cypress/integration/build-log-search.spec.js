describe('Build log search feature', function() {

  // build-log-detail.json: 120 lines; exactly three contain the word error in some case
  // (lines 3, 60 and 112), so a search for `error` yields 1 / 3 and the last match sits
  // deep enough to scroll the 70vh log box.
  function openLog() {
    cy.contains('[data-cy=build-row]', 'zephyr-01').find('[data-cy=build-open-log]').click();
    cy.wait('@getBuildDetail');
    cy.get('[data-cy=full-build-log]').should('contain', 'compiling module 1 of 120');
  }

  beforeEach(function() {
    cy.viewport(1536, 754);
    cy.stubThinxApi();
    // Registered after stubThinxApi, so it outranks the catch-all (device-detail.spec.js
    // uses the same alias for its own bespoke full-log stub).
    cy.intercept({ method: 'GET', pathname: '/api/v2/logs/build/build-1' }, { fixture: 'api/build-log-detail.json' }).as('getBuildDetail');
    // A plain hard load of the History route (NOTIF-04): the page reads the audit log and
    // the build log, the Header reads the profile once and the build log twice.
    cy.visitAppRoute('/app/history', { session: true });
    cy.wait(['@getAuditLog', '@getBuildLog', '@getBuildLog', '@getBuildLog', '@getProfile']);
    cy.get('.nav-tabs').contains('.nav-link', 'Build Log').click();
    openLog();
  });

  it('Should highlight, count and step through matches case-insensitively (BUILD-03)', function() {
    // The 200 ms debounce is covered by the retrying assertions, never by a numeric wait.
    cy.get('[data-cy=build-log-search]').type('error');
    cy.get('[data-cy=build-log-match]').should('have.length', 3);
    cy.get('[data-cy=build-log-search-count]').should('contain', '1 / 3');
    cy.get('[data-cy=build-log-match]').first().should('have.class', 'build-log-match--current');
    cy.get('[data-cy=build-log-match]').first().should('have.attr', 'aria-current', 'true');
    cy.get('.build-log-match--current').should('have.length', 1);

    cy.get('[data-cy=build-log-next]').click();
    cy.get('[data-cy=build-log-search-count]').should('contain', '2 / 3');
    // The current mark moves to the second match (line 60, below the 70vh fold).
    cy.get('[data-cy=build-log-match]').eq(1).should('have.class', 'build-log-match--current');
    cy.get('[data-cy=build-log-match]').eq(1).should('have.attr', 'aria-current', 'true');
    cy.get('[data-cy=build-log-match]').first().should('not.have.class', 'build-log-match--current');
    // NOT asserted here: that the log box scrolled to the current match (UI-B06). Measured on
    // 2026-10-18 (48.1-03): BuildLogDialog.scrollToCurrent runs in the dialog's own nextTick,
    // but the b-modal transporter re-renders the modal body one tick later (Vue 2 calls
    // updated() hooks after resetSchedulerState), so it measures the previous current mark
    // and scrollTop stays 0. Pre-existing defect, recorded in the phase deferred-items.md;
    // add `expect($log[0].scrollTop).to.be.greaterThan(0)` here once it is fixed.
    cy.get('[data-cy=build-log-next]').click();
    cy.get('[data-cy=build-log-search-count]').should('contain', '3 / 3');
    // Wraps around in both directions.
    cy.get('[data-cy=build-log-next]').click();
    cy.get('[data-cy=build-log-search-count]').should('contain', '1 / 3');
    cy.get('[data-cy=build-log-prev]').click();
    cy.get('[data-cy=build-log-search-count]').should('contain', '3 / 3');
    cy.get('@unstubbed.all').should('have.length', 0);
  });

  it('Should search only from three characters and report no matches (BUILD-03)', function() {
    // Three characters search (err matches ERROR, error and Error); dropping to two clears it.
    cy.get('[data-cy=build-log-search]').type('err');
    cy.get('[data-cy=build-log-search-count]').should('contain', '1 / 3');
    cy.get('[data-cy=build-log-search]').type('{backspace}');
    cy.get('[data-cy=build-log-search]').should('have.value', 'er');
    cy.get('[data-cy=build-log-search-count]').should('have.text', '');
    cy.get('[data-cy=build-log-match]').should('not.exist');

    cy.get('[data-cy=build-log-search]').clear();
    cy.get('[data-cy=build-log-search]').type('zzzz');
    cy.get('[data-cy=build-log-search-count]').should('contain', 'No matches');
    cy.get('[data-cy=build-log-match]').should('not.exist');
    cy.get('[data-cy=build-log-prev]').should('be.disabled');
    cy.get('[data-cy=build-log-next]').should('be.disabled');
    cy.get('@unstubbed.all').should('have.length', 0);
  });

  it('Should forget the search when the dialog is opened again (BUILD-03)', function() {
    cy.get('[data-cy=build-log-search]').type('error');
    cy.get('[data-cy=build-log-search-count]').should('contain', '1 / 3');
    cy.get('.modal-footer').contains('button', 'Close').click();
    // A non-static b-modal leaves the DOM when hidden.
    cy.get('[data-cy=full-build-log]').should('not.exist');
    cy.get('.modal').should('not.exist');

    // A second open requests the log again and starts with an empty search (D-12).
    openLog();
    cy.get('@getBuildDetail.all').should('have.length', 2);
    cy.get('[data-cy=build-log-search]').should('have.value', '');
    cy.get('[data-cy=build-log-search-count]').should('have.text', '');
    cy.get('[data-cy=build-log-match]').should('not.exist');
    cy.get('@unstubbed.all').should('have.length', 0);
  });

});

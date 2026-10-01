describe('History feature', function() {

  beforeEach(function() {
    cy.viewport(1536, 754);
    cy.stubThinxApi();
  });

  it('Should load the history page with both Audit Log and Build Log tabs (HIST-01)', function() {
    cy.visitAppRoute('/app/history', {
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
      cy.visitAppRoute('/app/history', { session: true });
      cy.wait(['@getAuditLog', '@getBuildLog']);
      // The waits above may be satisfied by the dashboard that cy.visitAppRoute
      // passes through; wait for History's own rows before any test runs.
      cy.get('.page-title').should('contain', 'History');
      cy.get('[data-cy=audit-row]').should('have.length', 4);
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

  describe('paging (LOG-03/LOG-04)', function() {

    // Two-page stubs (26-RESEARCH.md "Cypress: two-page stub"). Registered AFTER
    // the outer beforeEach's cy.stubThinxApi(), so they outrank its catch-all and
    // its @getAuditLog / @getBuildLog intercepts (Pitfall 11). The handler branches
    // on the cursor query parameter: no cursor is a first-page request (History,
    // and the dashboard / Header / Notifications on the way in), a cursor is a
    // Load more. `auditFailures` / `buildFailures` say how many cursor requests
    // answer 500 before the stub starts answering with page 2.
    function stubPagedLogs({ auditFailures = 0, buildFailures = 0 } = {}) {
      const pagedHandler = (table, failures) => {
        let failed = 0;
        return (req) => {
          const cursor = new URL(req.url).searchParams.get('cursor');
          if (!cursor) {
            req.reply({ fixture: `api/${table}-log-page1.json` });
          } else if (failed < failures) {
            failed += 1;
            req.reply({ statusCode: 500, body: { success: false, response: 'stub_page_error' } });
          } else {
            req.reply({ fixture: `api/${table}-log-page2.json` });
          }
        };
      };
      cy.intercept({ method: 'GET', pathname: '/api/v2/logs/audit' }, pagedHandler('audit', auditFailures))
        .as('getAuditLogPaged');
      cy.intercept({ method: 'GET', pathname: '/api/v2/logs/build' }, pagedHandler('build', buildFailures))
        .as('getBuildLogPaged');
    }

    // Cursor (Load more) requests seen so far by a paged intercept. cy.wait('@alias')
    // yields the OLDEST unwaited request, and the dashboard that visitAppRoute
    // passes through has already sent first-page requests, so a Load more
    // request is picked out of `.all` by its cursor instead.
    function cursorCalls(alias) {
      return cy.get(`${alias}.all`).then((calls) =>
        calls.filter((call) => new URL(call.request.url).searchParams.get('cursor')));
    }

    function openPagedHistory() {
      cy.visitAppRoute('/app/history', { session: true });
      cy.get('.page-title').should('contain', 'History');
      cy.get('[data-cy=audit-row]').should('have.length', 3);
      cy.get('[data-cy=build-row]').should('have.length', 2);
    }

    it('Should show no Load more with the legacy unpaged fixtures (UI-SPEC 1)', function() {
      cy.visitAppRoute('/app/history', { session: true });
      cy.get('.page-title').should('contain', 'History');
      cy.get('[data-cy=audit-row]').should('have.length', 4);
      cy.get('[data-cy=build-row]').should('have.length', 3);
      cy.get('[data-cy=audit-paging]').should('exist');
      cy.get('[data-cy=build-paging]').should('exist');
      cy.get('[data-cy=audit-load-more]').should('not.exist');
      cy.get('[data-cy=build-load-more]').should('not.exist');
    });

    it('Should keep the dashboard cards to the first page with no paging controls (UI-SPEC 7)', function() {
      stubPagedLogs();
      cy.visitApp('/#/app/dashboard', { session: true });
      cy.get('.page-title').should('contain', 'Dashboard');
      cy.get('[data-cy=recent-audit] tbody tr').should('have.length', 3);
      cy.get('[data-cy=recent-builds] tbody tr').should('have.length', 2);
      cy.get('[data-cy$=load-more]').should('not.exist');
      cy.get('[data-cy$=filter-hint]').should('not.exist');
      cy.get('[data-cy$=paging-status]').should('not.exist');
      cursorCalls('@getAuditLogPaged').should('have.length', 0);
      cursorCalls('@getBuildLogPaged').should('have.length', 0);
    });

    it('Should append the next audit page with limit=100 and the page-1 cursor (UI-SPEC 2)', function() {
      stubPagedLogs();
      openPagedHistory();
      // First-page requests ask for 100 and carry no cursor.
      cy.get('@getAuditLogPaged.all').then((calls) => {
        expect(calls.length).to.be.greaterThan(0);
        calls.forEach((call) => {
          const query = new URL(call.request.url).searchParams;
          expect(query.get('limit')).to.eq('100');
          expect(query.get('cursor')).to.eq(null);
        });
      });
      cy.get('[data-cy=audit-paging-status]').should('have.text', '');
      cy.get('[data-cy=audit-load-more]')
        .should('be.visible')
        .and('have.attr', 'aria-label', 'Load more audit log entries')
        .and('contain', 'Load more')
        .click();
      cy.get('[data-cy=audit-row]').should('have.length', 5);
      cy.get('[data-cy=audit-row]').last().should('contain', 'Older device registered');
      cursorCalls('@getAuditLogPaged').should((calls) => {
        expect(calls).to.have.length(1);
        const query = new URL(calls[0].request.url).searchParams;
        expect(query.get('limit')).to.eq('100');
        expect(query.get('cursor')).to.eq('audit-cursor-2');
      });
      cy.get('[data-cy=audit-load-more]').should('not.exist');
      cy.get('[data-cy=audit-paging-status]')
        .should('have.text', 'Loaded 2 more entries. All 5 entries loaded.');
    });

    it('Should page the build table with its own cursor (UI-SPEC 2, builds)', function() {
      stubPagedLogs();
      openPagedHistory();
      cy.get('.nav-tabs').contains('.nav-link', 'Build Log').click();
      cy.get('[data-cy=build-load-more]')
        .should('be.visible')
        .and('have.attr', 'aria-label', 'Load more builds')
        .click();
      cy.get('[data-cy=build-row]').should('have.length', 3);
      cy.get('[data-cy=build-row]').last().should('contain', 'mu-03');
      cursorCalls('@getBuildLogPaged').should((calls) => {
        expect(calls).to.have.length(1);
        const query = new URL(calls[0].request.url).searchParams;
        expect(query.get('limit')).to.eq('100');
        expect(query.get('cursor')).to.eq('build-cursor-2');
      });
      cy.get('[data-cy=build-load-more]').should('not.exist');
      cy.get('[data-cy=build-paging-status]')
        .should('have.text', 'Loaded 1 more entry. All 3 entries loaded.');
    });

    it('Should page the audit and build tables independently (UI-SPEC 3)', function() {
      stubPagedLogs();
      openPagedHistory();

      // Builds first: the audit table, its button and its cursor are untouched.
      cy.get('.nav-tabs').contains('.nav-link', 'Build Log').click();
      cy.get('[data-cy=build-load-more]').should('be.visible').click();
      cy.get('[data-cy=build-row]').should('have.length', 3);
      cy.get('[data-cy=build-load-more]').should('not.exist');
      cy.get('[data-cy=audit-row]').should('have.length', 3);
      cy.get('[data-cy=audit-load-more]').should('exist');
      cy.get('[data-cy=audit-paging-status]').should('have.text', '');
      cursorCalls('@getAuditLogPaged').should('have.length', 0);

      // Then audit: the build table keeps its rows and sends no further request.
      cy.get('.nav-tabs').contains('.nav-link', 'Audit Log').click();
      cy.get('[data-cy=audit-load-more]').should('be.visible').click();
      cy.get('[data-cy=audit-row]').should('have.length', 5);
      cy.get('[data-cy=audit-load-more]').should('not.exist');
      cy.get('[data-cy=build-row]').should('have.length', 3);
      cy.get('[data-cy=build-paging-status]').should('have.text', 'Loaded 1 more entry. All 3 entries loaded.');
      cursorCalls('@getAuditLogPaged').should('have.length', 1);
      cursorCalls('@getBuildLogPaged').should('have.length', 1);
    });

    it('Should keep the build button while only the audit table is paged (UI-SPEC 3, reverse)', function() {
      stubPagedLogs();
      openPagedHistory();
      cy.get('[data-cy=audit-load-more]').should('be.visible').click();
      cy.get('[data-cy=audit-row]').should('have.length', 5);
      cy.get('[data-cy=build-row]').should('have.length', 2);
      cy.get('[data-cy=build-load-more]').should('exist');
      cy.get('[data-cy=build-paging-status]').should('have.text', '');
      cursorCalls('@getBuildLogPaged').should('have.length', 0);
    });

    it('Should show the filter hint only while older entries exist and send no request (UI-SPEC 4, D-05/D-06)', function() {
      stubPagedLogs();
      openPagedHistory();
      cy.get('[data-cy=audit-filter-hint]').should('not.exist');
      // Snapshot only after History's rows are visible, so the dashboard's and
      // History's own first-page requests are already counted.
      cy.get('@getAuditLogPaged.all').its('length').then((before) => {
        // Date filter.
        cy.get('.tab-pane.active [data-cy=date-from]').type('2026-09-21');
        cy.get('[data-cy=audit-row]').should('have.length', 2);
        cy.get('[data-cy=audit-filter-hint]')
          .should('be.visible')
          .and('have.text', 'Filtering 3 loaded entries; older entries exist.');
        cy.get('.tab-pane.active [data-cy=date-from]').clear();
        cy.get('[data-cy=audit-row]').should('have.length', 3);
        cy.get('[data-cy=audit-filter-hint]').should('not.exist');

        // Flag filter.
        cy.get('[data-cy=flag-filter]').contains('.custom-control-label', 'Danger').click();
        cy.get('[data-cy=audit-row]').should('have.length', 2);
        cy.get('[data-cy=audit-filter-hint]').should('be.visible');
        cy.get('[data-cy=flag-filter]').contains('.custom-control-label', 'Danger').click();
        cy.get('[data-cy=audit-row]').should('have.length', 3);
        cy.get('[data-cy=audit-filter-hint]').should('not.exist');

        cy.get('@getAuditLogPaged.all').should('have.length', before);
      });
      cursorCalls('@getAuditLogPaged').should('have.length', 0);
      cursorCalls('@getBuildLogPaged').should('have.length', 0);
    });

    it('Should show no filter hint when nothing older exists (UI-SPEC 4, has_more false)', function() {
      // Legacy fixtures: no paging, so has_more is false.
      cy.visitAppRoute('/app/history', { session: true });
      cy.get('.page-title').should('contain', 'History');
      cy.get('[data-cy=audit-row]').should('have.length', 4);
      cy.get('.tab-pane.active [data-cy=date-from]').type('2026-09-15');
      cy.get('[data-cy=audit-row]').should('have.length', 3);
      cy.get('[data-cy=audit-filter-hint]').should('not.exist');
      cy.get('[data-cy=build-filter-hint]').should('not.exist');
      cy.get('[data-cy=audit-load-more]').should('not.exist');
    });

    it('Should keep Load more when a filter matches no loaded entry (UI-SPEC 5)', function() {
      stubPagedLogs();
      openPagedHistory();
      cy.get('.tab-pane.active [data-cy=date-from]').type('2026-12-01');
      cy.get('[data-cy=audit-row]').should('not.exist');
      cy.get('.tab-pane.active').should('contain', 'No loaded entries match these filters.');
      cy.get('[data-cy=audit-load-more]').should('be.visible');
      cy.get('[data-cy=audit-filter-hint]').should('have.text', 'Filtering 3 loaded entries; older entries exist.');
    });

    it('Should keep rows and the button after a failed Load more, and append on retry (UI-SPEC 6)', function() {
      stubPagedLogs({ auditFailures: 1 });
      openPagedHistory();
      cy.get('[data-cy=audit-load-more]').should('be.visible').click();
      cy.get('[data-cy=audit-load-more-error]')
        .should('be.visible')
        .and('have.attr', 'role', 'alert')
        .and('have.text', "Couldn't load older entries. Select Load more to try again.");
      cy.get('[data-cy=audit-row]').should('have.length', 3);
      cy.get('[data-cy=audit-load-more]').should('be.visible').and('not.have.attr', 'aria-disabled');
      cy.get('[data-cy=audit-paging-status]').should('have.text', '');

      // Retry: the stub now answers 200 with page 2.
      cy.get('[data-cy=audit-load-more]').click();
      cy.get('[data-cy=audit-row]').should('have.length', 5);
      cy.get('[data-cy=audit-load-more-error]').should('not.exist');
      cy.get('[data-cy=audit-load-more]').should('not.exist');
      cursorCalls('@getAuditLogPaged').should((calls) => {
        expect(calls).to.have.length(2);
        calls.forEach((call) => {
          expect(new URL(call.request.url).searchParams.get('cursor')).to.eq('audit-cursor-2');
        });
      });
    });

  });

});

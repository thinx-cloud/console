
describe('History feature', function() {

  beforeEach(() => {
    cy.viewport(1536, 754);
    cy.login();
    cy.visit('http://localhost:3000/#/app/history');
  });

  it('Should load the history page with both Audit Log and Build Log tabs (HIST-01)', function() { /* TODO HIST-01: verify both b-tab titles ("Audit Log" and "Build Log") render; no console errors */ });

  it('Should reflect tab state in URL — /app/history/audit and /app/history/builds (HIST-02)', function() { /* TODO HIST-02: click each tab, assert URL hash matches /app/history/audit and /app/history/builds respectively */ });

  it('Should allow expanding a build row to read the full log inline (HIST-03)', function() { /* TODO HIST-03: click Expand on a build row with a log, assert the <pre> no longer has the 120px max-height clipping */ });

  it('Should filter both tabs by a date range (HIST-04)', function() { /* TODO HIST-04: set from/to inputs, assert filtered rows have item.date within range */ });

  it('Should filter audit log by warning/danger flag checkboxes (HIST-05)', function() { /* TODO HIST-05: uncheck "danger" in flag-filter group, assert no rows with flags: ['danger'] remain */ });

});


describe('Dashboard feature', function() {

  beforeEach(function() {
    if (!Cypress.env('HAS_THINX_TEST_CREDENTIALS')) this.skip();
    cy.viewport(1536, 754);
    cy.login();
    cy.visit('http://localhost:3000/#/app/dashboard');
  });

  it('Should load the dashboard without JS errors (DASH-01)', function() { /* TODO DASH-01: verify page-title Dashboard visible, no console errors */ });

  it('Should fetch real stats from GET /stats (DASH-01)', function() { /* TODO DASH-01: intercept /stats, assert request fired and cards bound to response */ });

  it('Should display six metric cards (DASH-02)', function() { /* TODO DASH-02: verify 6 metric card elements rendered */ });

  it('Should show today/week/month breakdowns on metric cards (DASH-02)', function() { /* TODO DASH-02: verify each card shows three period sub-values */ });

  it('Should render the check-ins timeline chart (DASH-03)', function() { /* TODO DASH-03: verify canvas/chart element present */ });

  it('Should update the timeline chart when the range selector changes (DASH-03)', function() { /* TODO DASH-03: click 31-day option, verify chart re-renders */ });

  it('Should display the recent builds widget with download links (DASH-04)', function() { /* TODO DASH-04: verify last-10 builds list and download link per row */ });

  it('Should display the recent audit events widget (DASH-05)', function() { /* TODO DASH-05: verify audit events card and rows */ });

});

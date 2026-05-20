
describe('Device Detail feature', function() {

  beforeEach(() => {
    cy.viewport(1536, 754);
    cy.login();
    cy.visit('http://localhost:3000/#/app/devices');
  });

  it('Should navigate to device detail on Detail button click (DEVI-10)', function() { /* TODO DEVI-10: click first Detail button, verify URL changes to /app/device/:udid */ });

  it('Should display device info section (DEVI-11)', function() { /* TODO DEVI-11: verify Device Info card visible */ });

  it('Should display environment variables section (DEVI-11)', function() { /* TODO DEVI-11: verify Environment Variables card present */ });

  it('Should display transformer assignment section (DEVI-11)', function() { /* TODO DEVI-11: verify Transformer Assignment card and b-form-select present */ });

  it('Should display build history section (DEVI-11)', function() { /* TODO DEVI-11: verify Build History card present (empty state allowed) */ });

  it('Should display device logs section (DEVI-11)', function() { /* TODO DEVI-11: verify Device Logs card present when last_build_id is set */ });

  it('Should display Transfer button in Actions card (DEVI-11)', function() { /* TODO DEVI-11/D-12: Transfer button visible in Actions card */ });

});

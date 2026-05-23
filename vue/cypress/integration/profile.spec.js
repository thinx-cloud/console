
describe('Profile feature', function() {

  beforeEach(() => {
    cy.viewport(1536, 754);
    cy.login();
    cy.visit('http://localhost:3000/#/app/profile');
  });

  it('Should load the profile page without JS errors (PROF-01)', function() { /* TODO PROF-01: verify page title "My Profile" visible, no console errors */ });

  it('Should display and save profile fields: first name, last name, phone, timezone (PROF-01)', function() { /* TODO PROF-01: fill first_name/last_name/mobile_phone/timezone fields, click Save Profile, verify success alert */ });

  it('Should display avatar upload picker and preview (PROF-02)', function() { /* TODO PROF-02: verify avatar tab visible, file input present, preview <img> updates after upload */ });

  it('Should save notification preferences without overwriting profile info (PROF-03)', function() { /* TODO PROF-03: check "All notifications" checkbox, click Save Notifications, verify success alert, reload and confirm profile first_name unchanged */ });

  it('Should show admin tab for admin users and hide it for non-admin (PROF-04)', function() { /* TODO PROF-04: verify admin tab present when profile.admin === true, absent when false */ });

  it('Should require confirmation before deleting account and redirect to /login (PROF-05)', function() { /* TODO PROF-05: click Delete My Account, confirm modal appears, cancel does not redirect, confirm does redirect to /login */ });

  it('Should be reachable via header My Account dropdown link (PROF-06)', function() { /* TODO PROF-06: click header settings dropdown, click My Account, verify URL is /#/app/profile */ });

});

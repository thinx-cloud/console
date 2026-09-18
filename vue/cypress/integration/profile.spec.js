describe('Profile feature', function() {

  beforeEach(function() {
    cy.viewport(1536, 754);
  });

  describe('with a non-admin profile', function() {

    beforeEach(function() {
      cy.stubThinxApi();
      cy.visitApp('/#/app/profile', {
        session: true,
        onBeforeLoad(win) {
          // Cypress already fails on uncaught exceptions; a logged console.error is
          // invisible to it, so stub it to make the PROF-01 "no JS errors" assertion
          // real. Profile.vue took 7 new attributes in this branch, two on components
          // with non-obvious attribute fall-through, which is exactly the kind of
          // change that surfaces as a `[Vue warn]` routed through console.error.
          cy.stub(win.console, 'error').as('consoleError');
        },
      });
      cy.wait('@getProfile');
    });

    it('Should load the profile page without JS errors (PROF-01)', function() {
      cy.get('.page-title').should('contain', 'My Profile');
      cy.get('.nav-tabs .nav-link').should('contain', 'Profile');
      cy.get('@consoleError').should('not.have.been.called');
    });

    it('Should display and save profile fields: first name, last name, phone, timezone (PROF-01)', function() {
      // Positional cy.get('input').eq(n) is unreliable here: Header.vue renders a
      // #search-input <b-input> ahead of the router-view content, so an
      // unscoped `input` query is off by one against these four fields. Select
      // by data-cy instead of contorting the indices.
      cy.get('[data-cy=profile-first-name]').should('have.value', 'Cypress');
      cy.get('[data-cy=profile-last-name]').should('have.value', 'Tester');
      cy.get('[data-cy=profile-mobile-phone]').should('have.value', '+420123456789');
      cy.get('[data-cy=profile-timezone-abbr]').should('have.value', 'Europe/Prague');

      cy.get('[data-cy=profile-first-name]').clear().type('Renamed');
      cy.get('[data-cy=save-profile]').click();

      cy.wait('@postProfile').its('request.body.info').should((info) => {
        expect(info.first_name).to.eq('Renamed');
        expect(info.last_name).to.eq('Tester');
        expect(info.mobile_phone).to.eq('+420123456789');
        expect(info.timezone_abbr).to.eq('Europe/Prague');
      });
      cy.get('.alert-success').should('contain', 'Profile updated.');
    });

    it('Should display avatar upload picker and preview (PROF-02)', function() {
      cy.get('.nav-tabs').contains('.nav-link', 'Avatar').click();
      cy.get('[data-cy=avatar-file]').should('exist');
      cy.get('[data-cy=avatar-preview]').should('be.visible');

      // b-form-file's computedAttrs binds passthrough attrs (incl. data-cy)
      // straight onto the real <input type=file>, not a wrapper element.
      cy.get('[data-cy=avatar-file]').selectFile('cypress/fixtures/api/avatar.png', { force: true });
      // The post-upload refetch must return a profile that HAS an avatar, or
      // avatarSrc falls back to the bundled default and the preview never changes.
      cy.intercept({ method: 'GET', pathname: '/api/v2/profile' }, { fixture: 'api/profile-with-avatar.json' }).as('getProfileWithAvatar');
      cy.contains('button', 'Save Avatar').click();

      cy.wait('@postProfile').its('request.body').should('have.property', 'avatar');
      cy.wait('@getProfileWithAvatar');
      // avatarSrc hard-codes the `data:image/png;base64,` prefix regardless of
      // content, so matching only that prefix would pass even if the binding
      // were broken and profile.avatar were some other non-empty string.
      // Asserting the actual fixture bytes (the PNG signature, base64-encoded)
      // proves the preview is really rendering profile.avatar.
      cy.get('[data-cy=avatar-preview]').should('have.attr', 'src')
        .and('match', /^data:image\/png;base64,/)
        .and('include', 'iVBORw0KGgo');
    });

    it('Should save notification preferences without overwriting profile info (PROF-03)', function() {
      cy.get('.nav-tabs').contains('.nav-link', 'Notifications').click();
      cy.contains('.custom-control-label', 'All notifications').click();
      cy.get('[data-cy=save-notifications]').click();

      cy.wait('@postProfile').its('request.body.info').should((info) => {
        expect(info.notifications.all).to.eq(true);
        // The regression this test exists for: saveNotifications must merge into
        // the existing info blob, not replace it.
        expect(info.first_name).to.eq('Cypress');
        expect(info.email).to.eq('cypress@example.test');
      });
      cy.get('.alert-success').should('contain', 'Notification preferences saved.');
    });

    it('Should require confirmation before deleting account and redirect to /login (PROF-05)', function() {
      cy.get('.nav-tabs').contains('.nav-link', 'Account').click();

      // Cancel must not navigate and must not fire the request. The hash
      // check alone wouldn't catch a fire-and-forget DELETE that never
      // navigates, so also assert directly on the aliased request count.
      cy.get('[data-cy=delete-account]').click();
      cy.get('.modal-footer .btn-secondary').click();
      cy.hash().should('eq', '#/app/profile');
      cy.get('@deleteAccount.all').should('have.length', 0);

      cy.get('[data-cy=delete-account]').click();
      cy.get('.modal-footer .btn-danger').click();
      cy.wait('@deleteAccount');
      cy.hash().should('eq', '#/login');
    });

    it('Should be reachable via header My Account dropdown link (PROF-06)', function() {
      cy.visitApp('/#/app/dashboard', { session: true });
      cy.get('[data-cy=settings-dropdown] .dropdown-toggle').click();
      cy.get('[data-cy=settings-dropdown]').contains('.dropdown-item', 'My Account').click();
      cy.hash().should('eq', '#/app/profile');
    });

  });

  it('Should show admin tab for admin users and hide it for non-admin (PROF-04)', function() {
    cy.stubThinxApi();
    cy.visitApp('/#/app/profile', { session: true });
    cy.wait('@getProfile');
    // b-tab renders its title into .nav-tabs, never onto the pane, so this is a
    // text assertion rather than a data-cy one.
    cy.get('.nav-tabs .nav-link').should('not.contain', 'Admin');

    cy.stubThinxApi({ profile: 'api/profile-admin.json' });
    cy.visitApp('/#/app/profile', { session: true });
    // This app uses hash-based routing, and the URL above is byte-for-byte
    // identical to the one already loaded, so it never fires a `hashchange`
    // event and Vue Router never remounts Profile.vue to pick up the new
    // stub. cy.reload() forces the real full-document reload that a
    // navigation to an actually-different URL would otherwise provide.
    cy.reload();
    cy.wait('@getProfile');
    cy.get('.nav-tabs .nav-link').should('contain', 'Admin');
  });

});

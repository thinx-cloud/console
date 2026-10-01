describe('OAuth return feature', function() {

  // GET /api/oauth/{google,github} destroys the API session before the provider
  // redirect, but the browser keeps XSRF-TOKEN. On the way back that cookie is
  // bound to a session that no longer exists, so the return page must re-prime
  // before its first POST instead of trusting the cookie (25-06 finding).
  it('Should re-prime the CSRF token before posting from /oauth-return with a stale cookie', function() {
    const calls = [];
    const record = (name, reply) => (req) => { calls.push(name); req.reply(reply); };

    cy.stubThinxApi();
    cy.intercept({ method: 'GET', pathname: '/api/v2/csrf-token' },
      // Like the API, the prime both sets the cookie and echoes the token.
      record('prime', {
        statusCode: 200,
        headers: { 'set-cookie': 'XSRF-TOKEN=fresh-csrf; Path=/' },
        body: { success: true, csrf_token: 'fresh-csrf' },
      })).as('csrfToken');
    cy.intercept({ method: 'POST', pathname: '/api/v2/session/token' },
      record('session-token', { statusCode: 401, body: { success: false, response: 'unauthorized' } })).as('sessionToken');
    cy.intercept({ method: 'POST', pathname: '/api/v2/login' },
      record('login', { statusCode: 200, body: { success: false, response: 'oauth_test_stub' } })).as('login');

    cy.setCookie('XSRF-TOKEN', 'stale-csrf');
    cy.visitApp('/#/oauth-return?t=one-shot&g=true');

    cy.wait('@login').its('request.headers').its('x-xsrf-token').should('eq', 'fresh-csrf');
    cy.wait('@sessionToken').its('request.headers').its('x-xsrf-token').should('eq', 'fresh-csrf');
    cy.wrap(calls).should((seen) => {
      expect(seen[0], 'first API call').to.eq('prime');
      expect(seen.filter((c) => c === 'prime'), 'one shared prime').to.have.length(1);
    });
  });
});

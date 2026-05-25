const PROFILE = {
  first_name: 'Cypress',
  last_name: 'User',
  username: 'test',
  owner: 'owner-1',
  admin: false,
  info: {
    transformers: [
      { utid: 'transformer-1', alias: 'Pass through', body: '' },
      { utid: 'transformer-2', alias: 'Formatter', body: '' },
    ],
  },
};

function createToken() {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + 3600,
    username: 'test',
  }));
  return header + '.' + payload + '.sig';
}

function stubConsoleApi(token) {
  cy.intercept('POST', '**/api/v2/login', {
    success: true,
    access_token: token,
    refresh_token: token,
  });
  cy.intercept('GET', '**/api/v2/profile', {
    success: true,
    profile: PROFILE,
  });
  cy.intercept('GET', '**/api/v2/device', {
    success: true,
    devices: [
      { udid: 'device-1', alias: 'Desk sensor', platform: 'esp32', firmware: '1.0.0', status: 'online' },
      { udid: 'device-2', alias: 'Door sensor', platform: 'esp8266', firmware: '1.0.1', status: 'online' },
    ],
  });
  cy.intercept('GET', '**/api/v2/source', {
    success: true,
    sources: {
      repo1: { alias: 'Firmware A', url: 'git@example.com:a.git', branch: 'origin/main', platform: 'esp32' },
      repo2: { alias: 'Firmware B', url: 'git@example.com:b.git', branch: 'origin/main', platform: 'esp8266' },
    },
  });
  cy.intercept('GET', '**/api/v2/logs/build', {
    success: true,
    buildlog: [
      {
        _id: 'build-1',
        name: 'Desk sensor build',
        state: 'COMPLETED',
        log: [
          {
            build_id: 'build-1',
            udid: 'device-1',
            alias: 'Desk sensor',
            state: 'COMPLETED',
            last_update: '2026-05-20T12:00:00.000Z',
            log: [{ message: 'done', last_update: '2026-05-20T12:00:00.000Z' }],
          },
        ],
      },
    ],
  });
  cy.intercept('GET', '**/api/v2/apikey', {
    success: true,
    apikeys: {
      key1: { alias: 'Default MQTT', name: '******************************1234567890', hash: 'hash-1' },
    },
  });
  cy.intercept('GET', '**/api/v2/env', {
    success: true,
    env: ['WIFI_SSID', 'REGION'],
  });
  cy.intercept('GET', '**/api/v2/mesh', {
    success: true,
    mesh_ids: {
      mesh1: { mesh_id: 'mesh-1', alias: 'Main mesh' },
    },
  });
  cy.intercept('GET', '**/api/v2/stats', {
    success: true,
    stats: { timeline: { CHECKINS: [] } },
  });
  cy.intercept('GET', '**/api/v2/stats/today', {
    success: true,
    today: {},
  });
  cy.intercept('GET', '**/api/v2/logs/audit', {
    success: true,
    auditlog: [],
  });
}

describe('Cost Attribution feature', function() {
  beforeEach(() => {
    cy.viewport(1536, 754);
    const token = createToken();
    stubConsoleApi(token);
    cy.visit('/#/app/cost-attribution', {
      onBeforeLoad(win) {
        win.localStorage.setItem('accessToken', token);
        win.localStorage.setItem('refreshToken', token);
        win.localStorage.setItem('authenticated', 'true');
      },
    });
    cy.location('hash').should('eq', '#/app/cost-attribution');
  });

  it('loads estimates and updates the total when a unit cost changes', function() {
    cy.contains('h1', 'Cost Attribution').should('be.visible');
    cy.get('[data-cy="cost-row"]').should('have.length', 7);

    cy.get('[data-cy="cost-total"]').invoke('text').then(initialTotal => {
      cy.get('[data-cy="unit-cost-devices"]').clear().type('1.25');
      cy.get('[data-cy="cost-total"]').should($total => {
        expect($total.text()).not.to.eq(initialTotal);
      });
    });

    cy.window().then(win => {
      const saved = JSON.parse(win.localStorage.getItem('thinx.costAttribution.unitCosts'));
      expect(saved.devices).to.eq(1.25);
    });
  });
});

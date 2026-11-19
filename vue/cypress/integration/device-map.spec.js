// Device maps on the Dashboard and Device Detail (src/components/DeviceMap, src/utils/deviceGeo.js).
// amCharts draws into SVG; pins are the map's circles. The fixtures mix usable locations with
// legacy 0/0, blank and string junk, and an alias written as amCharts formatting.

const MAP = '[data-cy=dashboard-device-map]';

describe('Device map', function() {

  beforeEach(function() {
    cy.viewport(1536, 754);
  });

  it('Dashboard draws one pin per device with a usable location, without console errors', function() {
    cy.stubThinxApi({ devices: 'api/devices-geo.json' });
    cy.visitApp('/#/app/dashboard', {
      session: true,
      onBeforeLoad(win) {
        cy.stub(win.console, 'error').as('consoleError');
      },
    });
    cy.wait('@getDevices');
    cy.get(MAP).should('be.visible');
    cy.get(MAP).find('[data-cy=device-map-empty]').should('not.exist');
    cy.get(MAP).find('[role=img]').should('have.attr', 'aria-label', 'Map with 2 device locations');
    cy.get(MAP).find('svg').should('exist');
    cy.get('@consoleError').should('not.have.been.called');
  });

  it('Dashboard shows the empty-state line when no device has a location', function() {
    cy.stubThinxApi({ devices: 'api/devices-no-location.json' });
    cy.visitApp('/#/app/dashboard', { session: true });
    cy.wait('@getDevices');
    cy.get(MAP).find('[data-cy=device-map-empty]').should('contain', 'No device has reported a location yet.');
    cy.get(MAP).find('svg').should('not.exist');
  });

  it('Device Detail shows "<n> dBm" and a one-pin map for a usable location', function() {
    cy.stubThinxApi({ devices: 'api/devices-geo.json' });
    cy.visitAppRoute('/app/device/udid-geo-ok', { session: true });
    cy.wait('@getDevices');
    cy.get('[data-cy=device-rssi]').should('have.text', '-67 dBm');
    cy.get('[data-cy=device-map] [role=img]').should('have.attr', 'aria-label', 'Map with 1 device location');
    cy.get('[data-cy=device-map] svg').should('exist');
  });

  it('Device Detail shows "—" and no map for legacy 0/0 and junk RSSI', function() {
    cy.stubThinxApi({ devices: 'api/devices-geo.json' });
    cy.visitAppRoute('/app/device/udid-geo-zero', { session: true });
    cy.wait('@getDevices');
    cy.get('[data-cy=device-rssi]').should('have.text', '—');
    cy.get('[data-cy=device-map]').should('not.exist');
  });

});

// Unit test for src/utils/deviceGeo.js: which devices get a pin on the Dashboard and Device
// Detail maps, how RSSI is printed, and that tooltip text cannot carry amCharts formatting.
// Also checks that both pages use the helper and keep their data-cy hooks.
//
// Plain node, offline, no browser: npm run test:unit

const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const compiler = require('vue-template-compiler');

const SRC = path.join(__dirname, '..', '..', 'src');
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log('ok   ' + name); } catch (err) { failures++; console.log('FAIL ' + name + ' (' + String(err && err.message).split('\n')[0] + ')'); }
}

// Evaluate the ES module and return its named exports (same approach as device-detail-deps.cjs).
function evalModule(rel) {
  const names = [];
  const code = read(rel)
    .replace(/^import .*;?$/gm, '')
    .replace(/^export (const|function|let) (\w+)/gm, (m, kind, name) => { names.push(name); return kind + ' ' + name; });
  return new Function(code + '\nreturn {' + names.join(', ') + '};')();
}
const G = evalModule('utils/deviceGeo.js');

// ---------------------------------------------------------------- location

check('coordinate: finite numbers and strict decimal strings only', () => {
  assert.equal(G.coordinate(50.08), 50.08);
  assert.equal(G.coordinate(-14), -14);
  assert.equal(G.coordinate('50.08'), 50.08);
  assert.equal(G.coordinate('-14.4'), -14.4);
  assert.equal(G.coordinate('.5'), 0.5);
  for (const bad of [null, undefined, '', ' ', ' 50.08', '50.08 ', '50,08', '1e2', '0x10', 'Infinity', 'NaN', '+5', '5-', NaN, Infinity, -Infinity, true, [50], { lat: 1 }]) {
    assert.equal(G.coordinate(bad), null, JSON.stringify(bad));
  }
});

check('deviceLocation: usable pairs give { latitude, longitude }', () => {
  assert.deepEqual(G.deviceLocation({ lat: 50.08, lon: 14.44 }), { latitude: 50.08, longitude: 14.44 });
  assert.deepEqual(G.deviceLocation({ lat: '-33.86', lon: '151.21' }), { latitude: -33.86, longitude: 151.21 });
  assert.deepEqual(G.deviceLocation({ lat: 90, lon: -180 }), { latitude: 90, longitude: -180 });
  // One axis 0 is a real place (equator or prime meridian).
  assert.deepEqual(G.deviceLocation({ lat: 0, lon: 32.5 }), { latitude: 0, longitude: 32.5 });
  assert.deepEqual(G.deviceLocation({ lat: 51.48, lon: 0 }), { latitude: 51.48, longitude: 0 });
});

check('deviceLocation: legacy 0/0, null, strings, out of range and missing are refused', () => {
  const bad = [
    { lat: 0, lon: 0 }, { lat: '0', lon: '0' }, { lat: -0, lon: 0 }, { lat: '0.0', lon: '-0' },
    { lat: null, lon: null }, { lat: null, lon: 14 }, { lat: 50, lon: undefined }, {},
    { lat: ' ', lon: ' ' }, { lat: '', lon: '' }, { lat: 'abc', lon: '14' },
    { lat: 90.0001, lon: 14 }, { lat: -91, lon: 14 }, { lat: 50, lon: 180.5 }, { lat: 50, lon: -181 },
    { lat: NaN, lon: 14 }, { lat: 50, lon: Infinity },
  ];
  for (const d of bad) assert.equal(G.deviceLocation(d), null, JSON.stringify(d));
  assert.equal(G.deviceLocation(null), null);
  assert.equal(G.deviceLocation('50,14'), null);
  assert.equal(G.hasLocation({ lat: 0, lon: 0 }), false);
  assert.equal(G.hasLocation({ lat: 1, lon: 1 }), true);
});

// ---------------------------------------------------------------- RSSI

check('usableRssi: integers from -150 to 0 only', () => {
  for (const ok of [-150, -67, -1, 0]) assert.equal(G.usableRssi(ok), ok);
  for (const bad of [null, undefined, ' ', '', '-67', -67.5, -151, 1, 100, NaN, -Infinity, true, {}]) {
    assert.equal(G.usableRssi(bad), null, JSON.stringify(bad));
  }
});

check('formatRssi: "<n> dBm" or the fallback', () => {
  assert.equal(G.formatRssi(-67), '-67 dBm');
  assert.equal(G.formatRssi(0), '0 dBm');
  assert.equal(G.formatRssi(' '), '—');
  assert.equal(G.formatRssi(null), '—');
  assert.equal(G.formatRssi(-200, 'RSSI unknown'), 'RSSI unknown');
});

// ---------------------------------------------------------------- tooltip text

check('escapeChartText doubles [ ] { } and quotes; plain text is unchanged', () => {
  assert.equal(G.escapeChartText('lab node 1'), 'lab node 1');
  assert.equal(G.escapeChartText('[bold red]x[/]'), '[[bold red]]x[[/]]');
  assert.equal(G.escapeChartText('{udid}'), '{{udid}}');
  assert.equal(G.escapeChartText("it's"), "it''s");
  assert.equal(G.escapeChartText(null), '');
});

// amCharts' own text pipeline (core/formatters/TextFormatter.js and Sprite.populateString in
// @amcharts/amcharts4 4.10): placeholders are scanned with the doubled pairs hidden, style
// blocks are [single brackets], and cleanUp turns doubled pairs back into one character.
function amchartsRender(text, data) {
  const P = ['\u0001', '\u0002', '\u0003', '\u0004', '\u0005'];
  const escape = (t) => t.replace(/\[\[/g, P[0]).replace(/([^/\]]{1})\]\]/g, '$1' + P[1]).replace(/\]\]/g, P[1]).replace(/\{\{/g, P[2]).replace(/\}\}/g, P[3]).replace(/''/g, P[4]);
  const unescape = (t) => t.split(P[0]).join('[[').split(P[1]).join(']]').split(P[2]).join('{{').split(P[3]).join('}}').split(P[4]).join("''");
  // populateString
  let s = escape(text);
  for (const tag of s.match(/\{([^}]+)\}/g) || []) s = s.split(tag).join(String(data[tag.slice(1, -1)] ?? ''));
  s = unescape(s);
  // format: style blocks are dropped from the visible text, then cleanUp
  s = unescape(escape(s).split(/\[[^[\]]*\]/).join(''));
  return s.replace(/\[\[/g, '[').replace(/\]\]/g, ']').replace(/\{\{/g, '{').replace(/\}\}/g, '}').replace(/''/g, "'");
}

check('pinTooltip: alias, RSSI, status, last update; hostile aliases print as typed', () => {
  const t = G.pinTooltip({ alias: 'gate', udid: 'u1', rssi: -67, status: 'connected', lastupdate: '2026-09-18T10:00:00.000Z' });
  const lines = t.split('\n');
  assert.equal(lines[0], 'gate');
  assert.equal(lines[1], '-67 dBm');
  assert.equal(lines[2], 'connected');
  assert.match(lines[3], /^Last update .*2026/);
  assert.equal(G.pinTooltip({ alias: 'x', rssi: ' ' }).split('\n')[1], 'RSSI unknown');
  assert.equal(G.pinTooltip({ alias: 'x' }).split('\n')[3], 'Last update unknown');
  assert.equal(G.pinTooltip({ alias: '  ', udid: 'u9' }).split('\n')[0], 'u9');
  const data = { udid: 'SECRET', status: 'connected' };
  for (const alias of ['{udid}', '[bold red]boom[/]', '{{udid}}', '[[x]]', "a'b''c", '{status}{udid}', ']]{', '[font-size: 90px]']) {
    const rendered = amchartsRender(G.pinTooltip({ alias, status: '{udid}', rssi: -1 }), data);
    assert.equal(rendered.split('\n')[0], alias, 'alias ' + alias);
    assert.equal(rendered.split('\n')[2], '{udid}', 'status ' + alias);
    assert(!rendered.includes('SECRET'), 'no placeholder evaluated for ' + alias);
  }
});

// ---------------------------------------------------------------- pins and bounds

check('devicePins: one pin per usable device, carrying udid, position and tooltip', () => {
  const pins = G.devicePins([
    { udid: 'a', alias: 'A', lat: 50.08, lon: 14.44, rssi: -52 },
    { udid: 'b', alias: 'B', lat: 0, lon: 0, rssi: -60 },
    { udid: 'c', alias: 'C', lat: '48.2', lon: '16.37', rssi: ' ' },
    { udid: 'd', alias: 'D', lat: null, lon: null },
    null,
    { udid: 'e', alias: 'E', lat: ' ', lon: 'x' },
  ]);
  assert.deepEqual(pins.map(p => p.udid), ['a', 'c']);
  assert.deepEqual(Object.keys(pins[0]).sort(), ['latitude', 'longitude', 'tooltip', 'udid']);
  assert.equal(pins[1].latitude, 48.2);
  assert.equal(G.devicePins(undefined).length, 0);
  assert.equal(G.devicePins({}).length, 0);
});

check('pinBounds: covers every pin, a single pin gets a minimum span, stays on the globe', () => {
  assert.equal(G.pinBounds([]), null);
  const one = G.pinBounds([{ latitude: 50, longitude: 14 }], 4);
  assert.deepEqual([one.north, one.south, one.east, one.west], [52, 48, 16, 12]);
  assert.deepEqual(one.center, { latitude: 50, longitude: 14 });
  const many = G.pinBounds([{ latitude: 10, longitude: -20 }, { latitude: 60, longitude: 40 }]);
  assert(many.north > 60 && many.south < 10 && many.east > 40 && many.west < -20);
  const edge = G.pinBounds([{ latitude: 89.9, longitude: 179.9 }, { latitude: -89.9, longitude: -179.9 }]);
  assert(edge.north <= 90 && edge.south >= -90 && edge.east <= 180 && edge.west >= -180);
});

// ---------------------------------------------------------------- pages

check('Dashboard: map card, empty state, pins from the store getter, click opens DeviceDetail', () => {
  const sfc = compiler.parseComponent(read('pages/Visits/Visits.vue'));
  assert.deepEqual(compiler.compile(sfc.template.content).errors, []);
  assert.match(sfc.template.content, /data-cy="dashboard-device-map"/);
  assert.match(sfc.template.content, /v-if="!mapPins.length"[^>]*data-cy="device-map-empty"/);
  assert.match(sfc.template.content, /<device-map v-else :pins="mapPins"[^>]*clickable @select="openDevice"/);
  assert.match(sfc.script.content, /devicePins\(this\.getDevices\(\)\)/);
  assert.match(sfc.script.content, /name: 'DeviceDetail', params: \{ udid \}/);
  assert.match(read('Routes.js'), /path: 'device\/:udid',\s*name: 'DeviceDetail'/);
});

check('DeviceDetail: RSSI via formatRssi, map under Lat/Lon only for a usable location', () => {
  const sfc = compiler.parseComponent(read('pages/Devices/DeviceDetail.vue'));
  const t = sfc.template.content;
  assert.deepEqual(compiler.compile(t).errors, []);
  assert.match(t, /RSSI<\/td><td data-cy="device-rssi">\{\{ rssiText \}\}<\/td>/);
  assert.match(t, /data-cy="device-snr"/);
  const latlon = t.indexOf('Lat/Lon');
  const map = t.indexOf('data-cy="device-map"');
  assert(latlon > 0 && map > latlon, 'map follows the Lat/Lon row');
  assert.match(t, /<div v-if="mapPins.length"[^>]*data-cy="device-map"/);
  assert.match(sfc.script.content, /formatRssi\(this\.device\.rssi\)/);
  assert.match(sfc.script.content, /devicePins\(\[this\.device\]\)/);
});

check('DeviceMap: bundled amCharts only, no HTML tooltip, disposed on destroy', () => {
  const src = read('components/DeviceMap/DeviceMap.vue');
  const imports = [...src.matchAll(/import\((?:\/\*[^*]*\*\/\s*)?'([^']+)'\)/g)].map(m => m[1]);
  assert.deepEqual(imports, ['@amcharts/amcharts4/core', '@amcharts/amcharts4/maps', '@amcharts/amcharts4-geodata/worldLow']);
  assert(!/tooltipHTML|innerHTML|v-html/.test(src), 'no HTML tooltips');
  assert(!/https?:\/\/(?!www\.w3\.org)/.test(src), 'no remote URL');
  assert.match(src, /beforeDestroy\(\) \{[\s\S]*this\.chart\.dispose\(\)/);
  assert.match(src, /MapImageSeries/);
  assert.match(src, /zoomToRectangle/);
});

if (failures) {
  console.log(failures + ' check(s) failed');
  process.exit(1);
}
console.log('device-geo: all checks passed');

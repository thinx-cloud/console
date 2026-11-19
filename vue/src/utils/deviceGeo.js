// Device location and signal checks for the device maps (Dashboard and Device Detail).
// Plain functions, no Vue and no amCharts, so tests/unit/device-geo.cjs can run them in node.
//
// The device list carries lat/lon and rssi as the devices reported them. Legacy records hold
// 0/0, null, "" or " " there, so nothing is drawn or printed unless it passes these checks.

// A plain decimal string: optional minus, digits, optional fraction. No whitespace, exponent,
// hex, "Infinity" or empty string, which Number() would otherwise accept.
const DECIMAL = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/;

export const RSSI_MIN = -150;
export const RSSI_MAX = 0;

// A finite number from a number or a strict decimal string, or null.
export function coordinate(raw) {
  let n = null;
  if (typeof raw === 'number') n = raw;
  else if (typeof raw === 'string' && DECIMAL.test(raw)) n = Number(raw);
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

// { latitude, longitude } when the device reported a usable location, else null.
// 0/0 is the legacy "no fix" value and is never drawn.
export function deviceLocation(device) {
  if (!device || typeof device !== 'object') return null;
  const latitude = coordinate(device.lat);
  const longitude = coordinate(device.lon);
  if (latitude === null || longitude === null) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude };
}

export function hasLocation(device) {
  return deviceLocation(device) !== null;
}

// The RSSI as an integer dBm from RSSI_MIN to RSSI_MAX, or null. Only numbers count.
export function usableRssi(raw) {
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= RSSI_MIN && raw <= RSSI_MAX ? raw : null;
}

// "-67 dBm", or the fallback when the RSSI is unusable.
export function formatRssi(raw, fallback = '—') {
  const rssi = usableRssi(raw);
  return rssi === null ? fallback : rssi + ' dBm';
}

// amCharts reads [ ] as style blocks and { } as data placeholders in any label or tooltip
// text, and '' as an escaped quote. Doubling each makes it print literally.
export function escapeChartText(value) {
  return String(value === null || value === undefined ? '' : value).replace(/[[\]{}']/g, (c) => c + c);
}

// Last update as a local date and time, or null when it is missing or unparseable.
export function formatLastUpdate(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Tooltip text for one pin, built from plain values and escaped for amCharts, so it holds
// no placeholder or style block of its own. The alias falls back to the udid.
export function pinTooltip(device) {
  const d = device || {};
  const name = typeof d.alias === 'string' && d.alias.trim() ? d.alias : (d.udid || 'Unnamed device');
  const status = d.status === null || d.status === undefined || d.status === '' ? 'status unknown' : d.status;
  const updated = formatLastUpdate(d.lastupdate);
  return [
    escapeChartText(name),
    escapeChartText(formatRssi(d.rssi, 'RSSI unknown')),
    escapeChartText(status),
    escapeChartText(updated ? 'Last update ' + updated : 'Last update unknown'),
  ].join('\n');
}

// One map pin per device with a usable location: the data a MapImageSeries reads.
export function devicePins(devices) {
  if (!Array.isArray(devices)) return [];
  const pins = [];
  for (const device of devices) {
    const location = deviceLocation(device);
    if (!location) continue;
    pins.push({
      udid: device.udid,
      latitude: location.latitude,
      longitude: location.longitude,
      tooltip: pinTooltip(device),
    });
  }
  return pins;
}

// The box to zoom to: the pins' extent, widened so a single pin or a tight cluster
// is not zoomed in to street level. Null for no pins.
export function pinBounds(pins, minSpan = 4) {
  if (!Array.isArray(pins) || !pins.length) return null;
  let north = -90; let south = 90; let east = -180; let west = 180;
  for (const p of pins) {
    north = Math.max(north, p.latitude);
    south = Math.min(south, p.latitude);
    east = Math.max(east, p.longitude);
    west = Math.min(west, p.longitude);
  }
  const padLat = Math.max((north - south) * 0.15, (minSpan - (north - south)) / 2, 0);
  const padLon = Math.max((east - west) * 0.15, (minSpan - (east - west)) / 2, 0);
  return {
    north: Math.min(90, north + padLat),
    south: Math.max(-90, south - padLat),
    east: Math.min(180, east + padLon),
    west: Math.max(-180, west - padLon),
    center: { latitude: (north + south) / 2, longitude: (east + west) / 2 },
  };
}

// Device settings that the Legacy device view edits (services/console/src/app/views/device.html)
// and the Vue Device Detail page mirrors: category, icon, timezone and tags.
// Plain functions, no Vue, so tests/unit/device-settings.cjs can run them in node.

// Legacy $rootScope.categories (services/console/src/app/js/main.js). The API lists a device
// with no category as "grey-mint" (lib/thinx/devices.js).
export const CATEGORIES = ['yellow-crusta', 'red-intense', 'purple-studio', 'blue', 'green', 'green-dark', 'grey-mint'];
export const DEFAULT_CATEGORY = 'grey-mint';

// The iot icon set in src/assets/thinx/ioticons (b_medium_01.png … b_medium_73.png).
export const ICON_COUNT = 73;

// Icon number 1..ICON_COUNT from a stored value (Legacy writes a number, older devices hold
// "01"-style strings), or null. Only numbers and strings are read (44-SECURITY N-1).
export function iconNumber(raw) {
  const n = typeof raw === 'number' || typeof raw === 'string' ? parseInt(raw, 10) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= ICON_COUNT ? n : null;
}

// "01".."73" for the asset file name; unknown icons show 01, as in the device list.
export function iconFileNumber(raw) {
  return String(iconNumber(raw) || 1).padStart(2, '0');
}

export function normalizeCategory(raw) {
  return CATEGORIES.includes(raw) ? raw : DEFAULT_CATEGORY;
}

// IANA zone names the browser knows, for the timezone suggestions. Empty where
// Intl.supportedValuesOf is missing; the field still accepts a typed zone.
export function timezoneNames() {
  try {
    if (typeof Intl.supportedValuesOf === 'function') return Intl.supportedValuesOf('timeZone');
  } catch (e) {
    // fall through
  }
  return [];
}

// Short name of an IANA zone right now ("CET", "GMT+1"), or null when the browser does not
// know the zone. The API validates timezone_utc itself (Util.isValidTimezone) and derives the
// offset; the abbreviation is what Legacy also sent alongside it.
export function timezoneAbbr(zone, at = new Date()) {
  if (typeof zone !== 'string' || !zone.trim()) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone.trim(), timeZoneName: 'short' }).formatToParts(at);
    const part = parts.find(p => p.type === 'timeZoneName');
    return part ? part.value : null;
  } catch (e) {
    return null;
  }
}

// Wall-clock time in a zone, "6. 11. 14:05" like Legacy's "d. M. HH:mm", or null.
export function timeInZone(zone, at = new Date()) {
  if (timezoneAbbr(zone, at) === null) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone.trim(), day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(at);
    const get = type => (parts.find(p => p.type === type) || {}).value || '';
    // en-GB pads day and month even when asked for 'numeric'; Legacy's d. M. does not.
    const unpad = v => String(parseInt(v, 10));
    return `${unpad(get('day'))}. ${unpad(get('month'))}. ${get('hour')}:${get('minute')}`;
  } catch (e) {
    return null;
  }
}

// Tags as the API stores them: trimmed, non-empty strings, no duplicates, order kept.
export function cleanTags(tags) {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();
  const out = [];
  for (const tag of tags) {
    if (typeof tag !== 'string') continue;
    const t = tag.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

// Order-insensitive equality of two tag/id lists.
export function sameSet(a, b) {
  const sa = new Set(Array.isArray(a) ? a : []);
  const sb = new Set(Array.isArray(b) ? b : []);
  if (sa.size !== sb.size) return false;
  return [...sa].every(x => sb.has(x));
}

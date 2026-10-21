// The one module that names device platforms (phase 44, UI-D01, UI-D02).
//
// Keys and display labels follow the Legacy console ($rootScope.platforms in
// services/console/src/app/js/main.js, lines 168-178), except that the fallback
// label is the lower-case word "unknown" (D-10). The platform colours live once,
// keyed the same way, in src/styles/_platforms.scss ($platform-colors).
//
// PlatformBullet, the device icon tile, the platform filter and the platform sort
// all read this module; no other file holds a platform name list.

export const PLATFORMS = {
  arduino: { label: 'Arduino', build: true },
  platformio: { label: 'Platform.io', build: true },
  nodemcu: { label: 'NodeMCU', build: true },
  pine64: { label: 'Pine64', build: true },
  micropython: { label: 'Micropython', build: true },
  mongoose: { label: 'MongooseOS', build: true },
  nodejs: { label: 'NodeJS', build: true },
  sigfox: { label: 'Sigfox', build: false },
  unknown: { label: 'unknown', build: true },
};

// Backend platform values that name a known platform differently. The API's MicroPython
// plugin (lib/thinx/plugins/python) reports "python" (44 WR-01); the API also accepts
// "mongooseos" for MongooseOS (lib/thinx/deployment.js supportedPlatform).
const ALIASES = { python: 'micropython', mongooseos: 'mongoose' };

// Base platform key of a raw platform string such as "arduino:esp8266".
// Anything that is not a known key (empty, null, "unknown_platform", ...) is "unknown".
// Only strings are read: any other type (null, a number, an object whose toString is
// not a function) is unknown, so device data can never make this throw (44-SECURITY N-1).
export function basePlatform(raw) {
  let key = (typeof raw === 'string' ? raw : '').split(':')[0].trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(ALIASES, key)) key = ALIASES[key];
  return Object.prototype.hasOwnProperty.call(PLATFORMS, key) ? key : 'unknown';
}

// { key, label, build } for a raw platform string. Never throws.
export function platformInfo(raw) {
  let key = 'unknown';
  try {
    key = basePlatform(raw);
  } catch (e) {
    key = 'unknown';
  }
  return { key, label: PLATFORMS[key].label, build: PLATFORMS[key].build };
}

// Order of two platforms by display label, case-insensitive, with unknown last (D-14: the
// platform pills and the device list's Platform sort share it). Keys and raw values both go
// through basePlatform, so a missing, non-string or unrecognised platform counts as unknown.
export function comparePlatformKeys(a, b) {
  const ka = basePlatform(a);
  const kb = basePlatform(b);
  if (ka === kb) return 0;
  if (ka === 'unknown') return 1;
  if (kb === 'unknown') return -1;
  return PLATFORMS[ka].label.toLowerCase().localeCompare(PLATFORMS[kb].label.toLowerCase());
}

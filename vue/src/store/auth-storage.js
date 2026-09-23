// Auth tokens live in memory only (Vuex + the API client). They are never
// written to localStorage/sessionStorage, where any injected third-party script
// could read them. A reload recovers the session from the httpOnly session
// cookie via POST /api/v2/session/token (see store/auth.js#hydrateSession).
//
// This module only scrubs tokens that older console builds persisted.

const LEGACY_KEYS = ['accessToken', 'refreshToken', 'authenticated'];

function scrub(name) {
  if (typeof window === 'undefined') return;
  try {
    const storage = window[name];
    if (!storage) return;
    LEGACY_KEYS.forEach((key) => storage.removeItem(key));
  } catch (_error) {
    // Storage may be unavailable in hardened browser modes; nothing to scrub.
  }
}

export function clearLegacyAuthStorage() {
  scrub('localStorage');
  scrub('sessionStorage');
}

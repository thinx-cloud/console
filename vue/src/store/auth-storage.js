const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const AUTHENTICATED_KEY = 'authenticated';

function getBrowserStorage(name) {
  if (typeof window === 'undefined') return null;
  try {
    return window[name] || null;
  } catch (_error) {
    return null;
  }
}

function getItem(storage, key) {
  try {
    return storage ? storage.getItem(key) : null;
  } catch (_error) {
    return null;
  }
}

function setItem(storage, key, value) {
  if (!storage) return;
  try {
    if (value) {
      storage.setItem(key, value);
    } else {
      storage.removeItem(key);
    }
  } catch (_error) {
    // Storage may be unavailable in hardened browser modes; keep auth in memory.
  }
}

function removeItem(storage, key) {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch (_error) {
    // Ignore storage cleanup failures.
  }
}

export function clearLegacyAuthStorage() {
  const storage = getBrowserStorage('localStorage');
  removeItem(storage, ACCESS_TOKEN_KEY);
  removeItem(storage, REFRESH_TOKEN_KEY);
  removeItem(storage, AUTHENTICATED_KEY);
}

export function getPersistedAuthTokens() {
  const session = getBrowserStorage('sessionStorage');
  const accessToken = getItem(session, ACCESS_TOKEN_KEY);
  const refreshToken = getItem(session, REFRESH_TOKEN_KEY);

  if (accessToken || refreshToken) {
    clearLegacyAuthStorage();
    return { accessToken, refreshToken };
  }

  const legacy = getBrowserStorage('localStorage');
  const legacyAccessToken = getItem(legacy, ACCESS_TOKEN_KEY);
  const legacyRefreshToken = getItem(legacy, REFRESH_TOKEN_KEY);

  if (legacyAccessToken || legacyRefreshToken) {
    persistAuthTokens({
      accessToken: legacyAccessToken,
      refreshToken: legacyRefreshToken,
    });
    return {
      accessToken: legacyAccessToken,
      refreshToken: legacyRefreshToken,
    };
  }

  clearLegacyAuthStorage();
  return { accessToken: null, refreshToken: null };
}

export function persistAuthTokens({ accessToken, refreshToken }) {
  const session = getBrowserStorage('sessionStorage');
  setItem(session, ACCESS_TOKEN_KEY, accessToken);
  setItem(session, REFRESH_TOKEN_KEY, refreshToken);
  clearLegacyAuthStorage();
}

export function clearPersistedAuthTokens() {
  const session = getBrowserStorage('sessionStorage');
  removeItem(session, ACCESS_TOKEN_KEY);
  removeItem(session, REFRESH_TOKEN_KEY);
  clearLegacyAuthStorage();
}

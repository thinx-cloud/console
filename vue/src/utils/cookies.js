// Cookie-read helper plus the shared XSRF prime/retry used by core/api.js,
// store/auth.js, Login.vue, PasswordReset.vue and OAuthReturn.vue.
// getCookie is pure and testable against a mocked `document.cookie`.
export function getCookie(name) {
  if (typeof document === "undefined" || !document.cookie) {
    return null;
  }

  const match = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)")
  );

  return match ? decodeURIComponent(match[1]) : null;
}

// SEC-CSRF-01 double-submit helpers (21-REVIEW CR-01 / WR-05).
export const XSRF_COOKIE_NAME = "XSRF-TOKEN";
export const XSRF_HEADER_NAME = "X-XSRF-TOKEN";
export const CSRF_REJECTED_MESSAGE =
  "Session security check failed. Reload the page and try again.";

// The API mints a NEW token for every request that arrives without the cookie,
// so two cookieless primes racing each other leave the header and the cookie
// jar disagreeing. Every caller therefore shares this single in-flight prime.
let primePromise = null;

// Last token a prime resolved to, for when document.cookie does not show the
// freshly set cookie yet.
let lastPrimedToken = null;

function csrfTokenUrl(apiBase) {
  return String(apiBase || "").replace(/\/$/, "") + "/csrf-token";
}

// Resolves to the token to send as X-XSRF-TOKEN ("" when priming failed).
// Skips the network when the cookie already exists, unless `force` is set:
// a forced prime (used after a csrf_token_invalid rejection) trusts the token
// the server echoes back, because that is the cookie value it actually parsed.
export function ensureCsrfToken(apiBase, { force = false } = {}) {
  if (!force) {
    const existing = getCookie(XSRF_COOKIE_NAME);
    if (existing) return Promise.resolve(existing);
  }
  if (!primePromise) {
    primePromise = fetch(csrfTokenUrl(apiBase), {
      method: "GET",
      credentials: "include",
    })
      .then((response) => response.json())
      .then((body) => {
        const echoed = (body && typeof body.csrf_token === "string") ? body.csrf_token : "";
        const token = force
          ? (echoed || getCookie(XSRF_COOKIE_NAME) || "")
          : (getCookie(XSRF_COOKIE_NAME) || echoed || "");
        if (token) lastPrimedToken = token;
        return token;
      })
      .catch(() => getCookie(XSRF_COOKIE_NAME) || "")
      .finally(() => {
        primePromise = null;
      });
  }
  return primePromise;
}

// Synchronous best-effort read for header composition.
export function getCsrfToken() {
  return getCookie(XSRF_COOKIE_NAME) || lastPrimedToken || "";
}

// True for the API's 403 {"success":false,"response":"csrf_token_invalid"}.
export function isCsrfRejection(status, payload) {
  return status === 403 && !!payload && payload.response === "csrf_token_invalid";
}

async function responseIsCsrfRejection(response) {
  if (!response || response.status !== 403) return false;
  try {
    return isCsrfRejection(response.status, await response.clone().json());
  } catch (_error) {
    return false;
  }
}

// fetch() for a CSRF-protected call: awaits the shared prime, sends the token it
// resolved to, and on a csrf_token_invalid rejection re-primes and retries ONCE.
export async function fetchWithCsrf(apiBase, url, init = {}) {
  const send = (token) => fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), [XSRF_HEADER_NAME]: token || "" },
  });
  const response = await send(await ensureCsrfToken(apiBase));
  if (!(await responseIsCsrfRejection(response))) return response;
  return send(await ensureCsrfToken(apiBase, { force: true }));
}

export default { getCookie, ensureCsrfToken, getCsrfToken, isCsrfRejection, fetchWithCsrf };

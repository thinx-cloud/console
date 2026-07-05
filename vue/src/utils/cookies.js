// Pure cookie-read helper shared by core/api.js, Login.vue, and OAuthReturn.vue.
// Testable against a mocked `document.cookie`.
export function getCookie(name) {
  if (typeof document === "undefined" || !document.cookie) {
    return null;
  }

  const match = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)")
  );

  return match ? decodeURIComponent(match[1]) : null;
}

export default { getCookie };

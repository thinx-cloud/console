import { clearPersistedAuthTokens } from "@/store/auth-storage";

export default class Api {

  constructor(hostname) {
    // Handle cases where hostname is undefined or null
    if (!hostname) {
      hostname = window.location.origin || 'http://localhost:3000';
    }
    //this.baseApiUrl = hostname.indexOf("http://") == -1 && hostname.indexOf("https://") === -1 ? 'https://' + hostname : hostname;
    this.baseApiUrl = hostname.replace(/\/$/, ""); // remove trailing slash
    this.accessToken = null;
    this.refreshToken = null;
    this.apiPath = '/api/v2';
  }

  composeOptions(method, body) {
    // Belt-and-suspenders (AUTH-03): if the access token's exp has already passed
    // (e.g. laptop slept past the auth/scheduleExpiry setTimeout firing time), tear
    // down the session synchronously before issuing the request. The request itself
    // is still issued — it will 401, but the page is already navigating to /login.
    // Uses platform atob + JSON.parse to avoid loading the JWT decode library
    // into the API client (kept dependency-free).
    if (this.accessToken) {
      try {
        const parts = this.accessToken.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          if (payload && typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
            clearPersistedAuthTokens();
            this.accessToken = null;
            this.refreshToken = null;
            if (typeof window !== 'undefined') window.location.hash = '#/login';
            // fall through — the request will 401 and the page is already navigating
          }
        }
      } catch (e) {
        // Malformed token — let the request fail naturally; do not blow up the API client here.
      }
    }
    let options = {
      method: method,
      credentials: 'include',
      headers: this.composeHeaders(),
    };
    if (typeof body !== 'undefined') {
      options['body'] = body;
    }
    return options;
  }

  composeHeaders() {
    const headers = {
      "Content-Type": "application/json",
    };
    if (this.accessToken) {
      headers.Authorization = 'Bearer ' + this.accessToken;
    }
    return headers;
  }

  composePath(path) {
    return this.baseApiUrl + this.apiPath + path;
  }

  parseResult(result) {
    if (result && typeof result.success !== 'undefined' && result.success) {
      let keys = Object.keys(result).filter( key => key !== 'success' );
      return {
        'success': result.success,
        'response': result[keys[0]]
      };
    }
    return result || { success: false };
  }

  setAccessToken(token) {
    this.accessToken = token || null;
  }

  setRefreshToken(token) {
    this.refreshToken = token || null;
  }

  async request(method, path, body) {
      const response = await fetch(this.composePath(path), this.composeOptions(method, body));
      const text = await response.text();

      if (!text) {
        return {
          success: false,
          status: response.status,
          response: null,
        };
      }

      try {
        const result = JSON.parse(text);
        if (!response.ok && typeof result.success === 'undefined') {
          return {
            success: false,
            status: response.status,
            response: result,
          };
        }
        return this.parseResult(result);
      } catch (error) {
        return {
          success: false,
          status: response.status,
          response: text,
        };
      }
  }

  async $get(path) {
      return this.request('GET', path);
  }

  async $post(path, body) {
      return this.request('POST', path, body);
  }

  async $put(path, body) {
      return this.request('PUT', path, body);
  }

  async $delete(path, body) {
      return this.request('DELETE', path, body);
  }

}

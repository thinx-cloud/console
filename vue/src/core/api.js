/**
 * @typedef {Object} ApiResult
 * @property {boolean} success - Whether the request succeeded.
 * @property {number} [status] - HTTP status code (present on failure).
 * @property {*} [response] - Parsed response payload.
 */

/**
 * HTTP client for the THiNX API v2.
 * Wraps fetch with token-based auth headers and a normalised result envelope.
 */
export default class Api {

  /**
   * @param {string} [hostname] - Base URL of the API server. Falls back to
   *   `window.location.origin` or `http://localhost:3000` when omitted.
   */
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

  /**
   * Builds a fetch options object for the given HTTP method.
   * @param {string} method - HTTP verb (GET, POST, PUT, DELETE).
   * @param {string} [body] - JSON-serialised request body. Omit for bodyless requests.
   * @returns {RequestInit} Options ready to pass to `fetch`.
   */
  composeOptions(method, body) {
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

  /**
   * Returns the standard request headers, including the Bearer token.
   * @returns {Record<string, string>} Headers object.
   */
  composeHeaders() {
    return {
      "Content-Type": "application/json",
      'Authorization': 'Bearer ' + this.refreshToken,
      'Access-Control-Allow-Origin': 'http://localhost:3080 ' + this.baseApiUrl,
    }
  }

  /**
   * Prepends the base URL and API path prefix to a relative path.
   * @param {string} path - Relative path, e.g. `/device`.
   * @returns {string} Fully-qualified URL.
   */
  composePath(path) {
    return this.baseApiUrl + this.apiPath + path;
  }

  /**
   * Normalises a successful API response into a `{ success, response }` envelope.
   * Passes error-shaped objects through unchanged.
   * @param {Object} result - Raw parsed JSON from the server.
   * @returns {ApiResult} Normalised result object.
   */
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

  /**
   * Stores the token used in Authorization headers.
   * @param {string} token - JWT access token.
   */
  setAccessToken(token) {
    this.refreshToken = token;
  }

  /**
   * Stores the refresh token.
   * @param {string} token - JWT refresh token.
   */
  setRefreshToken(token) {
    this.accessToken = token;
  }

  /**
   * Performs a fetch request and returns a normalised result envelope.
   * Returns `{ success: false }` on network errors, non-OK status, or non-JSON responses.
   * @param {string} method - HTTP verb.
   * @param {string} path - Relative API path.
   * @param {string} [body] - JSON-serialised request body.
   * @returns {Promise<ApiResult>} Normalised API result.
   */
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

  /**
   * Sends a GET request to the given API path.
   * @param {string} path - Relative API path.
   * @returns {Promise<ApiResult>}
   */
  async $get(path) {
      return this.request('GET', path);
  }

  /**
   * Sends a POST request with a JSON body.
   * @param {string} path - Relative API path.
   * @param {string} body - JSON-serialised payload.
   * @returns {Promise<ApiResult>}
   */
  async $post(path, body) {
      return this.request('POST', path, body);
  }

  /**
   * Sends a PUT request with a JSON body.
   * @param {string} path - Relative API path.
   * @param {string} body - JSON-serialised payload.
   * @returns {Promise<ApiResult>}
   */
  async $put(path, body) {
      return this.request('PUT', path, body);
  }

  /**
   * Sends a DELETE request, optionally with a JSON body.
   * @param {string} path - Relative API path.
   * @param {string} [body] - JSON-serialised payload.
   * @returns {Promise<ApiResult>}
   */
  async $delete(path, body) {
      return this.request('DELETE', path, body);
  }

}

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
    return {
      "Content-Type": "application/json",
      'Authorization': 'Bearer ' + this.refreshToken,
      'Access-Control-Allow-Origin': 'http://localhost:3080 ' + this.baseApiUrl,
    }
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
    this.refreshToken = token;
  }

  setRefreshToken(token) {
    this.accessToken = token;
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

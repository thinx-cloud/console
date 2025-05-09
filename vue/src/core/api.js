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
    if (typeof result.success !== 'undefined' && result.success) {
      let keys = Object.keys(result).filter( key => key !== 'success' );
      if (keys.length > 2) {
        console.log('WARN unusual response', result);
      }
      return {
        'success': result.success,
        'response': result[keys[0]]
      };
    } else {
      console.log('WARN unusual response', result);
      return result;
    }
  }

  setAccessToken(token) {
    this.refreshToken = token;
  }

  setRefreshToken(token) {
    this.accessToken = token;
  }

  async $get(path) {
      const response = await fetch(this.composePath(path), this.composeOptions('GET'));
      const result = await response.json();
      return this.parseResult(result);
  }

  async $post(path, body) {
      const response = await fetch(this.composePath(path), this.composeOptions('POST', body));
      const result = await response.json();
      return this.parseResult(result);
  }

}
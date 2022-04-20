  export default new class {

    composeOptions(method, accessToken, body) {
      let options = {
        method: method,
        credentials: 'include',
        headers: this.composeHeaders(accessToken),
      };
      if (typeof body !== 'undefined') {
        options['body'] = body;
      }
      return options;
    }

    composeHeaders(accessToken) {
      const baseApiUrl = typeof process.env.VUE_APP_API_HOSTNAME !== 'undefined' ? process.env.VUE_APP_API_HOSTNAME : '';
      return {
        "Content-Type": "application/json",
        'Authorization': 'Bearer ' + accessToken,
        'Access-Control-Allow-Origin': 'http://localhost:3080 ' + baseApiUrl,
      }
    }

    composePath(path) {
      const baseApiUrl = typeof process.env.VUE_APP_API_HOSTNAME !== 'undefined' ? process.env.VUE_APP_API_HOSTNAME : '';
      return baseApiUrl + path;
    }

    parseResult(result) {
      if (typeof result.success !== 'undefined' && result.success) {
        let keys = Object.keys(result).filter( key => key !== 'success' );
        if (keys.length > 2) {
          console.log('WARN unusual response', result);
        }
        console.log('DEBUG keys', keys);
        return {
          'success': result.success,
          'data': result[keys[0]]
        };
      } else {
         console.log('WARN unusual response', result);
        return result;
      }
    }

    async $get(path, accessToken) {
        const response = await fetch(this.composePath(path), this.composeOptions('GET', accessToken));
        const result = await response.json();
        return this.parseResult(result);
    }

    async $post(path, accessToken, body) {
        const response = await fetch(this.composePath(path), this.composeOptions('POST', accessToken, body));
        const result = await response.json();
        return this.parseResult(result);
    }
  }
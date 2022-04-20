  export default new class {
    
    async $get(path, accessToken) {
        const basepiUrl = typeof process.env.VUE_APP_API_HOSTNAME !== 'undefined' ? process.env.VUE_APP_API_HOSTNAME : '';

        const response = await fetch(basepiUrl + path, {
            method: "GET",
            credentials: 'include',
            headers: {
                "Content-Type": "application/json",
                'Authorization': 'Bearer ' + accessToken,
                'Access-Control-Allow-Origin': 'http://localhost:3080 ' + basepiUrl,
            },
        });
        const result = await response.json();
        if (typeof result.success !== 'undefined' && result.success) {
          let keys = Object.keys(result).filter( key => key !== 'success' );
          if (keys.length > 2) {
            console.log('WARN unusual response', result);
          };
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
  }
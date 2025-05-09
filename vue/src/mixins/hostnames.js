export default {
    data: () => {
      const apiHostname = process.env.VUE_APP_API_HOSTNAME || window.location.origin;
      const consoleHostname = process.env.VUE_APP_CONSOLE_HOSTNAME || window.location.origin;
      const landingHostname = process.env.VUE_APP_LANDING_HOSTNAME || window.location.origin;
      
      return {
        hostnames: {
          API: (apiHostname || '').replace(/\/$/, "") + '/api/v2',
          CONSOLE: consoleHostname,
          LANDING: landingHostname,
        }
      }
    },
    methods: {
      fixUrlProtocol(url) { 
        return url.indexOf('://') > -1 || url[0] == '/' ? url : 'https://' + url 
      },
    },
    created: function () {
      for (let key in this.hostnames) {
        if (key === 'API' && process.env.NODE_ENV === 'development') {
            continue;
        }
        this.hostnames[key] = this.fixUrlProtocol(this.hostnames[key]);
      }
      this.$hostnames = this.hostnames;
      console.log('global hostnames', this.$hostnames);
    },
  };
  
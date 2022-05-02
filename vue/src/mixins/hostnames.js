export default {
    data: () => {
      return {
        hostnames: {
          API: process.env.VUE_APP_API_HOSTNAME,
          CONSOLE: process.env.VUE_APP_CONSOLE_HOSTNAME,
          LANDING: process.env.VUE_APP_LANDING_HOSTNAME,
        }
      }
    },
    methods: {
      fixUrl(url) { 
        return url.indexOf('://') > -1 ? url : 'https://' + url 
      },
    },
    created: function () {
      for (let key in this.hostnames) {
        if (key === 'API' && process.env.NODE_ENV === 'development') {
            continue;
        }
        this.hostnames[key] = this.fixUrl(this.hostnames[key])
      }
      this.$hostnames = this.hostnames;
      console.log('global hostnames', this.$hostnames);
    },
  };
  
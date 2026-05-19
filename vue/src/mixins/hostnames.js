/**
 * Vue mixin that resolves and normalises the three application hostnames
 * (API, Console, Landing) from environment variables or the current origin.
 *
 * Exposes a `hostnames` data property and installs it as `this.$hostnames`
 * during the `created` lifecycle hook so components can reference it without
 * importing this mixin directly.
 *
 * @mixin
 */
export default {
    /**
     * Initialises `hostnames` from env vars, falling back to `window.location.origin`.
     * @returns {{ hostnames: { API: string, CONSOLE: string, LANDING: string } }}
     */
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
      /**
       * Ensures a URL has a protocol prefix.
       * Leaves absolute URLs and root-relative paths untouched.
       * @param {string} url - URL to normalise.
       * @returns {string} URL prefixed with `https://` when no protocol is present.
       */
      fixUrlProtocol(url) {
        return url.indexOf('://') > -1 || url[0] == '/' ? url : 'https://' + url
      },
    },
    /**
     * Applies `fixUrlProtocol` to each hostname (skips the API entry in development)
     * and exposes the resolved map as `this.$hostnames`.
     */
    created: function () {
      for (let key in this.hostnames) {
        if (key === 'API' && process.env.NODE_ENV === 'development') {
            continue;
        }
        this.hostnames[key] = this.fixUrlProtocol(this.hostnames[key]);
      }
      this.$hostnames = this.hostnames;
    },
  };


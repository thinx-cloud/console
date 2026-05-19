import config from "../config";

/**
 * Vue mixin that provides global app colour config and an HTML-decoding utility.
 * @mixin
 */
export default {
  /**
   * @returns {{ appConfig: { colors: Object } }}
   */
  data: () => {
    return {
      appConfig: {
        colors: config.colors
      }
    }
  },
  methods: {
    /**
     * Decodes HTML entities in a string by passing it through a temporary textarea.
     * @param {string} html - String that may contain HTML entities (e.g. `&amp;`).
     * @returns {string} Plain text with entities decoded.
     */
    decodeHtml(html) {
      let txt = document.createElement("textarea");
      txt.innerHTML = html;
      return txt.value;
    }
  }
};

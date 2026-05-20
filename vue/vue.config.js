const { execSync } = require('child_process');

let publicPath = process.env.NODE_ENV === 'production' ? '/' : '/';

// Inject build hash: CIRCLE_SHA1 in CI, short git hash locally
try {
  process.env.VUE_APP_BUILD_HASH = (
    process.env.CIRCLE_SHA1 || execSync('git rev-parse --short HEAD').toString().trim()
  ).slice(0, 8);
} catch {
  process.env.VUE_APP_BUILD_HASH = 'dev';
}

module.exports = {
  publicPath,
  lintOnSave: process.env.NODE_ENV !== 'production',
  productionSourceMap: false,
  devServer: {
    proxy: 'https://console.thinx.cloud',
  }
};

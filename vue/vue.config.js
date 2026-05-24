const { execSync } = require('child_process');

let publicPath = process.env.NODE_ENV === 'production' ? '/' : '/';

// Inject build hash: respect VUE_APP_BUILD_HASH if already set by the Docker
// build (CI passes it as --build-arg), then CIRCLE_SHA1, then short git hash
// locally, finally 'dev' as a no-git fallback.
try {
  process.env.VUE_APP_BUILD_HASH = (
    process.env.VUE_APP_BUILD_HASH
    || process.env.CIRCLE_SHA1
    || execSync('git rev-parse --short HEAD').toString().trim()
  ).slice(0, 8);
} catch {
  if (!process.env.VUE_APP_BUILD_HASH) process.env.VUE_APP_BUILD_HASH = 'dev';
}

module.exports = {
  publicPath,
  lintOnSave: process.env.NODE_ENV !== 'production',
  productionSourceMap: false,
  devServer: {
    proxy: 'https://console.thinx.cloud',
  }
};

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

// Rollbar's `environment` must name the deployment, not the webpack mode.
// NODE_ENV cannot serve that role here: the Dockerfile pins it to 'development'
// for the whole build stage, so vue-cli leaves it there and every production
// item was reported as 'development'. ENVIRONMENT is the build arg CI already
// passes through the Dockerfile, so re-export it under the VUE_APP_ prefix
// (the only prefix vue-cli inlines into the bundle).
if (!process.env.VUE_APP_ENVIRONMENT) {
  process.env.VUE_APP_ENVIRONMENT = process.env.ENVIRONMENT === 'production' ? 'production' : 'development';
}

module.exports = {
  publicPath,
  lintOnSave: process.env.NODE_ENV !== 'production',
  productionSourceMap: false,
  devServer: {
    proxy: 'https://console.thinx.cloud',
  }
};

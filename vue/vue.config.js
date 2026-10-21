const { execSync } = require('child_process');

let publicPath = process.env.NODE_ENV === 'production' ? '/' : '/';

// Inject build hash: respect VUE_APP_BUILD_HASH if already set by the Docker
// build (CI passes it as --build-arg), then CIRCLE_SHA1, then short git hash
// locally, cut to 7 characters (the same as CI's `cut -c -7`). The 'dev' no-git
// fallback stays for Rollbar's code_version; the footer (AppFooter) shows only a
// 7-hex commit id and hides 'dev' together with its separator (UI-05, D-11).
try {
  process.env.VUE_APP_BUILD_HASH = (
    process.env.VUE_APP_BUILD_HASH
    || process.env.CIRCLE_SHA1
    || execSync('git rev-parse --short HEAD').toString().trim()
  ).slice(0, 7);
} catch {
  if (!process.env.VUE_APP_BUILD_HASH) process.env.VUE_APP_BUILD_HASH = 'dev';
}

// The footer's copyright range ends at the build year, not at a year written
// into the template (UI-05, D-12). Taken from the build clock in UTC unless the
// env already carries it, so a CI or Docker build can pin it; no CI or
// Dockerfile change is needed for the default.
if (!process.env.VUE_APP_BUILD_YEAR) {
  process.env.VUE_APP_BUILD_YEAR = String(new Date().getUTCFullYear());
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

let publicPath = process.env.NODE_ENV === 'production' ? '/' : '/';

module.exports = {
  publicPath,
  lintOnSave: process.env.NODE_ENV !== 'production',
  productionSourceMap: false,
  devServer: {
    proxy: 'https://console.thinx.cloud',
  }
};

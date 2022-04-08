let publicPath = process.env.NODE_ENV === 'production' ? 'light-blue-vue-admin/' : '/';

module.exports = {
  publicPath,
  productionSourceMap: false,
  devServer: {
    proxy: 'https://rtm.thinx.cloud/api',
  }
};

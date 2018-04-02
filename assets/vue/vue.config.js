const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
const appConfig = require('./src/app.config')
const path = require('path')

module.exports = {
  configureWebpack: config => { return {
    // We provide the app's title in Webpack's name field, so that
    // it can be accessed in index.html to inject the correct title.
    name: appConfig.title,
    watch: process.env.NODE_ENV === 'development',
    output: {
      path: path.resolve(__dirname, '../build/vue'),
      filename: 'stl-[name].js',
      publicPath: 'assets/build/js/',
    },
    // Set up all the aliases we use in our app.
    resolve: {
      alias: require('./aliases.config').webpack,

    },
    plugins: [
      // Optionally produce a bundle analysis
      // TODO: Remove once this feature is built into Vue CLI
      new BundleAnalyzerPlugin({
        analyzerMode: process.env.ANALYZE ? 'static' : 'disabled',
        openAnalyzer: process.env.CI !== 'true',
      }),
    ],
  }},
  chainWebpack: config => {
    config.plugin('html')
      .tap(options => {
        options[0].template = '!!raw-loader!' + path.resolve(__dirname, '../../views/layouts/beforeWebpack.ejs');
        options[0].filename = path.resolve(__dirname, '../../views/layouts/app.ejs');
        options[0].minify = false; // override in production environment
        return options;
      });
  },
  css: {
    // Enable CSS source maps.
    sourceMap: true,
    // Enable CSS modules for all CSS/pre-processor files.
    // This option does not affect *.vue files.
    modules: true,
  },
  // Configure Webpack's dev server.
  // https://github.com/vuejs/vue-cli/blob/dev/docs/cli-service.md
  devServer: {
    ...(process.env.API_BASE_URL
      ? // Proxy API endpoints to the production base URL.
        { proxy: { '/api': { target: process.env.API_BASE_URL } } }
      : // Proxy API endpoints a local mock API.
        { before: require('./tests/mock-api') }),
  },
}

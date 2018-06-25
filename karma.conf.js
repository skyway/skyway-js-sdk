const webpackConfig = require('./webpack.config');

webpackConfig.mode = 'none';
// still need Babel to use inject-loader
webpackConfig.module.rules.push({
  test: /\.js$/,
  loader: 'babel-loader',
  exclude: /(\/node_modules$)/,
});
// enable-sourcemap
webpackConfig.devtool = 'inline-source-map';

module.exports = config => {
  config.set({
    files: [
      // if specify running tests
      './tests/peer/sfuRoom.js',
      // './tests/index.js',
    ],

    singleRun: true,

    frameworks: ['mocha'],

    webpack: webpackConfig,

    preprocessors: {
      // if specify running tests
      './tests/peer/sfuRoom.js': ['webpack', 'sourcemap'],
      // './tests/index.js': ['webpack', 'sourcemap'],
    },

    reporters: ['mocha'],

    browsers: ['ChromeHeadlessNoSandbox'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox'],
      },
    },
  });
};

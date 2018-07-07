const webpackConfig = require('./webpack.config');

webpackConfig.mode = 'none';
// still need Babel to use inject-loader
webpackConfig.module.rules.push({
  test: /\.js$/,
  exclude: /node_modules/,
  use: {
    loader: 'babel-loader',
    options: {
      presets: ['es2015'],
      plugins: ['babel-plugin-espower', 'istanbul'],
    },
  },
});
// enable-sourcemap
webpackConfig.devtool = 'inline-source-map';

module.exports = config =>
  config.set({
    files: [
      // if specify running tests
      // './tests/peer/sfuRoom.js',
      './tests/index.js',
    ],

    singleRun: true,

    frameworks: ['mocha'],

    webpack: webpackConfig,

    preprocessors: {
      // if specify running tests
      // './tests/peer/sfuRoom.js': ['webpack', 'sourcemap'],
      './tests/index.js': ['webpack', 'sourcemap'],
    },

    reporters: ['mocha', 'coverage'],
    coverageReporter: {
      dir: './coverage',
      reporters: [{ type: 'html' }, { type: 'text' }],
    },

    browsers: ['ChromeHeadlessNoSandbox'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox'],
      },
    },
  });

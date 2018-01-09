const webpackConfig = require('./webpack.config.js');

// Test env only attrs
webpackConfig.module.rules.push({
  test: /\.js$/,
  exclude: /node_modules/,
  use: {
    loader: 'istanbul-instrumenter-loader',
    options: {
      debug: true,
      esModules: true,
    },
  },
});

webpackConfig.devtool = 'inline-source-map';

module.exports = config => {
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

    browsers: ['ChromeHeadlessNoSandbox'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox'],
      },
    },

    coverageReporter: {
      reporters: [{ type: 'html', dir: './coverage' }, { type: 'text' }],
    },
  });
};

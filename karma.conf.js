const webpackConfig = require('./webpack.config.js');

webpackConfig.module.rules.push({
  test:    /\.js$/,
  exclude: /node_modules/,
  use:     {
    loader:  'istanbul-instrumenter-loader',
    options: {
      debug:     true,
      esModules: true,
    },
  },
});

module.exports = config => {
  config.set({
    files: [
      // if specify running tests
      // './tests/peer.js',
      './tests/index.js'
    ],

    singleRun: true,

    frameworks: ['mocha'],

    webpack: webpackConfig,

    preprocessors: {
      // if specify running tests
      // './src/peer.js':   'webpack',
      // './tests/peer.js': 'webpack',
      './tests/index.js': 'webpack',
    },

    reporters: [
      'mocha',
      'coverage',
    ],

    browsers: ['ChromeHeadless'],

    coverageReporter: {
      reporters: [
        {type: 'html', dir: './coverage'},
        {type: 'text'},
      ],
    },
  });
};

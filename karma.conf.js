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

module.exports =  {
  singleRun: true,

  frameworks: ['mocha'],

  webpack: webpackConfig,

  preprocessors: {
    'tests/**/*.js': 'webpack',
    'src/**/*.js':   'webpack',
  },

  reporters: [
    'mocha',
    'coverage',
  ],

  browsers: ['ChromeHeadless'],

  coverageReporter: {
    reporters: [
      {type: 'html', dir: 'coverage/'},
      {type: 'text'},
    ],
  },
};

const webpackConfig = require('./webpack.config.js');

module.exports =  {
  singleRun: true,

  frameworks: ['mocha'],

  // browserify: {
  //   debug:     true,
  //   transform: [
  //     ['browserify-istanbul', {
  //       instrumenter: require('isparta'),
  //     }],
  //     ['babelify'],
  //   ],
  //   plugin: ['proxyquireify/plugin'],
  // },

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

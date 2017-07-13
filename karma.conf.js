module.exports =  {
  singleRun: true,

  frameworks: ['mocha', 'browserify'],

  browserify: {
    debug:     true,
    transform: [
      ['browserify-istanbul', {
        instrumenter:       require('isparta'),
        instrumenterConfig: {babel: {presets: ['es2015']}},
      }],
      ['babelify', {presets: ['es2015'],
        plugins: ['babel-plugin-espower']},
      ],
    ],
    plugin: ['proxyquireify/plugin'],
  },

  preprocessors: {
    'tests/**/*.js': 'browserify',
    'src/**/*.js':   'browserify',
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

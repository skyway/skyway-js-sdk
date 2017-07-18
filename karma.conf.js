const argv = require('yargs').argv;
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
    files: _setTestFiles(argv),

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
        {type: 'html', dir: './coverage'},
        {type: 'text'},
      ],
    },
  });
};

function _setTestFiles(argv) {
  const testDir = './tests';
  const srcDir  = './src';

  const files = [];
  function getFileItem(path) {
    return {
      pattern:  path,
      watched:  false,
      served:   true,
      included: true,
    };
  }

  // If --tests is all or not specified, run all tests
  if (!argv.tests || argv.tests === 'all') {
    [
      `${testDir}/**/*.js`,
      `${srcDir}/**/*.js`,
    ].forEach(p => files.push(getFileItem(p)));
  }
  // If test specified
  else {
    // Put it in an array if there's only one --tests
    if (typeof argv.tests === 'string') {
      files.push(getFileItem(`${testDir}/${argv.tests}`));
      files.push(getFileItem(`${srcDir}/${argv.tests}`));
    }
    else {
      argv.tests.forEach(p => {
        files.push(getFileItem(`${testDir}/${p}`));
        files.push(getFileItem(`${srcDir}/${p}`));
      });
    }
  }

  return files;
}

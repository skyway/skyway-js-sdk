module.exports = function(config) {
  config.set({
    frameworks: ['browserify', 'mocha'],

    files: [
      {
        pattern:  'src/**/*.js',
        watched:  false,
        served:   true,
        included: true
      },
      {
        pattern:  'tests/**/test-*.js',
        watched:  false,
        served:   true,
        included: true
      }
    ],

    exclude: [
    ],

    preprocessors: {
      'tests/**/test-*.js': 'browserify',
      'src/**/*.js':        'browserify'
    },
    browserify: {
      configure: function(bundle) {
        bundle.once('prebundle', function() {
          bundle.transform(
            'babelify', {
              presets: ['es2015'],
              plugins: ['babel-plugin-espower']
            }
          ).plugin('proxyquire-universal');
        });
      }
    },

    reporters: [
      'mocha'
    ],

    // define reporters, port, logLevel, browsers etc.
    browsers: ['PhantomJS2']
  });
};

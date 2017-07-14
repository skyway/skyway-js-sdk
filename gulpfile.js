'use strict';

const gulp        = require('gulp');
const eslint      = require('gulp-eslint');
const uglify      = require('gulp-uglify');
const rename      = require('gulp-rename');
const header      = require('gulp-header');
const del         = require('del');
const browserify  = require('browserify');
const babelify    = require('babelify');
const source      = require('vinyl-source-stream');
const buffer      = require('vinyl-buffer');
const runSequence = require('run-sequence');
const jsdoc       = require('gulp-jsdoc3');

const karmaConfig = require('./karma.conf.js');
const KarmaServer = require('karma').Server;
const argv = require('yargs').argv;

gulp.task('test', done => {
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

  karmaConfig.files = files;
  KarmaServer.start(karmaConfig, done);
});

gulp.task('clean', () => {
  return del(['dist/**/*.js']);
});

gulp.task('lint', () => {
  return gulp.src(
    [
      '**/*.js',
      '!node_modules/**',
      '!dist/**',
      '!coverage/**',
      '!docs/**',
      '!examples/**',
    ])
    .pipe(eslint('.eslintrc'))
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

gulp.task('build', () => {
  const currentYear = new Date().getFullYear();
  const copyright =
    `/* skywayjs Copyright(c) ${currentYear} ` +
    `NTT Communications Corporation      *\n` +
    ` * peerjs Copyright(c) 2013 Michelle Bu <michelle@michellebu.com> */\n`;

  return browserify('./src/peer.js', {standalone: 'Peer'})
    .transform(babelify, {presets: ['es2015']})
    .bundle()
    .pipe(source('eclwebrtc.js'))
    .pipe(buffer())
    .pipe(header(copyright))
    .pipe(gulp.dest('dist'))

    .pipe(rename(function(path) {
      if (path.extname === '.js') {
        path.basename += '.min';
      }
    }))
    .pipe(uglify())
    .pipe(header(copyright))
    .pipe(gulp.dest('dist'));
});

gulp.task('doc', cb => {
  gulp.src(['README.md', './src/**/*.js'], {read: false})
    .pipe(jsdoc(cb));
});

gulp.task('default', () => {
  runSequence('lint', 'build');
});

gulp.doneCallback = function(err) {
  process.exit(err ? 1 : 0);
};

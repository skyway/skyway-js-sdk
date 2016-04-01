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

const karmaConfig = require('./karma.conf.js');
const KarmaServer = require('karma').Server;

let tests = require('yargs').argv.test;
const testDir = 'tests/';
const srcDir  = 'src/';
const fileList = [];
const files = [];

// If --test is all or not specified, run all tests
if (!tests || tests === 'all') {
  fileList.push(`${testDir}test-**.js`);
  fileList.push(`${srcDir}**.js`);
} else {
  // Put it in an array if there's only one --test
  if (typeof tests === 'string') {
    tests = [tests];
  }

  for (let test of tests) {
    fileList.push(`${srcDir}${test}.js`);
    fileList.push(`${testDir}test-${test}.js`);
  }
}

for (let filename of fileList) {
  files.push({
    pattern:  filename,
    watched:  false,
    served:   true,
    included: true
  });
}

gulp.task('test', done => {
  karmaConfig.files = files;
  KarmaServer.start(karmaConfig, done);
});

gulp.task('clean', () => {
  return del(['dist/**/*.js']);
});

gulp.task('lint', () => {
  return gulp.src(['**/*.js', '!node_modules/**', '!dist/**', '!coverage/**', '!examples/**'])
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
    .pipe(source('skyway.js'))
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

gulp.task('default', () => {
  runSequence('lint', 'build');
});

gulp.doneCallback = function(err) {
  process.exit(err ? 1 : 0);
};

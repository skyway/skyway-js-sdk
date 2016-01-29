const gulp        = require('gulp');
const eslint      = require('gulp-eslint');
const uglify      = require('gulp-uglify');
const rename      = require('gulp-rename');
const del         = require('del');
const path        = require('path');
const browserify  = require('browserify');
const babelify    = require('babelify');
const source      = require('vinyl-source-stream');
const buffer      = require('vinyl-buffer');
const runSequence = require('run-sequence');
const KarmaServer = require('karma').Server;

gulp.task('clean', () => {
  return del(['dist/**/*.js']);
});

gulp.task('lint', () => {
  return gulp.src(['**/*.js', '!node_modules/**', '!dist/**'])
    .pipe(eslint('.eslintrc'))
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

gulp.task('build', () => {
  return browserify('./src/skyway.js')
    .transform(babelify, {presets: ['es2015']})
    .bundle()
    .pipe(source('skyway.js'))
    .pipe(buffer())
    .pipe(gulp.dest('dist'))
    .pipe(rename(function(path) {
      if (path.extname === '.js') {
        path.basename += '.min';
      }
    }))
    .pipe(uglify())
    .pipe(gulp.dest('dist'));
});

gulp.task('test', done => {
  new KarmaServer({
    configFile: path.join(__dirname, '/karma.conf.js'),
    singleRun:  true
  }, done).start();
});

gulp.task('default', () => {
  runSequence('lint', 'build');
});

gulp.doneCallback = function(err) {
  process.exit(err ? 1 : 0);
};

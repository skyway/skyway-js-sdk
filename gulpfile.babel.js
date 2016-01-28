var gulp        = require('gulp');
var eslint      = require('gulp-eslint');
var uglify      = require('gulp-uglify');
var rename      = require('gulp-rename');
var del         = require('del');
var path        = require('path');
var browserify  = require('browserify');
var babelify    = require('babelify');
var source      = require('vinyl-source-stream');
var buffer      = require('vinyl-buffer');
var runSequence = require('run-sequence');
var KarmaServer = require('karma').Server;

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

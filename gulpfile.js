var gulp       = require('gulp');
var eslint     = require('gulp-eslint');
var uglify     = require('gulp-uglify');
var rename     = require('gulp-rename');
var del        = require('del');
var browserify = require('browserify');
var babelify   = require('babelify');
var source     = require('vinyl-source-stream');

gulp.task('clean', function() {
  return del(['dist/**/*.js']);
});

gulp.task('lint', function() {
  return gulp.src(['**/*.js', '!node_modules/**', '!dist/**'])
    .pipe(eslint({
      extends: 'google',
      rules: {
        'no-multi-spaces': [1, {
          exceptions: {
            VariableDeclarator: true
          }
        }]
      }
    }))
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

gulp.task('build', ['lint'], function() {
  return browserify('./src/skyway.js')
    .transform(babelify, {presets: ['es2015']})
    .bundle()
    .pipe(source('skyway.js'))
    .pipe(gulp.dest('dist'));
});

gulp.task('uglify', ['build'], function() {
  return gulp.src('./dist/skyway.js')
    .pipe(uglify())
    .pipe(rename('skyway.min.js'))
    .pipe(gulp.dest('dist'));
});

gulp.task('default', ['lint', 'build', 'uglify'], function() {

});


var gulp = require('gulp');
var eslint = require('gulp-eslint');
var babel = require('gulp-babel');

gulp.task('lint', function() {
  return gulp.src(['**/*.js', '!node_modules/**', '!build/**'])
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

gulp.task('babel', function() {
  return gulp.src('src/**/*.js')
    .pipe(babel({
      presets: ['es2015']
    }))
    .pipe(gulp.dest('build'));
});

gulp.task('default', ['lint'], function() {
  gulp.start('babel');
});


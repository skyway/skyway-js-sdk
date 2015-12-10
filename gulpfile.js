var gulp = require('gulp');
var eslint = require('gulp-eslint');

gulp.task('lint', function() {
  return gulp.src(['**/*.js', '!node_modules/**'])
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

gulp.task('default', ['lint'], function() {
});


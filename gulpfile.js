const gulp = require('gulp');
const less = require('gulp-less');
const babel = require('gulp-babel');
const uglify = require('gulp-uglify');
const webpack = require('gulp-webpack');
const cleanCss = require('gulp-clean-css');

gulp.task('styles', () => {
  return gulp.src('frontend/styles/app.less')
    .pipe(less({paths: ['public']}))
    .pipe(cleanCss())
    .pipe(gulp.dest('public'));
});

gulp.task('scripts', () => {
  return gulp.src('frontend/**/*.js')
    .pipe(babel({
      presets: ['es2015']
    }))
    .pipe(gulp.dest('public'));
});

gulp.task('scripts-bundled', ['scripts'], () => {
  return gulp.src('public/app.js')
    .pipe(webpack({
      output: {
        filename: 'app.bundled.js'
      }
    }))
    .pipe(uglify())
    .pipe(gulp.dest('public'));
});

gulp.task('watch', ['default'], () => {
  gulp.watch(['frontend/*.less'], ['styles']);
  gulp.watch(['frontend/*.js'], ['scripts-bundled']);
});

gulp.task('default', ['styles', 'scripts-bundled']);

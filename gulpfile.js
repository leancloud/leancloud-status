const gulp = require('gulp');
const less = require('gulp-less');
const babel = require('gulp-babel');
const webpack = require('gulp-webpack');
const cleanCss = require('gulp-clean-css');
const Visualizer = require('webpack-visualizer-plugin');
const UglifyJsPlugin = require('webpack').optimize.UglifyJsPlugin;

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
  return webpackTask('app');
});

gulp.task('admin-bundled', ['scripts'], () => {
  return webpackTask('admin');
});

gulp.task('watch', ['default'], () => {
  gulp.watch(['frontend/styles/*.less'], ['styles']);
  gulp.watch(['frontend/*.js'], ['scripts-bundled', 'admin-bundled']);
});

gulp.task('default', ['styles', 'scripts-bundled', 'admin-bundled']);

function webpackTask(name) {
  return gulp.src(`public/${name}.js`)
    .pipe(webpack({
      plugins: [
        new Visualizer(),
        new UglifyJsPlugin({compress: {warnings: false}})
      ],
      output: {
        filename: `${name}.bundled.js`
      }
    }))
    .pipe(gulp.dest('public'));
}

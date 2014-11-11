import path = require('path');
var gulp = require('gulp');
var typescript = require('gulp-tsc');

var paths = {
    sources: ['**/*.ts', '!**/*.d.ts', '!main.ts', '!node_modules/**', '!gulpfile.*'],
    scripts: ['client/*.js'],
    html: ['app/index.html', '!app/test.html'],
    out: '../lib'
};

gulp.task('sources', () => {
    var options = {
        declaration: false,
        removeComments: true
    };
    options['module'] = 'commonjs';

    gulp.src(paths.sources)
        .pipe(typescript(options))
        .pipe(gulp.dest(paths.out));
});

gulp.task('typings', () => {
    //TODO
});

gulp.task('scripts', () => {
    gulp.src(paths.scripts)
        .pipe(gulp.dest(path.join(paths.out, "client")));
});

gulp.task('default', ['sources', 'scripts'], () => {

});


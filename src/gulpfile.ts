import path = require('path');
var gulp = require('gulp');
var typescript = require('gulp-tsc');

var src = {
    lib: ['lib/*.ts', '!lib/*.d.ts'],
    client: ['lib/client/*.js'],
};

var out = {
    lib: '../lib',
    client: '../lib/client',
};

gulp.task('lib', () => {
    var options = {
        declaration: false,
        removeComments: true
    };
    options['module'] = 'commonjs';

    gulp.src(src.lib)
        .pipe(typescript(options))
        .pipe(gulp.dest(out.lib));
});

gulp.task('typings', () => {
    //TODO
});

gulp.task('client', () => {
    gulp.src(src.client)
        .pipe(gulp.dest(out.client));
});

gulp.task('default', ['lib', 'client'], () => {

});


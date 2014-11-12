import path = require('path');
import gulp = require('gulp');
var typescript = require('gulp-tsc');
var jeditor = require("gulp-json-editor");

var src = {
    lib: ['lib/*.ts', '!lib/*.d.ts'],
    client: ['lib/client/*.js'],
    pkg: ['package.json'],
};

var out = {
    lib: '../lib',
    client: '../lib/client',
    pkg: '..',
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

gulp.task('package', () => {
    gulp.src(src.pkg)
        .pipe(jeditor({'devDependencies': undefined}))
        .pipe(gulp.dest(out.pkg));
});

gulp.task('client', () => {
    gulp.src(src.client)
        .pipe(gulp.dest(out.client));
});

gulp.task('default', ['lib', 'client'], () => {

});


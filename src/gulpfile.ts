import path = require('path');
import gulp = require('gulp');
var replace = require('gulp-replace');
var typescript = require('gulp-tsc');
var jeditor = require("gulp-json-editor");

var src = {
    lib: ['lib/*.ts', '!lib/sftp-interop.ts', '!lib/*.d.ts'],
    lib_web: ['lib/sftp-client.ts', 'lib/sftp-api.ts', 'lib/sftp-misc.ts', 'lib/sftp-packet-web.ts', 'lib/sftp-enums.ts'],
    pkg: ['package.json'],
};

var out = {
    lib: '../lib',
    lib_web: '../web',
    pkg: '..',
};

gulp.task('lib', () => {
    var options = {
        "declaration": false,
        "removeComments": true,
        "module": "commonjs",
    };

    gulp.src(src.lib)
        .pipe(typescript(options))
        .pipe(gulp.dest(out.lib));
});

gulp.task('web', () => {
    var options = {
        "declaration": false,
        "removeComments": true,
        "module": "commonjs",
    };
    gulp.src(src.lib_web)
//        .pipe(typescript(options))
        //.pipe(replace(/(\/\/\/[^\n]*\n)/g, ''))
        .pipe(replace(/\r\nimport events = require\(\"(.*)\"\);/g, ''))
        .pipe(replace(/import (.*) = require\(\".\/sftp-packet\"\);/g, '/// <reference path="./sftp-packet-web.ts" />'))
        .pipe(replace(/import (.*) = require\(\"(.*)\"\);/g, '/// <reference path="$2.ts" />'))
        .pipe(replace(/\r\nimport (.*) = (.*);/g, ''))
        .pipe(replace(/export class/g, 'class'))
        .pipe(replace(/export interface/g, 'interface'))
        .pipe(replace(/NodeBuffer/g, 'Uint8Array'))
        .pipe(replace(/\n(\s*)(.*)WEB\: /g, '$1'))
        .pipe(gulp.dest(out.lib_web));

    
    //import packet = require("./sftp-packet");
});

gulp.task('package', () => {
    gulp.src(src.pkg)
        .pipe(jeditor({'devDependencies': undefined}))
        .pipe(gulp.dest(out.pkg));
});

gulp.task('default', ['lib', 'package', 'web'], () => {

});


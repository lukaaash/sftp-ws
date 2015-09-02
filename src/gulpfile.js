var gulp = require('gulp');

var replace = require('gulp-replace');
var ts = require('gulp-typescript');
var concat = require('gulp-concat');
var jeditor = require("gulp-json-editor");
var sourcemaps = require('gulp-sourcemaps');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');

var tsLib = ts.createProject({
    "declarationFiles": false,
    "noExternalResolve": true,
    "module": "commonjs",
});

var tsWeb = ts.createProject({
    "declarationFiles": false,
    "noExternalResolve": true,
    "sortOutput": true,
});

var src = {
    lib: ['lib/*.ts', 'tests/*.ts', '!lib/*-web.ts', '!lib/*.d.ts', 'typings/*/*.d.ts'],
    lib_web: ['lib/util-web.ts', 'lib/util.ts', 'lib/charsets.ts', 'lib/fs-api.ts', 'lib/fs-misc.ts', 'lib/fs-glob.ts', 'lib/fs-sources.ts', 'lib/fs-targets.ts', 'lib/fs-plus.ts', 'lib/channel.ts', 'lib/channel-ws.ts', 'lib/sftp-enums.ts', 'lib/sftp-packet.ts', 'lib/sftp-misc.ts', 'lib/sftp-client.ts', 'lib/sftp-web.ts'],
    pkg: ['package.json'],
    npm: ['.npmignore', '../README.md', '../LICENSE'],
};

var out = {
    lib: '../build',
    lib_web: '../build/web',
};

gulp.task('lib', function () {

    var tsResult = gulp.src(src.lib).pipe(ts(tsLib));

    return tsResult.js
        .pipe(rename(function (path) {
        if (path.basename.substr(path.basename.length - 6) == "-tests")
            path.dirname = "./tests";
        else
            path.dirname = "./lib";
        }))
        .pipe(gulp.dest(out.lib));
});

gulp.task('web.ts', function () {

    return gulp.src(src.lib_web)
        .pipe(replace(/\r/g, ''))
        .pipe(replace(/import (.*) = require\(\"(.*)\"\);.*\n/g, ''))
        .pipe(replace(/import (.*) = (.*);.*\n/g, ''))
        .pipe(replace(/\/\/\/(.*).*\n/g, ''))
        .pipe(replace(/export const/g, 'const'))
        .pipe(replace(/export class/g, 'class'))
        .pipe(replace(/export interface/g, 'interface'))
        .pipe(replace(/export function/g, 'function'))
        .pipe(replace(/new Buffer\(/g, 'new Uint8Array('))
        .pipe(replace(/NodeJS\./g, ''))
        .pipe(replace(/\n.*\/\/ #if NODE[\s\S]*\/\/ #endif.*\n/g, ''))
        .pipe(replace(/^(\s*)(.*)WEB\: /gm, '$1'))
        .pipe(concat('sftp.ts'))
        .pipe(replace(/class Client /g, 'export class Client '))
        .pipe(replace(/^/g, 'module SFTP {'))
        .pipe(replace(/$/g, '\n}'))
        .pipe(replace(/\n/g, '\r\n'))
        .pipe(gulp.dest(out.lib_web));
});

gulp.task('web.js', ['web.ts'], function () {

    var mapOptions = {
        includeContent: false,
        sourceRoot: "./",
    };

    return gulp.src(out.lib_web + '/sftp.ts')
        .pipe(sourcemaps.init())
        .pipe(ts(tsWeb)).js
        .pipe(replace(/^.*\n.*\n.*\n.*\n.*\n.*\nvar SFTP;\n/g, '//\r\n//\r\n//\r\n//\r\n//\r\n\r\nvar SFTP;\r\n'))
        .pipe(replace(/\n};.*\n.*\n.*\n.*\n.*\n.*\nvar SFTP;\n/g, '//\r\n//\r\n//\r\n//\r\n//\r\n\r\nvar SFTP;\r\n'))
        .pipe(sourcemaps.write(".", mapOptions))
        .pipe(gulp.dest(out.lib_web));

});

gulp.task('web', ['web.js'], function () {

    var uglifyOptions = {
        mangle: {
            except: ['SftpItem'],
            screw_ie8: true,
        },
        compress: {
            sequences: true,
            dead_code: true,
            conditionals: true,
            booleans: true,
            unused: true,
            if_return: true,
            join_vars: true,
            drop_console: true,
        },
        output: {
            preamble: "// http://github.com/lukaaash/sftp-ws/",
            //comments: "all",
            //beautify: true,
        }
    };

    return gulp.src(out.lib_web + '/sftp.js')
        .pipe(rename(function (path) { return path.basename = "sftp.min"; }))
        .pipe(uglify(uglifyOptions))
        .pipe(gulp.dest(out.lib_web));
});

gulp.task('package', function () {

    return gulp.src(src.pkg)
        .pipe(jeditor({ 'devDependencies': undefined }))
        .pipe(gulp.dest(out.lib));
});

gulp.task('npm', function () {
    return gulp.src(src.npm)
        .pipe(gulp.dest(out.lib));
});

gulp.task('build', ['lib', 'web', 'package', 'npm'], function () {

});

gulp.task('default', ['build'], function () {

});



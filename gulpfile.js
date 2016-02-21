var gulp = require('gulp');
var replace = require('gulp-replace');
var typescript = require('gulp-typescript');
var concat = require('gulp-concat');
var jeditor = require("gulp-json-editor");
var sourcemaps = require('gulp-sourcemaps');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');

var ts = {
    lib: typescript.createProject({
        "declarationFiles": false,
        "noExternalResolve": true,
        "module": "commonjs",
    }),
    web: typescript.createProject({
        "declarationFiles": false,
        "noExternalResolve": true,
        "sortOutput": true,
    }),
    tests: typescript.createProject({
        "declarationFiles": false,
        "noExternalResolve": false,
        "module": "commonjs",
    }),
};

var src = {
    lib: ['lib/*.ts', 'tests/*.ts', '!lib/*-web.ts', 'typings/*/*.d.ts'],
    tests: ['tests/*.ts', 'typings/*/*.d.ts'],
    web: ['lib/util-web.ts', 'lib/promise.ts', 'lib/util.ts', 'lib/charsets.ts', 'lib/fs-api.ts', 'lib/fs-misc.ts', 'lib/fs-glob.ts', 'lib/fs-sources.ts', 'lib/fs-targets.ts', 'lib/fs-plus.ts', 'lib/channel.ts', 'lib/channel-ws.ts', 'lib/sftp-enums.ts', 'lib/sftp-packet.ts', 'lib/sftp-misc.ts', 'lib/sftp-client.ts', 'lib/sftp.ts'],
    pkg: ['package.json'],
    npm: ['README.md', 'LICENSE'],
};

var out = {
    lib: 'lib',
    tests: 'tests',
    web: 'build/web',
    npm: 'build/npm',
    npm_lib: 'build/npm/lib',
};

gulp.task('lib', function () {
    var result = gulp.src(src.lib)
        .pipe(sourcemaps.init())
        .pipe(typescript(ts.lib));

    return result.js
        .pipe(sourcemaps.write())
        .pipe(gulp.dest(out.lib));
});

gulp.task('tests', function () {
    var result = gulp.src(src.tests)
        .pipe(sourcemaps.init())
        .pipe(typescript(ts.tests));

    return result.js
        .pipe(sourcemaps.write())
        .pipe(gulp.dest(out.tests));
});

gulp.task('npm.lib', function () {
    var result = gulp.src(src.lib)
        .pipe(typescript(ts.lib));

    return result.js
        .pipe(gulp.dest(out.npm_lib));
});

gulp.task('web.ts', function () {
    return gulp.src(src.web)
        .pipe(replace(/\r/g, ''))
        .pipe(replace(/import (.*) = require\(\"(.*)\"\);.*\n/g, ''))
        .pipe(replace(/import (.*) = (.*);.*\n/g, ''))
        .pipe(replace(/\/\/\/(.*).*\n/g, ''))
        .pipe(replace(/export =\s*\S*\n/g, ''))
        .pipe(replace(/export (\S+\s)/g, '$1'))
        .pipe(replace(/new Buffer\(/g, 'new Uint8Array('))
        .pipe(replace(/NodeJS\./g, ''))
        .pipe(replace(/\n?.*\/\/ #if NODE(?:(?!#endif\b)[\s\S])*\/\/ #endif.*\n/g, ''))
        .pipe(replace(/\n?.*\/\/ #if FULL(?:(?!#endif\b)[\s\S])*\/\/ #endif.*\n/g, ''))
        .pipe(replace(/^(\s*)(.*)WEB\: /gm, '$1'))
        .pipe(concat('sftp.ts'))
        .pipe(replace(/class Client /g, 'export class Client '))
        .pipe(replace(/^/g, 'module SFTP {'))
        .pipe(replace(/$/g, '\n}\n'))
        .pipe(replace(/\n/g, '\r\n'))
        .pipe(gulp.dest(out.web));
});

gulp.task('web.js', ['web.ts'], function () {
    var mapOptions = {
        includeContent: false,
        sourceRoot: "./",
    };

    return gulp.src(out.web + '/sftp.ts')
        .pipe(sourcemaps.init())
        .pipe(typescript(ts.web)).js
        .pipe(replace(/^var (.*\n){5}var SFTP;\n/g, '//\r\n//\r\n//\r\n//\r\n//\r\n' + 'var SFTP;\r\n'))
        .pipe(sourcemaps.write(".", mapOptions))
        .pipe(gulp.dest(out.web));

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

    return gulp.src(out.web + '/sftp.js')
        .pipe(rename(function (path) { return path.basename = "sftp.min"; }))
        .pipe(uglify(uglifyOptions))
        .pipe(gulp.dest(out.web));
});

gulp.task('npm.pkg', function () {
    return gulp.src(src.pkg)
        .pipe(jeditor(function (json) {
            delete json.devDependencies;
            delete json.scripts;
            return json;
        }))
        .pipe(gulp.dest(out.npm));
});

gulp.task('npm', ['npm.lib', 'npm.pkg'], function () {
    return gulp.src(src.npm)
        .pipe(gulp.dest(out.npm));
});

gulp.task('build', ['lib', 'tests', 'npm', 'web'], function () {

});

gulp.task('default', ['build'], function () {

});


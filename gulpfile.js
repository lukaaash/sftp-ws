var gulp = require('gulp');
var replace = require('gulp-replace');
var typescript = require('gulp-typescript');
var concat = require('gulp-concat');
var jeditor = require("gulp-json-editor");
var sourcemaps = require('gulp-sourcemaps');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var merge = require('merge-stream');

var ts = {
    lib: typescript.createProject({
        "declaration": false,
        "noExternalResolve": true,
        "module": "commonjs",
    }),
    web: typescript.createProject({
        "declaration": false,
        "noExternalResolve": true,
        "sortOutput": true,
    }),
    tests: typescript.createProject({
        "declaration": false,
        "noExternalResolve": false,
        "module": "commonjs",
    }),
};

var input = {
    sources: ['lib/*.ts', '!lib/*-web.ts', 'typings/*/*.d.ts'],
    tests: ['tests/*.ts'],
    web: ['lib/util-web.ts', 'lib/promise.ts', 'lib/util.ts', 'lib/charsets.ts', 'lib/fs-api.ts', 'lib/fs-misc.ts', 'lib/fs-glob.ts', 'lib/fs-sources.ts', 'lib/fs-targets.ts', 'lib/fs-plus.ts', 'lib/channel.ts', 'lib/channel-ws.ts', 'lib/sftp-enums.ts', 'lib/sftp-packet.ts', 'lib/sftp-misc.ts', 'lib/sftp-client.ts', 'lib/sftp.ts'],
    metadata: ['package.json'],
    files: ['README.md', 'LICENSE'],
};

var output = {
    lib: '.',
    web: 'build/web',
    packages: 'build/package',
};

gulp.task('lib', function () {
    var sources = gulp.src(input.sources, { base: "." });

    var tests = gulp.src(input.tests, { base: "." });

    return merge(sources, tests)
        //.pipe(sourcemaps.init())
        .pipe(typescript(ts.lib))
        //.pipe(sourcemaps.write(".", { includeContent: false, sourceRoot: ".." }))
        .pipe(gulp.dest(output.lib));
});

gulp.task('package', ['lib'], function () {
    // this task doesn't really depend on 'lib', but gulp-typescript silently fails when both are run at the same time

    var sources = gulp.src(input.sources, { base: "." })
        .pipe(typescript(ts.lib)).js;

    var metadata = gulp.src(input.metadata)
        .pipe(jeditor(function (json) {
            delete json.devDependencies;
            delete json.scripts;
            return json;
        }));

    var files = gulp.src(input.files);

    return merge(sources, metadata, files)
        .pipe(gulp.dest(output.packages));
});

gulp.task('web.ts', function () {
    return gulp.src(input.web)
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
        .pipe(gulp.dest(output.web));
});

gulp.task('web.js', ['web.ts'], function () {
    var mapOptions = {
        includeContent: false,
        sourceRoot: "./",
    };

    return gulp.src(output.web + '/sftp.ts')
        .pipe(sourcemaps.init())
        .pipe(typescript(ts.web)).js
        .pipe(replace(/^var (.*\n){5}var SFTP;\n/g, '//\r\n//\r\n//\r\n//\r\n//\r\n' + 'var SFTP;\r\n'))
        .pipe(sourcemaps.write(".", mapOptions))
        .pipe(gulp.dest(output.web));

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

    return gulp.src(output.web + '/sftp.js')
        .pipe(rename(function (path) { return path.basename = "sftp.min"; }))
        .pipe(uglify(uglifyOptions))
        .pipe(gulp.dest(output.web));
});

gulp.task('build', ['lib', 'package', 'web'], function () {

});

gulp.task('default', ['build'], function () {

});


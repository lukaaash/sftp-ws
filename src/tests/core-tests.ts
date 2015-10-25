import assert = require('assert');
import Path = require('path');
import fs = require('fs');
import SFTP = require('../lib/sftp');
import misc = require('../lib/sftp-misc');

import IItem = SFTP.IItem;

var tmp = Path.resolve("./tmp");

if (!fs.existsSync(tmp)) {
    fs.mkdirSync(tmp);
} else {
    function clear(path: string) {
        var items: string[] = fs.readdirSync(path);
        for (var i = 0; i < items.length; i++) {
            var itemPath = Path.join(path, items[i]);
            //console.log("deleting ", itemPath);

            var stats = fs.statSync(itemPath);

            if (stats.isFile() || stats.isSymbolicLink()) {
                fs.unlinkSync(itemPath);
            } else if (stats.isDirectory()) {
                clear(itemPath);
                fs.rmdirSync(itemPath);
            } else {
                throw "unable to delete " + itemPath;
            }
        }
    };

    clear(tmp);
}

var log;
try {
    //var log = require("bunyan").createLogger({ name: "sftp-ws-tests" });
    log = require("bunyan").createLogger({
        name: "sftp-ws-tests",
        streams: [{
            level: "debug",
            path: Path.join(tmp, "tests.log"),
        }]
    });
} catch (err) {
    if (log) throw err;
    console.warn("Note: To create a log file, do 'npm install bunyan'");
}

(function () {
    function logTestInfo(test) {
        if (log) log.info(test.parent.fullTitle() + " - " + test.title + " -----------------------");
    }

    var iti = it;
    it = <any>function (expectation, assertion: Function) {
        if (assertion.length == 0) {
            (<Function>iti)(expectation, function () {
                logTestInfo(this.test);
                return assertion.call(this);
            });
        } else if (assertion.length == 1) {
            (<Function>iti)(expectation, function (done: MochaDone) {
                logTestInfo(this.test);
                return assertion.call(this, done);
            });
        } else {
            throw new Error("Unsupported assertion");
        }
    };

    it.only = <any>function () { return iti.only.apply(this, arguments); }
    it.skip = <any>function () { return iti.skip.apply(this, arguments); }
    it.timeout = <any>function () { return iti.timeout.apply(this, arguments); }
})();


//require("fs").stat("c:/bagr.txt", <any>9);

fs.writeFileSync(Path.join(tmp, "readme.txt"), "This is a readme file.");
fs.writeFileSync(Path.join(tmp, "sample.txt"), "This is a sample file.");
fs.mkdirSync(Path.join(tmp, "empty"));
fs.mkdirSync(Path.join(tmp, "full"));
fs.mkdirSync(Path.join(tmp, "full/subdir01"));
//fs.symlinkSync(Path.join(tmp, "readme.txt"), Path.join(tmp, "readme2.txt"));

for (var n = 0; n < 200; n++) {
    fs.writeFileSync(Path.join(tmp, "full", "file" + n + "-quite-long-name.txt"), "This is a sample file number " + n);
}

var server = new SFTP.Server({
    log: log,
    port: 3022,
    virtualRoot: tmp,
});

function check(err: Error, done: Function, cb: Function) {
    if (err)
        return done(err);

    try {
        cb();
    } catch (err) {
        done(err);
    }
}

function error(err: Error, done: Function, expectedCode: string, expectedDescription?: string) {
    try {
        assert.ok(err, "Error expected");

        var actualCode = err['code'];
        var actualDescription = err['description'];

        assert.equal(actualCode, expectedCode, "Unexpected error code: " + actualCode);

        if (typeof expectedDescription !== 'undefined')
            assert.equal(actualDescription, expectedDescription, "Unexpected description: " + actualDescription);

        done();
    } catch (err) {
        done(err);
    }
}

function equalStats(attrs: SFTP.IStats, stats: fs.Stats): void {
    assert.equal(attrs.size, stats.size, "size mismatch");
    assert.equal((attrs.mtime.getTime() / 1000) | 0, (stats.mtime.getTime() / 1000) | 0, "mtime mismatch");
    assert.equal((attrs.atime.getTime() / 1000) | 0, (stats.atime.getTime() / 1000) | 0, "atime mismatch");
    assert.equal(attrs.mode, stats.mode, "mode mismatch");
    assert.equal(attrs.uid, stats.uid, "uid mismatch");
    assert.equal(attrs.gid, stats.gid, "gid mismatch");
}

var wrongPath = "No such file or directory";

var getFileName = (function () {
    var n = 1;
    return function () {
        return "file" + (n++) + ".txt";
    }
})();

describe("Basic Tests", function () {
    this.timeout(1000 * 1000);

    var client = <SFTP.Client>null;

    before(done => {
        client = new SFTP.Client();

        client.connect("ws://localhost:3022", {
            log: console,
        });

        client.on("error", err => {
            if (err.message == "Simulated callback error") return;

            // mocha seems to swallow uncought errors
            console.error("Uncought error:", err);
            process.exit(255);
        });

        client.on("ready", done);
    });

    after(done => {
        client.end();
        server.end();
        done();
    });

    it("flags", () => {
        for (var flags = 0; flags < 64; flags++) {
            var aflags = misc.SftpFlags.fromNumber(flags)[0];
            var nflags = misc.SftpFlags.toNumber(aflags);
            var sflags = misc.SftpFlags.fromNumber(nflags)[0];
            assert.equal(aflags, sflags);
        }
    });

    it("callback(fail)", done => {
        var message = "Simulated callback error";
        client.once("error", (err) => {
            assert.equal(err.message, message, "Unexpected error message");
            done();
        });

        client.realpath(".", (err, resolvedPath) => {
            throw new Error(message);
        });
    });

    it("realpath('.')", done => {
        client.realpath(".", (err, resolvedPath) => check(err, done, () => {
            assert.equal("/", resolvedPath, "Unexpected resolved path");
            done();
        }));
    });

    it("realpath(no-path)", done => {
        var name = "dir000/subdir";
        client.realpath(name, (err) => error(err, done, 'ENOENT', wrongPath));
    });

    it("realpath(path)", done => {
        client.realpath("./full/subdir01/../file0-quite-long-name.txt", (err, resolvedPath) => check(err, done, () => {
            assert.equal("/full/file0-quite-long-name.txt", resolvedPath, "Unexpected resolved path");
            done();
        }));
    });

    it("mkdir(no-path)", done => {
        var name = "dir000/subdir";
        client.mkdir(name, (err) => error(err, done, 'ENOENT', wrongPath));
    });

    it("mkdir(path)", done => {
        var name = "dir001";
        client.mkdir(name, (err) => check(err, done, () => {
            var stats = fs.statSync(Path.join(tmp, name));
            assert.ok(stats.isDirectory, "Directory expected");
            done();
        }));
    });

    it("rmdir(no-path)", done => {
        var name = "dir000";

        client.rmdir(name, (err) => error(err, done, 'ENOENT', wrongPath));
    });

    it("rmdir(path)", done => {
        var name = "dir002";
        fs.mkdirSync(Path.join(tmp, name));

        client.rmdir(name, (err) => check(err, done, () => {
            var exists = fs.existsSync(Path.join(tmp, name));
            assert.ok(!exists, "Directory not expected");
            done();
        }));
    });

    it("opendir(no-path)", done => {
        var name = "dir000";

        client.opendir(name, (err, handle) => error(err, done, 'ENOENT', wrongPath));
    });

    it("opendir(path)/readdir/close", done => {
        var name = "full";

        var list = fs.readdirSync(Path.join(tmp, name));
        list.push(".", "..");

        client.opendir(name, (err, handle) => check(err, done, () => {
            assert.ok(handle);
            readdir();

            function readdir() {
                client.readdir(handle, (err, items: IItem[]) => check(err, done, () => {
                    if (items) {
                        assert.ok(Array.isArray(items), "Not an array");

                        for (var i = 0; i < items.length; i++) {
                            var item = items[i];

                            //console.log(JSON.stringify(item));

                            var n = list.indexOf(item.filename);
                            assert.ok(n >= 0, "File '" + item.filename + "' not found");
                            list.splice(n, 1);
                        }

                        readdir();
                    } else {
                        assert.ok(<any>items === false, "Unexpected result");
                        assert.equal(list.length, 0, "Not all items listed");
                        client.close(handle, done);
                    }
                }));
            }
        }));
    });

    it("rename(no-path, path2)", done => {
        var name1 = "dir000/file.txt";
        var name2 = getFileName();

        client.rename(name1, name2, (err) => error(err, done, 'ENOENT', wrongPath));
    });

    it("rename(path1, no-path)", done => {
        var name1 = getFileName();
        var name2 = "dir000/file.txt";
        var body = "This is a file.";

        fs.writeFileSync(Path.join(tmp, name1), body);

        client.rename(name1, name2, (err) => error(err, done, 'ENOENT', wrongPath));
    });

    it("rename(path1, path2)", done => {
        var name1 = getFileName();
        var name2 = getFileName();
        var body = "This is a file.";

        fs.writeFileSync(Path.join(tmp, name1), body);
        assert.ok(!fs.existsSync(Path.join(tmp, name2)), "File should not exist");

        client.rename(name1, name2, (err) => check(err, done, () => {
            assert.ok(!fs.existsSync(Path.join(tmp, name1)), "File should not exist");
            var body2 = fs.readFileSync(Path.join(tmp, name2), { encoding: 'utf8' });
            assert.equal(body2, body, "File content mismatch");
            done();
        }));
    });

    it("unlink(no-path)", done => {
        var name = getFileName();

        client.unlink(name, (err) => error(err, done, 'ENOENT', wrongPath));
    });

    it("unlink(path)", done => {
        var name = getFileName();
        var body = "This is a file.";

        fs.writeFileSync(Path.join(tmp, name), body);

        client.unlink(name, (err) => check(err, done, () => {
            assert.ok(!fs.existsSync(Path.join(tmp, name)), "File should not exist");
            done();
        }));
    });

    it("open(no-path, 'r+')", done => {
        var name = getFileName();

        client.open(name, "r+", (err, handle) => error(err, done, 'ENOENT', wrongPath));
    });

    it("open(path, 'r+')/read/close", done => {
        var name = getFileName();

        var body = "0123456789" + "9876543210" + "00112233445566778899" + "abcdefghijklmnopqrstuvwxyz" + "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        fs.writeFileSync(Path.join(tmp, name), body);

        client.open(name, "r+", {}, (err, handle) => check(err, done, () => {

            var buffer = new Buffer(35);
            buffer.fill(0);

            client.read(handle, buffer, 0, 30, 10, err => check(err, done, () => {
                client.read(handle, buffer, 30, 5, 66, err => check(err, done, () => {
                    client.read(handle, buffer, 10, 3, 40, err => check(err, done, () => {

                        var body2 = buffer.toString();
                        assert.equal(body2, "9876543210" + "abc" + "12233445566778899" + "ABCDE", "File content mismatch");

                        client.read(handle, buffer, 0, 10, 1000, (err, buf, bytesRead) => check(err, done, () => {
                            assert.equal(buf.length, 0, "Unexpected buffer length");
                            assert.equal(bytesRead, 0, "Unexpected bytesRead");

                            client.close(handle, done);
                        }));
                    }));
                }));
            }));
        }));
    });

    it("open(no-path, 'w+')/write/close", done => {
        var name = getFileName();

        client.open(name, "w+", {}, (err, handle) => check(err, done, () => {
            var stats = fs.statSync(Path.join(tmp, name));
            assert.ok(stats.isFile, "Not a file");
            assert.equal(stats.size, 0, "Unexpected file size");

            var buffer = new Buffer("0123456789" + "9876543210" + "00112233445566778899" + "abcdefghijklmnopqrstuvwxyz" + "ABCDEFGHIJKLMNOPQRSTUVWXYZ");

            client.write(handle, buffer, 10, 30, 0, err => check(err, done, () => {
                client.write(handle, buffer, 66, 5, 30, err => check(err, done, () => {
                    client.write(handle, buffer, 40, 3, 10, err => check(err, done, () => {

                        var body2 = fs.readFileSync(Path.join(tmp, name), { encoding: 'utf8' });
                        assert.equal(body2, "9876543210" + "abc" + "12233445566778899" + "ABCDE", "File content mismatch");

                        client.close(handle, done);
                    }));
                }));
            }));
        }));
    });

    it("read(no-handle)", done => {
        try {
            client.read(123, new Buffer(10), 0, 10, 0, done);
            assert.fail("Call should have failed");
        } catch (error) {
            assert.equal(error.message, "Invalid handle");
            done();
        }
    });

    it("write(no-handle)", done => {
        try {
            client.write(123, new Buffer(10), 0, 10, 0, done);
            assert.fail("Call should have failed");
        } catch (error) {
            assert.equal(error.message, "Invalid handle");
            done();
        }
    });

    it("close(no-handle)", done => {
        try {
            client.close(123, done);
            assert.fail("Call should have failed");
        } catch (error) {
            assert.equal(error.message, "Invalid handle");
            done();
        }
    });

    it("fstat(no-handle)", done => {
        try {
            client.fstat(123, done);
            assert.fail("Call should have failed");
        } catch (error) {
            assert.equal(error.message, "Invalid handle");
            done();
        }
    });

    it("stat(no-path)", done => {
        var name = "dir000/file.txt";

        client.stat(name, (err, attrs) => error(err, done, 'ENOENT', wrongPath));
    });

    it("stat(path)", done => {
        var name = "full/file1-quite-long-name.txt";

        var stats = fs.statSync(Path.join(tmp, name));
        //console.log(stats);

        client.stat(name, (err, attrs) => check(err, done, () => {
            //console.log(attrs);
            equalStats(attrs, stats);
            done();
        }));
    });

    it("lstat(no-path)", done => {
        var name = "dir000/file.txt";

        client.lstat(name, (err, attrs) => error(err, done, 'ENOENT', wrongPath));
    });

    it("lstat(path)", done => {
        var name = "full/file1-quite-long-name.txt";

        var stats = fs.statSync(Path.join(tmp, name));
        //console.log(stats);

        client.lstat(name, (err, attrs) => check(err, done, () => {
            //console.log(attrs);
            equalStats(attrs, stats);
            done();
        }));
    });

    it("fstat(closed-handle)", done => {
        var name = "full/file2-quite-long-name.txt";

        client.open(name, "r+", {}, (err, handle) => check(err, done, () => {

            client.close(handle, err => check(err, done, () => {

                client.fstat(handle, (err, attrs) => error(err, done, 'EFAILURE', "Invalid handle"));
            }));
        }));
    });

    it("fstat(handle)", done => {
        var name = "full/file2-quite-long-name.txt";

        client.open(name, "r+", {}, (err, handle) => check(err, done, () => {

            var stats = fs.statSync(Path.join(tmp, name));
            //console.log(stats);

            client.fstat(handle, (err, attrs) => check(err, done, () => {
                //console.log(attrs);
                equalStats(attrs, stats);
                client.close(handle, done);
            }));
        }));
    });

    it("setstat(no-path)", done => {
        var name = "dir000/file.txt";

        client.setstat(name, { size: 12 }, (err) => error(err, done, 'ENOENT', wrongPath));
    });

    it("setstat(path)", done => {
        var name = getFileName();

        var body = "0123456789" + "0123456789" + "0123456789";
        fs.writeFileSync(Path.join(tmp, name), body);

        var mtime = new Date(2014, 8);
        var atime = new Date(2014, 9);

        client.setstat(name, { size: 12, mtime: mtime, atime: atime }, err => check(err, done, () => {

            var stats = fs.statSync(Path.join(tmp, name));
            //console.log(stats);

            assert.equal(stats.size, 12);
            assert.equal(stats.mtime.getTime() / 1000, mtime.getTime() / 1000);
            assert.equal(stats.atime.getTime() / 1000, atime.getTime() / 1000);

            done();
        }));
    });

    it("open(path)/fsetstat", done => {
        var name = getFileName();

        var body = "0123456789" + "0123456789" + "0123456789";
        fs.writeFileSync(Path.join(tmp, name), body);

        var mtime = new Date(2014, 8);
        var atime = new Date(2014, 9);

        client.open(name, "r+", {}, (err, handle) => check(err, done, () => {

            client.fsetstat(handle, { size: 12, mtime: mtime, atime: atime }, err => check(err, done, () => {

                var stats = fs.statSync(Path.join(tmp, name));
                //console.log(stats);

                assert.equal(stats.size, 12);
                assert.equal((stats.mtime.getTime() / 1000) | 0, (mtime.getTime() / 1000) | 0);
                assert.equal((stats.atime.getTime() / 1000) | 0, (atime.getTime() / 1000) | 0);

                client.close(handle, done);
            }));
        }));
    });

    /*
    TODO: (Unix-only)
    symlink(targetpath: string, linkpath: string, callback ?: (err: Error) => any): void;
    readlink(path: string, callback?: (err: Error, linkString: string) => any): void;
    lstat(path: string, callback?: (err: Error, attrs: IStats) => any): void;
    */


});

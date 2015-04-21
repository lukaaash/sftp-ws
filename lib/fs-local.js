var fs = require("fs");
var Path = require("path");
var LocalError = (function () {
    function LocalError(message, isPublic) {
        this.name = "Error";
        this.message = message;
        this.isPublic = (isPublic === true);
    }
    return LocalError;
})();
var LocalFilesystem = (function () {
    function LocalFilesystem() {
        this.isWindows = (process.platform === 'win32');
    }
    LocalFilesystem.prototype.open = function (path, flags, attrs, callback) {
        var mode = typeof attrs === 'object' ? attrs.mode : undefined;
        fs.open(path, flags, mode, function (err, fd) { return callback(err, fd); });
        //LATER: pay attemtion to attrs other than mode (low priority - many SFTP servers ignore these as well)
    };
    LocalFilesystem.prototype.close = function (handle, callback) {
        var err = null;
        if (Array.isArray(handle)) {
            if (handle.closed == true)
                err = new LocalError("Already closed", true);
            else
                handle.closed = true;
        }
        else if (!isNaN(handle)) {
            fs.close(handle, callback);
            return;
        }
        else {
            err = new LocalError("Invalid handle", true);
        }
        if (typeof callback == 'function') {
            process.nextTick(function () {
                callback(err);
            });
        }
    };
    LocalFilesystem.prototype.read = function (handle, buffer, offset, length, position, callback) {
        var initialOffset = offset;
        var totalBytes = 0;
        var read = function () {
            fs.read(handle, buffer, offset, length, position, function (err, bytesRead, b) {
                if (typeof err === 'undefined' || err == null) {
                    offset += bytesRead;
                    length -= bytesRead;
                    totalBytes += bytesRead;
                    if (length > 0 && bytesRead > 0) {
                        read();
                        return;
                    }
                }
                if (typeof callback === 'function')
                    callback(err, totalBytes, buffer.slice(initialOffset, initialOffset + totalBytes));
            });
        };
        read();
    };
    LocalFilesystem.prototype.write = function (handle, buffer, offset, length, position, callback) {
        var write = function () {
            fs.write(handle, buffer, offset, length, position, function (err, bytesWritten, b) {
                if (typeof err === 'undefined' || err == null) {
                    offset += bytesWritten;
                    length -= bytesWritten;
                    if (length > 0) {
                        write();
                        return;
                    }
                }
                if (typeof callback === 'function')
                    callback(err);
            });
        };
        write();
    };
    LocalFilesystem.prototype.lstat = function (path, callback) {
        fs.lstat(path, callback);
    };
    LocalFilesystem.prototype.fstat = function (handle, callback) {
        fs.fstat(handle, callback);
    };
    LocalFilesystem.prototype.run = function (actions, callback) {
        if (actions.length == 0) {
            if (typeof callback == 'function') {
                process.nextTick(callback);
                callback(null);
            }
            return;
        }
        var action = actions.shift();
        var next = function (err) {
            if (typeof err !== 'undefined' && err != null) {
                if (typeof callback == 'function')
                    callback(err);
                return;
            }
            if (actions.length == 0) {
                if (typeof callback == 'function')
                    callback(null);
                return;
            }
            action = actions.shift();
            action(next);
        };
        action(next);
    };
    LocalFilesystem.prototype.setstat = function (path, attrs, callback) {
        var actions = new Array();
        if (!isNaN(attrs.uid) || !isNaN(attrs.gid))
            actions.push(function (next) {
                fs.chown(path, attrs.uid, attrs.gid, function (err) { return next(err); });
            });
        if (!isNaN(attrs.mode))
            actions.push(function (next) {
                fs.chmod(path, attrs.mode, function (err) { return next(err); });
            });
        if (!isNaN(attrs.size))
            actions.push(function (next) {
                fs.truncate(path, attrs.size, function (err) { return next(err); });
            });
        if (typeof attrs.atime === 'object' || typeof attrs.mtime === 'object') {
            //var atime = (typeof attrs.atime.getTime === 'function') ? attrs.atime.getTime() : undefined;
            //var mtime = (typeof attrs.mtime.getTime === 'function') ? attrs.mtime.getTime() : undefined;
            var atime = attrs.atime;
            var mtime = attrs.mtime;
            actions.push(function (next) {
                fs.utimes(path, atime, mtime, function (err) { return next(err); });
            });
        }
        this.run(actions, callback);
    };
    LocalFilesystem.prototype.fsetstat = function (handle, attrs, callback) {
        var actions = new Array();
        if (!isNaN(attrs.uid) || !isNaN(attrs.gid))
            actions.push(function (next) {
                fs.fchown(handle, attrs.uid, attrs.gid, function (err) { return next(err); });
            });
        if (!isNaN(attrs.mode))
            actions.push(function (next) {
                fs.fchmod(handle, attrs.mode, function (err) { return next(err); });
            });
        if (!isNaN(attrs.size))
            actions.push(function (next) {
                fs.ftruncate(handle, attrs.size, function (err) { return next(err); });
            });
        if (typeof attrs.atime === 'object' || typeof attrs.mtime === 'object') {
            //var atime = (typeof attrs.atime.getTime === 'function') ? attrs.atime.getTime() : undefined;
            //var mtime = (typeof attrs.mtime.getTime === 'function') ? attrs.mtime.getTime() : undefined;
            var atime = attrs.atime;
            var mtime = attrs.mtime;
            actions.push(function (next) {
                fs.futimes(handle, atime, mtime, function (err) { return next(err); });
            });
        }
        this.run(actions, callback);
    };
    LocalFilesystem.prototype.opendir = function (path, callback) {
        fs.readdir(path, function (err, files) {
            if (typeof err !== 'undefined' && err != null) {
                files = null;
            }
            else if (Array.isArray(files)) {
                files["path"] = path;
                err = null;
            }
            else {
                files = null;
                err = new LocalError("Unable to read directory", true);
                err.path = path;
            }
            if (typeof callback === 'function')
                callback(err, files);
        });
    };
    LocalFilesystem.prototype.readdir = function (handle, callback) {
        var err = null;
        var path = null;
        if (Array.isArray(handle)) {
            if (handle.closed == true) {
                err = new LocalError("Already closed", true);
            }
            else {
                path = handle.path;
                if (typeof path !== 'string')
                    err = new LocalError("Invalid handle", true);
            }
        }
        else {
            err = new LocalError("Invalid handle", true);
        }
        var items = [];
        if (err == null) {
            var list = handle;
            if (list.length > 0) {
                var next = function () {
                    if (items.length >= 64 || list.length == 0) {
                        if (typeof callback == 'function') {
                            callback(null, (items.length > 0) ? items : false);
                        }
                        return;
                    }
                    var name = list.shift();
                    var itemPath = Path.join(path, name);
                    fs.stat(itemPath, function (err, stats) {
                        if (typeof err !== 'undefined' && err != null) {
                        }
                        else {
                            items.push({ filename: name, stats: stats });
                        }
                        next();
                    });
                };
                next();
                return;
            }
        }
        if (typeof callback == 'function') {
            process.nextTick(function () {
                callback(err, err == null ? false : null);
            });
        }
    };
    LocalFilesystem.prototype.unlink = function (path, callback) {
        fs.unlink(path, callback);
    };
    LocalFilesystem.prototype.mkdir = function (path, attrs, callback) {
        var mode = typeof attrs === 'object' ? attrs.mode : undefined;
        fs.mkdir(path, mode, callback);
        //LATER: pay attemtion to attrs other than mode (low priority - many SFTP servers ignore these as well)
    };
    LocalFilesystem.prototype.rmdir = function (path, callback) {
        fs.rmdir(path, callback);
    };
    LocalFilesystem.prototype.realpath = function (path, callback) {
        fs.realpath(path, callback);
    };
    LocalFilesystem.prototype.stat = function (path, callback) {
        fs.stat(path, callback);
    };
    LocalFilesystem.prototype.rename = function (oldPath, newPath, callback) {
        fs.rename(oldPath, newPath, callback);
    };
    LocalFilesystem.prototype.readlink = function (path, callback) {
        fs.readlink(path, callback);
    };
    LocalFilesystem.prototype.symlink = function (targetpath, linkpath, callback) {
        //TODO: make sure the order is correct (beware - other SFTP client and server vendors are confused as well)
        //TODO: make sure this work on Windows
        fs.symlink(linkpath, targetpath, 'file', callback);
    };
    return LocalFilesystem;
})();
exports.LocalFilesystem = LocalFilesystem;

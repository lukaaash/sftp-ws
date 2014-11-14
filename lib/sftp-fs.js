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
        fs.open(path, flags, mode, function (err, fd) {
            return callback(err, fd);
        });
    };

    LocalFilesystem.prototype.close = function (handle, callback) {
        var err = null;
        if (Array.isArray(handle)) {
            if (handle.closed == true)
                err = new LocalError("Already closed", true);
            else
                handle.closed = true;
        } else if (!isNaN(handle)) {
            fs.close(handle, callback);
            return;
        } else {
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
                fs.chown(path, attrs.uid, attrs.gid, function (err) {
                    return next(err);
                });
            });

        if (!isNaN(attrs.mode))
            actions.push(function (next) {
                fs.chmod(path, attrs.mode, function (err) {
                    return next(err);
                });
            });

        if (typeof attrs.atime === 'object' || typeof attrs.mtime === 'object') {
            var atime = (typeof attrs.atime.getTime === 'function') ? attrs.atime.getTime() : undefined;
            var mtime = (typeof attrs.mtime.getTime === 'function') ? attrs.mtime.getTime() : undefined;
            actions.push(function (next) {
                fs.utimes(path, attrs.atime.getTime(), attrs.mtime.getTime(), function (err) {
                    return next(err);
                });
            });
        }

        if (!isNaN(attrs.size))
            actions.push(function (next) {
                fs.truncate(path, attrs.size, function (err) {
                    return next(err);
                });
            });

        this.run(actions, callback);
    };

    LocalFilesystem.prototype.fsetstat = function (handle, attrs, callback) {
        var actions = new Array();

        if (!isNaN(attrs.uid) || !isNaN(attrs.gid))
            actions.push(function (next) {
                fs.fchown(handle, attrs.uid, attrs.gid, function (err) {
                    return next(err);
                });
            });

        if (!isNaN(attrs.mode))
            actions.push(function (next) {
                fs.fchmod(handle, attrs.mode, function (err) {
                    return next(err);
                });
            });

        if (typeof attrs.atime === 'object' || typeof attrs.mtime === 'object') {
            var atime = (typeof attrs.atime.getTime === 'function') ? attrs.atime.getTime() : undefined;
            var mtime = (typeof attrs.mtime.getTime === 'function') ? attrs.mtime.getTime() : undefined;
            actions.push(function (next) {
                fs.futimes(handle, attrs.atime.getTime(), attrs.mtime.getTime(), function (err) {
                    return next(err);
                });
            });
        }

        if (!isNaN(attrs.size))
            actions.push(function (next) {
                fs.ftruncate(handle, attrs.size, function (err) {
                    return next(err);
                });
            });

        this.run(actions, callback);
    };

    LocalFilesystem.prototype.opendir = function (path, callback) {
        fs.readdir(path, function (err, files) {
            if (typeof err !== 'undefined' && err != null) {
                files = null;
            } else if (Array.isArray(files)) {
                files["path"] = path;
                err = null;
            } else {
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
            } else {
                path = handle.path;
                if (typeof path !== 'string')
                    err = new LocalError("Invalid handle", true);
            }
        } else {
            err = new LocalError("Invalid handle", true);
        }

        var items = [];
        if (err == null) {
            var list = handle;

            if (list.length > 0) {
                var next = function () {
                    if (items.length >= 64 || list.length == 0) {
                        if (typeof callback == 'function') {
                            callback(null, items);
                        }
                        return;
                    }

                    var name = list.shift();
                    var itemPath = Path.join(path, name);

                    fs.stat(itemPath, function (err, stats) {
                        if (typeof err !== 'undefined' && err != null) {
                        } else {
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
                callback(err, items);
            });
        }
    };

    LocalFilesystem.prototype.unlink = function (path, callback) {
        fs.unlink(path, callback);
    };

    LocalFilesystem.prototype.mkdir = function (path, attrs, callback) {
        var mode = typeof attrs === 'object' ? attrs.mode : undefined;
        fs.mkdir(path, mode, callback);
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
        fs.symlink(linkpath, targetpath, 'file', callback);
    };
    return LocalFilesystem;
})();
exports.LocalFilesystem = LocalFilesystem;

var SafeFilesystem = (function () {
    function SafeFilesystem(fs, virtualRootPath, readOnly) {
        this.isSafe = true;
        this.fs = fs;
        this.isWindows = (fs['isWindows'] === true);
        this.root = Path.normalize(virtualRootPath);
        this.handles = [];
        this.readOnly = (readOnly == true);
    }
    SafeFilesystem.prototype.dispose = function () {
        var _this = this;
        if (this.handles == null)
            return;

        this.handles.forEach(function (handle) {
            if (handle != null)
                _this.fs.close(handle, function (err) {
                });
        });

        this.fs = null;
        this.root = null;
        this.handles = null;
    };

    SafeFilesystem.prototype.addHandle = function (value) {
        if (value == null || typeof value === 'undefined')
            throw Error("Invalid handle");

        if (this.handles.length > 64) {
            for (var h = 0; h < this.handles.length; h++) {
                if (this.handles[h] == null) {
                    this.handles[h] = value;
                    return h + 1;
                }
            }
        }

        this.handles.push(value);
        return this.handles.length;
    };

    SafeFilesystem.prototype.removeHandle = function (h) {
        this.handles[h - 1] = null;
    };

    SafeFilesystem.prototype.toLocalHandle = function (h) {
        var value = this.handles[h - 1];
        if (value == null || typeof value === 'undefined')
            return null;

        return value;
    };

    SafeFilesystem.prototype.toVirtualPath = function (fullPath) {
        var i = 0;
        var path;
        while (true) {
            if (i >= this.root.length) {
                path = fullPath.substr(this.root.length);
                break;
            }

            if (i >= fullPath.length) {
                path = "/";
                break;
            }

            if (this.root[i] != fullPath[i]) {
                path = "/";
                break;
            }

            i++;
        }

        if (this.isWindows)
            path = path.replace(/\\/g, '/');

        if (path.length == 0)
            path = "/";

        return path;
    };

    SafeFilesystem.prototype.toRealPath = function (path) {
        path = Path.join("/", path);
        path = Path.join(this.root, path);
        return path;
    };

    SafeFilesystem.prototype.processCallbackPath = function (err, path, callback) {
        if (typeof callback === 'function') {
            if (typeof err !== 'undefined' && err != null) {
                path = undefined;
            } else {
                if (typeof path !== 'undefined' && path != null)
                    path = this.toVirtualPath(path);
            }

            callback(err, path);
        }
    };

    SafeFilesystem.prototype.processCallbackHandle = function (err, handle, callback) {
        if (typeof callback === 'function') {
            if (typeof err !== 'undefined' && err != null) {
                handle = undefined;
            } else {
                if (typeof handle !== 'undefined' && handle != null)
                    handle = this.addHandle(handle);
            }

            callback(err, handle);
        }
    };

    SafeFilesystem.prototype.reportReadOnly = function (callback) {
        if (typeof callback === 'function') {
            var err = new LocalError("Internal server error", true);

            process.nextTick(function () {
                callback(err);
            });
        }
    };

    SafeFilesystem.prototype.isReadOnly = function () {
        return !(this.readOnly === false);
    };

    SafeFilesystem.prototype.open = function (path, flags, attrs, callback) {
        var _this = this;
        if (this.isReadOnly() && flags != "r") {
            this.reportReadOnly();
            return;
        }

        path = this.toRealPath(path);
        this.fs.open(path, flags, attrs, function (err, handle) {
            return _this.processCallbackHandle(err, handle, callback);
        });
    };

    SafeFilesystem.prototype.close = function (handle, callback) {
        var h = handle;
        handle = this.toLocalHandle(h);
        if (handle != null)
            this.removeHandle(h);

        this.fs.close(handle, callback);
    };

    SafeFilesystem.prototype.read = function (handle, buffer, offset, length, position, callback) {
        handle = this.toLocalHandle(handle);
        this.fs.read(handle, buffer, offset, length, position, callback);
    };

    SafeFilesystem.prototype.write = function (handle, buffer, offset, length, position, callback) {
        if (this.isReadOnly()) {
            this.reportReadOnly();
            return;
        }

        handle = this.toLocalHandle(handle);
        this.fs.write(handle, buffer, offset, length, position, callback);
    };

    SafeFilesystem.prototype.lstat = function (path, callback) {
        path = this.toRealPath(path);
        this.fs.lstat(path, callback);
    };

    SafeFilesystem.prototype.fstat = function (handle, callback) {
        handle = this.toLocalHandle(handle);
        this.fs.fstat(handle, callback);
    };

    SafeFilesystem.prototype.setstat = function (path, attrs, callback) {
        if (this.isReadOnly()) {
            this.reportReadOnly();
            return;
        }

        path = this.toRealPath(path);
        this.fs.setstat(path, attrs, callback);
    };

    SafeFilesystem.prototype.fsetstat = function (handle, attrs, callback) {
        if (this.isReadOnly()) {
            this.reportReadOnly();
            return;
        }

        handle = this.toLocalHandle(handle);
        this.fs.fsetstat(handle, attrs, callback);
    };

    SafeFilesystem.prototype.opendir = function (path, callback) {
        var _this = this;
        path = this.toRealPath(path);
        this.fs.opendir(path, function (err, handle) {
            return _this.processCallbackHandle(err, handle, callback);
        });
    };

    SafeFilesystem.prototype.readdir = function (handle, callback) {
        handle = this.toLocalHandle(handle);
        this.fs.readdir(handle, callback);
    };

    SafeFilesystem.prototype.unlink = function (path, callback) {
        if (this.isReadOnly()) {
            this.reportReadOnly();
            return;
        }

        path = this.toRealPath(path);
        this.fs.unlink(path, callback);
    };

    SafeFilesystem.prototype.mkdir = function (path, attrs, callback) {
        if (this.isReadOnly()) {
            this.reportReadOnly();
            return;
        }

        path = this.toRealPath(path);
        this.fs.mkdir(path, attrs, callback);
    };

    SafeFilesystem.prototype.rmdir = function (path, callback) {
        if (this.isReadOnly()) {
            this.reportReadOnly();
            return;
        }

        path = this.toRealPath(path);
        this.fs.rmdir(path, callback);
    };

    SafeFilesystem.prototype.realpath = function (path, callback) {
        var _this = this;
        path = this.toRealPath(path);
        this.fs.realpath(path, function (err, resolvedPath) {
            return _this.processCallbackPath(err, resolvedPath, callback);
        });
    };

    SafeFilesystem.prototype.stat = function (path, callback) {
        path = this.toRealPath(path);
        this.fs.stat(path, callback);
    };

    SafeFilesystem.prototype.rename = function (oldPath, newPath, callback) {
        if (this.isReadOnly()) {
            this.reportReadOnly();
            return;
        }

        oldPath = this.toRealPath(oldPath);
        newPath = this.toRealPath(newPath);
        this.fs.rename(oldPath, newPath, callback);
    };

    SafeFilesystem.prototype.readlink = function (path, callback) {
        var _this = this;
        path = this.toRealPath(path);
        this.fs.readlink(path, function (err, linkString) {
            return _this.processCallbackPath(err, linkString, callback);
        });
    };

    SafeFilesystem.prototype.symlink = function (targetpath, linkpath, callback) {
        if (this.isReadOnly()) {
            this.reportReadOnly();
            return;
        }

        targetpath = this.toRealPath(targetpath);
        linkpath = this.toRealPath(linkpath);
        this.fs.symlink(targetpath, linkpath, callback);
    };
    return SafeFilesystem;
})();
exports.SafeFilesystem = SafeFilesystem;

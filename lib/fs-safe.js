var Path = require("path");
var SafeFilesystem = (function () {
    function SafeFilesystem(fs, virtualRootPath, readOnly) {
        this.isSafe = true;
        this.fs = fs;
        this.isWindows = (fs['isWindows'] === true);
        this.root = Path.normalize(virtualRootPath);
        this.readOnly = (readOnly == true);
    }
    SafeFilesystem.prototype.wrapHandle = function (handle) {
        if (handle == null || typeof handle === 'undefined')
            throw Error("Invalid handle");
        return { handle: handle, owner: this };
    };
    SafeFilesystem.prototype.unwrapHandle = function (handle) {
        if (typeof handle !== 'object')
            return null;
        if (handle.owner != this)
            return null;
        return handle.handle;
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
                //TODO: enhance this to reflect the real path
                path = "/";
                break;
            }
            if (this.root[i] != fullPath[i]) {
                //TODO: enhance this to reflect the real path
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
        if (typeof err !== 'undefined' && err != null) {
            path = undefined;
        }
        else {
            if (typeof path !== 'undefined' && path != null)
                path = this.toVirtualPath(path);
        }
        callback(err, path);
    };
    SafeFilesystem.prototype.processCallbackHandle = function (err, handle, callback) {
        if (typeof err !== 'undefined' && err != null) {
            handle = undefined;
        }
        else {
            if (typeof handle !== 'undefined' && handle != null)
                handle = this.wrapHandle(handle);
        }
        callback(err, handle);
    };
    SafeFilesystem.prototype.reportReadOnly = function (callback) {
        var err = new Error("Internal server error");
        process.nextTick(function () {
            callback(err);
        });
    };
    SafeFilesystem.prototype.isReadOnly = function () {
        return !(this.readOnly === false);
    };
    SafeFilesystem.prototype.open = function (path, flags, attrs, callback) {
        var _this = this;
        if (this.isReadOnly() && flags != "r") {
            this.reportReadOnly(callback);
            return;
        }
        try {
            path = this.toRealPath(path);
            this.fs.open(path, flags, attrs, function (err, handle) { return _this.processCallbackHandle(err, handle, callback); });
        }
        catch (err) {
            callback(err, null);
        }
    };
    SafeFilesystem.prototype.close = function (handle, callback) {
        handle = this.unwrapHandle(handle);
        try {
            this.fs.close(handle, callback);
        }
        catch (err) {
            callback(err);
        }
    };
    SafeFilesystem.prototype.read = function (handle, buffer, offset, length, position, callback) {
        handle = this.unwrapHandle(handle);
        try {
            this.fs.read(handle, buffer, offset, length, position, callback);
        }
        catch (err) {
            callback(err, null, null);
        }
    };
    SafeFilesystem.prototype.write = function (handle, buffer, offset, length, position, callback) {
        if (this.isReadOnly()) {
            this.reportReadOnly(callback);
            return;
        }
        handle = this.unwrapHandle(handle);
        try {
            this.fs.write(handle, buffer, offset, length, position, callback);
        }
        catch (err) {
            callback(err);
        }
    };
    SafeFilesystem.prototype.lstat = function (path, callback) {
        path = this.toRealPath(path);
        try {
            this.fs.lstat(path, callback);
        }
        catch (err) {
            callback(err, null);
        }
    };
    SafeFilesystem.prototype.fstat = function (handle, callback) {
        handle = this.unwrapHandle(handle);
        try {
            this.fs.fstat(handle, callback);
        }
        catch (err) {
            callback(err, null);
        }
    };
    SafeFilesystem.prototype.setstat = function (path, attrs, callback) {
        if (this.isReadOnly()) {
            this.reportReadOnly(callback);
            return;
        }
        path = this.toRealPath(path);
        try {
            this.fs.setstat(path, attrs, callback);
        }
        catch (err) {
            callback(err);
        }
    };
    SafeFilesystem.prototype.fsetstat = function (handle, attrs, callback) {
        if (this.isReadOnly()) {
            this.reportReadOnly(callback);
            return;
        }
        handle = this.unwrapHandle(handle);
        try {
            this.fs.fsetstat(handle, attrs, callback);
        }
        catch (err) {
            callback(err);
        }
    };
    SafeFilesystem.prototype.opendir = function (path, callback) {
        var _this = this;
        path = this.toRealPath(path);
        try {
            this.fs.opendir(path, function (err, handle) { return _this.processCallbackHandle(err, handle, callback); });
        }
        catch (err) {
            callback(err, null);
        }
    };
    SafeFilesystem.prototype.readdir = function (handle, callback) {
        handle = this.unwrapHandle(handle);
        try {
            this.fs.readdir(handle, callback);
        }
        catch (err) {
            callback(err, null);
        }
    };
    SafeFilesystem.prototype.unlink = function (path, callback) {
        if (this.isReadOnly()) {
            this.reportReadOnly(callback);
            return;
        }
        path = this.toRealPath(path);
        try {
            this.fs.unlink(path, callback);
        }
        catch (err) {
            callback(err);
        }
    };
    SafeFilesystem.prototype.mkdir = function (path, attrs, callback) {
        if (this.isReadOnly()) {
            this.reportReadOnly(callback);
            return;
        }
        path = this.toRealPath(path);
        try {
            this.fs.mkdir(path, attrs, callback);
        }
        catch (err) {
            callback(err);
        }
    };
    SafeFilesystem.prototype.rmdir = function (path, callback) {
        if (this.isReadOnly()) {
            this.reportReadOnly(callback);
            return;
        }
        path = this.toRealPath(path);
        try {
            this.fs.rmdir(path, callback);
        }
        catch (err) {
            callback(err);
        }
    };
    SafeFilesystem.prototype.realpath = function (path, callback) {
        var _this = this;
        path = this.toRealPath(path);
        try {
            this.fs.realpath(path, function (err, resolvedPath) { return _this.processCallbackPath(err, resolvedPath, callback); });
        }
        catch (err) {
            callback(err, null);
        }
    };
    SafeFilesystem.prototype.stat = function (path, callback) {
        path = this.toRealPath(path);
        try {
            this.fs.stat(path, callback);
        }
        catch (err) {
            callback(err, null);
        }
    };
    SafeFilesystem.prototype.rename = function (oldPath, newPath, callback) {
        if (this.isReadOnly()) {
            this.reportReadOnly(callback);
            return;
        }
        oldPath = this.toRealPath(oldPath);
        newPath = this.toRealPath(newPath);
        try {
            this.fs.rename(oldPath, newPath, callback);
        }
        catch (err) {
            callback(err);
        }
    };
    SafeFilesystem.prototype.readlink = function (path, callback) {
        var _this = this;
        path = this.toRealPath(path);
        try {
            this.fs.readlink(path, function (err, linkString) { return _this.processCallbackPath(err, linkString, callback); });
        }
        catch (err) {
            callback(err, null);
        }
    };
    SafeFilesystem.prototype.symlink = function (targetpath, linkpath, callback) {
        if (this.isReadOnly()) {
            this.reportReadOnly(callback);
            return;
        }
        targetpath = this.toRealPath(targetpath);
        linkpath = this.toRealPath(linkpath);
        try {
            this.fs.symlink(targetpath, linkpath, callback);
        }
        catch (err) {
            callback(err);
        }
    };
    return SafeFilesystem;
})();
exports.SafeFilesystem = SafeFilesystem;

var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var events = require("events"); //WEB: /// <reference path="misc-web.ts" />
var EventEmitter = events.EventEmitter;
var FilesystemPlus = (function (_super) {
    __extends(FilesystemPlus, _super);
    function FilesystemPlus(fs) {
        _super.call(this);
        this._fs = fs;
    }
    FilesystemPlus.prototype.wrapCallback = function (callback) {
        var _this = this;
        if (typeof callback !== 'function') {
            // use dummy callback to prevent having to check this later
            return function () {
            };
        }
        else {
            return function () {
                try {
                    callback.apply(_this, arguments);
                }
                catch (error) {
                    _this.emit("error", error);
                }
            };
        }
    };
    FilesystemPlus.prototype.on = function (event, listener) {
        return _super.prototype.on.call(this, event, listener);
    };
    FilesystemPlus.prototype.once = function (event, listener) {
        return _super.prototype.once.call(this, event, listener); //WEB: // removed
    }; //WEB: // removed
    FilesystemPlus.prototype.addListener = function (event, listener) {
        return _super.prototype.addListener.call(this, event, listener);
    };
    FilesystemPlus.prototype.open = function (path, flags, attrs, callback) {
        if (typeof attrs === 'function' && typeof callback === 'undefined') {
            callback = attrs;
            attrs = null;
        }
        callback = this.wrapCallback(callback);
        this._fs.open(path, flags, attrs, callback);
    };
    FilesystemPlus.prototype.close = function (handle, callback) {
        callback = this.wrapCallback(callback);
        this._fs.close(handle, callback);
    };
    FilesystemPlus.prototype.read = function (handle, buffer, offset, length, position, callback) {
        callback = this.wrapCallback(callback);
        this._fs.read(handle, buffer, offset, length, position, callback);
    };
    FilesystemPlus.prototype.write = function (handle, buffer, offset, length, position, callback) {
        callback = this.wrapCallback(callback);
        this._fs.write(handle, buffer, offset, length, position, callback);
    };
    FilesystemPlus.prototype.lstat = function (path, callback) {
        callback = this.wrapCallback(callback);
        this._fs.lstat(path, callback);
    };
    FilesystemPlus.prototype.fstat = function (handle, callback) {
        callback = this.wrapCallback(callback);
        this._fs.fstat(handle, callback);
    };
    FilesystemPlus.prototype.setstat = function (path, attrs, callback) {
        callback = this.wrapCallback(callback);
        this._fs.setstat(path, attrs, callback);
    };
    FilesystemPlus.prototype.fsetstat = function (handle, attrs, callback) {
        callback = this.wrapCallback(callback);
        this._fs.fsetstat(handle, attrs, callback);
    };
    FilesystemPlus.prototype.opendir = function (path, callback) {
        callback = this.wrapCallback(callback);
        this._fs.opendir(path, callback);
    };
    FilesystemPlus.prototype.readdir = function (handle, callback) {
        var _this = this;
        callback = this.wrapCallback(callback);
        if (typeof handle !== 'string')
            return this._fs.readdir(handle, callback);
        var path = handle;
        var list = [];
        var next = function (err, items) {
            if (err != null) {
                _this.close(handle);
                callback(err, list);
                return;
            }
            if (items === false) {
                _this.close(handle, function (err) {
                    callback(err, list);
                });
                return;
            }
            list = list.concat(items);
            _this._fs.readdir(handle, next);
        };
        this.opendir(path, function (err, h) {
            if (err != null) {
                callback(err, null);
                return;
            }
            handle = h;
            next(null, []);
        });
    };
    FilesystemPlus.prototype.unlink = function (path, callback) {
        callback = this.wrapCallback(callback);
        this._fs.unlink(path, callback);
    };
    FilesystemPlus.prototype.mkdir = function (path, attrs, callback) {
        if (typeof attrs === 'function' && typeof callback === 'undefined') {
            callback = attrs;
            attrs = null;
        }
        callback = this.wrapCallback(callback);
        this._fs.mkdir(path, attrs, callback);
    };
    FilesystemPlus.prototype.rmdir = function (path, callback) {
        callback = this.wrapCallback(callback);
        this._fs.rmdir(path, callback);
    };
    FilesystemPlus.prototype.realpath = function (path, callback) {
        callback = this.wrapCallback(callback);
        this._fs.realpath(path, callback);
    };
    FilesystemPlus.prototype.stat = function (path, callback) {
        callback = this.wrapCallback(callback);
        this._fs.stat(path, callback);
    };
    FilesystemPlus.prototype.rename = function (oldPath, newPath, callback) {
        callback = this.wrapCallback(callback);
        this._fs.rename(oldPath, newPath, callback);
    };
    FilesystemPlus.prototype.readlink = function (path, callback) {
        callback = this.wrapCallback(callback);
        this._fs.readlink(path, callback);
    };
    FilesystemPlus.prototype.symlink = function (targetpath, linkpath, callback) {
        callback = this.wrapCallback(callback);
        this._fs.symlink(targetpath, linkpath);
    };
    return FilesystemPlus;
})(EventEmitter);
exports.FilesystemPlus = FilesystemPlus;

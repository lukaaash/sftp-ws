var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var packet = require("./sftp-packet");
var misc = require("./sftp-misc");
var safe = require("./fs-safe");
var enums = require("./sftp-enums");
var channel = require("./channel");
var Channel = channel.Channel;
var SftpPacketWriter = packet.SftpPacketWriter;
var SftpPacketReader = packet.SftpPacketReader;
var SftpItem = misc.SftpItem;
var SftpAttributes = misc.SftpAttributes;
var SftpStatus = misc.SftpStatus;
var SftpFlags = misc.SftpFlags;
var SftpResponse = (function (_super) {
    __extends(SftpResponse, _super);
    function SftpResponse() {
        _super.call(this, 34000);
    }
    return SftpResponse;
})(SftpPacketWriter);
var SftpHandleInfo = (function () {
    function SftpHandleInfo(h) {
        this.h = h;
        this.items = null;
        this.locked = false;
        this.tasks = [];
    }
    return SftpHandleInfo;
})();
var SftpServerSessionCore = (function () {
    function SftpServerSessionCore(host, fs) {
        this._fs = fs;
        this._host = host;
        this._handles = new Array(SftpServerSessionCore.MAX_HANDLE_COUNT + 1);
        this.nextHandle = 1;
    }
    SftpServerSessionCore.prototype.send = function (response) {
        // send packet
        var packet = response.finish();
        this._host.send(packet);
        // start next task
        if (typeof response.handleInfo === 'object') {
            this.processNext(response.handleInfo);
        }
    };
    SftpServerSessionCore.prototype.sendStatus = function (response, code, message) {
        SftpStatus.write(response, code, message);
        this.send(response);
    };
    SftpServerSessionCore.prototype.sendError = function (response, err) {
        var log = this._host.log;
        if (typeof log === 'object' && typeof log.error === 'function')
            log.error(err);
        SftpStatus.writeError(response, err);
        this.send(response);
    };
    SftpServerSessionCore.prototype.sendIfError = function (response, err) {
        if (err == null || typeof err === 'undefined')
            return false;
        this.sendError(response, err);
        return true;
    };
    SftpServerSessionCore.prototype.sendSuccess = function (response, err) {
        if (this.sendIfError(response, err))
            return;
        SftpStatus.writeSuccess(response);
        this.send(response);
    };
    SftpServerSessionCore.prototype.sendAttribs = function (response, err, stats) {
        if (this.sendIfError(response, err))
            return;
        response.type = 105 /* ATTRS */;
        response.start();
        var attr = new SftpAttributes();
        attr.from(stats);
        attr.write(response);
        this.send(response);
    };
    SftpServerSessionCore.prototype.sendHandle = function (response, handleInfo) {
        response.type = 102 /* HANDLE */;
        response.start();
        response.writeInt32(4);
        response.writeInt32(handleInfo.h);
        this.send(response);
    };
    SftpServerSessionCore.prototype.sendPath = function (response, err, path) {
        if (this.sendIfError(response, err))
            return;
        response.type = 104 /* NAME */;
        response.start();
        response.writeInt32(1);
        response.writeString(path);
        response.writeString("");
        response.writeInt32(0);
        this.send(response);
    };
    SftpServerSessionCore.prototype.readHandleInfo = function (request) {
        // read a 4-byte handle
        if (request.readInt32() != 4)
            return null;
        var h = request.readInt32();
        var handleInfo = this._handles[h];
        if (typeof handleInfo !== 'object')
            return null;
        return handleInfo;
    };
    SftpServerSessionCore.prototype.createHandleInfo = function () {
        var h = this.nextHandle;
        var max = SftpServerSessionCore.MAX_HANDLE_COUNT;
        for (var i = 0; i < max; i++) {
            var next = (h % max) + 1; // 1..MAX_HANDLE_COUNT
            var handleInfo = this._handles[h];
            if (typeof handleInfo === 'undefined') {
                var handleInfo = new SftpHandleInfo(h);
                this._handles[h] = handleInfo;
                this.nextHandle = next;
                return handleInfo;
            }
            h = next;
        }
        return null;
    };
    SftpServerSessionCore.prototype.deleteHandleInfo = function (handleInfo) {
        var h = handleInfo.h;
        var handleInfo = this._handles[h];
        if (typeof handleInfo !== 'object')
            throw new Error("Handle not found");
        delete this._handles[h];
    };
    SftpServerSessionCore.prototype.end = function () {
        this._host.close();
    };
    SftpServerSessionCore.prototype._end = function () {
        var _this = this;
        if (typeof this._fs === 'undefined')
            return;
        // close all handles
        this._handles.forEach(function (handleInfo) {
            _this._fs.close(handleInfo.handle, function (err) {
            });
        });
        delete this._fs;
    };
    SftpServerSessionCore.prototype._process = function (data) {
        var _this = this;
        var request = new SftpPacketReader(data);
        var response = new SftpResponse();
        if (request.type == 1 /* INIT */) {
            var version = request.readInt32();
            response.type = 2 /* VERSION */;
            response.start();
            response.writeInt32(3);
            this.send(response);
            return;
        }
        response.id = request.id;
        var handleInfo;
        switch (request.type) {
            case 4 /* CLOSE */:
            case 5 /* READ */:
            case 6 /* WRITE */:
            case 8 /* FSTAT */:
            case 10 /* FSETSTAT */:
            case 12 /* READDIR */:
                handleInfo = this.readHandleInfo(request);
                if (handleInfo == null) {
                    this.sendStatus(response, 4 /* FAILURE */, "Invalid handle");
                    return;
                }
                response.handleInfo = handleInfo;
                break;
            default:
                handleInfo = null;
                break;
        }
        if (handleInfo == null) {
            this.processRequest(request, response, null);
        }
        else if (!handleInfo.locked) {
            handleInfo.locked = true;
            this.processRequest(request, response, handleInfo);
        }
        else {
            handleInfo.tasks.push(function () { return _this.processRequest(request, response, handleInfo); });
        }
    };
    SftpServerSessionCore.prototype.processNext = function (handleInfo) {
        if (handleInfo.tasks.length > 0) {
            var task = handleInfo.tasks.pop();
            task();
        }
        else {
            handleInfo.locked = false;
        }
    };
    SftpServerSessionCore.prototype.processRequest = function (request, response, handleInfo) {
        var _this = this;
        var fs = this._fs;
        if (typeof fs === 'undefined') {
            // already disposed
            return;
        }
        try {
            if (request.length > 66000) {
                this.sendStatus(response, 5 /* BAD_MESSAGE */, "Packet too long");
                return;
            }
            switch (request.type) {
                case 3 /* OPEN */:
                    var path = request.readString();
                    var pflags = request.readInt32();
                    var attrs = new SftpAttributes(request);
                    var modes = SftpFlags.fromFlags(pflags);
                    if (modes.length == 0) {
                        this.sendStatus(response, 4 /* FAILURE */, "Unsupported flags");
                        return;
                    }
                    handleInfo = this.createHandleInfo();
                    if (handleInfo == null) {
                        this.sendStatus(response, 4 /* FAILURE */, "Too many open handles");
                        return;
                    }
                    var openFile = function () {
                        var mode = modes.shift();
                        fs.open(path, mode, attrs, function (err, handle) {
                            if (_this.sendIfError(response, err)) {
                                _this.deleteHandleInfo(handleInfo);
                                return;
                            }
                            if (modes.length == 0) {
                                handleInfo.handle = handle;
                                _this.sendHandle(response, handleInfo);
                                return;
                            }
                            fs.close(handle, function (err) {
                                if (_this.sendIfError(response, err)) {
                                    _this.deleteHandleInfo(handleInfo);
                                    return;
                                }
                                openFile();
                            });
                        });
                    };
                    openFile();
                    return;
                case 4 /* CLOSE */:
                    this.deleteHandleInfo(handleInfo);
                    fs.close(handleInfo.handle, function (err) { return _this.sendSuccess(response, err); });
                    return;
                case 5 /* READ */:
                    var position = request.readInt64();
                    var count = request.readInt32();
                    if (count > 0x8000)
                        count = 0x8000;
                    response.type = 103 /* DATA */;
                    response.start();
                    var offset = response.position + 4;
                    response.check(4 + count);
                    fs.read(handleInfo.handle, response.buffer, offset, count, position, function (err, bytesRead, b) {
                        if (_this.sendIfError(response, err))
                            return;
                        response.writeInt32(bytesRead);
                        response.skip(bytesRead);
                        _this.send(response);
                    });
                    return;
                case 6 /* WRITE */:
                    var position = request.readInt64();
                    var count = request.readInt32();
                    var offset = request.position;
                    request.skip(count);
                    fs.write(handleInfo.handle, request.buffer, offset, count, position, function (err) { return _this.sendSuccess(response, err); });
                    return;
                case 7 /* LSTAT */:
                    var path = request.readString();
                    fs.lstat(path, function (err, stats) { return _this.sendAttribs(response, err, stats); });
                    return;
                case 8 /* FSTAT */:
                    fs.fstat(handleInfo.handle, function (err, stats) { return _this.sendAttribs(response, err, stats); });
                    return;
                case 9 /* SETSTAT */:
                    var path = request.readString();
                    var attrs = new SftpAttributes(request);
                    fs.setstat(path, attrs, function (err) { return _this.sendSuccess(response, err); });
                    return;
                case 10 /* FSETSTAT */:
                    var attrs = new SftpAttributes(request);
                    fs.fsetstat(handleInfo.handle, attrs, function (err) { return _this.sendSuccess(response, err); });
                    return;
                case 11 /* OPENDIR */:
                    var path = request.readString();
                    handleInfo = this.createHandleInfo();
                    if (handleInfo == null) {
                        this.sendStatus(response, 4 /* FAILURE */, "Too many open handles");
                        return;
                    }
                    fs.opendir(path, function (err, handle) {
                        if (_this.sendIfError(response, err)) {
                            _this.deleteHandleInfo(handleInfo);
                            return;
                        }
                        handleInfo.handle = handle;
                        _this.sendHandle(response, handleInfo);
                    });
                    return;
                case 12 /* READDIR */:
                    response.type = 104 /* NAME */;
                    response.start();
                    var count = 0;
                    var offset = response.position;
                    response.writeInt32(0);
                    var done = function () {
                        if (count == 0) {
                            _this.sendStatus(response, 1 /* EOF */, "EOF");
                        }
                        else {
                            response.buffer.writeInt32BE(count, offset, true);
                            _this.send(response);
                        }
                    };
                    var next = function (items) {
                        if (items === false) {
                            done();
                            return;
                        }
                        var list = items;
                        while (list.length > 0) {
                            var it = list.shift();
                            var item = new SftpItem(it.filename, it.stats);
                            item.write(response);
                            count++;
                            if (response.position > 0x7000) {
                                handleInfo.items = list;
                                done();
                                return;
                            }
                        }
                        readdir();
                    };
                    var readdir = function () {
                        fs.readdir(handleInfo.handle, function (err, items) {
                            if (_this.sendIfError(response, err))
                                return;
                            next(items);
                        });
                    };
                    var previous = handleInfo.items;
                    if (previous != null && previous.length > 0) {
                        handleInfo.items = [];
                        next(previous);
                        return;
                    }
                    readdir();
                    return;
                case 13 /* REMOVE */:
                    var path = request.readString();
                    fs.unlink(path, function (err) { return _this.sendSuccess(response, err); });
                    return;
                case 14 /* MKDIR */:
                    var path = request.readString();
                    var attrs = new SftpAttributes(request);
                    fs.mkdir(path, attrs, function (err) { return _this.sendSuccess(response, err); });
                    return;
                case 15 /* RMDIR */:
                    var path = request.readString();
                    fs.rmdir(path, function (err) { return _this.sendSuccess(response, err); });
                    return;
                case 16 /* REALPATH */:
                    var path = request.readString();
                    fs.realpath(path, function (err, resolvedPath) { return _this.sendPath(response, err, resolvedPath); });
                    return;
                case 17 /* STAT */:
                    var path = request.readString();
                    fs.stat(path, function (err, stats) { return _this.sendAttribs(response, err, stats); });
                    return;
                case 18 /* RENAME */:
                    var oldpath = request.readString();
                    var newpath = request.readString();
                    fs.rename(oldpath, newpath, function (err) { return _this.sendSuccess(response, err); });
                    return;
                case 19 /* READLINK */:
                    var path = request.readString();
                    fs.readlink(path, function (err, linkString) { return _this.sendPath(response, err, linkString); });
                    return;
                case 20 /* SYMLINK */:
                    var linkpath = request.readString();
                    var targetpath = request.readString();
                    fs.symlink(targetpath, linkpath, function (err) { return _this.sendSuccess(response, err); });
                    return;
                default:
                    this.sendStatus(response, 8 /* OP_UNSUPPORTED */, "Not supported");
            }
        }
        catch (err) {
            this.sendError(response, err);
        }
    };
    SftpServerSessionCore.MAX_HANDLE_COUNT = 512;
    return SftpServerSessionCore;
})();
exports.SftpServerSessionCore = SftpServerSessionCore;
var SftpServerSession = (function (_super) {
    __extends(SftpServerSession, _super);
    function SftpServerSession(ws, fs, log) {
        var channel = new Channel(this, ws);
        channel.log = log;
        _super.call(this, channel, fs);
        channel.start();
    }
    return SftpServerSession;
})(SftpServerSessionCore);
exports.SftpServerSession = SftpServerSession;

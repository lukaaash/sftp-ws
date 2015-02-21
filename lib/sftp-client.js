var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var packet = require("./sftp-packet");
var misc = require("./sftp-misc");
var enums = require("./sftp-enums");
var plus = require("./fs-plus");
var channel = require("./channel");
var FilesystemPlus = plus.FilesystemPlus;
var Channel = channel.Channel;
var SftpPacket = packet.SftpPacket;
var SftpPacketWriter = packet.SftpPacketWriter;
var SftpPacketReader = packet.SftpPacketReader;
var SftpFlags = misc.SftpFlags;
var SftpAttributes = misc.SftpAttributes;
var SftpItem = misc.SftpItem;
var SftpClientCore = (function () {
    function SftpClientCore() {
        this._host = null;
        this._id = null;
        this._ready = false;
        this._requests = [];
        this._maxWriteBlockLength = 32 * 1024;
        this._maxReadBlockLength = 256 * 1024;
    }
    SftpClientCore.prototype.getRequest = function (type) {
        var request = new SftpPacketWriter(this._maxWriteBlockLength + 1024); //TODO: cache buffers
        request.type = type;
        request.id = this._id;
        if (type == 1 /* INIT */) {
            if (this._id != null)
                throw new Error("Already initialized");
            this._id = 1;
        }
        else {
            this._id = (this._id + 1) & 0xFFFFFFFF;
        }
        request.start();
        return request;
    };
    SftpClientCore.prototype.writeStats = function (packet, attrs) {
        var pattrs = new SftpAttributes();
        pattrs.from(attrs);
        pattrs.write(packet);
    };
    SftpClientCore.prototype.execute = function (request, callback, responseParser) {
        if (typeof callback !== 'function') {
            // use dummy callback to prevent having to check this later
            callback = function () {
            };
        }
        if (typeof this._requests[request.id] !== 'undefined')
            throw new Error("Duplicate request");
        var packet = request.finish();
        this._host.send(packet);
        this._requests[request.id] = { callback: callback, responseParser: responseParser };
    };
    SftpClientCore.prototype._init = function (host, callback) {
        var _this = this;
        this._host = host;
        var request = this.getRequest(1 /* INIT */);
        request.writeInt32(3); // SFTPv3
        this.execute(request, callback, function (response, cb) {
            if (response.type != 2 /* VERSION */) {
                callback(new Error("Protocol violation"));
                return;
            }
            var version = response.readInt32();
            if (version != 3) {
                callback(new Error("Protocol violation"));
                return;
            }
            _this._ready = true;
            callback(null);
        });
    };
    SftpClientCore.prototype._process = function (packet) {
        var response = new SftpPacketReader(packet);
        var request = this._requests[response.id];
        if (typeof request === 'undefined')
            throw new Error("Unknown response ID");
        delete this._requests[response.id];
        request.responseParser.call(this, response, request.callback);
    };
    SftpClientCore.prototype._end = function () {
    };
    SftpClientCore.prototype.end = function () {
        this._host.close();
    };
    SftpClientCore.prototype.open = function (path, flags, attrs, callback) {
        path = this.toPath(path, 'path');
        var request = this.getRequest(3 /* OPEN */);
        request.writeString(path);
        request.writeInt32(SftpFlags.toFlags(flags));
        this.writeStats(request, attrs);
        this.execute(request, callback, this.parseHandle);
    };
    SftpClientCore.prototype.close = function (handle, callback) {
        handle = this.toHandle(handle);
        var request = this.getRequest(4 /* CLOSE */);
        request.writeData(handle);
        this.execute(request, callback, this.parseStatus);
    };
    SftpClientCore.prototype.read = function (handle, buffer, offset, length, position, callback) {
        var _this = this;
        handle = this.toHandle(handle);
        this.checkBuffer(buffer, offset, length);
        this.checkPosition(position);
        // make sure the length is within reasonable limits
        if (length > this._maxReadBlockLength)
            length = this._maxReadBlockLength;
        var request = this.getRequest(5 /* READ */);
        request.writeData(handle);
        request.writeInt64(position);
        request.writeInt32(length);
        this.execute(request, callback, function (response, cb) { return _this.parseData(response, cb, buffer, offset, length); });
    };
    SftpClientCore.prototype.write = function (handle, buffer, offset, length, position, callback) {
        handle = this.toHandle(handle);
        this.checkBuffer(buffer, offset, length);
        this.checkPosition(position);
        if (length > this._maxWriteBlockLength)
            throw new Error("Length exceeds maximum allowed data block length");
        var request = this.getRequest(6 /* WRITE */);
        request.writeData(handle);
        request.writeInt64(position);
        request.writeData(buffer, offset, offset + length);
        this.execute(request, callback, this.parseStatus);
    };
    SftpClientCore.prototype.lstat = function (path, callback) {
        path = this.toPath(path, 'path');
        this.command(7 /* LSTAT */, [path], callback, this.parseAttribs);
    };
    SftpClientCore.prototype.fstat = function (handle, callback) {
        handle = this.toHandle(handle);
        var request = this.getRequest(8 /* FSTAT */);
        request.writeData(handle);
        this.execute(request, callback, this.parseAttribs);
    };
    SftpClientCore.prototype.setstat = function (path, attrs, callback) {
        path = this.toPath(path, 'path');
        var request = this.getRequest(9 /* SETSTAT */);
        request.writeString(path);
        this.writeStats(request, attrs);
        this.execute(request, callback, this.parseStatus);
    };
    SftpClientCore.prototype.fsetstat = function (handle, attrs, callback) {
        handle = this.toHandle(handle);
        var request = this.getRequest(10 /* FSETSTAT */);
        request.writeData(handle);
        this.writeStats(request, attrs);
        this.execute(request, callback, this.parseStatus);
    };
    SftpClientCore.prototype.opendir = function (path, callback) {
        path = this.toPath(path, 'path');
        this.command(11 /* OPENDIR */, [path], callback, this.parseHandle);
    };
    SftpClientCore.prototype.readdir = function (handle, callback) {
        handle = this.toHandle(handle);
        var request = this.getRequest(12 /* READDIR */);
        request.writeData(handle);
        this.execute(request, callback, this.parseItems);
    };
    SftpClientCore.prototype.unlink = function (path, callback) {
        path = this.toPath(path, 'path');
        this.command(13 /* REMOVE */, [path], callback, this.parseStatus);
    };
    SftpClientCore.prototype.mkdir = function (path, attrs, callback) {
        path = this.toPath(path, 'path');
        var request = this.getRequest(14 /* MKDIR */);
        request.writeString(path);
        this.writeStats(request, attrs);
        this.execute(request, callback, this.parseStatus);
    };
    SftpClientCore.prototype.rmdir = function (path, callback) {
        path = this.toPath(path, 'path');
        this.command(15 /* RMDIR */, [path], callback, this.parseStatus);
    };
    SftpClientCore.prototype.realpath = function (path, callback) {
        path = this.toPath(path, 'path');
        this.command(16 /* REALPATH */, [path], callback, this.parsePath);
    };
    SftpClientCore.prototype.stat = function (path, callback) {
        path = this.toPath(path, 'path');
        this.command(17 /* STAT */, [path], callback, this.parseAttribs);
    };
    SftpClientCore.prototype.rename = function (oldPath, newPath, callback) {
        oldPath = this.toPath(oldPath, 'oldPath');
        newPath = this.toPath(newPath, 'newPath');
        this.command(18 /* RENAME */, [oldPath, newPath], callback, this.parseStatus);
    };
    SftpClientCore.prototype.readlink = function (path, callback) {
        path = this.toPath(path, 'path');
        this.command(19 /* READLINK */, [path], callback, this.parsePath);
    };
    SftpClientCore.prototype.symlink = function (targetPath, linkPath, callback) {
        targetPath = this.toPath(targetPath, 'targetPath');
        linkPath = this.toPath(linkPath, 'linkPath');
        this.command(20 /* SYMLINK */, [targetPath, linkPath], callback, this.parseStatus);
    };
    SftpClientCore.prototype.toHandle = function (handle) {
        if (typeof handle === 'object') {
            if (SftpPacket.isBuffer(handle._handle) && handle._this == this)
                return handle._handle;
        }
        else if (handle == null || typeof handle === 'undefined') {
            throw new Error("Missing handle");
        }
        throw new Error("Invalid handle");
    };
    SftpClientCore.prototype.toPath = function (path, name) {
        if (typeof path !== 'string') {
            if (path == null || typeof path === 'undefined')
                throw new Error("Missing " + name);
            if (typeof path === 'function')
                throw new Error("Invalid " + name);
            path = new String(path);
        }
        if (path.length == 0)
            throw new Error("Empty " + name);
        return path;
    };
    SftpClientCore.prototype.checkBuffer = function (buffer, offset, length) {
        if (!SftpPacket.isBuffer(buffer))
            throw new Error("Invalid buffer");
        if (typeof offset !== 'number' || offset < 0)
            throw new Error("Invalid offset");
        if (typeof length !== 'number' || length < 0)
            throw new Error("Invalid length");
        if ((offset + length) > buffer.length)
            throw new Error("Offset or length is out of bands");
    };
    SftpClientCore.prototype.checkPosition = function (position) {
        if (typeof position !== 'number' || position < 0 || position > 0x7FFFFFFFFFFFFFFF)
            throw new Error("Invalid position");
    };
    SftpClientCore.prototype.command = function (command, args, callback, responseParser) {
        var request = this.getRequest(command);
        for (var i = 0; i < args.length; i++) {
            request.writeString(args[i]);
        }
        this.execute(request, callback, responseParser);
    };
    SftpClientCore.prototype.readStatus = function (response) {
        var code = response.readInt32();
        var message = response.readString();
        if (code == 0 /* OK */)
            return null;
        var error = new Error("SFTP error " + code + ": " + message);
        error['code'] = code;
        return error;
    };
    SftpClientCore.prototype.checkResponse = function (response, expectedType, callback) {
        if (response.type == 101 /* STATUS */) {
            var error = this.readStatus(response);
            if (error != null) {
                callback(error);
                return false;
            }
        }
        if (response.type != expectedType)
            throw new Error("Unexpected packet received");
        return true;
    };
    SftpClientCore.prototype.parseStatus = function (response, callback) {
        if (!this.checkResponse(response, 101 /* STATUS */, callback))
            return;
        callback(null);
    };
    SftpClientCore.prototype.parseAttribs = function (response, callback) {
        if (!this.checkResponse(response, 105 /* ATTRS */, callback))
            return;
        var attrs = new SftpAttributes(response);
        callback(null, attrs);
    };
    SftpClientCore.prototype.parseHandle = function (response, callback) {
        if (!this.checkResponse(response, 102 /* HANDLE */, callback))
            return;
        var handle = response.readData(true);
        callback(null, { _handle: handle, _this: this });
    };
    SftpClientCore.prototype.parsePath = function (response, callback) {
        if (!this.checkResponse(response, 104 /* NAME */, callback))
            return;
        var count = response.readInt32();
        if (count != 1)
            throw new Error("Invalid response");
        var path = response.readString();
        callback(null, path);
    };
    SftpClientCore.prototype.parseData = function (response, callback, buffer, offset, length) {
        if (!this.checkResponse(response, 103 /* DATA */, callback))
            return;
        var data = response.readData(false);
        if (data.length > length)
            throw new Error("Received too much data");
        length = data.length;
        data.copy(buffer, offset, 0, length); //WEB: buffer.set(data, offset);
        var view = buffer.slice(offset, offset + length); //WEB: var view = buffer.subarray(offset, offset + length); 
        callback(null, length, view); //TODO: make sure that this corresponds to the behavior of fs.read
    };
    SftpClientCore.prototype.parseItems = function (response, callback) {
        if (response.type == 101 /* STATUS */) {
            var error = this.readStatus(response);
            if (error != null) {
                if (error['code'] == 1 /* EOF */)
                    callback(null, false);
                else
                    callback(error, null);
                return;
            }
        }
        if (response.type != 104 /* NAME */)
            throw new Error("Unexpected packet received");
        var count = response.readInt32();
        var items = [];
        for (var i = 0; i < count; i++) {
            items[i] = new SftpItem(response);
        }
        callback(null, items);
    };
    return SftpClientCore;
})();
var SftpClient = (function (_super) {
    __extends(SftpClient, _super);
    function SftpClient(ws, log) {
        var _this = this;
        var sftp = new SftpClientCore();
        var channel = new Channel(sftp, ws);
        channel.log = log;
        _super.call(this, sftp);
        ws.on("open", function () {
            channel.start();
            sftp._init(channel, function (err) {
                if (err != null) {
                    _this.emit('error', err);
                }
                else {
                    _this.emit('ready');
                }
            });
        }); //WEB: };
    }
    SftpClient.prototype.end = function () {
        this._fs.end();
    };
    return SftpClient;
})(FilesystemPlus);
exports.SftpClient = SftpClient;

//
//
//
//
//

var SFTP;
(function (SFTP) {
    function __extends(d, b) {
        for (var p in b)
            if (b.hasOwnProperty(p))
                d[p] = b[p];
        function __() {
            this.constructor = d;
        }
        __.prototype = b.prototype;
        d.prototype = new __();
    }
    ;
    var EventEmitter = (function () {
        function EventEmitter() {
            this._events = {};
        }
        EventEmitter.prototype.addListener = function (event, listener) {
            var list = this._events[event] || [];
            list.push(listener);
            this._events[event] = list;
            return this;
        };
        EventEmitter.prototype.on = function (event, listener) {
            return this.addListener(event, listener);
        };
        EventEmitter.prototype.removeListener = function (event, listener) {
            var list = this._events[event];
            if (!Array.isArray(list))
                return;
            var n = list.indexOf(listener);
            if (n >= 0)
                list.splice(n, 1);
            return this;
        };
        EventEmitter.prototype.removeAllListeners = function (event) {
            if (typeof event === 'string')
                delete this._events[event];
            else if (typeof event === 'undefined')
                this._events = {};
            return this;
        };
        EventEmitter.prototype.listeners = function (event) {
            return this._events[event];
        };
        EventEmitter.prototype.emit = function (event) {
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            var list = this._events[event];
            if (!Array.isArray(list))
                return;
            args = Array.prototype.slice.call(args, 1);
            for (var i = 0; i < list.length; i++) {
                list[i].apply(this, args);
            }
        };
        return EventEmitter;
    })();
    function toLogWriter(writer) {
        writer = writer || {};
        var fixed = {};
        var fix = false;
        function empty() {
        }
        ;
        function prepare(name) {
            var func = writer[name];
            if (typeof func !== 'function') {
                fixed[name] = empty;
                fix = true;
            }
            else {
                fixed[name] = function () {
                    func.apply(writer, arguments);
                };
            }
        }
        ;
        prepare("info");
        prepare("warn");
        prepare("error");
        prepare("log");
        return fix ? fixed : writer;
    }
    SFTP.toLogWriter = toLogWriter;
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
    var Channel = (function () {
        // removed
        function Channel(session, ws) {
            this.session = session;
            this.ws = ws;
            // removed
        }
        Channel.prototype.start = function () {
            var _this = this;
            this.ws.onclose = function (e) {
                var code = e.code;
                var message = e.reason;
                _this.log.info("Connection closed:", code, message);
                _this.close(1000); // normal close
            };
            this.ws.onerror = function (err) {
                //this.emit('error', err);
                var name = typeof err;
                _this.log.error("Socket error:", err.message, name);
                _this.close(1011); // unexpected condition
            };
            this.ws.onmessage = function (message) {
                var request;
                if (true) {
                    request = new Uint8Array(message.data);
                }
                else {
                    _this.log.error("Text packet received, but not supported yet.");
                    _this.close(1003); // unsupported data
                    return;
                }
                try {
                    _this.session._process(request);
                }
                catch (error) {
                    _this.log.error("Error while processing packet:", error);
                    _this.close(1011); // unexpected condition
                }
            };
        };
        Channel.prototype.send = function (packet) {
            if (this.ws == null)
                return;
            this.ws.send(packet);
            // removed
            // removed
            // removed
            // removed
            // removed
        };
        Channel.prototype.close = function (reason) {
            if (this.ws == null)
                return;
            if (typeof reason === 'undefined')
                reason = 1000; // normal close
            try {
                this.ws.close(reason, "closed");
            }
            catch (error) {
                this.log.error("Error while closing WebSocket:", error);
            }
            finally {
                this.ws = null;
            }
            try {
                this.session._end();
            }
            catch (error) {
                this.log.error("Error while closing session:", error);
            }
            finally {
                this.session = null;
            }
        };
        return Channel;
    })();
    var SftpPacket = (function () {
        function SftpPacket() {
        }
        SftpPacket.prototype.check = function (count) {
            var remaining = this.length - this.position;
            if (count > remaining)
                throw new Error("Unexpected end of packet");
        };
        SftpPacket.prototype.skip = function (count) {
            this.check(length);
            this.position += count;
        };
        SftpPacket.isBuffer = function (obj) {
            return obj && obj.buffer instanceof ArrayBuffer && obj.byteLength !== undefined;
        };
        return SftpPacket;
    })();
    var SftpPacketReader = (function (_super) {
        __extends(SftpPacketReader, _super);
        function SftpPacketReader(buffer) {
            _super.call(this);
            this.buffer = buffer;
            this.position = 0;
            this.length = buffer.length;
            var length = this.readInt32() + 4;
            if (length != this.length)
                throw new Error("Invalid packet received");
            this.type = this.readByte();
            if (this.type == 1 /* INIT */ || this.type == 2 /* VERSION */) {
                this.id = null;
            }
            else {
                this.id = this.readInt32();
            }
        }
        SftpPacketReader.prototype.readByte = function () {
            this.check(1);
            var value = this.buffer[this.position++];
            return value;
        };
        SftpPacketReader.prototype.readInt32 = function () {
            var value = this.readUint32();
            if (value & 0x80000000)
                value -= 0x100000000;
            return value;
        };
        SftpPacketReader.prototype.readUint32 = function () {
            this.check(4);
            var value = 0;
            value |= this.buffer[this.position++] << 24;
            value |= this.buffer[this.position++] << 16;
            value |= this.buffer[this.position++] << 8;
            value |= this.buffer[this.position++];
            return value;
        };
        SftpPacketReader.prototype.readInt64 = function () {
            var hi = this.readInt32();
            var lo = this.readUint32();
            var value = hi * 0x100000000 + lo;
            return value;
        };
        SftpPacketReader.prototype.readString = function () {
            var length = this.readInt32();
            this.check(length);
            var value = "";
            var p = this.position;
            var end = p + length;
            while (p < end) {
                var code = this.buffer[p++];
                if (code >= 128) {
                    var len;
                    switch (code & 0xE0) {
                        case 0xE0:
                            if (code & 0x10) {
                                code &= 0x07;
                                len = 3;
                            }
                            else {
                                code &= 0xF;
                                len = 2;
                            }
                            break;
                        case 0xC0:
                            code &= 0x1F;
                            len = 1;
                            break;
                        default:
                            code = 0xFFFD; // replacement character
                            len = 0;
                            break;
                    }
                    if ((p + len) > this.length) {
                        code = 0xFFFD;
                        p = this.length;
                    }
                    else {
                        while (len > 0) {
                            var n = this.buffer[p++];
                            if ((n & 0xC0) != 0x80) {
                                code = 0xFFFD;
                                break;
                            }
                            code = (code << 6) | (n & 0x3F);
                        }
                    }
                }
                value += String.fromCharCode(code);
            }
            this.position = end;
            return value;
        };
        SftpPacketReader.prototype.skipString = function () {
            var length = this.readInt32();
            this.check(length);
            var end = this.position + length;
            this.position = end;
        };
        SftpPacketReader.prototype.readDadta = function (clone) {
            var length = this.readInt32();
            this.check(length);
            var start = this.position;
            var end = start + length;
            this.position = end;
            return this.buffer.subarray(start, end);
        };
        SftpPacketReader.prototype.readData = function (clone) {
            var length = this.readInt32();
            this.check(length);
            var start = this.position;
            var end = start + length;
            this.position = end;
            var view = this.buffer.subarray(start, end);
            if (clone) {
                var buffer = new Uint8Array(length);
                buffer.set(view, 0);
                return buffer;
            }
            else {
                return view;
            }
        };
        return SftpPacketReader;
    })(SftpPacket);
    var SftpPacketWriter = (function (_super) {
        __extends(SftpPacketWriter, _super);
        function SftpPacketWriter(length) {
            _super.call(this);
            this.buffer = new Uint8Array(length);
            this.position = 0;
            this.length = length;
        }
        SftpPacketWriter.prototype.start = function () {
            this.position = 0;
            this.writeInt32(0); // length placeholder
            this.writeByte(this.type | 0);
            if (this.type == 1 /* INIT */ || this.type == 2 /* VERSION */) {
            }
            else {
                this.writeInt32(this.id | 0);
            }
        };
        SftpPacketWriter.prototype.finish = function () {
            var length = this.position;
            this.position = 0;
            this.writeInt32(length - 4);
            return this.buffer.subarray(0, length);
        };
        SftpPacketWriter.prototype.writeByte = function (value) {
            this.check(1);
            this.buffer[this.position++] = value & 0xFF;
        };
        SftpPacketWriter.prototype.writeInt32 = function (value) {
            this.check(4);
            this.buffer[this.position++] = (value >> 24) & 0xFF;
            this.buffer[this.position++] = (value >> 16) & 0xFF;
            this.buffer[this.position++] = (value >> 8) & 0xFF;
            this.buffer[this.position++] = value & 0xFF;
        };
        SftpPacketWriter.prototype.writeInt64 = function (value) {
            var hi = (value / 0x100000000) | 0;
            var lo = (value & 0xFFFFFFFF) | 0;
            this.writeInt32(hi);
            this.writeInt32(lo);
        };
        SftpPacketWriter.prototype.writeString = function (value) {
            var start = this.position;
            this.writeInt32(0); // will get overwritten later
            this.check(value.length);
            var length = 0;
            for (var i = 0; i < value.length; i++) {
                var code = value.charCodeAt(i);
                if (code <= 0x7F) {
                    length += 1;
                    this.check(1);
                    this.buffer[this.position++] = (code | 0);
                }
                else if (code <= 0x7FF) {
                    length += 2;
                    this.check(2);
                    this.buffer[this.position++] = (code >> 6) | 0x80;
                    this.buffer[this.position++] = (code & 0x3F);
                }
                else if (code <= 0xFFFF) {
                    length += 3;
                    this.check(3);
                    this.buffer[this.position++] = ((code >> 12) & 0x0F) | 0xE0;
                    this.buffer[this.position++] = ((code >> 6) & 0x3F) | 0x80;
                    this.buffer[this.position++] = (code & 0x3F);
                }
                else if (code <= 0x1FFFFF) {
                    length += 4;
                    this.check(4);
                    this.buffer[this.position++] = ((code >> 18) & 0x03) | 0xF0;
                    this.buffer[this.position++] = ((code >> 12) & 0x0F) | 0xE0;
                    this.buffer[this.position++] = ((code >> 6) & 0x3F) | 0x80;
                    this.buffer[this.position++] = (code & 0x3F);
                }
                else {
                    length += 1;
                    this.check(1);
                    this.buffer[this.position++] = 0x3F;
                }
            }
            // write number of bytes
            var position = this.position;
            this.position = start;
            this.writeInt32(length);
            this.position = position;
        };
        SftpPacketWriter.prototype.writeData = function (data, start, end) {
            if (typeof start !== 'undefined')
                data = data.subarray(start, end);
            var length = data.length;
            this.writeInt32(length);
            this.check(length);
            this.buffer.set(data, this.position);
            this.position += length;
        };
        return SftpPacketWriter;
    })(SftpPacket);
    var SftpFlags = (function () {
        function SftpFlags() {
        }
        SftpFlags.toFlags = function (flags) {
            switch (flags) {
                case 'r':
                    return 1 /* READ */;
                case 'r+':
                    return 1 /* READ */ | 2 /* WRITE */;
                case 'w':
                    return 2 /* WRITE */ | 8 /* CREATE */ | 16 /* TRUNC */;
                case 'w+':
                    return 2 /* WRITE */ | 8 /* CREATE */ | 16 /* TRUNC */ | 1 /* READ */;
                case 'wx':
                case 'xw':
                    return 2 /* WRITE */ | 8 /* CREATE */ | 16 /* TRUNC */ | 32 /* EXCL */;
                case 'wx+':
                case 'xw+':
                    return 2 /* WRITE */ | 8 /* CREATE */ | 16 /* TRUNC */ | 32 /* EXCL */ | 1 /* READ */;
                case 'a':
                    return 2 /* WRITE */ | 8 /* CREATE */ | 4 /* APPEND */;
                case 'a+':
                    return 2 /* WRITE */ | 8 /* CREATE */ | 4 /* APPEND */ | 1 /* READ */;
                case 'ax':
                case 'xa':
                    return 2 /* WRITE */ | 8 /* CREATE */ | 4 /* APPEND */ | 32 /* EXCL */;
                case 'ax+':
                case 'xa+':
                    return 2 /* WRITE */ | 8 /* CREATE */ | 4 /* APPEND */ | 32 /* EXCL */ | 1 /* READ */;
                default:
                    throw Error("Invalid flags '" + flags + "'");
            }
        };
        SftpFlags.fromFlags = function (flags) {
            var read = ((flags & 1 /* READ */) != 0);
            var write = ((flags & 2 /* WRITE */) != 0);
            var append = ((flags & 4 /* APPEND */) != 0);
            var create = ((flags & 8 /* CREATE */) != 0);
            var trunc = ((flags & 16 /* TRUNC */) != 0);
            var excl = ((flags & 32 /* EXCL */) != 0);
            var modes = [];
            if (create) {
                if (excl) {
                    modes.push("wx+");
                }
                else if (trunc) {
                    modes.push("w+");
                }
                else {
                    modes.push("wx+");
                    create = false;
                }
            }
            if (!create) {
                if (append) {
                    if (read) {
                        modes.push("a+");
                    }
                    else {
                        modes.push("a");
                    }
                }
                else if (write) {
                    modes.push("r+");
                }
                else {
                    modes.push("r");
                }
            }
            return modes;
        };
        return SftpFlags;
    })();
    var SftpStatus = (function () {
        function SftpStatus() {
        }
        SftpStatus.write = function (response, code, message) {
            response.type = 101 /* STATUS */;
            response.start();
            response.writeInt32(code);
            response.writeString(message);
            response.writeInt32(0);
        };
        SftpStatus.writeSuccess = function (response) {
            this.write(response, 0 /* OK */, "OK");
        };
        SftpStatus.writeError = function (response, err) {
            var message;
            var code = 4 /* FAILURE */;
            switch (err.errno | 0) {
                default:
                    if (err["isPublic"] === true)
                        message = err.message;
                    else
                        message = "Unknown error";
                    break;
                case 1:
                    message = "End of file";
                    code = 1 /* EOF */;
                    break;
                case 3:
                    message = "Permission denied";
                    code = 3 /* PERMISSION_DENIED */;
                    break;
                case 4:
                    message = "Try again";
                    break;
                case 9:
                    message = "Bad file number";
                    break;
                case 10:
                    message = "Device or resource busy";
                    break;
                case 18:
                    message = "Invalid argument";
                    break;
                case 20:
                    message = "Too many open files";
                    break;
                case 24:
                    message = "File table overflow";
                    break;
                case 25:
                    message = "No buffer space available";
                    break;
                case 26:
                    message = "Out of memory";
                    break;
                case 27:
                    message = "Not a directory";
                    break;
                case 28:
                    message = "Is a directory";
                    break;
                case 34:
                    message = "No such file or directory";
                    code = 2 /* NO_SUCH_FILE */;
                    break;
                case 35:
                    message = "Function not implemented";
                    code = 8 /* OP_UNSUPPORTED */;
                    break;
                case 47:
                    message = "File exists";
                    break;
                case 49:
                    message = "File name too long";
                    break;
                case 50:
                    message = "Operation not permitted";
                    break;
                case 51:
                    message = "Too many symbolic links encountered";
                    break;
                case 52:
                    message = "Cross-device link ";
                    break;
                case 53:
                    message = "Directory not empty";
                    break;
                case 54:
                    message = "No space left on device";
                    break;
                case 55:
                    message = "I/O error";
                    break;
                case 56:
                    message = "Read-only file system";
                    break;
                case 57:
                    message = "No such device";
                    code = 2 /* NO_SUCH_FILE */;
                    break;
                case 58:
                    message = "Illegal seek";
                    break;
                case 59:
                    message = "Operation canceled";
                    break;
            }
            this.write(response, code, message);
        };
        return SftpStatus;
    })();
    var SftpOptions = (function () {
        function SftpOptions() {
        }
        return SftpOptions;
    })();
    var SftpItem = (function () {
        function SftpItem(arg, stats) {
            if (typeof arg === 'object') {
                var request = arg;
                this.filename = request.readString();
                this.longname = request.readString();
                this.stats = new SftpAttributes(request);
            }
            else {
                var filename = arg;
                this.filename = filename;
                this.longname = filename;
                if (typeof stats === 'object') {
                    var attr = new SftpAttributes();
                    attr.from(stats);
                    this.stats = attr;
                    this.longname = attr.toString() + " " + filename;
                }
            }
        }
        SftpItem.prototype.write = function (response) {
            response.writeString(this.filename);
            response.writeString(this.longname);
            if (typeof this.stats === "object")
                this.stats.write(response);
            else
                response.writeInt32(0);
        };
        return SftpItem;
    })();
    var SftpAttributes = (function () {
        function SftpAttributes(request) {
            if (typeof request === 'undefined') {
                this.flags = 0;
                return;
            }
            var flags = this.flags = request.readUint32();
            if (flags & 1 /* SIZE */) {
                this.size = request.readInt64();
            }
            if (flags & 2 /* UIDGID */) {
                this.uid = request.readInt32();
                this.gid = request.readInt32();
            }
            if (flags & 4 /* PERMISSIONS */) {
                this.mode = request.readUint32();
            }
            if (flags & 8 /* ACMODTIME */) {
                this.atime = new Date(1000 * request.readUint32());
                this.mtime = new Date(1000 * request.readUint32());
            }
            if (flags & 2147483648 /* EXTENDED */) {
                this.flags &= ~2147483648 /* EXTENDED */;
                this.size = request.readInt64();
                for (var i = 0; i < this.size; i++) {
                    request.skipString();
                    request.skipString();
                }
            }
        }
        SftpAttributes.prototype.write = function (response) {
            var flags = this.flags;
            response.writeInt32(flags);
            if (flags & 1 /* SIZE */) {
                response.writeInt64(this.size);
            }
            if (flags & 2 /* UIDGID */) {
                response.writeInt32(this.uid);
                response.writeInt32(this.gid);
            }
            if (flags & 4 /* PERMISSIONS */) {
                response.writeInt32(this.mode);
            }
            if (flags & 8 /* ACMODTIME */) {
                response.writeInt32(this.atime.getTime() / 1000);
                response.writeInt32(this.mtime.getTime() / 1000);
            }
            if (flags & 2147483648 /* EXTENDED */) {
                response.writeInt32(0);
            }
        };
        SftpAttributes.prototype.from = function (stats) {
            if (stats == null || typeof stats === 'undefined') {
                this.flags = 0;
            }
            else {
                var flags = 0;
                if (typeof stats.size !== 'undefined') {
                    flags |= 1 /* SIZE */;
                    this.size = stats.size | 0;
                }
                if (typeof stats.uid !== 'undefined' || typeof stats.gid !== 'undefined') {
                    flags |= 2 /* UIDGID */;
                    this.uid = stats.uid | 0;
                    this.gid = stats.gid | 0;
                }
                if (typeof stats.mode !== 'undefined') {
                    flags |= 4 /* PERMISSIONS */;
                    this.mode = stats.mode | 0;
                }
                if (typeof stats.atime !== 'undefined' || typeof stats.mtime !== 'undefined') {
                    flags |= 8 /* ACMODTIME */;
                    this.atime = stats.atime; //TODO: make sure its Date
                    this.mtime = stats.mtime; //TODO: make sure its Date
                }
                if (typeof stats.nlink !== 'undefined') {
                    this.nlink = stats.nlink;
                }
                this.flags = flags;
            }
        };
        SftpAttributes.prototype.toString = function () {
            var attrs = this.mode;
            var perms;
            switch (attrs & 0xE000) {
                case 8192 /* CHARACTER_DEVICE */:
                    perms = "c";
                    break;
                case 16384 /* DIRECTORY */:
                    perms = "d";
                    break;
                case 24576 /* BLOCK_DEVICE */:
                    perms = "b";
                    break;
                case 32768 /* REGULAR_FILE */:
                    perms = "-";
                    break;
                case 40960 /* SYMLINK */:
                    perms = "l";
                    break;
                case 49152 /* SOCKET */:
                    perms = "s";
                    break;
                case 4096 /* FIFO */:
                    perms = "p";
                    break;
                default:
                    perms = "-";
                    break;
            }
            attrs &= 0x1FF;
            for (var j = 0; j < 3; j++) {
                var mask = (attrs >> ((2 - j) * 3)) & 0x7;
                perms += (mask & 4) ? "r" : "-";
                perms += (mask & 2) ? "w" : "-";
                perms += (mask & 1) ? "x" : "-";
            }
            var len = this.size.toString();
            if (len.length < 9)
                len = "         ".slice(len.length - 9) + len;
            else
                len = " " + len;
            var modified = this.mtime;
            var diff = (new Date().getTime() - modified.getTime()) / (3600 * 24);
            var date = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][modified.getUTCMonth()];
            var day = modified.getUTCDate();
            date += ((day <= 9) ? "  " : " ") + day;
            if (diff < -30 || diff > 180)
                date += "  " + modified.getUTCFullYear();
            else
                date += " " + ("0" + modified.getUTCHours()).slice(-2) + ":" + ("0" + modified.getUTCMinutes()).slice(-2);
            var nlink = (typeof this.nlink === 'undefined') ? 1 : this.nlink;
            return perms + " " + nlink + " user group " + len + " " + date;
        };
        return SftpAttributes;
    })();
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
            if (typeof attrs === 'function' && typeof callback === 'undefined') {
                callback = attrs;
                attrs = null;
            }
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
            if (typeof attrs === 'function' && typeof callback === 'undefined') {
                callback = attrs;
                attrs = null;
            }
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
            error['description'] = message;
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
            delete attrs.flags;
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
            buffer.set(data, offset);
            var view = buffer.subarray(offset, offset + length);
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
            channel.log = toLogWriter(log);
            _super.call(this, sftp);
            ws.onopen = function () {
                channel.start();
                sftp._init(channel, function (err) {
                    if (err != null) {
                        _this.emit('error', err);
                    }
                    else {
                        _this.emit('ready');
                    }
                });
            };
        }
        SftpClient.prototype.end = function () {
            this._fs.end();
        };
        return SftpClient;
    })(FilesystemPlus);
    var Client = (function (_super) {
        __extends(Client, _super);
        function Client(address, options) {
            var protocols = [];
            if (typeof options !== 'object' || typeof options.protocol == 'undefined') {
                protocols.push('sftp');
            }
            else {
                protocols.push(options.protocol);
            }
            var ws = new WebSocket(address, protocols);
            ws.binaryType = "arraybuffer";
            _super.call(this, ws, options.log);
        }
        return Client;
    })(SftpClient);
    SFTP.Client = Client;
})(SFTP || (SFTP = {}));

//# sourceMappingURL=sftp.js.map
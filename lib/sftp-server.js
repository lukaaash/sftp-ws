var packet = require("./sftp-packet");
var misc = require("./sftp-misc");

var SftpPacket = packet.SftpPacket;
var SftpItem = misc.SftpItem;
var SftpAttributes = misc.SftpAttributes;
var SftpStatus = misc.SftpStatus;
var SftpFlags = misc.SftpFlags;

var SftpServer = (function () {
    function SftpServer(options) {
        this.fs = options.fs;
        this.sendData = options.send;
        this.log = options.log;
        this.readdirCache = {};
    }
    SftpServer.prototype.send = function (packet) {
        var length = packet.offset;

        packet.buffer.writeInt32BE(length - 4, 0, true);

        this.sendData(packet.buffer.slice(0, length));
    };

    SftpServer.prototype.status = function (packet, code, message) {
        SftpStatus.write(packet, code, message);
        this.send(packet);
    };

    SftpServer.prototype.error = function (packet, err, message) {
        if (typeof this.log === 'object' && typeof this.log.error === 'function')
            this.log.error(err);

        if (typeof err === 'object') {
            SftpStatus.writeError(packet, err);
        } else {
            var code = err | 0;
            if (code < 2 || code > 8)
                code = SftpStatus.FAILURE;

            message = "" + message;
            if (message.length == 0)
                message = "Error";

            SftpStatus.write(packet, code, message);
        }
        this.send(packet);
    };

    SftpServer.prototype.checkError = function (packet, err) {
        if (err == null || typeof err === 'undefined' || typeof err !== 'object')
            return false;

        this.error(packet, err);
        return true;
    };

    SftpServer.prototype.finish = function (packet, err) {
        if (this.checkError(packet, err))
            return;

        SftpStatus.writeSuccess(packet);
        this.send(packet);
    };

    SftpServer.prototype.stats = function (packet, err, stats) {
        if (this.checkError(packet, err))
            return;

        packet.writeByte(SftpPacket.ATTRS);
        packet.writeInt32(packet.id);
        var attr = new SftpAttributes();
        attr.from(stats);
        attr.write(packet);
        this.send(packet);
    };

    SftpServer.prototype.handle = function (packet, err, handle) {
        if (this.checkError(packet, err))
            return;

        packet.writeByte(SftpPacket.HANDLE);
        packet.writeInt32(packet.id);
        packet.writeHandle(handle);
        this.send(packet);
    };

    SftpServer.prototype.name = function (packet, err, path) {
        if (this.checkError(packet, err))
            return;

        packet.writeByte(SftpPacket.NAME);
        packet.writeInt32(packet.id);
        packet.writeInt32(1);
        packet.writeString(path);
        packet.writeString("");
        packet.writeInt32(0);
        this.send(packet);
    };

    SftpServer.prototype.end = function () {
        this.fs.dispose();
        delete this.fs;
    };

    SftpServer.prototype.process = function (data) {
        var _this = this;
        var fs = this.fs;
        if (typeof fs === 'undefined')
            throw new Error("Session has ended");

        var request = new SftpPacket(data);
        var reply = new SftpPacket(new Buffer(34000));
        reply.reset();

        var length = request.readInt32() + 4;
        if (length != request.length)
            throw new Error("Invalid packet received");

        var command = request.readByte();
        var id = (command >= SftpPacket.REQUEST_MIN && command <= SftpPacket.REQUEST_MAX) ? request.readInt32() : null;
        request.id = id;
        reply.id = id;

        if (length > 66000) {
            this.error(reply, SftpStatus.BAD_MESSAGE, "Packet too long");
            return;
        }

        try  {
            switch (command) {
                case SftpPacket.INIT:
                    var version = request.readInt32();

                    reply.writeByte(SftpPacket.VERSION);
                    reply.writeInt32(3);
                    this.send(reply);
                    return;

                case SftpPacket.OPEN:
                    var path = request.readString();
                    var pflags = request.readInt32();
                    var attrs = new SftpAttributes(request);

                    var modes = SftpFlags.getModes(pflags);

                    if (modes.length == 0) {
                        this.status(reply, SftpStatus.FAILURE, "Unsupported flags");
                        return;
                    }

                    var openFile = function () {
                        var mode = modes.shift();
                        fs.open(path, mode, attrs, function (err, handle) {
                            if (_this.checkError(reply, err))
                                return;

                            if (modes.length == 0) {
                                _this.handle(reply, null, handle);
                                return;
                            }

                            fs.close(handle, function (err) {
                                if (_this.checkError(reply, err))
                                    return;

                                openFile();
                            });
                        });
                    };

                    openFile();
                    return;

                case SftpPacket.CLOSE:
                    var handle = request.readHandle();

                    if (typeof this.readdirCache[handle] !== "undefined") {
                        delete this.readdirCache[handle];
                    }

                    fs.close(handle, function (err) {
                        return _this.finish(reply, err);
                    });
                    return;

                case SftpPacket.READ:
                    var handle = request.readHandle();
                    var position = request.readInt64();
                    var count = request.readInt32();
                    if (count > 0x8000)
                        count = 0x8000;

                    reply.writeByte(SftpPacket.DATA);
                    reply.writeInt32(reply.id);
                    reply.writeInt32(0);
                    var offset = reply.ignore(count);

                    fs.read(handle, reply.buffer, offset, count, position, function (err, bytesRead, b) {
                        if (_this.checkError(reply, err))
                            return;

                        reply.seek(offset - 4);
                        reply.writeInt32(bytesRead);
                        reply.ignore(bytesRead);
                        _this.send(reply);
                    });
                    return;

                case SftpPacket.WRITE:
                    var handle = request.readHandle();
                    var position = request.readInt64();
                    var count = request.readInt32();
                    var offset = request.offset;
                    request.ignore(count);

                    fs.write(handle, reply.buffer, offset, count, position, function (err) {
                        return _this.finish(reply, err);
                    });
                    return;

                case SftpPacket.LSTAT:
                    var path = request.readString();

                    fs.lstat(path, function (err, stats) {
                        return _this.stats(reply, err, stats);
                    });
                    return;

                case SftpPacket.FSTAT:
                    var handle = request.readHandle();

                    fs.fstat(handle, function (err, stats) {
                        return _this.stats(reply, err, stats);
                    });
                    return;

                case SftpPacket.SETSTAT:
                    var path = request.readString();
                    var attrs = new SftpAttributes(request);

                    fs.setstat(path, attrs, function (err) {
                        return _this.finish(reply, err);
                    });
                    return;

                case SftpPacket.FSETSTAT:
                    var handle = request.readHandle();
                    var attrs = new SftpAttributes(request);

                    fs.fsetstat(handle, attrs, function (err) {
                        return _this.finish(reply, err);
                    });
                    return;

                case SftpPacket.OPENDIR:
                    var path = request.readString();

                    fs.opendir(path, function (err, handle) {
                        return _this.handle(reply, err, handle);
                    });
                    return;

                case SftpPacket.READDIR:
                    var handle = request.readHandle();

                    reply.writeByte(SftpPacket.NAME);
                    reply.writeInt32(reply.id);

                    var count = 0;
                    var offset = reply.offset;
                    reply.writeInt32(0);

                    var done = function () {
                        if (count == 0) {
                            _this.status(reply, SftpStatus.EOF, "EOF");
                        } else {
                            reply.buffer.writeInt32BE(count, offset, true);
                            _this.send(reply);
                        }
                    };

                    var next = function (items) {
                        if (items.length == 0) {
                            done();
                            return;
                        }

                        while (items.length > 0) {
                            var it = items.shift();
                            var item = new SftpItem(it.filename, it.stats);
                            item.write(reply);
                            count++;

                            if (reply.offset > 0x7000) {
                                _this.readdirCache[handle] = items;
                                done();
                                return;
                            }
                        }

                        var prev = _this.readdirCache[handle];

                        if (Array.isArray(prev) && prev.length > 0) {
                            next(prev);
                            return;
                        }

                        readdir();
                    };

                    var readdir = function () {
                        fs.readdir(handle, function (err, items) {
                            if (_this.checkError(reply, err))
                                return;

                            next(items);
                        });
                    };

                    readdir();
                    return;

                case SftpPacket.REMOVE:
                    var path = request.readString();

                    fs.unlink(path, function (err) {
                        return _this.finish(reply, err);
                    });
                    return;

                case SftpPacket.MKDIR:
                    var path = request.readString();
                    var attrs = new SftpAttributes(request);

                    fs.mkdir(path, attrs, function (err) {
                        return _this.finish(reply, err);
                    });
                    return;

                case SftpPacket.RMDIR:
                    var path = request.readString();

                    fs.rmdir(path, function (err) {
                        return _this.finish(reply, err);
                    });
                    return;

                case SftpPacket.REALPATH:
                    var path = request.readString();

                    fs.realpath(path, function (err, resolvedPath) {
                        return _this.name(reply, err, resolvedPath);
                    });
                    return;

                case SftpPacket.STAT:
                    var path = request.readString();

                    fs.stat(path, function (err, stats) {
                        return _this.stats(reply, err, stats);
                    });
                    return;

                case SftpPacket.RENAME:
                    var oldpath = request.readString();
                    var newpath = request.readString();

                    fs.rename(oldpath, newpath, function (err) {
                        return _this.finish(reply, err);
                    });
                    return;

                case SftpPacket.READLINK:
                    var path = request.readString();

                    fs.readlink(path, function (err, linkString) {
                        return _this.name(reply, err, linkString);
                    });
                    return;

                case SftpPacket.SYMLINK:
                    var linkpath = request.readString();
                    var targetpath = request.readString();

                    fs.symlink(targetpath, linkpath, function (err) {
                        return _this.finish(reply, err);
                    });
                    return;

                default:
                    this.status(reply, SftpStatus.OP_UNSUPPORTED, "Not supported");
            }
        } catch (err) {
            this.error(reply, err);
        }
    };
    return SftpServer;
})();
exports.SftpServer = SftpServer;

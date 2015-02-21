var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var enums = require("./sftp-enums");
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
        return Buffer.isBuffer(obj);
    };
    return SftpPacket;
})();
exports.SftpPacket = SftpPacket;
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
        var value = this.buffer.readUInt8(this.position, true);
        this.position += 1;
        return value;
    };
    SftpPacketReader.prototype.readInt32 = function () {
        this.check(4);
        var value = this.buffer.readInt32BE(this.position, true);
        this.position += 4;
        return value;
    };
    SftpPacketReader.prototype.readUint32 = function () {
        this.check(4);
        var value = this.buffer.readUInt32BE(this.position, true);
        this.position += 4;
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
        var end = this.position + length;
        var value = this.buffer.toString('utf8', this.position, end);
        this.position = end;
        return value;
    };
    SftpPacketReader.prototype.skipString = function () {
        var length = this.readInt32();
        this.check(length);
        var end = this.position + length;
        this.position = end;
    };
    SftpPacketReader.prototype.readData = function (clone) {
        var length = this.readInt32();
        this.check(length);
        var start = this.position;
        var end = start + length;
        this.position = end;
        if (clone) {
            var buffer = new Buffer(length);
            this.buffer.copy(buffer, 0, start, end);
            return buffer;
        }
        else {
            return this.buffer.slice(start, end);
        }
    };
    return SftpPacketReader;
})(SftpPacket);
exports.SftpPacketReader = SftpPacketReader;
var SftpPacketWriter = (function (_super) {
    __extends(SftpPacketWriter, _super);
    function SftpPacketWriter(length) {
        _super.call(this);
        this.buffer = new Buffer(length);
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
        this.buffer.writeInt32BE(length - 4, 0, true);
        return this.buffer.slice(0, length);
    };
    SftpPacketWriter.prototype.writeByte = function (value) {
        this.check(1);
        this.buffer.writeInt8(value, this.position, true);
        this.position += 1;
    };
    SftpPacketWriter.prototype.writeInt32 = function (value) {
        this.check(4);
        this.buffer.writeInt32BE(value, this.position, true);
        this.position += 4;
    };
    SftpPacketWriter.prototype.writeInt64 = function (value) {
        var hi = (value / 0x100000000) | 0;
        var lo = (value & 0xFFFFFFFF) | 0;
        this.writeInt32(hi);
        this.writeInt32(lo);
    };
    SftpPacketWriter.prototype.writeString = function (value) {
        var offset = this.position;
        this.writeInt32(0); // will get overwritten later
        var charLength = value.length;
        this.check(value.length); // does not ensure there is enough space (because of UTF-8)
        this.buffer._charsWritten = 0;
        var bytesWritten = this.buffer.write(value, this.position, undefined, 'utf-8');
        this.position += bytesWritten;
        if (Buffer._charsWritten != charLength)
            throw new Error("Not enough space in the buffer");
        // write number of bytes
        this.buffer.writeInt32BE(bytesWritten, offset, true);
    };
    SftpPacketWriter.prototype.writeData = function (data, start, end) {
        if (typeof start !== 'undefined')
            data = data.slice(start, end);
        var length = data.length;
        this.writeInt32(length);
        this.check(length);
        data.copy(this.buffer, this.position, 0, length);
        this.position += length;
    };
    return SftpPacketWriter;
})(SftpPacket);
exports.SftpPacketWriter = SftpPacketWriter;

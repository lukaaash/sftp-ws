var SftpPacket = (function () {
    function SftpPacket(buffer) {
        this.buffer = buffer;
        this.offset = 0;
        this.length = buffer.length;
    }
    SftpPacket.prototype.reset = function () {
        this.offset = 0;
        this.writeInt32(0);
    };

    SftpPacket.prototype.seek = function (offset) {
        this.offset = offset;
    };

    SftpPacket.prototype.ignore = function (count) {
        this.checkSize(count);
        var offset = this.offset;
        this.offset += count;
        return offset;
    };

    SftpPacket.prototype.writeByte = function (value) {
        this.checkSize(1);
        this.buffer.writeInt8(value, this.offset, true);
        this.offset += 1;
    };

    SftpPacket.prototype.writeInt32 = function (value) {
        this.checkSize(4);
        this.buffer.writeInt32BE(value, this.offset, true);
        this.offset += 4;
    };

    SftpPacket.prototype.writeInt64 = function (value) {
        var hi = (value / 0x100000000) | 0;
        var lo = (value & 0xFFFFFFFF) | 0;

        this.writeInt32(hi);
        this.writeInt32(lo);
    };

    SftpPacket.prototype.writeString = function (value) {
        var offset = this.offset;
        this.writeInt32(0);
        var charLength = value.length;
        this.checkSize(value.length);

        this.buffer._charsWritten = 0;
        var bytesWritten = this.buffer.write(value, this.offset, undefined, 'utf-8');
        this.offset += bytesWritten;
        if (Buffer._charsWritten != charLength)
            throw new Error("Not enough space in the buffer");

        this.buffer.writeInt32BE(bytesWritten, offset, true);
    };

    SftpPacket.prototype.checkSize = function (size) {
        var remaining = this.length - this.offset;
        if (size > remaining)
            throw new Error("Premature end of packet encountered");
    };

    SftpPacket.prototype.readByte = function () {
        this.checkSize(1);
        var value = this.buffer.readUInt8(this.offset, true);
        this.offset += 1;

        return value;
    };

    SftpPacket.prototype.readInt32 = function () {
        this.checkSize(4);
        var value = this.buffer.readInt32BE(this.offset, true);
        this.offset += 4;
        return value;
    };

    SftpPacket.prototype.readUint32 = function () {
        this.checkSize(4);
        var value = this.buffer.readUInt32BE(this.offset, true);
        this.offset += 4;
        return value;
    };

    SftpPacket.prototype.readInt64 = function () {
        var hi = this.readInt32();
        var lo = this.readUint32();

        var value = hi * 0x100000000 + lo;
        return value;
    };

    SftpPacket.prototype.readString = function () {
        var length = this.readInt32();
        this.checkSize(length);

        var end = this.offset + length;
        var value = this.buffer.toString('utf8', this.offset, end);
        this.offset = end;

        return value;
    };

    SftpPacket.prototype.skipString = function () {
        var length = this.readInt32();
        this.checkSize(length);

        var end = this.offset + length;
        this.offset = end;
    };

    SftpPacket.prototype.writeHandle = function (h) {
        this.writeInt32(4);
        this.writeInt32(h);
    };

    SftpPacket.prototype.readHandle = function () {
        var length = this.readInt32();
        var value;
        if (length == 4) {
            value = this.readInt32();
        } else {
            this.checkSize(length);
            this.offset += length;
            value = -1;
        }

        return value;
    };

    SftpPacket.prototype.isEmpty = function () {
        return this.offset >= this.length;
    };
    SftpPacket.INIT = 1;
    SftpPacket.VERSION = 2;

    SftpPacket.REQUEST_MIN = 3;
    SftpPacket.OPEN = 3;
    SftpPacket.CLOSE = 4;
    SftpPacket.READ = 5;
    SftpPacket.WRITE = 6;
    SftpPacket.LSTAT = 7;
    SftpPacket.FSTAT = 8;
    SftpPacket.SETSTAT = 9;
    SftpPacket.FSETSTAT = 10;
    SftpPacket.OPENDIR = 11;
    SftpPacket.READDIR = 12;
    SftpPacket.REMOVE = 13;
    SftpPacket.MKDIR = 14;
    SftpPacket.RMDIR = 15;
    SftpPacket.REALPATH = 16;
    SftpPacket.STAT = 17;
    SftpPacket.RENAME = 18;
    SftpPacket.READLINK = 19;
    SftpPacket.SYMLINK = 20;
    SftpPacket.REQUEST_MAX = 20;

    SftpPacket.STATUS = 101;
    SftpPacket.HANDLE = 102;
    SftpPacket.DATA = 103;
    SftpPacket.NAME = 104;
    SftpPacket.ATTRS = 105;
    return SftpPacket;
})();
exports.SftpPacket = SftpPacket;

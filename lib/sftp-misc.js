var packet = require("./sftp-packet");

var SftpPacket = packet.SftpPacket;

var SftpFlags = (function () {
    function SftpFlags() {
    }
    SftpFlags.getModes = function (flags) {
        var read = ((flags & this.READ) != 0);
        var write = ((flags & this.WRITE) != 0);
        var append = ((flags & this.APPEND) != 0);
        var create = ((flags & this.CREAT) != 0);
        var trunc = ((flags & this.TRUNC) != 0);
        var excl = ((flags & this.EXCL) != 0);

        var modes = [];

        if (create) {
            if (excl) {
                modes.push("wx+");
            } else if (trunc) {
                modes.push("w+");
            } else {
                modes.push("wx+");
                create = false;
            }
        }

        if (!create) {
            if (append) {
                if (read) {
                    modes.push("a+");
                } else {
                    modes.push("a");
                }
            } else if (write) {
                modes.push("r+");
            } else {
                modes.push("r");
            }
        }

        return modes;
    };
    SftpFlags.READ = 0x00000001;
    SftpFlags.WRITE = 0x00000002;
    SftpFlags.APPEND = 0x00000004;
    SftpFlags.CREAT = 0x00000008;
    SftpFlags.TRUNC = 0x00000010;
    SftpFlags.EXCL = 0x00000020;
    return SftpFlags;
})();
exports.SftpFlags = SftpFlags;

var SftpStatus = (function () {
    function SftpStatus() {
    }
    SftpStatus.write = function (packet, code, message) {
        packet.reset();
        packet.writeByte(SftpPacket.STATUS);
        packet.writeInt32(packet.id | 0);
        packet.writeInt32(code);
        packet.writeString(message);
        packet.writeInt32(0);
    };

    SftpStatus.writeSuccess = function (packet) {
        this.write(packet, this.OK, "OK");
    };

    SftpStatus.writeError = function (packet, err) {
        var message;
        var code = this.FAILURE;

        switch (err.errno | 0) {
            default:
                if (err["isPublic"] === true)
                    message = err.message;
                else
                    message = "Unknown error";
                break;
            case 1:
                message = "End of file";
                code = this.EOF;
                break;
            case 3:
                message = "Permission denied";
                code = this.PERMISSION_DENIED;
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
                code = this.NO_SUCH_FILE;
                break;
            case 35:
                message = "Function not implemented";
                code = this.OP_UNSUPPORTED;
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
                code = this.NO_SUCH_FILE;
                break;
            case 58:
                message = "Illegal seek";
                break;
            case 59:
                message = "Operation canceled";
                break;
        }

        this.write(packet, code, message);
    };
    SftpStatus.OK = 0;
    SftpStatus.EOF = 1;
    SftpStatus.NO_SUCH_FILE = 2;
    SftpStatus.PERMISSION_DENIED = 3;
    SftpStatus.FAILURE = 4;
    SftpStatus.BAD_MESSAGE = 5;
    SftpStatus.NO_CONNECTION = 6;
    SftpStatus.CONNECTION_LOST = 7;
    SftpStatus.OP_UNSUPPORTED = 8;
    return SftpStatus;
})();
exports.SftpStatus = SftpStatus;

var SftpOptions = (function () {
    function SftpOptions() {
    }
    return SftpOptions;
})();
exports.SftpOptions = SftpOptions;

var SftpItem = (function () {
    function SftpItem(filename, stats) {
        this.filename = filename;
        this.longname = filename;
        if (typeof stats === 'object') {
            var attr = new SftpAttributes();
            attr.from(stats);
            this.stats = attr;
            this.longname = attr.toString() + " " + filename;
        }
    }
    SftpItem.prototype.write = function (packet) {
        packet.writeString(this.filename);
        packet.writeString(this.longname);
        if (typeof this.stats === "object")
            this.stats.write(packet);
        else
            packet.writeInt32(0);
    };
    return SftpItem;
})();
exports.SftpItem = SftpItem;

var SftpAttributes = (function () {
    function SftpAttributes(packet) {
        if (typeof packet === 'undefined') {
            this.flags = 0;
            return;
        }

        var flags = this.flags = packet.readUint32();

        if (flags & SftpAttributes.SIZE) {
            this.size = packet.readInt64();
        }

        if (flags & SftpAttributes.UIDGID) {
            this.uid = packet.readInt32();
            this.gid = packet.readInt32();
        }

        if (flags & SftpAttributes.PERMISSIONS) {
            this.mode = packet.readUint32();
        }

        if (flags & SftpAttributes.ACMODTIME) {
            this.atime = new Date(1000 * packet.readUint32());
            this.mtime = new Date(1000 * packet.readUint32());
        }

        if (flags & SftpAttributes.EXTENDED) {
            this.flags -= SftpAttributes.EXTENDED;
            this.size = packet.readInt64();
            for (var i = 0; i < this.size; i++) {
                packet.skipString();
                packet.skipString();
            }
        }
    }
    SftpAttributes.prototype.write = function (buffer) {
        var flags = this.flags;
        buffer.writeInt32(flags);

        if (flags & SftpAttributes.SIZE) {
            buffer.writeInt64(this.size);
        }

        if (flags & SftpAttributes.UIDGID) {
            buffer.writeInt32(this.uid);
            buffer.writeInt32(this.gid);
        }

        if (flags & SftpAttributes.PERMISSIONS) {
            buffer.writeInt32(this.mode);
        }

        if (flags & SftpAttributes.ACMODTIME) {
            buffer.writeInt32(this.atime.getTime() / 1000);
            buffer.writeInt32(this.mtime.getTime() / 1000);
        }

        if (flags & SftpAttributes.EXTENDED) {
            buffer.writeInt32(0);
        }
    };

    SftpAttributes.prototype.from = function (stats) {
        this.flags = SftpAttributes.BASIC;
        this.size = stats.size | 0;
        this.uid = stats.uid | 0;
        this.gid = stats.gid | 0;
        this.atime = stats.atime;
        this.mode = stats.mode;
        this.mtime = stats.mtime;
        this.nlink = stats.nlink;
        if (typeof this.nlink === 'undefined')
            this.nlink = 1;
    };

    SftpAttributes.prototype.toString = function () {
        var attrs = this.mode;

        var perms;
        switch (attrs & 0xE000) {
            case SftpAttributes.POSIX_CHARACTER_DEVICE:
                perms = "c";
                break;
            case SftpAttributes.POSIX_DIRECTORY:
                perms = "d";
                break;
            case SftpAttributes.POSIX_BLOCK_DEVICE:
                perms = "b";
                break;
            case SftpAttributes.POSIX_REGULAR_FILE:
                perms = "-";
                break;
            case SftpAttributes.POSIX_SYMLINK:
                perms = "l";
                break;
            case SftpAttributes.POSIX_SOCKET:
                perms = "s";
                break;
            case SftpAttributes.POSIX_FIFO:
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

        return perms + " " + this.nlink + " user group " + len + " " + date;
    };
    SftpAttributes.SIZE = 0x00000001;
    SftpAttributes.UIDGID = 0x00000002;
    SftpAttributes.PERMISSIONS = 0x00000004;
    SftpAttributes.ACMODTIME = 0x00000008;
    SftpAttributes.BASIC = 0x0000000F;
    SftpAttributes.EXTENDED = 0x80000000;

    SftpAttributes.POSIX_FIFO = 0x1000;
    SftpAttributes.POSIX_CHARACTER_DEVICE = 0x2000;
    SftpAttributes.POSIX_DIRECTORY = 0x4000;
    SftpAttributes.POSIX_BLOCK_DEVICE = 0x6000;
    SftpAttributes.POSIX_REGULAR_FILE = 0x8000;
    SftpAttributes.POSIX_SYMLINK = 0xA000;
    SftpAttributes.POSIX_SOCKET = 0XC000;
    return SftpAttributes;
})();
exports.SftpAttributes = SftpAttributes;

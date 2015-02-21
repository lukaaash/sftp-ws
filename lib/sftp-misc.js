var packet = require("./sftp-packet");
var enums = require("./sftp-enums");
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
exports.SftpFlags = SftpFlags;
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
exports.SftpStatus = SftpStatus;
var SftpOptions = (function () {
    function SftpOptions() {
    }
    return SftpOptions;
})();
exports.SftpOptions = SftpOptions;
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
exports.SftpItem = SftpItem;
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
exports.SftpAttributes = SftpAttributes;

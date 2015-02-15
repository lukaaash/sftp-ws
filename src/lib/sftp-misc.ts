import packet = require("./sftp-packet");
import api = require("./sftp-api");
import common = require("./sftp-common");

import SftpPacket = packet.SftpPacket;
import SftpPacketWriter = packet.SftpPacketWriter;
import SftpPacketReader = packet.SftpPacketReader;
import SftpPacketType = common.SftpPacketType;
import IItem = api.IItem;
import IStats = api.IStats;
import IStatsExt = api.IStatsExt;

export class SftpFlags {
    
    // flags
    static READ = 0x00000001;
    static WRITE = 0x00000002;
    static APPEND = 0x00000004;
    static CREATE = 0x00000008;
    static TRUNC = 0x00000010;
    static EXCL = 0x00000020;

    static toFlags(flags: string): number {
        switch (flags) {
            case 'r':
                return SftpFlags.READ;
            case 'r+':
                return SftpFlags.READ | SftpFlags.WRITE;
            case 'w':
                return SftpFlags.WRITE | SftpFlags.CREATE | SftpFlags.TRUNC;
            case 'w+':
                return SftpFlags.WRITE | SftpFlags.CREATE | SftpFlags.TRUNC | SftpFlags.READ;
            case 'wx':
            case 'xw':
                return SftpFlags.WRITE | SftpFlags.CREATE | SftpFlags.TRUNC | SftpFlags.EXCL;
            case 'wx+':
            case 'xw+':
                return SftpFlags.WRITE | SftpFlags.CREATE | SftpFlags.TRUNC | SftpFlags.EXCL | SftpFlags.READ;
            case 'a':
                return SftpFlags.WRITE | SftpFlags.CREATE | SftpFlags.APPEND;
            case 'a+':
                return SftpFlags.WRITE | SftpFlags.CREATE | SftpFlags.APPEND | SftpFlags.READ;
            case 'ax':
            case 'xa':
                return SftpFlags.WRITE | SftpFlags.CREATE | SftpFlags.APPEND | SftpFlags.EXCL;
            case 'ax+':
            case 'xa+':
                return SftpFlags.WRITE | SftpFlags.CREATE | SftpFlags.APPEND | SftpFlags.EXCL | SftpFlags.READ;
            default:
                throw Error("Invalid flags '" + flags + "'");
        }
    }

    static fromFlags(flags: number): string[] {
        var read = ((flags & this.READ) != 0);
        var write = ((flags & this.WRITE) != 0);
        var append = ((flags & this.APPEND) != 0);
        var create = ((flags & this.CREATE) != 0);
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
    }

}

export class SftpStatus {
    static OK = 0;
    static EOF = 1;
    static NO_SUCH_FILE = 2;
    static PERMISSION_DENIED = 3;
    static FAILURE = 4;
    static BAD_MESSAGE = 5;
    static NO_CONNECTION = 6;
    static CONNECTION_LOST = 7;
    static OP_UNSUPPORTED = 8;

    static write(response: SftpPacketWriter, code: number, message: string) {
        response.type = SftpPacketType.STATUS;
        response.start();

        response.writeInt32(code);
        response.writeString(message);
        response.writeInt32(0);
    }

    static writeSuccess(response: SftpPacketWriter) {
        this.write(response, this.OK, "OK");
    }

    static writeError(response: SftpPacketWriter, err: ErrnoException) {
        var message: string;
        var code = this.FAILURE;

        // loosely based on the list from https://github.com/rvagg/node-errno/blob/master/errno.js

        switch (err.errno | 0) {
            default:
                if (err["isPublic"] === true)
                    message = err.message;
                else
                    message = "Unknown error";
                break;
            case 1: // EOF
                message = "End of file";
                code = this.EOF;
                break;
            case 3: // EACCES
                message = "Permission denied";
                code = this.PERMISSION_DENIED;
                break;
            case 4: // EAGAIN
                message = "Try again";
                break;
            case 9: // EBADF
                message = "Bad file number";
                break;
            case 10: // EBUSY
                message = "Device or resource busy";
                break;
            case 18: // EINVAL
                message = "Invalid argument";
                break;
            case 20: // EMFILE
                message = "Too many open files";
                break;
            case 24: // ENFILE
                message = "File table overflow";
                break
            case 25: // ENOBUFS
                message = "No buffer space available";
                break
            case 26: // ENOMEM
                message = "Out of memory";
                break
            case 27: // ENOTDIR
                message = "Not a directory";
                break
            case 28: // EISDIR
                message = "Is a directory";
                break
            case 34: // ENOENT
                message = "No such file or directory";
                code = this.NO_SUCH_FILE;
                break
            case 35: // ENOSYS
                message = "Function not implemented";
                code = this.OP_UNSUPPORTED;
                break;
            case 47: // EEXIST
                message = "File exists";
                break
            case 49: // ENAMETOOLONG
                message = "File name too long";
                break
            case 50: // EPERM
                message = "Operation not permitted";
                break
            case 51: // ELOOP
                message = "Too many symbolic links encountered";
                break
            case 52: // EXDEV
                message = "Cross-device link ";
                break
            case 53: // ENOTEMPTY
                message = "Directory not empty";
                break
            case 54: // ENOSPC
                message = "No space left on device";
                break
            case 55: // EIO
                message = "I/O error";
                break
            case 56: // EROFS
                message = "Read-only file system";
                break
            case 57: // ENODEV
                message = "No such device";
                code = this.NO_SUCH_FILE;
                break
            case 58: // ESPIPE
                message = "Illegal seek";
                break;
            case 59: // ECANCELED
                message = "Operation canceled";
                break;
        }

        this.write(response, code, message);
    }

}

export class SftpOptions {
    encoding: string;
    handle: NodeBuffer;
    flags: string;
    mode: number;
    start: number;
    end: number;
    autoClose: boolean;
}

export class SftpItem implements IItem {
    filename: string;
    longname: string;
    stats: SftpAttributes;

    constructor(request: SftpPacketReader)
    constructor(filename: string, stats?: IStats)
    constructor(arg: any, stats?: IStats) {
        if (typeof arg === 'object') {
            var request = <SftpPacketReader>arg;
            this.filename = request.readString();
            this.longname = request.readString();
            this.stats = new SftpAttributes(request);
        } else {
            var filename = <string>arg;
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

    write(response: SftpPacketWriter): void {
        response.writeString(this.filename);
        response.writeString(this.longname);
        if (typeof this.stats === "object")
            this.stats.write(response);
        else
            response.writeInt32(0);
    }
}

export class SftpAttributes implements IStats {

    //uint32   flags
    //uint64   size           present only if flag SSH_FILEXFER_ATTR_SIZE
    //uint32   uid            present only if flag SSH_FILEXFER_ATTR_UIDGID
    //uint32   gid            present only if flag SSH_FILEXFER_ATTR_UIDGID
    //uint32   permissions    present only if flag SSH_FILEXFER_ATTR_PERMISSIONS
    //uint32   atime          present only if flag SSH_FILEXFER_ATTR_ACMODTIME
    //uint32   mtime          present only if flag SSH_FILEXFER_ATTR_ACMODTIME
    //uint32   extended_count present only if flag SSH_FILEXFER_ATTR_EXTENDED
    //string   extended_type
    //string   extended_data
    //...      more extended data(extended_type - extended_data pairs),
    //so that number of pairs equals extended_count

    // attribute flags
    static SIZE = 0x00000001;
    static UIDGID = 0x00000002;
    static PERMISSIONS = 0x00000004;
    static ACMODTIME = 0x00000008;
    static BASIC = 0x0000000F;
    static EXTENDED = 0x80000000;

    static POSIX_FIFO = 0x1000;
    static POSIX_CHARACTER_DEVICE = 0x2000;
    static POSIX_DIRECTORY = 0x4000;
    static POSIX_BLOCK_DEVICE = 0x6000;
    static POSIX_REGULAR_FILE = 0x8000;
    static POSIX_SYMLINK = 0xA000;
    static POSIX_SOCKET = 0XC000;

    flags: number;
    size: number;
    uid: number;
    gid: number;
    mode: number;
    atime: Date;
    mtime: Date;
    nlink: number;

    constructor(request?: SftpPacketReader) {
        if (typeof request === 'undefined') {
            this.flags = 0;
            return;
        }

        var flags = this.flags = request.readUint32();

        if (flags & SftpAttributes.SIZE) {
            this.size = request.readInt64();
        }

        if (flags & SftpAttributes.UIDGID) {
            this.uid = request.readInt32();
            this.gid = request.readInt32();
        }

        if (flags & SftpAttributes.PERMISSIONS) {
            this.mode = request.readUint32();
        }

        if (flags & SftpAttributes.ACMODTIME) {
            this.atime = new Date(1000 * request.readUint32());
            this.mtime = new Date(1000 * request.readUint32());
        }

        if (flags & SftpAttributes.EXTENDED) {
            this.flags -= SftpAttributes.EXTENDED;
            this.size = request.readInt64();
            for (var i = 0; i < this.size; i++) {
                request.skipString();
                request.skipString();
            }
        }
    }

    write(response: SftpPacketWriter): void {
        var flags = this.flags;
        response.writeInt32(flags);

        if (flags & SftpAttributes.SIZE) {
            response.writeInt64(this.size);
        }

        if (flags & SftpAttributes.UIDGID) {
            response.writeInt32(this.uid);
            response.writeInt32(this.gid);
        }

        if (flags & SftpAttributes.PERMISSIONS) {
            response.writeInt32(this.mode);
        }

        if (flags & SftpAttributes.ACMODTIME) {
            response.writeInt32(this.atime.getTime() / 1000);
            response.writeInt32(this.mtime.getTime() / 1000);
        }

        if (flags & SftpAttributes.EXTENDED) {
            response.writeInt32(0);
        }
    }

    from(stats: IStatsExt): void {
        if (stats == null || typeof stats === 'undefined') {
            this.flags = 0;
        } else {
            var flags = 0;

            if (typeof stats.size !== 'undefined') {
                flags |= SftpAttributes.SIZE;
                this.size = stats.size | 0;
            }

            if (typeof stats.uid !== 'undefined' || typeof stats.gid !== 'undefined') {
                flags |= SftpAttributes.UIDGID;
                this.uid = stats.uid | 0;
                this.gid = stats.gid | 0;
            }

            if (typeof stats.mode !== 'undefined') {
                flags |= SftpAttributes.PERMISSIONS;
                this.mode = stats.mode | 0;
            }

            if (typeof stats.atime !== 'undefined' || typeof stats.mtime !== 'undefined') {
                flags |= SftpAttributes.ACMODTIME;
                this.atime = stats.atime; //TODO: make sure its Date
                this.mtime = stats.mtime; //TODO: make sure its Date
            }

            if (typeof stats.nlink !== 'undefined') {
                this.nlink = stats.nlink;
            }

            this.flags = flags;
        }
    }

    toString(): string {
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

        var nlink = (typeof this.nlink === 'undefined') ? 1 : this.nlink;

        return perms + " " + nlink + " user group " + len + " " + date;
    }

}


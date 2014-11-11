/// <reference path="sftp-packet.ts" />

import packet = require("./sftp-packet");
import api = require("./sftp-api");

import SftpPacket = packet.SftpPacket;
import IItem = api.IItem;
import IStats = api.IStats;

export class SftpFlags {
    
    // flags
    static READ = 0x00000001;
    static WRITE = 0x00000002;
    static APPEND = 0x00000004;
    static CREAT = 0x00000008;
    static TRUNC = 0x00000010;
    static EXCL = 0x00000020;

    static getModes(flags: number): string[] {
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

    static write(packet: SftpPacket, code: number, message: string) {
        packet.reset();
        packet.writeByte(SftpPacket.STATUS);
        packet.writeInt32(packet.id | 0);
        packet.writeInt32(code);
        packet.writeString(message);
        packet.writeInt32(0);
    }

    static writeSuccess(packet: SftpPacket) {
        this.write(packet, this.OK, "OK");
    }

    static writeError(packet: SftpPacket, err: ErrnoException) {
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

        this.write(packet, code, message);
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

    constructor(filename: string, stats?: IStats) {
        this.filename = filename;
        this.longname = filename;
        if (typeof stats === 'object') {
            var attr = new SftpAttributes();
            attr.from(stats);
            this.stats = attr;
            this.longname = attr.toString() + " " + filename;
        }
    }

    write(packet: SftpPacket): void {
        packet.writeString(this.filename);
        packet.writeString(this.longname);
        if (typeof this.stats === "object")
            this.stats.write(packet);
        else
            packet.writeInt32(0);
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

    constructor(packet?: SftpPacket) {
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

    write(buffer: SftpPacket): void {
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
    }

    from(stats: IStats): void {
        this.flags = SftpAttributes.BASIC;
        this.size = stats.size | 0;
        this.uid = stats.uid | 0;
        this.gid = stats.gid | 0;
        this.atime = stats.atime;
        this.mode = stats.mode;
        this.mtime = stats.mtime;
        this.nlink = (<any>stats).nlink;
        if (typeof this.nlink === 'undefined')
            this.nlink = 1;
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

        return perms + " user group " + this.nlink + " " + len + " " + date;
    }

}


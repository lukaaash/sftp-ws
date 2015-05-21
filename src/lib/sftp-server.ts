import packet = require("./sftp-packet");
import misc = require("./sftp-misc");
import safe = require("./fs-safe");
import api = require("./fs-api");
import enums = require("./sftp-enums");
import channel = require("./channel");
import util = require("./util");

import SafeFilesystem = safe.SafeFilesystem;
import IStats = api.IStats;
import IItem = api.IItem;
import ILogWriter = util.ILogWriter;
import ISession = channel.ISession;
import ISessionHost = channel.ISessionHost;
import Channel = channel.Channel;
import SftpPacket = packet.SftpPacket;
import SftpPacketWriter = packet.SftpPacketWriter;
import SftpPacketReader = packet.SftpPacketReader;
import SftpPacketType = enums.SftpPacketType;
import SftpStatusCode = enums.SftpStatusCode;
import SftpItem = misc.SftpItem;
import SftpAttributes = misc.SftpAttributes;
import SftpStatus = misc.SftpStatus;
import SftpFlags = misc.SftpFlags;


class SftpResponse extends SftpPacketWriter {

    constructor() {
        super(34000);
    }

    handleInfo: SftpHandleInfo;
}

class SftpHandleInfo {
    h: number;
    handle: any;
    items: IItem[];
    locked: boolean;
    tasks: Function[];

    constructor(h: number) {
        this.h = h;
        this.items = null;
        this.locked = false;
        this.tasks = [];
    }
}

class SftpException implements Error {
    name: string;
    message: string;
    code: SftpStatusCode;
    errno: number;

    constructor(err: ErrnoException) {
        var message: string;
        var code = SftpStatusCode.FAILURE;
        var errno = err.errno | 0;
        // loosely based on the list from https://github.com/rvagg/node-errno/blob/master/errno.js

        switch (errno) {
            default:
                if (err["isPublic"] === true)
                    message = err.message;
                else
                    message = "Unspecified error (" + errno + ")";
                break;
            case 1: // EOF
                message = "End of file";
                code = SftpStatusCode.EOF;
                break;
            case 3: // EACCES
                message = "Permission denied";
                code = SftpStatusCode.PERMISSION_DENIED;
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
                break;
            case 25: // ENOBUFS
                message = "No buffer space available";
                break;
            case 26: // ENOMEM
                message = "Out of memory";
                break;
            case 27: // ENOTDIR
                message = "Not a directory";
                break;
            case 28: // EISDIR
                message = "Is a directory";
                break;
            case 34: // ENOENT
                message = "No such file or directory";
                code = SftpStatusCode.NO_SUCH_FILE;
                break;
            case 35: // ENOSYS
                message = "Function not implemented";
                code = SftpStatusCode.OP_UNSUPPORTED;
                break;
            case 47: // EEXIST
                message = "File exists";
                break;
            case 49: // ENAMETOOLONG
                message = "File name too long";
                break;
            case 50: // EPERM
                message = "Operation not permitted";
                break;
            case 51: // ELOOP
                message = "Too many symbolic links encountered";
                break;
            case 52: // EXDEV
                message = "Cross-device link";
                break;
            case 53: // ENOTEMPTY
                message = "Directory not empty";
                break;
            case 54: // ENOSPC
                message = "No space left on device";
                break;
            case 55: // EIO
                message = "I/O error";
                break;
            case 56: // EROFS
                message = "Read-only file system";
                break;
            case 57: // ENODEV
                message = "No such device";
                code = SftpStatusCode.NO_SUCH_FILE;
                break;
            case 58: // ESPIPE
                message = "Illegal seek";
                break;
            case 59: // ECANCELED
                message = "Operation canceled";
                break;
        }

        this.name = "SftpException";
        this.message = message;
        this.code = code;
        this.errno = errno;
    }
}

export class SftpServerSessionCore implements ISession {

    private _fs: SafeFilesystem;
    private _host: ISessionHost;
    private _log: ILogWriter;
    private _handles: SftpHandleInfo[];
    private nextHandle: number;

    private static MAX_HANDLE_COUNT = 512;

    constructor(host: ISessionHost, fs: SafeFilesystem) {
        this._fs = fs;
        this._host = host;
        this._log = host.log;
        this._handles = new Array<SftpHandleInfo>(SftpServerSessionCore.MAX_HANDLE_COUNT + 1);
        this.nextHandle = 1;
    }

    private send(response: SftpResponse): void {

        // send packet
        var packet = response.finish();
        this._host.send(packet);

        // start next task
        if (typeof response.handleInfo === 'object') {
            this.processNext(response.handleInfo);
        }
    }

    private sendStatus(response: SftpResponse, code: number, message: string): void {
        SftpStatus.write(response, code, message);
        this.send(response);
    }

    private sendError(response: SftpResponse, err: Error, isFatal: boolean): void {
        var message: string;
        var code: SftpStatusCode;
        if (!isFatal) {
            var error = new SftpException(err);
            code = error.code;
            message = error.message;
            this._log.log("Unable to process request #" + response.id + ": " + err);
        } else {
            code = SftpStatusCode.FAILURE;
            message = "Internal server error";
            this._log.error("Fatal error while processing request #" + response.id + ": " + err);
        }

        SftpStatus.write(response, code, message);
        this.send(response);
    }

    private sendIfError(response: SftpResponse, err: ErrnoException): boolean {
        if (err == null || typeof err === 'undefined')
            return false;

        this.sendError(response, err, false);
        return true;
    }

    private sendSuccess(response: SftpResponse, err: ErrnoException): void {
        if (this.sendIfError(response, err))
            return;

        SftpStatus.writeSuccess(response);
        this.send(response);
    }

    private sendAttribs(response: SftpResponse, err: ErrnoException, stats: IStats): void {
        if (this.sendIfError(response, err))
            return;

        response.type = SftpPacketType.ATTRS;
        response.start();

        var attr = new SftpAttributes();
        attr.from(stats);
        attr.write(response);
        this.send(response);
    }

    private sendHandle(response: SftpResponse, handleInfo: SftpHandleInfo): void {
        response.type = SftpPacketType.HANDLE;
        response.start();
        
        response.writeInt32(4);
        response.writeInt32(handleInfo.h);
        this.send(response);
    }

    private sendPath(response: SftpResponse, err: ErrnoException, path: string): void {
        if (this.sendIfError(response, err))
            return;

        response.type = SftpPacketType.NAME;
        response.start();

        response.writeInt32(1);
        response.writeString(path);
        response.writeString("");
        response.writeInt32(0);
        this.send(response);
    }

    private readHandleInfo(request: SftpPacketReader): SftpHandleInfo {
        // read a 4-byte handle
        if (request.readInt32() != 4)
            return null;

        var h = request.readInt32();
        var handleInfo = this._handles[h];
        if (typeof handleInfo !== 'object')
            return null;

        return handleInfo;
    }

    private createHandleInfo() {
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
    }

    private deleteHandleInfo(handleInfo: SftpHandleInfo): void {
        var h = handleInfo.h;
        if (h < 0)
            return;

        handleInfo.h = -1;
        var handleInfo = this._handles[h];
        if (typeof handleInfo !== 'object')
            throw new Error("Handle not found");

        delete this._handles[h];
    }

    end(): void {
        this._host.close();
    }

    _end(): void {
        if (typeof this._fs === 'undefined')
            return;

        // close all handles
        this._handles.forEach(handleInfo => {
            this._fs.close(handleInfo.handle, err => {
            });
        });
           
        delete this._fs;
    }

    _process(data: NodeBuffer): void {
        var request = new SftpPacketReader(data);

        var response = new SftpResponse();

        if (request.type == SftpPacketType.INIT) {
            var version = request.readInt32();

            response.type = SftpPacketType.VERSION;
            response.start();

            response.writeInt32(3);
            this.send(response);
            return;
        }

        response.id = request.id;

        var handleInfo: SftpHandleInfo;
        switch (request.type) {
            case SftpPacketType.CLOSE:
            case SftpPacketType.READ:
            case SftpPacketType.WRITE:
            case SftpPacketType.FSTAT:
            case SftpPacketType.FSETSTAT:
            case SftpPacketType.READDIR:
                handleInfo = this.readHandleInfo(request);
                if (handleInfo == null) {
                    this.sendStatus(response, SftpStatusCode.FAILURE, "Invalid handle");
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
        } else if (!handleInfo.locked) {
            handleInfo.locked = true;
            this.processRequest(request, response, handleInfo);
        } else {
            handleInfo.tasks.push(() => {
                if (handleInfo.h < 0)
                    this.sendStatus(response, SftpStatusCode.FAILURE, "Invalid handle");
                else
                    this.processRequest(request, response, handleInfo);
            });
        }
    }

    private processNext(handleInfo: SftpHandleInfo) {
        if (handleInfo.tasks.length > 0) {
            var task = handleInfo.tasks.shift();
            task();
        } else {
            handleInfo.locked = false;
        }
    }

    private processRequest(request: SftpPacketReader, response: SftpResponse, handleInfo: SftpHandleInfo) {
        var fs = this._fs;
        if (typeof fs === 'undefined') {
            // already disposed
            return;
        }

        try {

            if (request.length > 66000) {
                this.sendStatus(response, SftpStatusCode.BAD_MESSAGE, "Packet too long");
                return;
            }

            switch (request.type) {

                case SftpPacketType.OPEN:
                    var path = request.readString();
                    var pflags = request.readInt32();
                    var attrs = new SftpAttributes(request);

                    var modes = SftpFlags.fromNumber(pflags);

                    if (modes.length == 0) {
                        this.sendStatus(response, SftpStatusCode.FAILURE, "Unsupported flags");
                        return;
                    }

                    handleInfo = this.createHandleInfo();
                    if (handleInfo == null) {
                        this.sendStatus(response, SftpStatusCode.FAILURE, "Too many open handles");
                        return;
                    }

                    var openFile = () => {
                        var mode = modes.shift();
                        fs.open(path, mode, attrs, (err, handle) => {

                            if (this.sendIfError(response, err)) {
                                this.deleteHandleInfo(handleInfo);
                                return;
                            }

                            if (modes.length == 0) {
                                handleInfo.handle = handle;
                                this.sendHandle(response, handleInfo);
                                return;
                            }

                            fs.close(handle, err => {
                                if (this.sendIfError(response, err)) {
                                    this.deleteHandleInfo(handleInfo);
                                    return;
                                }

                                openFile();
                            });
                        });
                    };

                    openFile();
                    return;

                case SftpPacketType.CLOSE:
                    this.deleteHandleInfo(handleInfo);

                    fs.close(handleInfo.handle, err => this.sendSuccess(response, err));
                    return;

                case SftpPacketType.READ:
                    var position = request.readInt64();
                    var count = request.readInt32();
                    if (count > 0x8000)
                        count = 0x8000;

                    response.type = SftpPacketType.DATA;
                    response.start();

                    var offset = response.position + 4;
                    response.check(4 + count);

                    fs.read(handleInfo.handle, response.buffer, offset, count, position, (err, bytesRead, b) => {
                        if (this.sendIfError(response, err))
                            return;

                        if (bytesRead == 0) {
                            this.sendStatus(response, SftpStatusCode.EOF, "EOF");
                            return;
                        }

                        response.writeInt32(bytesRead);
                        response.skip(bytesRead);
                        this.send(response);
                    });
                    return;

                case SftpPacketType.WRITE:
                    var position = request.readInt64();
                    var count = request.readInt32();
                    var offset = request.position;
                    request.skip(count);

                    fs.write(handleInfo.handle, request.buffer, offset, count, position, err => this.sendSuccess(response, err));
                    return;

                case SftpPacketType.LSTAT:
                    var path = request.readString();

                    fs.lstat(path, (err, stats) => this.sendAttribs(response, err, stats));
                    return;

                case SftpPacketType.FSTAT:
                    fs.fstat(handleInfo.handle, (err, stats) => this.sendAttribs(response, err, stats));
                    return;

                case SftpPacketType.SETSTAT:
                    var path = request.readString();
                    var attrs = new SftpAttributes(request);

                    fs.setstat(path, attrs, err => this.sendSuccess(response, err));
                    return;

                case SftpPacketType.FSETSTAT:
                    var attrs = new SftpAttributes(request);

                    fs.fsetstat(handleInfo.handle, attrs, err => this.sendSuccess(response, err));
                    return;

                case SftpPacketType.OPENDIR:
                    var path = request.readString();

                    handleInfo = this.createHandleInfo();
                    if (handleInfo == null) {
                        this.sendStatus(response, SftpStatusCode.FAILURE, "Too many open handles");
                        return;
                    }

                    fs.opendir(path, (err, handle) => {

                        if (this.sendIfError(response, err)) {
                            this.deleteHandleInfo(handleInfo);
                            return;
                        }

                        handleInfo.handle = handle;
                        this.sendHandle(response, handleInfo);
                    });
                    return;

                case SftpPacketType.READDIR:
                    response.type = SftpPacketType.NAME;
                    response.start();

                    var count = 0;
                    var offset = response.position;
                    response.writeInt32(0);

                    var done = () => {
                        if (count == 0) {
                            this.sendStatus(response, SftpStatusCode.EOF, "EOF");
                        } else {
                            response.buffer.writeInt32BE(count, offset, true);
                            this.send(response);
                        }
                    };

                    var next = (items: IItem[]|boolean) => {

                        if (items === false) {
                            done();
                            return;
                        }
                        
                        var list = <IItem[]>items;

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

                    var readdir = () => {
                        fs.readdir(handleInfo.handle, (err, items) => {
                            if (this.sendIfError(response, err))
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

                case SftpPacketType.REMOVE:
                    var path = request.readString();

                    fs.unlink(path, err => this.sendSuccess(response, err));
                    return;

                case SftpPacketType.MKDIR:
                    var path = request.readString();
                    var attrs = new SftpAttributes(request);

                    fs.mkdir(path, attrs, err => this.sendSuccess(response, err));
                    return;

                case SftpPacketType.RMDIR:
                    var path = request.readString();

                    fs.rmdir(path, err => this.sendSuccess(response, err));
                    return;

                case SftpPacketType.REALPATH:
                    var path = request.readString();

                    fs.realpath(path, (err, resolvedPath) => this.sendPath(response, err, resolvedPath));
                    return;

                case SftpPacketType.STAT:
                    var path = request.readString();

                    fs.stat(path, (err, stats) => this.sendAttribs(response, err, stats));
                    return;

                case SftpPacketType.RENAME:
                    var oldpath = request.readString();
                    var newpath = request.readString();

                    fs.rename(oldpath, newpath, err => this.sendSuccess(response, err));
                    return;

                case SftpPacketType.READLINK:
                    var path = request.readString();

                    fs.readlink(path, (err, linkString) => this.sendPath(response, err, linkString));
                    return;

                case SftpPacketType.SYMLINK:
                    var linkpath = request.readString();
                    var targetpath = request.readString();

                    fs.symlink(targetpath, linkpath, err => this.sendSuccess(response, err));
                    return;

                default:
                    this.sendStatus(response, SftpStatusCode.OP_UNSUPPORTED, "Not supported");
            }
        } catch (err) {
            this.sendError(response, err, true);
        }
    }

}

export class SftpServerSession extends SftpServerSessionCore {

    constructor(ws: any, fs: SafeFilesystem, log: ILogWriter) {
        var channel = new Channel(this, ws, log);
        super(channel, fs);
    }
}


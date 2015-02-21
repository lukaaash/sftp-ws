import packet = require("./sftp-packet");
import misc = require("./sftp-misc");
import safe = require("./fs-safe");
import api = require("./fs-api");
import enums = require("./sftp-enums");
import channel = require("./channel");

import SafeFilesystem = safe.SafeFilesystem;
import IStats = api.IStats;
import IItem = api.IItem;
import ILogWriter = channel.ILogWriter;
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

export class SftpServerSessionCore implements ISession {

    private _fs: SafeFilesystem;
    private _host: ISessionHost;
    private _handles: SftpHandleInfo[];
    private nextHandle: number;

    private static MAX_HANDLE_COUNT = 512;

    constructor(host: ISessionHost, fs: SafeFilesystem) {
        this._fs = fs;
        this._host = host;
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

    private sendError(response: SftpResponse, err: Error): void {
        var log = this._host.log;
        if (typeof log === 'object' && typeof log.error === 'function')
            log.error(err);

        SftpStatus.writeError(response, err);
        this.send(response);
    }

    private sendIfError(response: SftpResponse, err: ErrnoException): boolean {
        if (err == null || typeof err === 'undefined')
            return false;

        this.sendError(response, err);
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
                if (handleInfo == null)
                    this.sendStatus(response, SftpStatusCode.FAILURE, "Invalid handle");

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
            handleInfo.tasks.push(() => this.processRequest(request, response, handleInfo));
        }
    }

    private processNext(handleInfo: SftpHandleInfo) {
        if (handleInfo.tasks.length > 0) {
            var task = handleInfo.tasks.pop();
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

                    var modes = SftpFlags.fromFlags(pflags);

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

                    var offset = response.position;
                    response.check(4 + count);

                    fs.read(handleInfo.handle, response.buffer, offset, count, position, (err, bytesRead, b) => {
                        if (this.sendIfError(response, err))
                            return;

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

                    fs.write(handleInfo.handle, response.buffer, offset, count, position, err => this.sendSuccess(response, err));
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
            this.sendError(response, err);
        }
    }

}

export class SftpServerSession extends SftpServerSessionCore {

    constructor(ws: any, fs: SafeFilesystem, log: ILogWriter) {

        var channel = new Channel(this, ws);
        channel.log = log;
        super(channel, fs);

        channel.start();
    }
}


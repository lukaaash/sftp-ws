/// <reference path="sftp-packet.ts" />
/// <reference path="sftp-misc.ts" />

import packet = require("./sftp-packet");
import misc = require("./sftp-misc");
import fs = require("./sftp-fs");
import api = require("./sftp-api");

import SafeFilesystem = fs.SafeFilesystem;
import IStats = api.IStats;
import IItem = api.IItem;
import ILogWriter = api.ILogWriter;
import IServer = api.IServerSession;

import SftpPacket = packet.SftpPacket;
import SftpPacketWriter = packet.SftpPacketWriter;
import SftpPacketReader = packet.SftpPacketReader;
import SftpItem = misc.SftpItem;
import SftpAttributes = misc.SftpAttributes;
import SftpStatus = misc.SftpStatus;
import SftpFlags = misc.SftpFlags;

export interface SftpServerOptions {
    fs: SafeFilesystem;
    send: (data: NodeBuffer) => void;
    log?: ILogWriter;
}

export class SftpServer implements IServer {

    private fs: SafeFilesystem;
    private sendData: (data: NodeBuffer) => void;
    private log: ILogWriter;
    private readdirCache: Object;

    constructor(options: SftpServerOptions) {
        this.fs = options.fs;
        this.sendData = options.send;
        this.log = options.log;
        this.readdirCache = {};
    }

    private send(response: SftpPacketWriter): void {
        var length = response.position;

        // write packet length
        response.position = 0;
        response.writeInt32(length - 4);

        this.sendData(response.buffer.slice(0, length));
    }

    private sendStatus(response: SftpPacketWriter, code: number, message: string): void {
        SftpStatus.write(response, code, message);
        this.send(response);
    }

    private sendError(response: SftpPacketWriter, err: Error): void {
        if (typeof this.log === 'object' && typeof this.log.error === 'function')
            this.log.error(err);

        SftpStatus.writeError(response, err);
        this.send(response);
    }

    private sendIfError(response: SftpPacketWriter, err: ErrnoException): boolean {
        if (err == null || typeof err === 'undefined')
            return false;

        this.sendError(response, err);
        return true;
    }

    private sendSuccess(response: SftpPacketWriter, err: ErrnoException): void {
        if (this.sendIfError(response, err))
            return;

        SftpStatus.writeSuccess(response);
        this.send(response);
    }

    private sendAttribs(response: SftpPacketWriter, err: ErrnoException, stats: IStats): void {
        if (this.sendIfError(response, err))
            return;

        response.type = SftpPacket.ATTRS;
        response.start();

        var attr = new SftpAttributes();
        attr.from(stats);
        attr.write(response);
        this.send(response);
    }

    private sendHandle(response: SftpPacketWriter, err: ErrnoException, handle: any): void {
        if (this.sendIfError(response, err))
            return;

        response.type = SftpPacket.HANDLE;
        response.start();
        
        response.writeHandle(handle);
        this.send(response);
    }

    private sendPath(response: SftpPacketWriter, err: ErrnoException, path: string): void {
        if (this.sendIfError(response, err))
            return;

        response.type = SftpPacket.NAME;
        response.start();

        response.writeInt32(1);
        response.writeString(path);
        response.writeString("");
        response.writeInt32(0);
        this.send(response);
    }

    end(): void {
        if (typeof this.fs === 'undefined')
            return;

        this.fs.dispose();
        delete this.fs;
    }

    process(data: NodeBuffer): void {
        var fs = this.fs;
        if (typeof fs === 'undefined')
            throw new Error("Session has ended");

        var request = new SftpPacketReader(data);

        var response = new SftpPacketWriter(34000);

        if (request.type == SftpPacket.INIT) {
            var version = request.readInt32();

            response.type = SftpPacket.VERSION;
            response.start();

            response.writeInt32(3);
            this.send(response);
            return;
        }

        response.id = request.id;

        if (request.length > 66000) {
            this.sendStatus(response, SftpStatus.BAD_MESSAGE, "Packet too long");
            return;
        }

        try {
            switch (request.type) {

                case SftpPacket.OPEN:
                    var path = request.readString();
                    var pflags = request.readInt32();
                    var attrs = new SftpAttributes(request);

                    var modes = SftpFlags.fromFlags(pflags);

                    if (modes.length == 0) {
                        this.sendStatus(response, SftpStatus.FAILURE, "Unsupported flags");
                        return;
                    }

                    var openFile = () => {
                        var mode = modes.shift();
                        fs.open(path, mode, attrs, (err, handle) => {

                            if (this.sendIfError(response, err))
                                return;

                            if (modes.length == 0) {
                                this.sendHandle(response, null, handle);
                                return;
                            }

                            fs.close(handle, err => {
                                if (this.sendIfError(response, err))
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

                    fs.close(handle, err => this.sendSuccess(response, err));
                    return;

                case SftpPacket.READ:
                    var handle = request.readHandle();
                    var position = request.readInt64();
                    var count = request.readInt32();
                    if (count > 0x8000)
                        count = 0x8000;

                    response.type = SftpPacket.DATA;
                    response.start();

                    var offset = response.position;
                    response.check(4 + count);

                    fs.read(handle, response.buffer, offset, count, position, (err, bytesRead, b) => {
                        if (this.sendIfError(response, err))
                            return;

                        response.writeInt32(bytesRead);
                        response.skip(bytesRead);
                        this.send(response);
                    });
                    return;

                case SftpPacket.WRITE:
                    var handle = request.readHandle();
                    var position = request.readInt64();
                    var count = request.readInt32();
                    var offset = request.position;
                    request.skip(count);

                    fs.write(handle, response.buffer, offset, count, position, err => this.sendSuccess(response, err));
                    return;

                case SftpPacket.LSTAT:
                    var path = request.readString();

                    fs.lstat(path, (err, stats) => this.sendAttribs(response, err, stats));
                    return;

                case SftpPacket.FSTAT:
                    var handle = request.readHandle();

                    fs.fstat(handle, (err, stats) => this.sendAttribs(response, err, stats));
                    return;

                case SftpPacket.SETSTAT:
                    var path = request.readString();
                    var attrs = new SftpAttributes(request);

                    fs.setstat(path, attrs, err => this.sendSuccess(response, err));
                    return;

                case SftpPacket.FSETSTAT:
                    var handle = request.readHandle();
                    var attrs = new SftpAttributes(request);

                    fs.fsetstat(handle, attrs, err => this.sendSuccess(response, err));
                    return;

                case SftpPacket.OPENDIR:
                    var path = request.readString();

                    fs.opendir(path, (err, handle) => this.sendHandle(response, err, handle));
                    return;

                case SftpPacket.READDIR:
                    var handle = request.readHandle();

                    response.type = SftpPacket.NAME;
                    response.start();

                    var count = 0;
                    var offset = response.position;
                    response.writeInt32(0);

                    var done = () => {
                        if (count == 0) {
                            this.sendStatus(response, SftpStatus.EOF, "EOF");
                        } else {
                            response.buffer.writeInt32BE(count, offset, true);
                            this.send(response);
                        }
                    };

                    var next = (items: IItem[]) => {

                        if (items == null) {
                            done();
                            return;
                        }

                        while (items.length > 0) {
                            var it = items.shift();
                            var item = new SftpItem(it.filename, it.stats);
                            item.write(response);
                            count++;

                            if (response.position > 0x7000) {
                                this.readdirCache[handle] = items;
                                done();
                                return;
                            }
                        }

                        readdir();
                    };

                    var readdir = () => {
                        fs.readdir(handle, (err, items) => {
                            if (this.sendIfError(response, err))
                                return;

                            next(items);
                        });
                    };

                    var previous = <IItem[]>this.readdirCache[handle];
                    if (Array.isArray(previous) && previous.length > 0) {
                        this.readdirCache[handle] = [];
                        next(previous);
                        return;
                    }

                    readdir();
                    return;

                case SftpPacket.REMOVE:
                    var path = request.readString();

                    fs.unlink(path, err => this.sendSuccess(response, err));
                    return;

                case SftpPacket.MKDIR:
                    var path = request.readString();
                    var attrs = new SftpAttributes(request);

                    fs.mkdir(path, attrs, err => this.sendSuccess(response, err));
                    return;

                case SftpPacket.RMDIR:
                    var path = request.readString();

                    fs.rmdir(path, err => this.sendSuccess(response, err));
                    return;

                case SftpPacket.REALPATH:
                    var path = request.readString();

                    fs.realpath(path, (err, resolvedPath) => this.sendPath(response, err, resolvedPath));
                    return;

                case SftpPacket.STAT:
                    var path = request.readString();

                    fs.stat(path, (err, stats) => this.sendAttribs(response, err, stats));
                    return;

                case SftpPacket.RENAME:
                    var oldpath = request.readString();
                    var newpath = request.readString();

                    fs.rename(oldpath, newpath, err => this.sendSuccess(response, err));
                    return;

                case SftpPacket.READLINK:
                    var path = request.readString();

                    fs.readlink(path, (err, linkString) => this.sendPath(response, err, linkString));
                    return;

                case SftpPacket.SYMLINK:
                    var linkpath = request.readString();
                    var targetpath = request.readString();

                    fs.symlink(targetpath, linkpath, err => this.sendSuccess(response, err));
                    return;

                default:
                    this.sendStatus(response, SftpStatus.OP_UNSUPPORTED, "Not supported");
            }
        } catch (err) {
            this.sendError(response, err);
        }
    }

}

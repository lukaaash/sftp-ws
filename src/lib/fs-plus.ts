import api = require("./fs-api");
import misc = require("./fs-misc");
import transfers = require("./fs-transfers");
import util = require("./util");
import events = require("events");

import IFilesystem = api.IFilesystem;
import IItem = api.IItem;
import IStats = api.IStats;
import IDataSource = transfers.IDataSource;
import wrap = util.wrap;
import toDataSource = transfers.toDataSource;
import EventEmitter = events.EventEmitter;
import readdir = misc.readdir;

export interface IFilesystemExt extends FilesystemPlus {
}

export class FilesystemPlus extends EventEmitter implements IFilesystem {

    protected _fs: IFilesystem;
    protected _local: IFilesystem;

    constructor(fs: IFilesystem, local: IFilesystem) {
        super();
        this._fs = fs;
        this._local = local;
    }

    private wrapCallback(callback: any): any {
        if (typeof callback !== 'function') {
            // use dummy callback to prevent having to check this later
            return function () { };
        } else {
            return () => {
                try {
                    callback.apply(this, arguments);
                } catch (error) {
                    this.emit("error", error);
                }
            };
        }
    }

    on(event: 'error', listener: (err: Error) => void): EventEmitter;
    on(event: string, listener: Function): EventEmitter;
    on(event: string, listener: Function): EventEmitter {
        return super.on(event, listener);
    }

    once(event: 'error', listener: (err: Error) => void): EventEmitter; //WEB: // removed
    once(event: string, listener: Function): EventEmitter; //WEB: // removed
    once(event: string, listener: Function): EventEmitter { //WEB: // removed
        return super.once(event, listener); //WEB: // removed
    } //WEB: // removed

    addListener(event: 'error', listener: (err: Error) => void): EventEmitter;
    addListener(event: string, listener: Function): EventEmitter;
    addListener(event: string, listener: Function): EventEmitter {
        return super.addListener(event, listener);
    }

    open(path: string, flags: string, attrs?: IStats, callback?: (err: Error, handle: any) => any): void {
        if (typeof attrs === 'function' && typeof callback === 'undefined') {
            callback = <any>attrs;
            attrs = null;
        }
        callback = this.wrapCallback(callback);

        this._fs.open(path, flags, attrs, callback);
    }

    close(handle: any, callback?: (err: Error) => any): void {
        callback = this.wrapCallback(callback);

        this._fs.close(handle, callback);
    }

    read(handle: any, buffer: NodeBuffer, offset: number, length: number, position: number, callback?: (err: Error, bytesRead: number, buffer: NodeBuffer) => any): void {
        callback = this.wrapCallback(callback);

        this._fs.read(handle, buffer, offset, length, position, callback);
    }

    write(handle: any, buffer: NodeBuffer, offset: number, length: number, position: number, callback?: (err: Error) => any): void {
        callback = this.wrapCallback(callback);

        this._fs.write(handle, buffer, offset, length, position, callback);
    }

    lstat(path: string, callback?: (err: Error, attrs: IStats) => any): void {
        callback = this.wrapCallback(callback);

        this._fs.lstat(path, callback);
    }

    fstat(handle: any, callback?: (err: Error, attrs: IStats) => any): void {
        callback = this.wrapCallback(callback);

        this._fs.fstat(handle, callback);
    }

    setstat(path: string, attrs: IStats, callback?: (err: Error) => any): void {
        callback = this.wrapCallback(callback);

        this._fs.setstat(path, attrs, callback);
    }

    fsetstat(handle: any, attrs: IStats, callback?: (err: Error) => any): void {
        callback = this.wrapCallback(callback);

        this._fs.fsetstat(handle, attrs, callback);
    }

    opendir(path: string, callback?: (err: Error, handle: any) => any): void {
        callback = this.wrapCallback(callback);

        this._fs.opendir(path, callback);
    }

    readdir(path: string, callback?: (err: Error, items: IItem[]) => any)
    readdir(handle: any, callback?: (err: Error, items: IItem[]|boolean) => any)
    readdir(handle: any, callback?: (err: Error, items: IItem[]|boolean) => any): void {
        callback = this.wrapCallback(callback);

        if (typeof handle !== 'string')
            return this._fs.readdir(handle, callback);

        readdir(this._fs, <string>handle, callback);
    }

    unlink(path: string, callback?: (err: Error) => any): void {
        callback = this.wrapCallback(callback);

        this._fs.unlink(path, callback);
    }

    mkdir(path: string, attrs?: IStats, callback?: (err: Error) => any): void {
        if (typeof attrs === 'function' && typeof callback === 'undefined') {
            callback = <any>attrs;
            attrs = null;
        }
        callback = this.wrapCallback(callback);

        this._fs.mkdir(path, attrs, callback);
    }

    rmdir(path: string, callback?: (err: Error) => any): void {
        callback = this.wrapCallback(callback);

        this._fs.rmdir(path, callback);
    }

    realpath(path: string, callback?: (err: Error, resolvedPath: string) => any): void {
        callback = this.wrapCallback(callback);

        this._fs.realpath(path, callback);
    }

    stat(path: string, callback?: (err: Error, attrs: IStats) => any): void {
        callback = this.wrapCallback(callback);

        this._fs.stat(path, callback);
    }

    rename(oldPath: string, newPath: string, callback?: (err: Error) => any): void {
        callback = this.wrapCallback(callback);

        this._fs.rename(oldPath, newPath, callback);
    }

    readlink(path: string, callback?: (err: Error, linkString: string) => any): void {
        callback = this.wrapCallback(callback);

        this._fs.readlink(path, callback);
    }

    symlink(targetpath: string, linkpath: string, callback?: (err: Error) => any): void {
        callback = this.wrapCallback(callback);

        this._fs.symlink(targetpath, linkpath);
    }

    upload(localPath: string|string[], remotePath: string, callback?: (err: Error) => any)
    upload(input: any, remotePath: string, callback?: (err: Error) => any): void {
        callback = this.wrapCallback(callback);

        var _this = this;
        var source = <IDataSource>null;

        toDataSource(this._local, input,(err, src) => {
            if (err) return callback(err);
            source = src;
            next();
        });

        function next() {
            try {
                source.next(upload);
            } catch (err) {
                callback(err);
            }
        }

        function upload(err: Error, finished: boolean) {
            if (err || finished) return callback(err);

            _this._upload(source, remotePath, err => {
                if (err) {
                    try {
                        source.close(err2 => {
                            //TODO: log err2
                            callback(err);
                        });
                    } catch (err2) {
                        //TODO: log err2
                        callback(err);
                    }
                } else {
                    next();
                }
            });
        }
    }

    private _upload(source: IDataSource, remotePath: string, callback?: (err: Error) => any): void {

        var sftp = this._fs;
        var position = 0;
        var handle = null;

        var maxRequests = 4;
        var requests = 0;
        var chunkSize = 0x8000;
        var eof = false;
        var reading = false;
        var closing = false;
        var error = <Error>null;

        try {
            if (remotePath.length > 0 && remotePath != '/') {
                if (remotePath[remotePath.length - 1] != '/')
                    remotePath += "/";
            }
            remotePath += source.name;

            sftp.open(remotePath, "w",(err, h) => {
                if (err) return callback(err);
                handle = h;
                source.ondata = chunk;
                read();
            });
        } catch (err) {
            return process.nextTick(() => callback(err));
        }

        function next(): void {
            if (requests >= maxRequests)
                return;

            if (reading || closing)
                return;

            if (eof || error) {
                if (handle) {
                    close();
                } else if (requests <= 0) {
                    callback(error);
                }
                return;
            }

            read();
        }

        function read(): void {
            console.log("read");
            try {
                requests++;
                reading = true;
                source.read(chunkSize);
            } catch (err) {
                error = error || err;
                reading = false;
                requests--;
                next();
            }
        }

        function chunk(err: Error, buffer: NodeBuffer, bytesRead: number): void {
            reading = false;

            if (err) {
                error = error || err;
                requests--;
            } else if (bytesRead > 0) {
                write(buffer, bytesRead);
            } else {
                console.log("eof");
                eof = true;
                requests--;
            }

            next();
        }

        function write(buffer: NodeBuffer, bytesRead: number): void {
            try {
                var p = position;
                console.log("write", p, bytesRead);
                position += bytesRead;
                sftp.write(handle, buffer, 0, bytesRead, p, err => {
                    error = error || err;
                    requests--;
                    console.log("done");
                    next();
                });
            } catch (err) {
                error = error || err;
                requests--;
                next();
            }

            //TODO: progress reporting
        }

        function close(): void {
            try {
                closing = true;
                sftp.close(handle, err => {
                    error = error || err;
                    closing = false;
                    handle = null;
                    next();
                });
            } catch (err) {
                error = error || err;
                closing = false;
                handle = null;
                next();
            }
        }

    }


}
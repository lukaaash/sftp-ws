import fs = require("fs");
import Path = require("path");
import api = require("./fs-api");

import IFilesystem = api.IFilesystem;
import IItem = api.IItem;
import IStats = api.IStats;

class LocalError implements Error {
    name: string;
    message: string;
    isPublic: boolean;

    constructor(message: string, isPublic?: boolean) {
        this.name = "Error";
        this.message = message;
        this.isPublic = (isPublic === true);
    }
}

export class LocalFilesystem implements IFilesystem {

    private isWindows: boolean;

    constructor() {
        this.isWindows = (process.platform === 'win32');
    }

    open(path: string, flags: string, attrs?: IStats, callback?: (err: Error, handle: any) => any): void {
        var mode = typeof attrs === 'object' ? attrs.mode : undefined;
        fs.open(path, flags, mode, (err, fd) => callback(err, fd));
        //LATER: pay attemtion to attrs other than mode (low priority - many SFTP servers ignore these as well)
    }

    close(handle: any, callback?: (err: Error) => any): void {

        var err = null;
        if (Array.isArray(handle)) {
            if (handle.closed == true)
                err = new LocalError("Already closed", true);
            else
                handle.closed = true;
        } else if (!isNaN(handle)) {
            fs.close(handle, callback);
            return;
        } else {
            err = new LocalError("Invalid handle", true);
        }

        if (typeof callback == 'function') {
            process.nextTick(function () {
                callback(err);
            });
        }
    }

    read(handle: any, buffer: NodeBuffer, offset: number, length: number, position: number, callback?: (err: Error, bytesRead: number, buffer: NodeBuffer) => any): void {
        var initialOffset = offset;
        var totalBytes = 0;
        var read = () => {
            fs.read(handle, buffer, offset, length, position, (err, bytesRead, b) => {
                if (typeof err === 'undefined' || err == null) {
                    offset += bytesRead;
                    length -= bytesRead;
                    totalBytes += bytesRead;

                    if (length > 0 && bytesRead > 0) {
                        read();
                        return;
                    }
                }

                if (typeof callback === 'function')
                    callback(err, totalBytes, buffer.slice(initialOffset, initialOffset + totalBytes));
            });
        };

        read();
    }

    write(handle: any, buffer: NodeBuffer, offset: number, length: number, position: number, callback?: (err: Error) => any): void {
        var write = () => {
            fs.write(handle, buffer, offset, length, position, (err, bytesWritten, b) => {
                if (typeof err === 'undefined' || err == null) {
                    offset += bytesWritten;
                    length -= bytesWritten;

                    if (length > 0) {
                        write();
                        return;
                    }
                }

                if (typeof callback === 'function')
                    callback(err);
            });
        };

        write();
    }

    lstat(path: string, callback?: (err: Error, attrs: IStats) => any): void {
        fs.lstat(path, callback);
    }

    fstat(handle: any, callback?: (err: Error, attrs: IStats) => any): void {
        fs.fstat(handle, callback);
    }

    private run(actions: Function[], callback?: (err: Error) => any) {

        if (actions.length == 0) {
            if (typeof callback == 'function') {
                process.nextTick(callback);
                callback(null);
            }
            return;
        }

        var action = actions.shift();

        var next = (err?: ErrnoException) => {
            if (typeof err !== 'undefined' && err != null) {
                if (typeof callback == 'function')
                    callback(err);
                return;
            }

            if (actions.length == 0) {
                if (typeof callback == 'function')
                    callback(null);
                return;
            }

            action = actions.shift();
            action(next);
        };

        action(next);
    }

    setstat(path: string, attrs: IStats, callback?: (err: Error) => any): void {

        var actions = new Array<Function>();

        if (!isNaN(attrs.uid) || !isNaN(attrs.gid))
            actions.push(function (next: Function) { fs.chown(path, attrs.uid, attrs.gid, err => next(err)) });

        if (!isNaN(attrs.mode))
            actions.push(function (next: Function) { fs.chmod(path, attrs.mode, err => next(err)) });

        if (typeof attrs.atime === 'object' || typeof attrs.mtime === 'object') {
            var atime = (typeof attrs.atime.getTime === 'function') ? attrs.atime.getTime() : undefined;
            var mtime = (typeof attrs.mtime.getTime === 'function') ? attrs.mtime.getTime() : undefined;
            actions.push(function (next: Function) { fs.utimes(path, attrs.atime.getTime(), attrs.mtime.getTime(), err => next(err)) });
        }

        if (!isNaN(attrs.size))
            actions.push(function (next: Function) { fs.truncate(path, attrs.size, err => next(err)) });    

        this.run(actions, callback);
    }

    fsetstat(handle: any, attrs: IStats, callback?: (err: Error) => any): void {

        var actions = new Array<Function>();

        if (!isNaN(attrs.uid) || !isNaN(attrs.gid))
            actions.push(function (next: Function) { fs.fchown(handle, attrs.uid, attrs.gid, err => next(err)) });

        if (!isNaN(attrs.mode))
            actions.push(function (next: Function) { fs.fchmod(handle, attrs.mode, err => next(err)) });

        if (typeof attrs.atime === 'object' || typeof attrs.mtime === 'object') {
            var atime = (typeof attrs.atime.getTime === 'function') ? attrs.atime.getTime() : undefined;
            var mtime = (typeof attrs.mtime.getTime === 'function') ? attrs.mtime.getTime() : undefined;
            actions.push(function (next: Function) { fs.futimes(handle, attrs.atime.getTime(), attrs.mtime.getTime(), err => next(err)) });
        }

        if (!isNaN(attrs.size))
            actions.push(function (next: Function) { fs.ftruncate(handle, attrs.size, err => next(err)) });

        this.run(actions, callback);
    }

    opendir(path: string, callback?: (err: Error, handle: any) => any): void {

        fs.readdir(path, (err, files) => {

            if (typeof err !== 'undefined' && err != null) {
                files = null;
            } else if (Array.isArray(files)) {
                files["path"] = path;
                err = null;
            } else {
                files = null;
                err = new LocalError("Unable to read directory", true);
                err.path = path;
            }

            if (typeof callback === 'function')
                callback(err, files);

        });
    }

    readdir(handle: any, callback?: (err: Error, items: IItem[]|boolean) => any): void {
        var err = null;
        var path = null;
        if (Array.isArray(handle)) {
            if (handle.closed == true) {
                err = new LocalError("Already closed", true);
            } else {
                path = handle.path;
                if (typeof path !== 'string')
                    err = new LocalError("Invalid handle", true);
            }
        } else {
            err = new LocalError("Invalid handle", true);
        }

        var items = [];
        if (err == null) {
            var list = <Array<string>>handle;

            if (list.length > 0) {

                var next = function () {
                    if (items.length >= 64 || list.length == 0) {
                        if (typeof callback == 'function') {
                            callback(null,(items.length > 0) ? items : false);
                        }
                        return;
                    }

                    var name = list.shift();
                    var itemPath = Path.join(path, name);

                    fs.stat(itemPath, (err, stats) => {
                        if (typeof err !== 'undefined' && err != null) {
                            //TODO: log unsuccessful stat?
                        } else {
                            items.push({ filename: name, stats: stats });
                        }
                        next();
                    });
                };

                next();
                return;
            }
        }


        if (typeof callback == 'function') {
            process.nextTick(function () {
                callback(err, err == null ? false : null);
            });
        }
    }

    unlink(path: string, callback?: (err: Error) => any): void {
        fs.unlink(path, callback);
    }

    mkdir(path: string, attrs?: IStats, callback?: (err: Error) => any): void {
        var mode = typeof attrs === 'object' ? attrs.mode : undefined;
        fs.mkdir(path, mode, callback);
        //LATER: pay attemtion to attrs other than mode (low priority - many SFTP servers ignore these as well)
    }

    rmdir(path: string, callback?: (err: Error) => any): void {
        fs.rmdir(path, callback);
    }

    realpath(path: string, callback?: (err: Error, resolvedPath: string) => any): void {
        fs.realpath(path, callback);
    }

    stat(path: string, callback?: (err: Error, attrs: IStats) => any): void {
        fs.stat(path, callback);
    }

    rename(oldPath: string, newPath: string, callback?: (err: Error) => any): void {
        fs.rename(oldPath, newPath, callback);
    }

    readlink(path: string, callback?: (err: Error, linkString: string) => any): void {
        fs.readlink(path, callback);
    }

    symlink(targetpath: string, linkpath: string, callback?: (err: Error) => any): void {
        //TODO: make sure the order is correct (beware - other SFTP client and server vendors are confused as well)
        //TODO: make sure this work on Windows
        fs.symlink(linkpath, targetpath, 'file', callback);
    }

}

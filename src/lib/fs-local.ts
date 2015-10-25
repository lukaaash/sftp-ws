import fs = require("fs");
import api = require("./fs-api");
import misc = require("./fs-misc");

import IFilesystem = api.IFilesystem;
import IItem = api.IItem;
import IStats = api.IStats;
import RenameFlags = api.RenameFlags;
import Path = misc.Path;
import FileUtil = misc.FileUtil;

class LocalError implements Error {
    name: string;
    message: string;
    isPublic: boolean;
    code: string;
    errno: number;

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

    private checkPath(path: string, name: string): string {
        var localPath = Path.create(path, this, name);
        var path = localPath.path;

        if (path[0] == '~') {
            var home = <string>(process.env.HOME || process.env.USERPROFILE || ".");
            if (path.length == 1) return home;
            if (path[1] === '/' || (path[1] === '\\' && this.isWindows)) {
                path = localPath.join(home, path.substr(2)).path;
            }
        }

        return path;
    }

    private fail(code: string, callback?: (err: Error, ...args: any[]) => any): void {
        var message;
        var errno;
        switch (code) {
            case "ENOSYS":
                message = "Operation not supported";
                errno = 35;
                break;
            default:
                message = "Failure";
                code = "EFAILURE";
                break;
        }

        var error = new LocalError(message, true);
        error.code = code;
        error.errno = errno;
        process.nextTick(() => callback(error));
    }

    open(path: string, flags: string, attrs?: IStats, callback?: (err: Error, handle: any) => any): void {
        if (typeof attrs === 'function' && typeof callback === 'undefined') {
            callback = <any>attrs;
            attrs = null;
        }

        path = this.checkPath(path, 'path');

        var mode = (attrs && typeof attrs === 'object') ? attrs.mode : undefined;
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

    read(handle: any, buffer: Buffer, offset: number, length: number, position: number, callback?: (err: Error, buffer: Buffer, bytesRead: number) => any): void {
        var initialOffset = offset;
        var totalBytes = 0;

        if (!buffer) {
            buffer = new Buffer(length);
            offset = 0;
        }

        var read = () => {
            fs.read(handle, buffer, offset, length, position, (err, bytesRead, b) => {
                if (typeof err === 'undefined' || err == null) {
                    length -= bytesRead;
                    totalBytes += bytesRead;

                    if (length > 0 && bytesRead > 0) {
                        offset += bytesRead;
                        position += bytesRead;
                        read();
                        return;
                    }
                }

                if (typeof callback === 'function')
                    callback(err, buffer.slice(offset, offset + totalBytes), totalBytes);
            });
        };

        read();
    }

    write(handle: any, buffer: Buffer, offset: number, length: number, position: number, callback?: (err: Error) => any): void {
        var write = () => {
            fs.write(handle, buffer, offset, length, position, (err, bytesWritten, b) => {
                if (typeof err === 'undefined' || err == null) {
                    length -= bytesWritten;

                    if (length > 0) {
                        offset += bytesWritten;
                        position += bytesWritten;
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
        path = this.checkPath(path, 'path');

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

        var next = (err?: NodeJS.ErrnoException) => {
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
        path = this.checkPath(path, 'path');

        var actions = new Array<Function>();

        if (!isNaN(attrs.uid) || !isNaN(attrs.gid))
            actions.push(function (next: Function) { fs.chown(path, attrs.uid, attrs.gid, err => next(err)) });

        if (!isNaN(attrs.mode))
            actions.push(function (next: Function) { fs.chmod(path, attrs.mode, err => next(err)) });

        if (!isNaN(attrs.size))
            actions.push(function (next: Function) { fs.truncate(path, attrs.size, err => next(err)) });

        if (typeof attrs.atime === 'object' || typeof attrs.mtime === 'object') {
            //var atime = (typeof attrs.atime.getTime === 'function') ? attrs.atime.getTime() : undefined;
            //var mtime = (typeof attrs.mtime.getTime === 'function') ? attrs.mtime.getTime() : undefined;
            var atime = attrs.atime;
            var mtime = attrs.mtime;
            actions.push(function (next: Function) { fs.utimes(path, <any>atime, <any>mtime, err => next(err)) });
        }

        this.run(actions, callback);
    }

    fsetstat(handle: any, attrs: IStats, callback?: (err: Error) => any): void {

        var actions = new Array<Function>();

        if (!isNaN(attrs.uid) || !isNaN(attrs.gid))
            actions.push(function (next: Function) { fs.fchown(handle, attrs.uid, attrs.gid, err => next(err)) });

        if (!isNaN(attrs.mode))
            actions.push(function (next: Function) { fs.fchmod(handle, attrs.mode, err => next(err)) });

        if (!isNaN(attrs.size))
            actions.push(function (next: Function) { fs.ftruncate(handle, attrs.size, err => next(err)) });

        if (typeof attrs.atime === 'object' || typeof attrs.mtime === 'object') {
            //var atime = (typeof attrs.atime.getTime === 'function') ? attrs.atime.getTime() : undefined;
            //var mtime = (typeof attrs.mtime.getTime === 'function') ? attrs.mtime.getTime() : undefined;
            var atime = attrs.atime;
            var mtime = attrs.mtime;
            actions.push(function (next: Function) { fs.futimes(handle, <any>atime, <any>mtime, err => next(err)) });
        }

        this.run(actions, callback);
    }

    opendir(path: string, callback?: (err: Error, handle: any) => any): void {
        path = this.checkPath(path, 'path');

        fs.readdir(path, (err, files) => {

            if (files) files.splice(0, 0, ".", "..");

            if (typeof err !== 'undefined' && err != null) {
                files = null;
            } else if (Array.isArray(files)) {
                files["path"] = new Path(path, this).normalize();
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
        var path = <Path>null;
        if (Array.isArray(handle)) {
            if (handle.closed == true) {
                err = new LocalError("Already closed", true);
            } else {
                path = handle.path;
                if (typeof path !== 'object')
                    err = new LocalError("Invalid handle", true);
            }
        } else {
            err = new LocalError("Invalid handle", true);
        }

        var windows = this.isWindows;
        var items = [];
        if (err == null) {
            var paths = (<string[]>handle).splice(0, 64);

            if (paths.length > 0) {

                function next(): void {
                    var name = paths.shift();

                    if (!name) {
                        if (typeof callback == 'function') {
                            callback(null, (items.length > 0) ? items : false);
                        }
                        return;
                    }

                    var itemPath = path.join(name).path;

                    fs.stat(itemPath, (err, stats) => {
                        if (typeof err !== 'undefined' && err != null) {
                            //TODO: log unsuccessful stat?
                        } else {
                            //
                            items.push({
                                filename: name,
                                longname: FileUtil.toString(name, stats),
                                stats: stats,
                            });
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
        path = this.checkPath(path, 'path');

        fs.unlink(path, callback);
    }

    mkdir(path: string, attrs?: IStats, callback?: (err: Error) => any): void {
        path = this.checkPath(path, 'path');

        if (typeof attrs === 'function' && typeof callback === 'undefined') {
            callback = <any>attrs;
            attrs = null;
        }

        var mode = (attrs && typeof attrs === 'object') ? attrs.mode : undefined;
        fs.mkdir(path, mode, callback);
        //LATER: pay attemtion to attrs other than mode (low priority - many SFTP servers ignore these as well)
    }

    rmdir(path: string, callback?: (err: Error) => any): void {
        path = this.checkPath(path, 'path');

        fs.rmdir(path, callback);
    }

    realpath(path: string, callback?: (err: Error, resolvedPath: string) => any): void {
        path = this.checkPath(path, 'path');

        fs.realpath(path, callback);
    }

    stat(path: string, callback?: (err: Error, attrs: IStats) => any): void {
        path = this.checkPath(path, 'path');

        fs.stat(path, callback);
    }

    rename(oldPath: string, newPath: string, flags: RenameFlags, callback?: (err: Error) => any): void {
        oldPath = this.checkPath(oldPath, 'oldPath');
        newPath = this.checkPath(newPath, 'newPath');

        if (flags === RenameFlags.OVERWRITE) {
            // posix-style rename (with overwrite)
            fs.rename(oldPath, newPath, callback);
        } else if (flags === 0) {
            // Windows-style rename (fail if destination exists)
            fs.link(oldPath, newPath, err => {
                if (err) return callback(err);

                fs.unlink(oldPath, err => {
                    callback(err);
                });
            });
        } else {
            this.fail("ENOSYS", callback);
        }
    }

    readlink(path: string, callback?: (err: Error, linkString: string) => any): void {
        path = this.checkPath(path, 'path');

        fs.readlink(path, callback);
    }

    symlink(oldPath: string, newPath: string, callback?: (err: Error) => any): void {
        oldPath = this.checkPath(oldPath, 'oldPath');
        newPath = this.checkPath(newPath, 'newPath');

        //TODO: make sure the order is correct (beware - other SFTP client and server vendors are confused as well)
        //TODO: make sure this work on Windows
        fs.symlink(newPath, oldPath, 'file', callback);
    }

    link(oldPath: string, newPath: string, callback?: (err: Error) => any): void {
        oldPath = this.checkPath(oldPath, 'oldPath');
        newPath = this.checkPath(newPath, 'newPath');

        fs.link(oldPath, newPath, callback);
    }


}

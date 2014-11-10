import fs = require("fs");
import Path = require("path");

export interface IStats {
    mode?: number;
    uid?: number;
    gid?: number;
    size?: number;
    atime?: Date;
    mtime?: Date;
}

export interface IItem {
    filename: string;
    stats?: IStats;
}

export interface IFilesystem {
    open(path: string, flags: string, attrs?: IStats, callback?: (err: Error, handle: any) => any): void;
    close(handle: any, callback?: (err: Error) => any): void;
    read(handle: any, buffer, offset, length, position, callback?: (err: Error, bytesRead: number, buffer: NodeBuffer) => any): void;
    write(handle: any, buffer, offset, length, position, callback?: (err: Error) => any): void;
    lstat(path: string, callback?: (err: Error, attrs: IStats) => any): void;
    fstat(handle: any, callback?: (err: Error, attrs: IStats) => any): void;
    setstat(path: string, attrs: IStats, callback?: (err: Error) => any): void;
    fsetstat(handle: any, attrs: IStats, callback?: (err: Error) => any): void;
    opendir(path: string, callback?: (err: Error, handle: any) => any): void;
    readdir(handle: any, callback?: (err: Error, items: IItem[]) => any): void;
    unlink(path: string, callback?: (err: Error) => any): void;
    mkdir(path: string, attrs?: IStats, callback?: (err: Error) => any): void;
    rmdir(path: string, callback?: (err: Error) => any): void;
    realpath(path: string, callback?: (err: Error, resolvedPath: string) => any): void;
    stat(path: string, callback?: (err: Error, attrs: IStats) => any): void;
    rename(oldPath: string, newPath: string, callback?: (err: Error) => any): void;
    readlink(path: string, callback?: (err: Error, linkString: string) => any): void;
    symlink(targetpath: string, linkpath: string, callback?: (err: Error) => any): void;
}


class LocalError implements ErrnoException {
    name: string;
    message: string;
    errno: number;
    code: string;

    constructor(message: string, errno?: number, code?: string) {
        this.name = "Error";
        this.message = message;
        this.errno = errno;
        this.code = code;
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
    }

    close(handle: any, callback?: (err: Error) => any): void {

        var err = null;
        if (Array.isArray(handle)) {
            if (handle.closed == true)
                err = new LocalError("already closed");
            else
                handle.closed = true;
        } else if (!isNaN(handle)) {
            fs.close(handle, callback);
            return;
        } else {
            err = new LocalError("invalid handle");
        }

        if (typeof callback == 'function') {
            process.nextTick(function () {
                callback(err);
            });
        }
    }

    read(handle: any, buffer: NodeBuffer, offset: number, length: number, position: number, callback?: (err: Error, bytesRead: number, buffer: NodeBuffer) => any): void {
        fs.read(handle, buffer, offset, length, position, callback);
    }

    write(handle: any, buffer: NodeBuffer, offset: number, length: number, position: number, callback?: (err: Error) => any): void {
        fs.write(handle, buffer, offset, length, position, (err, written, b) => {
        });

        var write = () => {
            fs.write(handle, buffer, offset, length, position, (err, written, b) => {
                if (typeof err === 'undefined' || err == null) {
                    offset += written;
                    length -= written;

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
                err = new LocalError("unable to read directory");
                err.path = path;
            }

            if (typeof callback === 'function')
                callback(err, files);

        });
    }

    readdir(handle: any, callback?: (err: Error, items: IItem[]) => any): void {
        var err = null;
        var path = null;
        if (Array.isArray(handle)) {
            if (handle.closed == true) {
                err = new LocalError("already closed");
            } else {
                path = handle.path;
                if (typeof path !== 'string')
                    err = new LocalError("invalid handle");
            }
        } else {
            err = new LocalError("invalid handle");
        }

        var items = [];
        if (err == null) {
            var list = <Array<string>>handle;

            if (list.length > 0) {

                var next = function () {
                    if (items.length >= 64 || list.length == 0) {
                        if (typeof callback == 'function') {
                            callback(null, items);
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
                callback(err, items);
            });
        }
    }

    unlink(path: string, callback?: (err: Error) => any): void {
        fs.unlink(path, callback);
    }

    mkdir(path: string, attrs?: IStats, callback?: (err: Error) => any): void {
        var mode = typeof attrs === 'object' ? attrs.mode : undefined;
        fs.mkdir(path, mode, callback);
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

export class SafeFilesystem implements IFilesystem {

    isSafe: boolean;
    private fs: IFilesystem;
    private isWindows: boolean;
    private root: string;
    private handles: Array<any>;

    constructor(virtualRootPath: string, fs: IFilesystem) {
        this.isSafe = true;
        this.fs = fs;
        this.isWindows = (fs['isWindows'] === true);
        this.root = Path.normalize(virtualRootPath);
        this.handles = [];
    }

    dispose() {
        if (this.handles == null)
            return;

        this.handles.forEach(handle => {
            if (handle != null)
                this.fs.close(handle, err => { });
        });

        this.fs = null;
        this.root = null;
        this.handles = null;
    }

    private addHandle(value: any): number {
        if (value == null || typeof value === 'undefined')
            throw Error("Invalid handle");

        if (this.handles.length > 64) {
            for (var h = 0; h < this.handles.length; h++) {
                if (this.handles[h] == null) {
                    this.handles[h] = value;
                    return h + 1; // return (index + 1) to avoid a zero handle
                }
            }
        }

        this.handles.push(value);
        return this.handles.length; // return (index + 1) to avoid a zero handle
    }

    private removeHandle(h: number) {
        this.handles[h - 1] = null;
    }

    private toLocalHandle(h: number): any {
        var value = this.handles[h - 1];
        if (value == null || typeof value === 'undefined')
            return null;

        return value;
    }

    private toVirtualPath(fullPath: string): string {

        var i = 0;
        var path: string;
        while (true) {
            if (i >= this.root.length) {
                path = fullPath.substr(this.root.length);
                break;
            }

            if (i >= fullPath.length) {
                //TODO: enhance this to reflect the real path
                path = "/";
                break;
            }

            if (this.root[i] != fullPath[i]) {
                //TODO: enhance this to reflect the real path
                path = "/";
                break;
            }

            i++;
        }

        if (this.isWindows)
            path = path.replace(/\\/g, '/');

        if (path.length == 0)
            path = "/";

        return path;
    }

    private toRealPath(path: string): string {
        path = Path.normalize(path);
        path = Path.join(this.root, path);
        return path;
    }

    private processCallbackPath(err: Error, path: string, callback?: (err: Error, path: string) => any) {
        if (typeof callback === 'function') {
            if (typeof err !== 'undefined' && err != null) {
                path = undefined;
            } else {
                if (typeof path !== 'undefined' && path != null)
                    path = this.toVirtualPath(path);
            }

            callback(err, path);
        }
    }

    private processCallbackHandle(err: Error, handle: any, callback?: (err: Error, handle: any) => any) {
        if (typeof callback === 'function') {
            if (typeof err !== 'undefined' && err != null) {
                handle = undefined;
            } else {
            if (typeof handle !== 'undefined' && handle != null)
                handle = this.addHandle(handle);
            }

            callback(err, handle);
        }
    }

    open(path: string, flags: string, attrs?: IStats, callback?: (err: Error, handle: any) => any): void {
        path = this.toRealPath(path);
        this.fs.open(path, flags, attrs, (err, handle) => this.processCallbackHandle(err, handle, callback));
    }

    close(handle: any, callback?: (err: Error) => any): void {
        var h = <number>handle;
        handle = this.toLocalHandle(h);
        if (handle != null)
            this.removeHandle(h);

        this.fs.close(handle, callback);
    }

    read(handle: any, buffer, offset, length, position, callback?: (err: Error, bytesRead: number, buffer: NodeBuffer) => any): void {
        handle = this.toLocalHandle(handle);
        this.fs.read(handle, buffer, offset, length, position, callback);
    }

    write(handle: any, buffer, offset, length, position, callback?: (err: Error) => any): void {
        handle = this.toLocalHandle(handle);
        this.fs.write(handle, buffer, offset, length, position, callback);
    }

    lstat(path: string, callback?: (err: Error, attrs: IStats) => any): void {
        path = this.toRealPath(path);
        this.fs.lstat(path, callback);
    }

    fstat(handle: any, callback?: (err: Error, attrs: IStats) => any): void {
        handle = this.toLocalHandle(handle);
        this.fs.fstat(handle, callback);
    }

    setstat(path: string, attrs: IStats, callback?: (err: Error) => any): void {
        path = this.toRealPath(path);
        this.fs.setstat(path, attrs, callback);
    }

    fsetstat(handle: any, attrs: IStats, callback?: (err: Error) => any): void {
        handle = this.toLocalHandle(handle);
        this.fs.fsetstat(handle, attrs, callback);
    }

    opendir(path: string, callback?: (err: Error, handle: any) => any): void {
        path = this.toRealPath(path);
        this.fs.opendir(path, (err, handle) => this.processCallbackHandle(err, handle, callback));
    }

    readdir(handle: any, callback?: (err: Error, items: IItem[]) => any): void {
        handle = this.toLocalHandle(handle);
        this.fs.readdir(handle, callback);
    }

    unlink(path: string, callback?: (err: Error) => any): void {
        path = this.toRealPath(path);
        this.fs.unlink(path, callback);
    }

    mkdir(path: string, attrs?: IStats, callback?: (err: Error) => any): void {
        path = this.toRealPath(path);
        this.fs.mkdir(path, attrs, callback);
    }

    rmdir(path: string, callback?: (err: Error) => any): void {
        path = this.toRealPath(path);
        this.fs.rmdir(path, callback);
    }

    realpath(path: string, callback?: (err: Error, resolvedPath: string) => any): void {
        path = this.toRealPath(path);
        this.fs.realpath(path, (err, resolvedPath) => this.processCallbackPath(err, resolvedPath, callback));
    }

    stat(path: string, callback?: (err: Error, attrs: IStats) => any): void {
        path = this.toRealPath(path);
        this.fs.stat(path, callback);
    }

    rename(oldPath: string, newPath: string, callback?: (err: Error) => any): void {
        oldPath = this.toRealPath(oldPath);
        newPath = this.toRealPath(newPath);
        this.fs.rename(oldPath, newPath, callback);
    }

    readlink(path: string, callback?: (err: Error, linkString: string) => any): void {
        path = this.toRealPath(path);
        this.fs.readlink(path, (err, linkString) => this.processCallbackPath(err, linkString, callback));
    }

    symlink(targetpath: string, linkpath: string, callback?: (err: Error) => any): void {
        targetpath = this.toRealPath(targetpath);
        linkpath = this.toRealPath(linkpath);
        this.fs.symlink(targetpath, linkpath, callback);
    }
}

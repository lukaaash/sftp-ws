import fs = require("fs");
import Path = require("path");
import api = require("./sftp-api");

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

export class SafeFilesystem implements IFilesystem {

    isSafe: boolean;
    private fs: IFilesystem;
    private isWindows: boolean;
    private root: string;
    private handles: Array<any>;
    private readOnly: boolean;

    constructor(fs: IFilesystem, virtualRootPath: string, readOnly?: boolean) {
        this.isSafe = true;
        this.fs = fs;
        this.isWindows = (fs['isWindows'] === true);
        this.root = Path.normalize(virtualRootPath);
        this.handles = [];
        this.readOnly = (readOnly == true);
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
        path = Path.join("/", path);
        path = Path.join(this.root, path);
        return path;
    }

    private processCallbackPath(err: Error, path: string, callback: (err: Error, path: string) => any) {
        if (typeof err !== 'undefined' && err != null) {
            path = undefined;
        } else {
            if (typeof path !== 'undefined' && path != null)
                path = this.toVirtualPath(path);
        }

        callback(err, path);
    }

    private processCallbackHandle(err: Error, handle: any, callback: (err: Error, handle: any) => any) {
        if (typeof err !== 'undefined' && err != null) {
            handle = undefined;
        } else {
        if (typeof handle !== 'undefined' && handle != null)
            handle = this.addHandle(handle);
        }

        callback(err, handle);
    }

    private reportReadOnly(callback: (err: Error, ...any) => any) {
        var err = new LocalError("Internal server error", true);

        process.nextTick(() => {
            callback(err);
        });
    }

    private isReadOnly(): boolean {
        return !(this.readOnly === false);
    }

    open(path: string, flags: string, attrs: IStats, callback: (err: Error, handle: any) => any): void {
        if (this.isReadOnly() && flags != "r") {
            this.reportReadOnly(callback);
            return;
        }

        try {
            path = this.toRealPath(path);
            this.fs.open(path, flags, attrs, (err, handle) => this.processCallbackHandle(err, handle, callback));
        } catch (err) {
            callback(err, null);
        }
    }

    close(handle: any, callback: (err: Error) => any): void {
        var h = <number>handle;
        handle = this.toLocalHandle(h);
        if (handle != null)
            this.removeHandle(h);

        try {
            this.fs.close(handle, callback);
        } catch (err) {
            callback(err);
        }
    }

    read(handle: any, buffer, offset, length, position, callback: (err: Error, bytesRead: number, buffer: NodeBuffer) => any): void {
        handle = this.toLocalHandle(handle);

        try {
            this.fs.read(handle, buffer, offset, length, position, callback);
        } catch (err) {
            callback(err, null, null);
        }
    }

    write(handle: any, buffer, offset, length, position, callback: (err: Error) => any): void {
        if (this.isReadOnly()) {
            this.reportReadOnly(callback);
            return;
        }

        handle = this.toLocalHandle(handle);

        try {
            this.fs.write(handle, buffer, offset, length, position, callback);
        } catch (err) {
            callback(err);
        }
    }

    lstat(path: string, callback: (err: Error, attrs: IStats) => any): void {
        path = this.toRealPath(path);

        try {
            this.fs.lstat(path, callback);
        } catch (err) {
            callback(err, null);
        }
    }

    fstat(handle: any, callback: (err: Error, attrs: IStats) => any): void {
        handle = this.toLocalHandle(handle);

        try {
            this.fs.fstat(handle, callback);
        } catch (err) {
            callback(err, null);
        }
    }

    setstat(path: string, attrs: IStats, callback: (err: Error) => any): void {
        if (this.isReadOnly()) {
            this.reportReadOnly(callback);
            return;
        }

        path = this.toRealPath(path);
        try {
            this.fs.setstat(path, attrs, callback);
        } catch (err) {
            callback(err);
        }
    }

    fsetstat(handle: any, attrs: IStats, callback: (err: Error) => any): void {
        if (this.isReadOnly()) {
            this.reportReadOnly(callback);
            return;
        }

        handle = this.toLocalHandle(handle);

        try {
            this.fs.fsetstat(handle, attrs, callback);
        } catch (err) {
            callback(err);
        }
    }

    opendir(path: string, callback: (err: Error, handle: any) => any): void {
        path = this.toRealPath(path);

        try {
            this.fs.opendir(path, (err, handle) => this.processCallbackHandle(err, handle, callback));
        } catch (err) {
            callback(err, null);
        }
    }

    readdir(handle: any, callback: (err: Error, items: IItem[]|boolean) => any): void {
        handle = this.toLocalHandle(handle);

        try {
            this.fs.readdir(handle, callback);
        } catch (err) {
            callback(err, null);
        }
    }

    unlink(path: string, callback: (err: Error) => any): void {
        if (this.isReadOnly()) {
            this.reportReadOnly(callback);
            return;
        }

        path = this.toRealPath(path);

        try {
            this.fs.unlink(path, callback);
        } catch (err) {
            callback(err);
        }
    }

    mkdir(path: string, attrs: IStats, callback: (err: Error) => any): void {
        if (this.isReadOnly()) {
            this.reportReadOnly(callback);
            return;
        }

        path = this.toRealPath(path);

        try {
            this.fs.mkdir(path, attrs, callback);
        } catch (err) {
            callback(err);
        }
    }

    rmdir(path: string, callback: (err: Error) => any): void {
        if (this.isReadOnly()) {
            this.reportReadOnly(callback);
            return;
        }

        path = this.toRealPath(path);

        try {
            this.fs.rmdir(path, callback);
        } catch (err) {
            callback(err);
        }
    }

    realpath(path: string, callback: (err: Error, resolvedPath: string) => any): void {
        path = this.toRealPath(path);

        try {
            this.fs.realpath(path, (err, resolvedPath) => this.processCallbackPath(err, resolvedPath, callback));
        } catch (err) {
            callback(err, null);
        }
    }

    stat(path: string, callback: (err: Error, attrs: IStats) => any): void {
        path = this.toRealPath(path);

        try {
            this.fs.stat(path, callback);
        } catch (err) {
            callback(err, null);
        }
    }

    rename(oldPath: string, newPath: string, callback: (err: Error) => any): void {
        if (this.isReadOnly()) {
            this.reportReadOnly(callback);
            return;
        }

        oldPath = this.toRealPath(oldPath);
        newPath = this.toRealPath(newPath);

        try {
            this.fs.rename(oldPath, newPath, callback);
        } catch (err) {
            callback(err);
        }
    }

    readlink(path: string, callback: (err: Error, linkString: string) => any): void {
        path = this.toRealPath(path);

        try {
            this.fs.readlink(path, (err, linkString) => this.processCallbackPath(err, linkString, callback));
        } catch (err) {
            callback(err, null);
        }
    }

    symlink(targetpath: string, linkpath: string, callback: (err: Error) => any): void {
        if (this.isReadOnly()) {
            this.reportReadOnly(callback);
            return;
        }

        targetpath = this.toRealPath(targetpath);
        linkpath = this.toRealPath(linkpath);

        try {
            this.fs.symlink(targetpath, linkpath, callback);
        } catch (err) {
            callback(err);
        }
    }
}

import fs = require("fs");
import Path = require("path");
import api = require("./fs-api");
import misc = require("./fs-misc");

import IFilesystem = api.IFilesystem;
import IItem = api.IItem;
import IStats = api.IStats;
import RenameFlags = api.RenameFlags;
import FileUtil = misc.FileUtil;

class HandleInfo {
    safe: number;
    real: any;
    busy: boolean;
    actions: Function[];
}

interface HandleToHandleInfoMap {
    [handle: number]: HandleInfo;
}

export class SafeFilesystem implements IFilesystem {

    isSafe: boolean;
    private fs: IFilesystem;
    private isWindows: boolean;
    private root: string;
    private readOnly: boolean;
    private hideUidGid: boolean;

    private _handles: HandleToHandleInfoMap;
    private _nextHandle: number;
    private static MAX_HANDLE_COUNT = 512;

    constructor(fs: IFilesystem, virtualRootPath: string, options: { readOnly?: boolean, hideUidGid?: boolean }) {
        options = options || {};
        this.isSafe = true;
        this.fs = fs;
        this.isWindows = (fs['isWindows'] === true);
        this.root = Path.normalize(virtualRootPath);
        this.readOnly = options.readOnly == true;
        this.hideUidGid = options.hideUidGid == true;
        this._handles = [];
        this._nextHandle = 1;
    }

    private createHandleInfo(): HandleInfo {
        var count = SafeFilesystem.MAX_HANDLE_COUNT;
        while (count-- > 0) {
            var safeHandle = this._nextHandle;
            this._nextHandle = (safeHandle % SafeFilesystem.MAX_HANDLE_COUNT) + 1;
            if (typeof this._handles[safeHandle] === "undefined") {
                var info = new HandleInfo();
                info.real = null;
                info.safe = safeHandle;
                info.busy = false;
                this._handles[safeHandle] = info;
                return info;
            }
        }

        return null;
    }

    private toHandleInfo(safeHandle: number): HandleInfo {
        if (typeof safeHandle !== 'number') return null;
        return this._handles[safeHandle] || null;
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

    private processCallbackHandle(err: Error, handleInfo: HandleInfo, realHandle: any, callback: (err: Error, safeHandle: number) => any) {
        var safeHandle = handleInfo.safe;
        if (err) {
            delete this._handles[safeHandle];
            callback(err, null);
            return;
        }
        handleInfo.real = realHandle;
        callback(null, safeHandle);
    }

    private processCallbackAttrs(err: Error, attrs: IStats, callback: (err: Error, attrs: IStats) => any) {
        if (attrs && this.hideUidGid) {
            attrs.uid = null;
            attrs.gid = null;
        }

        callback(err, attrs);
    }

    private isReadOnly(): boolean {
        return !(this.readOnly === false);
    }

    end() {
        if (!this.fs) return;

        //TODO: make sure all pending operations either complete or fail gracefully

        for (var handle = 1; handle <= SafeFilesystem.MAX_HANDLE_COUNT; handle++) {
            var handleInfo = this.toHandleInfo(handle);
            if (handleInfo && handleInfo.real !== null) {
                try {
                    this.fs.close(handleInfo.real, err => {
                        //TODO: report this
                    });
                } catch (err) {
                    //TODO: report this
                }
            }
            delete this._handles[handle];
        }

        delete this.fs;
    }

    private _execute(safeHandle: number, action: (handle: any, callback: (err: Error, ...args) => any) => void, callback: (err: Error, ...args) => any): void {
        var handleInfo = this.toHandleInfo(safeHandle);

        if (!handleInfo) return FileUtil.fail("Invalid handle", callback);

        var finished = false;
        var asynchronous = false;

        if (!handleInfo.busy) {
            handleInfo.busy = true;
            run();
        } else {
            var queue = handleInfo.actions;
            if (!queue) {
                queue = [];
                handleInfo.actions = queue;
            }
            queue.push(run);
        }

        function run() {
            try {
                action(handleInfo.real, done);
            } catch (err) {
                done(err);
            }
            asynchronous = true;
        }

        function done(err: Error) {
            if (finished) {
                //TODO: callback called more than once - this is a fatal error and should not be ignored
                return;
            }
            finished = true;

            // delay this function until the next tick if action finished synchronously
            if (!asynchronous) {
                asynchronous = true;
                process.nextTick(() => done(err));
                return;
            }

            // trigger next action
            var queue = handleInfo.actions;
            if (!queue || queue.length == 0) {
                handleInfo.busy = false;
            } else {
                var next = queue.shift();
                next();
            }

            // invoke the callback
            if (typeof callback !== "function") {
                if (err) throw err;
            } else {
                callback.apply(null, arguments);
            }
        }
    }

    open(path: string, flags: string, attrs: IStats, callback: (err: Error, handle: number) => any): void {
        if (this.isReadOnly() && flags != "r") return FileUtil.fail("EROFS", callback);

        var handleInfo = this.createHandleInfo();
        if (!handleInfo) return FileUtil.fail("ENFILE", callback);

        try {
            path = this.toRealPath(path);
            this.fs.open(path, flags, attrs, (err, realHandle) => this.processCallbackHandle(err, handleInfo, realHandle, callback));
        } catch (err) {
            callback(err, null);
        }
    }

    close(handle: number, callback: (err: Error) => any): void {
        this._execute(handle, (realHandle, callback) => {
            delete this._handles[handle];
            this.fs.close(realHandle, callback)
        }, callback);
    }

    read(handle: number, buffer, offset, length, position, callback: (err: Error, buffer: Buffer, bytesRead: number) => any): void {
        this._execute(handle, (handle, callback) => this.fs.read(handle, buffer, offset, length, position, callback), callback);
    }

    write(handle: number, buffer, offset, length, position, callback: (err: Error) => any): void {
        if (this.isReadOnly()) return FileUtil.fail("EROFS", callback);

        this._execute(handle, (handle, callback) => this.fs.write(handle, buffer, offset, length, position, callback), callback);
    }

    lstat(path: string, callback: (err: Error, attrs: IStats) => any): void {
        path = this.toRealPath(path);

        try {
            if (!this.hideUidGid) {
                this.fs.lstat(path, callback);
            } else {
                this.fs.lstat(path, (err, attrs) => this.processCallbackAttrs(err, attrs, callback));
            }
        } catch (err) {
            callback(err, null);
        }
    }

    fstat(handle: number, callback: (err: Error, attrs: IStats) => any): void {
        this._execute(handle, (handle, callback) => this.fs.fstat(handle, callback), (err: Error, attrs: IStats) => {
            if (this.hideUidGid) return this.processCallbackAttrs(err, attrs, callback);
            callback(err, attrs);
        });
    }

    setstat(path: string, attrs: IStats, callback: (err: Error) => any): void {
        if (this.isReadOnly()) return FileUtil.fail("EROFS", callback);

        if (this.hideUidGid) {
            attrs.uid = null;
            attrs.gid = null;
        }

        path = this.toRealPath(path);
        try {
            this.fs.setstat(path, attrs, callback);
        } catch (err) {
            callback(err);
        }
    }

    fsetstat(handle: number, attrs: IStats, callback: (err: Error) => any): void {
        if (this.isReadOnly()) return FileUtil.fail("EROFS", callback);

        if (attrs && this.hideUidGid) {
            attrs.uid = null;
            attrs.gid = null;
        }

        this._execute(handle, (handle, callback) => this.fs.fsetstat(handle, attrs, callback), callback);
    }

    opendir(path: string, callback: (err: Error, handle: number) => any): void {
        path = this.toRealPath(path);

        var handleInfo = this.createHandleInfo();
        if (!handleInfo) return FileUtil.fail("ENFILE", callback);

        try {
            this.fs.opendir(path, (err, realHandle) => this.processCallbackHandle(err, handleInfo, realHandle, callback));
        } catch (err) {
            callback(err, null);
        }
    }

    readdir(handle: number, callback: (err: Error, items: IItem[]|boolean) => any): void {
        this._execute(handle, (handle, callback) => this.fs.readdir(handle, callback), (err: Error, items: IItem[] | boolean) => {
            if (this.hideUidGid) {
                if (Array.isArray(items)) (<IItem[]>items).forEach(item => {
                    item.stats.uid = null;
                    item.stats.gid = null;
                });
            }
            callback(err, items);
        });
    }

    unlink(path: string, callback: (err: Error) => any): void {
        if (this.isReadOnly()) return FileUtil.fail("EROFS", callback);
        
        path = this.toRealPath(path);

        try {
            this.fs.unlink(path, callback);
        } catch (err) {
            callback(err);
        }
    }

    mkdir(path: string, attrs: IStats, callback: (err: Error) => any): void {
        if (this.isReadOnly()) return FileUtil.fail("EROFS", callback);

        path = this.toRealPath(path);

        try {
            this.fs.mkdir(path, attrs, callback);
        } catch (err) {
            callback(err);
        }
    }

    rmdir(path: string, callback: (err: Error) => any): void {
        if (this.isReadOnly()) return FileUtil.fail("EROFS", callback);

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
            if (!this.hideUidGid) {
                this.fs.stat(path, callback);
            } else {
                this.fs.stat(path, (err, attrs) => this.processCallbackAttrs(err, attrs, callback));
            }
        } catch (err) {
            callback(err, null);
        }
    }

    rename(oldPath: string, newPath: string, flags: RenameFlags, callback: (err: Error) => any): void {
        if (this.isReadOnly()) return FileUtil.fail("EROFS", callback);

        oldPath = this.toRealPath(oldPath);
        newPath = this.toRealPath(newPath);

        try {
            this.fs.rename(oldPath, newPath, flags, callback);
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

    symlink(oldPath: string, newPath: string, callback: (err: Error) => any): void {
        if (this.isReadOnly()) return FileUtil.fail("EROFS", callback);

        oldPath = this.toRealPath(oldPath);
        newPath = this.toRealPath(newPath);

        try {
            this.fs.symlink(oldPath, newPath, callback);
        } catch (err) {
            callback(err);
        }
    }

    link(oldPath: string, newPath: string, callback: (err: Error) => any): void {
        if (this.isReadOnly()) return FileUtil.fail("EROFS", callback);

        oldPath = this.toRealPath(oldPath);
        newPath = this.toRealPath(newPath);

        try {
            this.fs.link(oldPath, newPath, callback);
        } catch (err) {
            callback(err);
        }
    }
}

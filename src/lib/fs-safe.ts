import fs = require("fs");
import Path = require("path");
import api = require("./fs-api");
import misc = require("./fs-misc");

import IFilesystem = api.IFilesystem;
import IItem = api.IItem;
import IStats = api.IStats;
import RenameFlags = api.RenameFlags;
import FileUtil = misc.FileUtil;

export class SafeFilesystem implements IFilesystem {

    isSafe: boolean;
    private fs: IFilesystem;
    private isWindows: boolean;
    private root: string;
    private readOnly: boolean;
    private hideUidGid: boolean;

    constructor(fs: IFilesystem, virtualRootPath: string, options: { readOnly?: boolean, hideUidGid?: boolean }) {
        options = options || {};
        this.isSafe = true;
        this.fs = fs;
        this.isWindows = (fs['isWindows'] === true);
        this.root = Path.normalize(virtualRootPath);
        this.readOnly = options.readOnly == true;
        this.hideUidGid = options.hideUidGid == true;
    }

    private wrapHandle(handle: any): any {
        if (handle == null || typeof handle === 'undefined')
            throw Error("Invalid handle");

        return { handle: handle, owner: this };
    }

    private unwrapHandle(handle: any): any {
        if (typeof handle !== 'object')
            return null;

        if (handle.owner != this)
            return null;

        return handle.handle;
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
                handle = this.wrapHandle(handle);
        }

        callback(err, handle);
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

    open(path: string, flags: string, attrs: IStats, callback: (err: Error, handle: any) => any): void {
        if (this.isReadOnly() && flags != "r") return FileUtil.fail("EROFS", callback);

        try {
            path = this.toRealPath(path);
            this.fs.open(path, flags, attrs, (err, handle) => this.processCallbackHandle(err, handle, callback));
        } catch (err) {
            callback(err, null);
        }
    }

    close(handle: any, callback: (err: Error) => any): void {
        handle = this.unwrapHandle(handle);

        try {
            this.fs.close(handle, callback);
        } catch (err) {
            callback(err);
        }
    }

    read(handle: any, buffer, offset, length, position, callback: (err: Error, buffer: Buffer, bytesRead: number) => any): void {
        handle = this.unwrapHandle(handle);

        try {
            this.fs.read(handle, buffer, offset, length, position, callback);
        } catch (err) {
            callback(err, null, null);
        }
    }

    write(handle: any, buffer, offset, length, position, callback: (err: Error) => any): void {
        if (this.isReadOnly()) return FileUtil.fail("EROFS", callback);

        handle = this.unwrapHandle(handle);

        try {
            this.fs.write(handle, buffer, offset, length, position, callback);
        } catch (err) {
            callback(err);
        }
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

    fstat(handle: any, callback: (err: Error, attrs: IStats) => any): void {
        handle = this.unwrapHandle(handle);

        try {
            if (!this.hideUidGid) {
                this.fs.fstat(handle, callback);
            } else {
                this.fs.fstat(handle, (err, attrs) => this.processCallbackAttrs(err, attrs, callback));
            }
        } catch (err) {
            callback(err, null);
        }
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

    fsetstat(handle: any, attrs: IStats, callback: (err: Error) => any): void {
        if (this.isReadOnly()) return FileUtil.fail("EROFS", callback);

        handle = this.unwrapHandle(handle);

        if (this.hideUidGid) {
            attrs.uid = null;
            attrs.gid = null;
        }

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
        handle = this.unwrapHandle(handle);

        try {
            this.fs.readdir(handle, (err, items) => {
                if (this.hideUidGid) {
                    if (Array.isArray(items)) (<IItem[]>items).forEach(item => {
                        item.stats.uid = null;
                        item.stats.gid = null;
                    });
                }
                callback(err, items);
            });
        } catch (err) {
            callback(err, null);
        }
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

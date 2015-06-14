import api = require("./fs-api");
import misc = require("./fs-misc");
import sources = require("./fs-sources");
import targets = require("./fs-targets");
import util = require("./util");
import glob = require("./fs-glob");
import events = require("events");

import IFilesystem = api.IFilesystem;
import IItem = api.IItem;
import IStats = api.IStats;
import IDataSource = misc.IDataSource;
import IDataTarget = misc.IDataTarget;
import FileUtil = misc.FileUtil;
import FileDataTarget = targets.FileDataTarget;
import FileDataSource = transfers.FileDataSource;
import toDataSource = transfers.toDataSource;
import Task = util.Task;
import wrapCallback = util.wrapCallback;
import EventEmitter = events.EventEmitter;
import search = glob.search;

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

    open(path: string, flags: string, attrs?: IStats, callback?: (err: Error, handle: any) => any): void {
        if (typeof attrs === 'function' && typeof callback === 'undefined') {
            callback = <any>attrs;
            attrs = null;
        }
        callback = wrapCallback(this, null, callback);

        this._fs.open(path, flags, attrs, callback);
    }

    close(handle: any, callback?: (err: Error) => any): void {
        callback = wrapCallback(this, null, callback);

        this._fs.close(handle, callback);
    }

    read(handle: any, buffer: NodeBuffer, offset: number, length: number, position: number, callback?: (err: Error, bytesRead: number, buffer: NodeBuffer) => any): void {
        callback = wrapCallback(this, null, callback);

        this._fs.read(handle, buffer, offset, length, position, callback);
    }

    write(handle: any, buffer: NodeBuffer, offset: number, length: number, position: number, callback?: (err: Error) => any): void {
        callback = wrapCallback(this, null, callback);

        this._fs.write(handle, buffer, offset, length, position, callback);
    }

    lstat(path: string, callback?: (err: Error, attrs: IStats) => any): void {
        callback = wrapCallback(this, null, callback);

        this._fs.lstat(path, callback);
    }

    fstat(handle: any, callback?: (err: Error, attrs: IStats) => any): void {
        callback = wrapCallback(this, null, callback);

        this._fs.fstat(handle, callback);
    }

    setstat(path: string, attrs: IStats, callback?: (err: Error) => any): void {
        callback = wrapCallback(this, null, callback);

        this._fs.setstat(path, attrs, callback);
    }

    fsetstat(handle: any, attrs: IStats, callback?: (err: Error) => any): void {
        callback = wrapCallback(this, null, callback);

        this._fs.fsetstat(handle, attrs, callback);
    }

    opendir(path: string, callback?: (err: Error, handle: any) => any): void {
        callback = wrapCallback(this, null, callback);

        this._fs.opendir(path, callback);
    }

    readdir(path: string, callback?: (err: Error, items: IItem[]) => any)
    readdir(handle: any, callback?: (err: Error, items: IItem[]|boolean) => any)
    readdir(handle: any, callback?: (err: Error, items: IItem[]|boolean) => any): void {
        if (typeof handle === 'string') {
            var path = <string>handle;
            this.list(path, callback); //TODO: supply an option that turns off wildcards
            return;
        }

        callback = wrapCallback(this, null, callback);

        return this._fs.readdir(handle, callback);
    }

    unlink(path: string, callback?: (err: Error) => any): void {
        callback = wrapCallback(this, null, callback);

        this._fs.unlink(path, callback);
    }

    mkdir(path: string, attrs?: IStats, callback?: (err: Error) => any): void {
        if (typeof attrs === 'function' && typeof callback === 'undefined') {
            callback = <any>attrs;
            attrs = null;
        }
        callback = wrapCallback(this, null, callback);

        this._fs.mkdir(path, attrs, callback);
    }

    rmdir(path: string, callback?: (err: Error) => any): void {
        callback = wrapCallback(this, null, callback);

        this._fs.rmdir(path, callback);
    }

    realpath(path: string, callback?: (err: Error, resolvedPath: string) => any): void {
        callback = wrapCallback(this, null, callback);

        this._fs.realpath(path, callback);
    }

    stat(path: string, callback?: (err: Error, attrs: IStats) => any): void {
        callback = wrapCallback(this, null, callback);

        this._fs.stat(path, callback);
    }

    rename(oldPath: string, newPath: string, callback?: (err: Error) => any): void {
        callback = wrapCallback(this, null, callback);

        this._fs.rename(oldPath, newPath, callback);
    }

    readlink(path: string, callback?: (err: Error, linkString: string) => any): void {
        callback = wrapCallback(this, null, callback);

        this._fs.readlink(path, callback);
    }

    symlink(targetpath: string, linkpath: string, callback?: (err: Error) => any): void {
        callback = wrapCallback(this, null, callback);

        this._fs.symlink(targetpath, linkpath, callback);
    }

    link(oldPath: string, newPath: string, callback?: (err: Error) => any): void {
        callback = wrapCallback(this, null, callback);

        this._fs.link(oldPath, newPath, callback);
    }

    list(remotePath: string, callback?: (err: Error, items: IItem[]) => any): Task {
        var task = new Task();
        callback = wrapCallback(this, task, callback);

        search(this._fs, remotePath, task, {}, callback);

        return task;
    }

    upload(localPath: string, remotePath: string, callback?: (err: Error) => any)
    upload(input: any, remotePath: string, callback?: (err: Error) => any)
    upload(input: any, remotePath: string, callback?: (err: Error) => any): Task {
        return this._copy(input, this._local, remotePath, this._fs, callback);
    }

    download(remotePath: string|string[], localPath: string, callback?: (err: Error) => any): Task {
        return this._copy(remotePath, this._fs, localPath, this._local, callback);
    }

    private _copy(from: any, fromFs: IFilesystem, toPath: string, toFs: IFilesystem, callback?: (err: Error) => any): Task {
        var task = new Task();
        callback = wrapCallback(this, task, callback);

        var sources = <IDataSource[]>null;

        toPath = FileUtil.normalize(toPath,(<any>toFs).isWindows == true);
        toPath = FileUtil.removeTrailingSlash(toPath);

        toFs.stat(toPath, prepare);

        var directories = {};

        return task;

        function prepare(err: Error, stats: IStats): void {
            if (err) return callback(err);

            if (!FileUtil.isDirectory(stats))
                return callback(new Error("Target path is not a directory"));

            toPath = FileUtil.addTrailingSlash(toPath);

            try {
                toDataSource(fromFs, from, task,(err, src) => {
                    if (err) return callback(err);

                    try {
                        sources = src;
                        sources.forEach(source => {
                            //TODO: calculate total size
                            //TODO: make sure that source.name is valid on target fs
                        });

                        next();
                    } catch (err) {
                        callback(err);
                    }
                });
            } catch (err) {
                callback(err);
            }
        }

        function next(): void {
            var source = sources.shift();
            if (!source) return callback(null);

            var sourcePath = source.path || source.name;
                
            checkParent(source.name, transfer);

            function transfer(err: Error): void {
                if (err) return callback(err);

                var targetPath = toPath + source.name;

                task.emit("transferring", sourcePath, source.length);

                if (FileUtil.isDirectory(source.stats)) {
                    FileUtil.mkdir(toFs, targetPath, transferred);
                } else {
                    var target = new FileDataTarget(toFs, targetPath);
                    FileUtil.copy(source, target, task, transferred);
                }
            }

            function transferred(err: Error): void {
                if (err) return callback(err);
                task.emit("transferred", sourcePath, source.length);
                next();
            }
        }

        function checkParent(path: string, callback: (err: Error) => void) {
            var parent = FileUtil.getDirectoryName(path);
            if (parent.length == 0 || parent == "/") return callback(null);

            var exists = directories[parent];
            if (exists) return callback(null);

            checkParent(parent, err => {
                if (err) return callback(err);

                try {
                    FileUtil.mkdir(toFs, toPath + parent, err => {
                        if (err) return callback(err);
                        directories[parent] = true;
                        callback(null);
                    });
                } catch (err) {
                    callback(err);
                }
            });
        }
    }

}
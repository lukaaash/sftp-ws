import api = require("./fs-api");
import misc = require("./fs-misc");
import sources = require("./fs-sources");
import targets = require("./fs-targets");
import util = require("./util");
import glob = require("./fs-glob");
import APromise = require("./promise");
import events = require("events");

import IFilesystem = api.IFilesystem;
import IItem = api.IItem;
import IStats = api.IStats;
import IDataSource = misc.IDataSource;
import IDataTarget = misc.IDataTarget;
import FileUtil = misc.FileUtil;
import Path = misc.Path;
import IEventEmitter = misc.IEventEmitter;
import FileDataTarget = targets.FileDataTarget;
import BlobDataTarget = targets.BlobDataTarget;
import StringDataTarget = targets.StringDataTarget;
import BufferDataTarget = targets.BufferDataTarget;
import FileDataSource = sources.FileDataSource;
import toDataSource = sources.toDataSource;
import EventEmitter = events.EventEmitter;
import search = glob.search;
import ISearchOptionsExt = glob.ISearchOptionsExt;
import ISearchOptions = glob.ISearchOptions;

var Promise = Promise || APromise;

export interface Promise<T> {
    then<U>(onFulfilled?: (value: T) => U | Task<U>, onRejected?: (reason: any) => U | Task<U>): Task<U>;
    catch<U>(onRejected: (reason: any) => U | Task<U>): Task<U>;
    done?(): void;
}

export interface Task<T> extends Promise<T> {
    on(event: string, listener: Function): Task<T>;
    once(event: string, listener: Function): Task<T>;
}

export interface IFilesystemExt extends FilesystemPlus {
}

export class FilesystemPlus extends EventEmitter implements IFilesystem {

    protected _fs: IFilesystem;
    protected _local: IFilesystem;
    protected _promise: Function;

    constructor(fs: IFilesystem, local: IFilesystem) {
        super();
        this._fs = fs;
        this._local = local;
    }

    open(path: string, flags: string, attrs?: IStats, callback?: (err: Error, handle: any) => any): Task<any> {
        if (typeof callback === 'undefined' && typeof attrs === 'function') {
            callback = <any>attrs;
            attrs = null;
        }

        return this._task(callback, callback => {
            this._fs.open(path, flags, attrs, callback);
        });
    }

    close(handle: any, callback?: (err: Error) => any): Task<void> {
        return this._task(callback, callback => {
            this._fs.close(handle, callback);
        });
    }

    read(handle: any, buffer: Buffer, offset: number, length: number, position: number, callback?: (err: Error, buffer: Buffer, bytesRead: number) => any): Task<Buffer> {
        return this._task(callback, callback => {
            this._fs.read(handle, buffer, offset, length, position, callback);
        });
    }

    write(handle: any, buffer: Buffer, offset: number, length: number, position: number, callback?: (err: Error) => any): Task<void> {
        return this._task(callback, callback => {
            this._fs.write(handle, buffer, offset, length, position, callback);
        });
    }

    lstat(path: string, callback?: (err: Error, attrs: IStats) => any): Task<IStats> {
        return this._task(callback, callback => {
            this._fs.lstat(path, callback);
        });
    }

    fstat(handle: any, callback?: (err: Error, attrs: IStats) => any): Task<IStats> {
        return this._task(callback, callback => {
            this._fs.fstat(handle, callback);
        });
    }

    setstat(path: string, attrs: IStats, callback?: (err: Error) => any): Task<void> {
        return this._task(callback, callback => {
            this._fs.setstat(path, attrs, callback);
        });
    }

    fsetstat(handle: any, attrs: IStats, callback?: (err: Error) => any): Task<void> {
        return this._task(callback, callback => {
            this._fs.fsetstat(handle, attrs, callback);
        });
    }

    opendir(path: string, callback?: (err: Error, handle: any) => any): Task<void> {
        return this._task(callback, callback => {
            this._fs.opendir(path, callback);
        });
    }

    readdir(path: string, callback?: (err: Error, items: IItem[]) => any): Task<IItem[]>
    readdir(handle: any, callback?: (err: Error, items: IItem[]|boolean) => any): Task<IItem[]|boolean>
    readdir(handle: any, callback?: (err: Error, items: IItem[]|boolean) => any): Task<IItem[]|boolean> {
        return this._task(callback, callback => {
            if (typeof handle === 'string') {
                var path = Path.check(<string>handle, 'path');

                var options = <ISearchOptionsExt>{
                    noglobstar: true,
                    nowildcard: true,
                    onedir: true,
                    dotdirs: true,
                    all: true,
                };

                search(this._fs, path, null, options, callback);
                return;
            }

            this._fs.readdir(handle, callback);
        });
    }

    unlink(path: string, callback?: (err: Error) => any): Task<void> {
        return this._task(callback, callback => {
            this._fs.unlink(path, callback);
        });
    }

    mkdir(path: string, attrs?: IStats, callback?: (err: Error) => any): Task<void> {
        if (typeof callback === 'undefined' && typeof attrs === 'function') {
            callback = <any>attrs;
            attrs = null;
        }

        return this._task(callback, callback => {        
            this._fs.mkdir(path, attrs, callback);
        });
    }

    rmdir(path: string, callback?: (err: Error) => any): Task<void> {
        return this._task(callback, callback => {
            this._fs.rmdir(path, callback);
        });
    }

    realpath(path: string, callback?: (err: Error, resolvedPath: string) => any): Task<string> {
        return this._task(callback, callback => {
            this._fs.realpath(path, callback);
        });
    }

    stat(path: string, callback?: (err: Error, attrs: IStats) => any): Task<IStats> {
        return this._task(callback, callback => {
            this._fs.stat(path, callback);
        });
    }

    rename(oldPath: string, newPath: string, callback?: (err: Error) => any): Task<void> {
        return this._task(callback, callback => {
            this._fs.rename(oldPath, newPath, callback);
        });
    }

    readlink(path: string, callback?: (err: Error, linkString: string) => any): Task<string> {
        return this._task(callback, callback => {
            this._fs.readlink(path, callback);
        });
    }

    symlink(targetpath: string, linkpath: string, callback?: (err: Error) => any): Task<void> {
        return this._task(callback, callback => {
            this._fs.symlink(targetpath, linkpath, callback);
        });
    }

    join(...paths: string[]): string {
        var path = new Path("", this._fs);
        return path.join.apply(path, arguments).normalize().path;
    }

    link(oldPath: string, newPath: string, callback?: (err: Error) => any): Task<void> {
        return this._task(callback, callback => {
            this._fs.link(oldPath, newPath, callback);
        });
    }

    list(remotePath: string, callback?: (err: Error, items: IItem[]) => any): Task<IItem[]> {
        return this._task(callback, (callback, emitter) => {
            remotePath = Path.check(remotePath, 'remotePath');

            var options = <ISearchOptionsExt>{
                directories: true,
                files: true,
                nosort: false,
                dotdirs: false,
                noglobstar: true,
                onedir: true,
                all: true,
            };

            search(this._fs, remotePath, emitter, options, callback);
        });
    }

    search(remotePath: string, options?: ISearchOptions, callback?: (err: Error, items: IItem[]) => any): Task<IItem[]> {
        if (typeof callback === 'undefined' && typeof options === 'function') {
            callback = <any>options;
            options = null;
        }

        return this._task(callback, (callback, emitter) => {
            remotePath = Path.check(remotePath, 'remotePath');

            search(this._fs, remotePath, emitter, options, callback);
        });
    }

    info(remotePath: string, callback?: (err: Error, item: IItem) => any): Task<IItem> {
        return this._task(callback, (callback, emitter) => {
            remotePath = Path.check(remotePath, 'remotePath');

            var options = <ISearchOptionsExt>{
                oneitem: true,
            };

            search(this._fs, remotePath, emitter, options, (err, items) => {
                if (err) return callback(err, null);
                if (!items || items.length != 1) return callback(new Error("Unexpected result"), null);
                callback(null, items[0]);
            });
        });
    }

    readFile(remotePath: string, options?: { type?: string; encoding?: string; flag?: string; mimeType?: string; }, callback?: (err: Error, data: {}) => any): Task<any> {
        if (typeof callback === 'undefined' && typeof options === 'function') {
            callback = <any>options;
            options = null;
        }

        return this._task(callback, (callback, emitter) => {
            var remote = Path.create(remotePath, this._fs, 'remotePath');

            // process options
            options = options || {};
            var type = options.type;
            var encoding = options.encoding
            if (type) {
                type = (type + "").toLowerCase();
                if (type == "string" || type == "text") encoding = encoding || "utf8";
            } else {
                type = encoding ? "string" : "buffer";
            }

            // create appropriate target
            var target: IDataTarget;
            switch (type) {
                case "text":
                case "string":
                    target = new StringDataTarget(encoding);
                    break;
                case "array":
                case "buffer":
                    target = new BufferDataTarget();
                    break;
                case "blob":
                // WEB: target = new BlobDataTarget(options.mimeType);
                // WEB: break;
                default:
                    throw new Error("Unsupported data kind: " + options.type);
            }

            // create source
            var source = new FileDataSource(remote.fs, remote.path);

            // copy file data
            FileUtil.copy(source, target, emitter, err => {
                if (err) return callback(err, null);
                callback(null, (<any>target).result());
            });
        });
    }

    putFile(localPath: string, remotePath: string, callback?: (err: Error) => any): Task<void> {
        return this._task(callback, (callback, emitter) => {
            var local = Path.create(localPath, this._local, 'localPath');
            var remote = Path.create(remotePath, this._fs, 'remotePath');

            this._copyFile(local, remote, emitter, callback);
        });
    }

    getFile(remotePath: string, localPath: string, callback?: (err: Error) => any): Task<void> {
        return this._task(callback, (callback, emitter) => {
            var remote = Path.create(remotePath, this._fs, 'remotePath');
            var local = Path.create(localPath, this._local, 'localPath');

            this._copyFile(remote, local, emitter, callback);
        });
    }

    private _copyFile(sourcePath: Path, targetPath: Path, emitter: IEventEmitter, callback: (err: Error, ...args: any[]) => any): void {
        // append filename if target path ens with slash
        if (targetPath.endsWithSlash()) {
            var filename = sourcePath.getName();
            targetPath = targetPath.join(filename);
        }

        // create source and target
        var source = new FileDataSource(sourcePath.fs, sourcePath.path);
        var target = new FileDataTarget(targetPath.fs, targetPath.path);

        // copy file data
        FileUtil.copy(source, target, emitter, err => callback(err));
    }

    upload(localPath: string, remotePath: string, callback?: (err: Error) => any): Task<void>
    upload(input: any, remotePath: string, callback?: (err: Error) => any): Task<void>
    upload(input: any, remotePath: string, callback?: (err: Error) => any): Task<void> {
        return this._task(callback, (callback, emitter) => {
            var remote = Path.create(remotePath, this._fs, 'remotePath');

            this._copy(input, this._local, remote, emitter, callback);
        });
    }

    download(remotePath: string|string[], localPath: string, callback?: (err: Error) => any): Task<void> {
        return this._task(callback, (callback, emitter) => {
            var local = Path.create(localPath, this._local, 'localPath');

            this._copy(remotePath, this._fs, local, emitter, callback);
        });
    }

    private _copy(from: any, fromFs: IFilesystem, toPath: Path, emitter: IEventEmitter, callback: (err: Error, ...args: any[]) => any): void {
        var sources = <IDataSource[]>null;

        var toFs = toPath.fs;
        toPath = toPath.removeTrailingSlash();

        toFs.stat(toPath.path, prepare);

        var directories = {};

        function prepare(err: Error, stats: IStats): void {
            if (err) return callback(err);

            if (!FileUtil.isDirectory(stats))
                return callback(new Error("Target path is not a directory"));

            try {
                toDataSource(fromFs, from, emitter, (err, src) => {
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

            var targetPath: string;
            if (typeof source.relativePath === "string") {
                var relativePath = new Path(source.relativePath, fromFs);
                targetPath = toPath.join(relativePath).normalize().path;
                checkParent(relativePath, transfer);
            } else {
                targetPath = toPath.join(source.name).path;
                transfer(null);
            }

            function transfer(err: Error): void {
                if (err) return callback(err);

                if (FileUtil.isDirectory(source.stats)) {
                    FileUtil.mkdir(toFs, targetPath, transferred);
                } else {
                    var target = new FileDataTarget(toFs, targetPath);
                    FileUtil.copy(source, target, emitter, transferred);
                }
            }

            function transferred(err: Error): void {
                if (err) return callback(err);
                next();
            }
        }

        function checkParent(path: Path, callback: (err: Error) => void) {

            var parent = path.getParent();

            if (parent.isTop()) return callback(null);

            var exists = directories[<any>parent];
            if (exists) return callback(null);

            checkParent(parent, err => {
                if (err) return callback(err);

                try {
                    var targetPath = toPath.join(parent).path;

                    FileUtil.mkdir(toFs, targetPath, err => {
                        if (err) return callback(err);
                        directories[<any>parent] = true;
                        callback(null);
                    });
                } catch (err) {
                    callback(err);
                }
            });
        }
    }

    protected _task<T>(callback: (err: Error, ...args: any[]) => void, action: (callback: (err: Error, ...args: any[]) => void, emitter?: IEventEmitter) => void): any {
        var emitter;
        if (action.length >= 2) emitter = new EventEmitter();

        if (typeof callback === 'function') {
            action(callback, emitter);
            return emitter;
        }

        var promise = this._promise || Promise;
        var task = <any>new promise(executor);

        task.on = on;
        task.once = once;
        return task;

        function on(event: string, listener: Function): Task<T> {
            if (emitter) emitter.on(event, listener);
            return task;
        }

        function once(event: string, listener: Function): Task<T> {
            if (emitter) emitter.on(event, listener);
            return task;
        }

        function executor(resolve: (result: T|Promise<T>) => void, reject: (error: Error) => void): void {
            try {
                action(finish, emitter);
            } catch (err) {
                process.nextTick(() => finish(err));
            }

            function finish(err: Error, ...args: any[]): void
            function finish(): void {
                var error = arguments[0];
                try {
                    if (error) {
                        if (emitter) {
                            var err = error;
                            if (EventEmitter.listenerCount(task, "error")) {
                                emitter.emit("error", err);
                                err = null;
                            }

                            emitter.emit("finish", err);
                        }

                        reject(error);
                    } else {
                        if (emitter) {
                            switch (arguments.length) {
                                case 0:
                                case 1:
                                    emitter.emit("success");
                                    emitter.emit("finish", null);
                                    break;
                                case 2:
                                    emitter.emit("success", arguments[1]);
                                    emitter.emit("finish", null, arguments[1]);
                                    break;
                                case 3:
                                    emitter.emit("success", arguments[1], arguments[2]);
                                    emitter.emit("finish", null, arguments[1], arguments[2]);
                                    break;
                                default:
                                    arguments[0] = "success";
                                    emitter.emit.apply(task, arguments);

                                    if (EventEmitter.listenerCount(task, "finish") > 0) {
                                        arguments[0] = "finish";
                                        Array.prototype.splice.call(arguments, 1, 0, null);
                                        emitter.emit.apply(task, arguments);
                                    }
                                    break;
                            }
                        }

                        resolve(<T><any>arguments[1]);
                    }
                } catch (err) {
                    this.emit("error", err);
                }
            }
        }
    }

}
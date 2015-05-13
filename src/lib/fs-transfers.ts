import api = require("./fs-api");
import misc = require("./fs-misc");
import glob = require("./fs-glob");
import Path = require("path");

import IFilesystem = api.IFilesystem;
import IStats = api.IStats;
import IItem = api.IItem;
import isFile = misc.isFile;
import isDirectory = misc.isDirectory;
import search = glob.search;

export interface IDataSource {
    name: string;
    ondata: (err: Error, buffer: NodeBuffer, bytesRead: number) => void;
    read(bytesToRead: number): void;
    next(callback: (err: Error, finished: boolean) => void): void;
    close(callback: (err: Error) => void): void;
}

class ArrayDataSource implements IDataSource {

    private current: IDataSource;
    private list: IDataSource[];

    constructor() {
        this.current = null;
        this.list = [];
    }

    add(item: IDataSource) {
        this.list.push(item);
    }

    name: string;

    ondata: (err: Error, buffer: NodeBuffer, bytesRead: number) => void;

    read(bytesToRead: number): void {
        if (this.current == null)
            throw new Error("Call next first");

        this.current.read(bytesToRead);
    }

    next(callback: (err: Error, finished: boolean) => void): void {
        if (this.current == null)
            this.current = this.list.shift();

        if (!this.current)
            return process.nextTick(() => callback(null, true));

        this.current.next((err, finished) => {
            if (err) return callback(err, true);

            if (finished) {
                this.current = null;
                this.next(callback);
                return;
            }

            this.name = this.current.name;
            this.current.ondata = (err, buffer, bytesRead) => this.ondata(err, buffer, bytesRead);
            callback(null, false);
        });
    }

    close(callback: (err: Error) => void): void {
        var current = this.current;
        if (current != null) {
            this.current = null;
            this.list = [];
            current.close(callback);
        }
    }
}

class FileDataSource implements IDataSource {

    private fs: IFilesystem;
    private localPath: string;
    private stats: IStats;
    private handle: number;
    private pos: number;
    private buffers: NodeBuffer[];

    constructor(fs: IFilesystem, localPath: string, stats: IStats, position: number) {
        this.fs = fs;
        this.localPath = localPath;
        this.stats = stats;
        this.handle = null;
        this.pos = position;
        this.buffers = [];
    }

    name: string;

    ondata: (err: Error, buffer: NodeBuffer, bytesRead: number) => void;

    read(bytesToRead: number): void {
        if (this.handle == null)
            throw new Error("Call next first");

        bytesToRead = Math.min(bytesToRead, 0x20000);

        //TODO: does a buffer cache offer any benefit in modern JavaScript engines?

        var buffers = this.buffers;
        var buffer: NodeBuffer = null;
        for (var i = 0; i < buffers.length; i++) {
            if (buffers[i].length >= bytesToRead) {
                buffer = buffers.splice(i, 1)[0];
                break;
            }
        }

        if (buffer == null)
            buffer = new Buffer(Math.max(bytesToRead, 0x8000));

        this.fs.read(this.handle, buffer, 0, bytesToRead, this.pos,(err, bytesRead, buffer) => {
            this.pos += bytesRead;
            this.ondata(err, buffer, bytesRead);
            this.buffers.push(buffer);
        });
    }

    next(callback: (err: Error, finished: boolean) => void): void {
        if (this.handle == null) {
            this.fs.open(this.localPath, "r",(err, fd) => {
                if (err) return callback(err, true);

                this.name = Path.basename(this.localPath);
                this.handle = fd;
                callback(null, false);
            });
        } else {
            this.fs.close(this.handle, err => {
                callback(err, true);
            });
        }
    }

    close(callback: (err: Error) => void): void {
        if (this.handle == null) {
            process.nextTick(() => callback(null));
        } else {
            this.fs.close(this.handle, err => {
                callback(err);
            });
        }
    }

}

function toArrayDataSource(fs: IFilesystem, input: any[], callback: (err: Error, source?: IDataSource) => void): void {
    var source = new ArrayDataSource();
    var array = <any[]>[];
    Array.prototype.push.apply(array, input);
    next();

    function next(): void {
        var item = array.pop();
        if (!item) return callback(null, source);

        if (Array.isArray(item)) return process.nextTick(() => callback(new Error("Unsupported array of arrays data source")));

        if (typeof item === "string")
            toPathDataSource(fs, <string>item, false, add);
        else
            toDataSource(fs, item, add);
    }

    function add(err: Error, src: IDataSource): void {
        if (err) return callback(err, null);
        source.add(src);
        next();
    }
}


export function toPathDataSource(fs: IFilesystem, path: string, glob: boolean, callback: (err: Error, source?: IDataSource) => void): void {
    if (!fs) return process.nextTick(() => callback(new Error("File system not available")));

    if (!glob) {

        fs.stat(path,(err, stats) => {
            if (err) return callback(err, null);

            // make sure it's a regular file
            if (!isFile(stats)) return callback(new Error("Item is not a file: " + path), null);

            var item = new FileDataSource(fs, path, stats, 0);
            callback(null, item);
        });
        return;
    }

    search(fs, path,(err, items) => {
        if (err) return callback(err, null);

        var source = new ArrayDataSource();
        items.forEach(it => {
            var item = new FileDataSource(fs, it.path, it.stats, 0);
            source.add(item);
        });

        callback(null, source);
    });
}

export function toDataSource(fs: IFilesystem, input: any, callback: (err: Error, source?: IDataSource) => void): void {

    // arrays
    if (Array.isArray(input)) return toArrayDataSource(fs, <any[]>input, callback);

    // string paths
    if (typeof input === "string") return toPathDataSource(fs, <string>input, true, callback);

    //WEB: Blob objects
    //WEB: if (typeof input === "object" && typeof input.size == "number" && typeof input.slice == "function") return openBlobDataSource(input, callback);

    process.nextTick(() => callback(new Error("Unsupported data source")));
}


import api = require("./fs-api");
import util = require("./util");

import IFilesystem = api.IFilesystem;
import IStats = api.IStats;
import IItem = api.IItem;
import FileType = api.FileType;

export interface IDataTarget {
    on(event: 'drain', listener: () => void): NodeEventEmitter;
    on(event: 'progress', listener: (bytesTransferred: number) => void): NodeEventEmitter;
    on(event: 'error', listener: (err: Error) => void): NodeEventEmitter;
    on(event: 'finish', listener: () => void): NodeEventEmitter;
    on(event: string, listener: Function): NodeEventEmitter;

    start(): boolean;
    write(chunk: NodeBuffer): boolean;
    end(): void;
}

export interface IDataSource {
    name: string;
    length: number;
    stats?: IStats;
    path?: string;

    on(event: 'readable', listener: () => void): NodeEventEmitter;
    on(event: 'error', listener: (err: Error) => void): NodeEventEmitter;
    on(event: 'end', listener: () => void): NodeEventEmitter;
    on(event: string, listener: Function): NodeEventEmitter;

    read(): NodeBuffer;
    close(): void;
}

export class FileUtil {

    static isDirectory(stats: IStats): boolean {
        return stats ? (stats.mode & FileType.ALL) == FileType.DIRECTORY : false; // directory
    }

    static isFile(stats: IStats): boolean {
        return stats ? (stats.mode & FileType.ALL) == FileType.REGULAR_FILE : false; // regular file
    }

    static getFileName(path: string): string {
        var n = path.lastIndexOf('/');
        if (n < 0) return path;
        return path.substr(n + 1);
    }

    static getDirectoryName(path: string): string {
        var n = path.lastIndexOf('/');
        if (n < 0) return "";
        if (n == 0) return "/";
        return path.substr(0, n);
    }

    static normalize(path: string, isWindows: boolean): string {
        // replace backslashes with slashes on Windows filesystems
        if (isWindows) path = path.replace(/\\/g, "/");
        return path;
    }

    static addTrailingSlash(path: string): string {
        if (path.length > 0 && path[path.length - 1] != '/') path += "/";
        return path;
    }

    static mkdir(fs: IFilesystem, path: string, callback?: (err: Error) => any): void {
        fs.stat(path,(err, stats) => {
            if (!err) {
                if (FileUtil.isDirectory(stats)) return callback(null);
                return callback(new Error("Path is not a directory")); //TODO: better error
            }

            if ((<any>err).code != "ENOENT") return callback(err);

            fs.mkdir(path, null, callback);
        });
    }

    static copy(source: IDataSource, target: IDataTarget, emitter: NodeEventEmitter, callback?: (err: Error) => any): void {
        var writable = true;
        var started = false;
        var eof = false;
        var done = false;
        var error = <Error>null;
        var total = 0;

        source.on("readable",() => {
            //console.log("readable");
            if (!started) {
                started = true;
                target.start();
            }

            copy();
        });

        source.on("end",() => {
            //console.log("ended");
            eof = true;
            target.end();
        });

        source.on("error", err => {
            //console.log("read error", err);
            error = error || err || new Error("Unspecified error");
            eof = true;
            target.end();
        });

        target.on("drain",() => {
            //console.log("drained");
            writable = true;
            copy();
        });

        target.on("progress", bytesTransferred => {
            emitter.emit("progress", source.path, bytesTransferred, source.length);
        });

        target.on("finish",() => {
            //console.log("finished");
            exit();
        });

        target.on("error", err => {
            //console.log("write error", err);
            error = error || err || new Error("Unspecified error");
            exit();
        });

        function copy(): void {
            while (writable) {
                var chunk = source.read();
                if (!chunk) break;

                total += chunk.length;
                writable = target.write(chunk);
            }
        }

        function exit(): void {
            if (!eof) source.close();

            if (!done) {
                done = true;
                callback(error);
            }
        }
    }
}

import api = require("./fs-api");
import util = require("./util");

import IFilesystem = api.IFilesystem;
import IStats = api.IStats;
import IItem = api.IItem;
import FileType = api.FileType;

export interface IDataTarget {
    on(event: 'drain', listener: () => void): NodeEventEmitter;
    on(event: 'error', listener: (err: Error) => void): NodeEventEmitter;
    on(event: 'finish', listener: () => void): NodeEventEmitter;
    on(event: string, listener: Function): NodeEventEmitter;

    write(chunk: NodeBuffer, callback?: () => void): boolean;
    end(): void;

    acceptsEmptyBlocks?: boolean;
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
        var empty = true;
        var writable = true;
        var eof = false;
        var done = false;
        var error = <Error>null;
        var total = 0;

        source.on("readable",() => {
            //console.log("readable");
            while (writable) {
                if (!copy()) break;
            }
        });

        source.on("end",() => {
            //console.log("ended");
            eof = true;
            if (empty && target.acceptsEmptyBlocks) target.write(new Buffer(0));
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
            do {
                if (!copy()) break;
            } while (writable);
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

        function copy(): boolean {
            var chunk = source.read();
            if (!chunk) return false;

            empty = false;
            writable = target.write(chunk,() => {
                // The fact that write requests might in theory be completed in different order
                // doesn't concern us much because a transferred byte is still a transferred byte
                // and it will all add up to proper number in the end.
                total += chunk.length;
                emitter.emit("progress", source.path, total, source.length);
            });

            return writable;
        }

        function exit(): void {
            if (!eof) return source.close();

            if (!done) {
                done = true;
                callback(error);
            }
        }
    }
}

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

export class Path {
    private path: string;

    constructor(path: string|Path)
    constructor(path: string) {
        if (typeof path !== "string") path = "" + path;
        this.path = path;
    }

    isTop(): boolean {
        return this.path.length == 0 || this.path == "/";
    }

    getName(): string {
        var path = this.path;
        var n = path.lastIndexOf('/');
        if (n < 0) return path;
        return path.substr(n + 1);
    }

    getParent(): Path {
        var path = this.path;
        var n = path.lastIndexOf('/');
        if (n < 0) {
            path = "";
        } else if (n == 0) {
            path = "/";
        } else {
            path = path.substr(0, n);
        }

        return new Path(path);
    }

    normalize(isWindows: boolean, removeTrailingSlash?: boolean): Path {
        var path = this.path;

        // replace backslashes with slashes on Windows filesystems
        if (isWindows) path = path.replace(/\\/g, "/");

        if (removeTrailingSlash) {
            var len = path.length;
            if (len > 1 && path[len - 1] == '/') path = path.substr(0, len - 1);
        }

        return new Path(path);
    }

    combine(relativePath: string|Path): Path
    combine(relativePath: string): Path {
        var path = this.path;

        if (typeof relativePath !== "string") relativePath = "" + relativePath;

        if (relativePath.length == 0) return new Path(path);
        if (relativePath[0] == '/') return new Path(relativePath);

        var len = path.length;
        if (len == 0) {
            path = "./";
        } else if (path[len - 1] != '/') {
            path += "/";
        }

        return new Path(path + relativePath);
    }

    toString(): string {
        return this.path;
    }

    static join(paths: string[], windows?: boolean): string {
        var result = <string>null;
        paths.forEach(path => {
            if (typeof path === "undefined") return;
            path = "" + path;
            if (path.length == 0) return;
            if (result === null || path[0] === '/' || path === "~" || (path[0] === '~' && path[1] === '/')) {
                result = path;
                return;
            }

            if (windows) {
                if (path[0] === '\\' || (path[0] === '~' && path[1] === '\\') || path[1] === ':') {
                    result = path;
                    return;
                }
            }

            var last = result[result.length - 1];
            if (last === '/' || (windows && last === '\\')) {
                result = result + path;
            } else {
                result = result + "/" + path;
            }
        });

        if (result === null) {
            result = ".";
        } else if (windows) {
            result = result.replace(/\//g, '\\');
        }

        return result;
    }

    static check(path: string, name?: string): string {
        if (typeof name === "undefined") name = "path";

        if (typeof path !== "string") {
            if (path === null || typeof path === "undefined")
                throw new Error("Missing " + name);

            if (typeof path === 'function')
                throw new Error("Invalid " + name);

            path = "" + path;
        }

        if (path.length == 0)
            throw new Error("Empty " + name);

        return path;
    }
}

export class FileUtil {

    static isDirectory(stats: IStats): boolean {
        return stats ? (stats.mode & FileType.ALL) == FileType.DIRECTORY : false; // directory
    }

    static isFile(stats: IStats): boolean {
        return stats ? (stats.mode & FileType.ALL) == FileType.REGULAR_FILE : false; // regular file
    }

    static toString(filename: string, stats: IStats): string {
        var attrs = stats.mode;

        var perms;
        switch (attrs & FileType.ALL) {
            case FileType.CHARACTER_DEVICE:
                perms = "c";
                break;
            case FileType.DIRECTORY:
                perms = "d";
                break;
            case FileType.BLOCK_DEVICE:
                perms = "b";
                break;
            case FileType.REGULAR_FILE:
                perms = "-";
                break;
            case FileType.SYMLINK:
                perms = "l";
                break;
            case FileType.SOCKET:
                perms = "s";
                break;
            case FileType.FIFO:
                perms = "p";
                break;
            default:
                perms = "-";
                break;
        }

        attrs &= 0x1FF;

        for (var j = 0; j < 3; j++) {
            var mask = (attrs >> ((2 - j) * 3)) & 0x7;
            perms += (mask & 4) ? "r" : "-";
            perms += (mask & 2) ? "w" : "-";
            perms += (mask & 1) ? "x" : "-";
        }

        var len = stats.size.toString();
        if (len.length < 9)
            len = "         ".slice(len.length - 9) + len;
        else
            len = " " + len;

        var modified = stats.mtime;
        var diff = (new Date().getTime() - modified.getTime()) / (3600 * 24);
        var date = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][modified.getUTCMonth()];
        var day = modified.getUTCDate();
        date += ((day <= 9) ? "  " : " ") + day;

        if (diff < -30 || diff > 180)
            date += "  " + modified.getUTCFullYear();
        else
            date += " " + ("0" + modified.getUTCHours()).slice(-2) + ":" + ("0" + modified.getUTCMinutes()).slice(-2);

        var nlink = (typeof (<any>stats).nlink === 'undefined') ? 1 : (<any>stats).nlink;

        return perms + " " + nlink + " user group " + len + " " + date + " " + filename;
    }

    static getFileName(path: string): string {
        var n = path.lastIndexOf('/');
        if (n < 0) return path;
        return path.substr(n + 1);
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

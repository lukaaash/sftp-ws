import api = require("./fs-api");
import events = require("events");

import IFilesystem = api.IFilesystem;
import IStats = api.IStats;
import IItem = api.IItem;
import EventEmitter = events.EventEmitter;

export class DataTarget extends EventEmitter {
    on(event: 'drain', listener: () => void): EventEmitter;
    on(event: 'progress', listener: (bytesTransferred: number) => void): EventEmitter;
    on(event: 'error', listener: (err: Error) => void): EventEmitter;
    on(event: 'finish', listener: () => void): EventEmitter;
    on(event: string, listener: Function): EventEmitter;
    on(event: string, listener: Function): EventEmitter {
        return super.on(event, listener);
    }

    once(event: 'drain', listener: () => void): EventEmitter;
    once(event: 'error', listener: (err: Error) => void): EventEmitter;
    once(event: 'finish', listener: () => void): EventEmitter;
    once(event: string, listener: Function): EventEmitter;
    once(event: string, listener: Function): EventEmitter {
        return super.once(event, listener);
    }

    write(chunk: NodeBuffer): boolean {
        return false;
    }

    end(): void {
    }
}

export class DataSource extends EventEmitter {
    name: string;
    length: number;
    stats: IStats;

    on(event: 'readable', listener: () => void): EventEmitter;
    on(event: 'error', listener: (err: Error) => void): EventEmitter;
    on(event: 'end', listener: () => void): EventEmitter;
    on(event: string, listener: Function): EventEmitter;
    on(event: string, listener: Function): EventEmitter {
        this.flush();
        return super.on(event, listener);
    }

    once(event: 'readable', listener: () => void): EventEmitter;
    once(event: 'error', listener: (err: Error) => void): EventEmitter;
    once(event: 'end', listener: () => void): EventEmitter;
    once(event: string, listener: Function): EventEmitter;
    once(event: string, listener: Function): EventEmitter {
        this.flush();
        return super.once(event, listener);
    }

    protected flush(): void {
    }

    read(): NodeBuffer {
        return new Buffer(0);
    }

    close(): void {
    }
}

export class FileUtil {

    static isDirectory(stats: IStats): boolean {
        return stats ? (stats.mode & 0xE000) == 0x4000 : false; // directory
    }

    static isFile(stats: IStats): boolean {
        return stats ? (stats.mode & 0xE000) == 0x8000 : false; // regular file
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

    static addTrailingSlash(path: string): string {
        if (path.length > 0 && path[path.length - 1] != '/') path += "/";
        return path;
    }

    static readdir(fs: IFilesystem, path: string, callback?: (err: Error, items: IItem[]) => any): void {
        var list: IItem[] = [];
        var handle;

        function next(err, items: IItem[]|boolean): void {

            if (err != null) {
                fs.close(handle);
                callback(err, list);
                return;
            }

            if (items === false) {
                fs.close(handle, err => {
                    callback(err, list);
                });
                return;
            }

            list = list.concat(<IItem[]>items);
            fs.readdir(handle, next);
        };

        fs.opendir(path,(err, h) => {
            if (err != null) {
                callback(err, null);
                return;
            }

            handle = h;
            next(null, []);
        });
    }

    static copy(source: DataSource, target: DataTarget, callback?: (err: Error) => any): void {
        var writable = true;
        var eof = false;
        var done = false;
        var error = <Error>null;
        var total = 0;

        source.on("readable",() => {
            //console.log("readable");
            copy();
        });

        source.on("end",() => {
            //console.log("ended");
            eof = true;

            // if the source file was empty, 'send' at least one empty block to make sure the file is created
            if (total == 0)
                target.write(new Buffer(0)); // WEB: target.write(new UInt8Array(0));
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
            console.log("transferred", bytesTransferred);
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

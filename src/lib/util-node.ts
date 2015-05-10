import fs = require("fs");
import Path = require("path");
import Stats = fs.Stats;

class FileDataSource {

    private localPath: string;
    private stats: Stats;
    private fd: number;
    private pos: number;
    private buffers: NodeBuffer[];

    constructor(localPath: string, stats: Stats, position: number) {
        this.localPath = localPath;
        this.stats = stats;
        this.fd = null;
        this.pos = position;
        this.buffers = [];
    }

    name: string;

    ondata: (err: Error, buffer: NodeBuffer, bytesRead: number) => void;

    read(bytesToRead: number): void {
        if (this.fd == null)
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

        fs.read(this.fd, buffer, 0, bytesToRead, this.pos,(err, bytesRead, buffer) => {
            this.pos += bytesRead;
            this.ondata(err, buffer, bytesRead);
            this.buffers.push(buffer);
        });
    }

    next(callback: (err: Error, finished: boolean) => void): void {
        if (this.fd == null) {
            fs.open(this.localPath, "r",(err, fd) => {
                if (err) return callback(err, true);

                this.name = Path.basename(this.localPath);
                this.fd = fd;
                callback(null, false);
            });
        } else {
            fs.close(this.fd, err => {
                callback(err, true);
            });
        }
    }

    close(callback: (err: Error) => void): void {
        if (this.fd == null) {
            process.nextTick(() => callback(null));
        } else {
            fs.close(this.fd, err => {
                callback(err);
            });
        }
    }

}

export function openFileDataSource(localPath: string, callback: (err: Error, source?: FileDataSource) => void): void {

    fs.stat(localPath,(err, stats) => {
        if (err) return callback(err);
        if (!stats.isFile()) return callback(new Error("Specified item is not a file"));

        callback(null, new FileDataSource(localPath, stats, 0));
    });
}
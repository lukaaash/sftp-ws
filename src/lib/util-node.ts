import fs = require("fs");

class FileDataSource {

    private fd: number;
    private pos: number;
    private buffers: NodeBuffer[];

    constructor(fd: number, position: number) {
        this.fd = fd;
        this.pos = position;
        this.buffers = [];
    }

    ondata: (err: Error, buffer: NodeBuffer, bytesRead: number) => void;

    read(bytesToRead: number): void {

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

    close(callback: (err: Error) => void): void {
        fs.close(this.fd, callback);
    }

}

export function openFileDataSource(localPath: string, callback: (err: Error, source?: FileDataSource) => void): FileDataSource {

    fs.stat(localPath,(err, stats) => {
        if (err) return callback(err);
        if (!stats.isFile()) return callback(new Error("Specified item is not a file"));

        fs.open(localPath, "r", (err, fd) => {
            if (err) return callback(err);
            callback(null, new FileDataSource(fd, 0));
        });
    });

    return null;
}
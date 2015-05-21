import api = require("./fs-api");
import misc = require("./fs-misc");
import glob = require("./fs-glob");

import IFilesystem = api.IFilesystem;
import IStats = api.IStats;
import IItem = api.IItem;
import FileUtil = misc.FileUtil;
import DataSource = misc.DataSource;
import DataTarget = misc.DataTarget;
import search = glob.search;

export class FileDataTarget extends DataTarget {
    private fs: IFilesystem;
    private path: string;

    private handle: any;
    private position: number;

    private queue: IChunk[];
    private requests: number;

    private bytesTransferred: number;

    private opening: boolean;
    private report: boolean;
    private ready: boolean;
    private ended: boolean;
    private finished: boolean;
    private failed: boolean;

    constructor(fs: IFilesystem, path: string) {
        super();

        this.fs = fs;
        this.path = path;

        this.handle = null;
        this.position = 0;

        this.queue = [];
        this.requests = 0;

        this.bytesTransferred = 0;

        this.opening = false;
        this.report = false;
        this.ready = false;
        this.ended = false;
        this.finished = false;
    }

    private flush(sync: boolean) {
        try {
            if (this.opening)
                return;

            if (this.ended) {
                // if there are still no outstanding requests or queued data, do the cleanup
                if (this.requests == 0 && this.queue.length == 0) {

                    // if the file is still open, close it
                    if (this.handle != null) {
                        var handle = this.handle;
                        this.handle = null;
                        this.fs.close(handle, err => {
                            if (err) return this.error(err);
                            this.flush(false);
                        });
                        return;
                    }

                    // finish when there is nothing else to wait for
                    if (!this.finished) {
                        this.finished = true;
                        if (sync)
                            process.nextTick(() => super.emit('finish'));
                        else
                            super.emit('finish');
                    }

                    return;
                }
            }

            // with maximum of active write requests, we are not ready to send more
            if (this.requests >= 4) {
                this.ready = false;
                return;
            }

            // otherwise, write more chunks while possible
            while (this.requests < 4) {
                var chunk = this.queue.shift();
                if (!chunk)
                    break;

                this.next(chunk, this.position);
                this.position += chunk.length;
            }

            // emit event when ready do accept more data
            if (!this.ready && !this.ended) {
                this.ready = true;

                // don't emit if called synchronously
                if (!sync)
                    super.emit('drain');
            }
        } catch (err) {
            this.error(err);
        }
    }

    private next(chunk: IChunk, position: number): void {
        var bytesToWrite = chunk.length;

        //console.log("write", position, bytesToWrite);
        this.requests++;
        try {
            this.fs.write(this.handle, chunk, 0, bytesToWrite, position, err => {
                this.requests--;
                //console.log("write done", err || position);

                if (err) return this.error(err);

                // report progress
                if (this.report) {
                    // The fact that write requests might in theory be completed in different order
                    // doesn't concern us much because a transferred byte is still a transferred byte
                    // and it will all add up to proper number in the end.
                    this.bytesTransferred += bytesToWrite;
                    super.emit('progress', this.bytesTransferred);
                }

                this.flush(false);
            });
        } catch (err) {
            this.requests--;
            this.error(err);
        }
    }

    private error(err: Error): void {
        this.ready = false;
        this.ended = true;
        this.finished = true;
        this.queue = [];
        this.flush(false);
        process.nextTick(() => super.emit('error', err));
    }

    write(chunk: NodeBuffer): boolean {
        // don't accept more data if ended
        if (this.ended)
            return false;

        // enqueue the chunk for processing
        if (chunk.length > 0)
            this.queue.push(<IChunk>chunk);

        // open the file if not open yet
        if (this.handle == null) {
            if (!this.opening) this.open();
            return false;
        }

        this.flush(true);
        return this.ready;
    }

    private open(): void {
        this.opening = true;
        try {
            this.fs.open(this.path, "w",(err, handle) => {
                this.opening = false;

                if (err) return this.error(err);

                // determine whether to report progress
                if (super.listeners('progress').length > 0) {
                    this.report = true;
                        
                    // report progress of 0 bytes
                    super.emit('progress', 0);
                }

                this.handle = handle;
                this.flush(false);
            });
        } catch (err) {
            this.opening = false;
            this.error(err);
        }
    }

    end(): void {
        this.ready = false;
        this.ended = true;
        this.flush(true);
    }
}

interface IChunk extends NodeBuffer {
    position: number;
}

export class FileDataSource extends DataSource {
    private fs: IFilesystem;
    private path: string;

    private handle: any;
    private nextChunkPosition: number;
    private expectedPosition: number;

    private queue: IChunk[];
    private opening: boolean;
    private eof: boolean;
    private closed: boolean;
    private ended: boolean;
    private requests: number;
    private readable: boolean;
    private failed: boolean;

    constructor(fs: IFilesystem, path: string, name: string, stats: IStats, position: number) {
        super();
        this.fs = fs;
        this.path = path;
        this.name = name;
        this.length = stats.size;
        this.stats = stats;

        this.handle = null;
        this.nextChunkPosition = this.expectedPosition = position;
        this.queue = [];
        this.opening = false;
        this.eof = false;
        this.closed = false;
        this.ended = false;
        this.requests = 0;
        this.readable = false;
        this.failed = false;
    }

    protected flush(): void {
        try {
            if (this.closed || this.eof) {
                // if there are still outstanding requests, do nothing yet
                if (this.requests > 0)
                    return;

                // if the file is still open, close it
                if (this.handle != null) {
                    var handle = this.handle;
                    this.handle = null;
                    this.fs.close(handle, err => {
                        if (err) return this.error(err);
                        this.flush();
                    });
                    return;
                }

                // wait for all readable blocks to be read
                if (this.readable)
                    return;

                // end when there is nothing else to wait for
                if (!this.ended) {
                    this.ended = true;
                    if (!this.failed)
                        process.nextTick(() => super.emit('end'));
                }

                return;
            }

            // open the file if not open yet
            if (this.handle == null) {
                if (!this.opening) this.open();
                return;
            }

            // read more data if possible
            while (this.requests < 4) {
                if (this.closed)
                    break;

                if ((this.nextChunkPosition - this.expectedPosition) > 0x20000)
                    break;

                var chunkSize = 0x8000;
                this.next(this.nextChunkPosition, chunkSize);
                this.nextChunkPosition += chunkSize
            }
        } catch (err) {
            this.error(err);
        }
    }

    private next(position: number, bytesToRead: number): void {
        //console.log("read", position, bytesToRead);
        this.requests++;
        try {
            this.fs.read(this.handle, new Buffer(bytesToRead), 0, bytesToRead, position,(err, bytesRead, buffer) => {
                this.requests--;
                //console.log("read result", err || position, bytesRead);

                if (err) return this.error(err);

                if (this.closed) {
                    this.flush();
                    return;
                }

                if (bytesRead == 0) {
                    this.eof = true;
                    this.flush();
                    return;
                }

                try {
                    // prepare the chunk for the queue
                    var chunk = <IChunk>buffer.slice(0, bytesRead); //WEB: var chunk = <IChunk>buffer.subarray(0, bytesRead);
                    chunk.position = position;

                    // insert the chunk into the appropriate position in the queue
                    var index = this.queue.length
                    while (--index >= 0) {
                        if (position > this.queue[index].position)
                            break;
                    }
                    this.queue.splice(++index, 0, chunk);

                    // if incomplete chunk was received, read the rest of its data
                    if (bytesRead > 0 && bytesRead < bytesToRead)
                        this.next(position + bytesRead, bytesToRead - bytesRead);

                    this.flush();

                    if (!this.readable && index == 0 && chunk.position == this.expectedPosition) {
                        this.readable = true;
                        if (chunk.length > 0)
                            super.emit('readable');
                    }
                } catch (err) {
                    this.error(err);
                }
            });
        } catch (err) {
            this.requests--;
            this.error(err);
        }
    }

    read(): NodeBuffer {
        if (this.queue.length == 0)
            return null;

        var chunk = this.queue[0];
        if (chunk && chunk.position == this.expectedPosition) {
            this.expectedPosition += chunk.length;
            this.queue.shift();
            if (this.queue.length == 0)
                this.readable = false;
        } else {
            chunk = null;
        }

        this.flush();

        return chunk;
    }

    private error(err: Error): void {
        this.closed = true;
        this.failed = true;
        this.queue = [];
        this.flush();
        process.nextTick(() => super.emit('error', err));
    }

    private open(): void {
        this.opening = true;
        try {
            this.fs.open(this.path, "r",(err, handle) => {
                this.opening = false;

                if (err) return this.error(err);

                this.handle = handle;
                this.flush();
            });
        } catch (err) {
            this.opening = false;
            this.error(err);
        }
    }

    close(): void {
        this.closed = true;
        this.queue = [];
        this.flush();
    }
}

function toArrayDataSource(fs: IFilesystem, input: any[], callback: (err: Error, source?: DataSource[]) => void): void {
    var source = <DataSource[]>[];
    var array = <any[]>[];
    Array.prototype.push.apply(array, input);
    next();

    function next(): void {
        var item = array.shift();
        if (!item) return callback(null, source);

        if (Array.isArray(item)) return process.nextTick(() => callback(new Error("Unsupported array of arrays data source")));

        if (typeof item === "string")
            toPathDataSource(fs, <string>item, false, add);
        else
            toDataSource(fs, item, add);
    }

    function add(err: Error, src: DataSource[]): void {
        if (err) return callback(err, null);
        Array.prototype.push.apply(source, src);
        next();
    }
}

function toPathDataSource(fs: IFilesystem, path: string, glob: boolean, callback: (err: Error, source?: DataSource[]) => void): void {
    if (!fs) return process.nextTick(() => callback(new Error("File system not available")));

    try {
        if (!glob) {

            fs.stat(path,(err, stats) => {
                if (err) return callback(err, null);

                // make sure it's a regular file
                if (!FileUtil.isFile(stats)) return callback(new Error("Item is not a file: " + path), null);

                var item = new FileDataSource(fs, path, FileUtil.getFileName(path), stats, 0);
                callback(null, [item]);
            });
            return;
        }

        search(fs, path,(err, items) => {
            if (err) return callback(err, null);

            var source = <DataSource[]>[];
            items.forEach(it => {
                var item = new FileDataSource(fs, it.path, it.relativePath, it.stats, 0);
                source.push(item);
            });

            callback(null, source);
        });
    } catch (err) {
        process.nextTick(() => callback(err));
    }
}

export function toDataSource(fs: IFilesystem, input: any, callback: (err: Error, source?: DataSource[]) => void): void {

    // arrays
    if (Array.isArray(input)) return toArrayDataSource(fs, <any[]>input, callback);

    // string paths
    if (typeof input === "string") return toPathDataSource(fs, <string>input, true, callback);

    //WEB: Blob objects
    //WEB: if (typeof input === "object" && typeof input.size == "number" && typeof input.slice == "function") return openBlobDataSource(input, callback);

    process.nextTick(() => callback(new Error("Unsupported data source")));
}



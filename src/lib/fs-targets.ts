import api = require("./fs-api");
import misc = require("./fs-misc");
import charsets = require("./charsets");
import events = require("events");

import IFilesystem = api.IFilesystem;
import IStats = api.IStats;
import IItem = api.IItem;
import FileUtil = misc.FileUtil;
import IDataTarget = misc.IDataTarget;
import Encoding = charsets.Encoding;
import IStringDecoder = charsets.IStringDecoder;
import IStringEncoder = charsets.IStringEncoder;
import EventEmitter = events.EventEmitter;

interface IChunk extends NodeBuffer {
    callback?: () => void;
}

export class FileDataTarget extends EventEmitter implements IDataTarget {
    private fs: IFilesystem;
    private path: string;

    private handle: any;
    private position: number;

    private queue: IChunk[];
    private requests: number;

    private started: boolean;
    private ready: boolean;
    private ended: boolean;
    private finished: boolean;
    private failed: boolean;

    acceptsEmptyBlocks: boolean;

    on(event: string, listener: Function): NodeEventEmitter {
        return super.on(event, listener);
    }

    constructor(fs: IFilesystem, path: string) {
        super();

        this.fs = fs;
        this.path = path;

        this.handle = null;
        this.position = 0;

        this.queue = [];
        this.requests = 0;

        this.started = false;
        this.ready = false;
        this.ended = false;
        this.finished = false;
        FileDataTarget.prototype.acceptsEmptyBlocks = true;
    }

    private _flush(sync: boolean): void {
        if (this.ended) {
            // if there are no outstanding requests or queued data, do the cleanup
            if (this.requests == 0 && this.queue.length == 0) {

                // if the file is still open, close it
                if (this.handle != null) return this._close();

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

        // return if not open
        if (!this.handle) return;

        try {
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

                this._next(chunk, this.position);
                this.position += chunk.length;
            }

            // emit event when ready do accept more data
            if (!this.ready && !this.ended) {
                this.ready = true;

                // don't emit if called synchronously
                if (!sync) super.emit('drain');
            }
        } catch (err) {
            this._error(err);
        }
    }

    private _next(chunk: IChunk, position: number): void {
        var bytesToWrite = chunk.length;

        //console.log("write", position, bytesToWrite);
        this.requests++;
        try {
            this.fs.write(this.handle, chunk, 0, bytesToWrite, position, err => {
                this.requests--;
                //console.log("write done", err || position);

                if (err) return this._error(err);

                if (typeof chunk.callback === "function") chunk.callback();

                this._flush(false);
            });
        } catch (err) {
            this.requests--;
            this._error(err);
        }
    }

    private _error(err: Error): void {
        this.ready = false;
        this.ended = true;
        this.finished = true;
        this.queue = [];
        this._flush(false);
        process.nextTick(() => super.emit('error', err));
    }

    write(chunk: NodeBuffer, callback?: () => void): boolean {
        // don't accept more data if ended
        if (this.ended)
            return false;

        // enqueue the chunk for processing
        if (chunk.length > 0) {
            (<IChunk>chunk).callback = callback;
            this.queue.push(<IChunk>chunk);
        }

        // open the file if not started yet
        if (!this.started) {
            this._open();
            return false;
        }

        this._flush(true);
        return this.ready;
    }

    private _open(): void {
        if (this.started) return;

        this.started = true;
        try {
            this.fs.open(this.path, "w",(err, handle) => {
                if (err) return this._error(err);

                this.handle = handle;
                this._flush(false);
            });
        } catch (err) {
            this._error(err);
        }
    }

    private _close(): void {
        if (!this.handle) return;

        var handle = this.handle;
        this.handle = null;
        try {
            this.fs.close(handle, err => {
                if (err) return this._error(err);
                this._flush(false);
            });
        } catch (err) {
            this._error(err);
        }
    }

    end(): void {
        this.ready = false;
        this.ended = true;
        this._flush(true);
    }
}

export class DataTarget extends EventEmitter implements IDataTarget {
    constructor() {
        super();
    }

    on(event: string, listener: Function): NodeEventEmitter {
        return super.on(event, listener);
    }

    protected _data(chunk: NodeBuffer): void {
        super.emit('data', chunk);
    }

    protected _end(): void {
        super.emit('end');
    }

    write(chunk: NodeBuffer, callback?: () => void): boolean {
        // we don't have to do this in the next tick because our caller doesn't need that either
        this._data(chunk);
        if (typeof callback === "function") callback();
        return true;
    }

    end(): void {
        // we don't have to do this in the next tick because our caller doesn't need that either
        this._end();
        super.emit('finish');
    }
}

export class StringDataTarget extends DataTarget {
    private _decoder: IStringDecoder;

    constructor(encoding: string) {
        super();
        this._decoder = new Encoding(encoding).getDecoder();
    }

    protected _data(chunk: NodeBuffer): void {
        this._decoder.write(chunk, 0, chunk.length);
    }

    protected _end(): void {
    }

    result() {
        return this._decoder.text();
    }
}

export class BlobDataTarget extends DataTarget {
    private _chunks: NodeBuffer[];
    private _blob: Blob;
    private _mimeType: string;

    constructor(mimeType?: string) {
        super();
        this._chunks = [];
        this._mimeType = mimeType;
    }

    protected _data(chunk: NodeBuffer): void {
        this._chunks.push(chunk);
    }

    protected _end(): void {
        var options;
        if (this._mimeType) options = { type: this._mimeType };
        this._blob = new Blob(this._chunks, options);
        this._chunks.length = 0;
    }

    result() {
        return this._blob;
    }
}

export class BufferDataTarget extends DataTarget {
    private _chunks: NodeBuffer[];
    private _buffer: NodeBuffer;
    private _length: number;

    constructor() {
        super();
        this._chunks = [];
        this._length = 0;
    }

    protected _data(chunk: NodeBuffer): void {
        this._length += chunk.length;
        this._chunks.push(chunk);
    }

    protected _end(): void {
        this._buffer = new Buffer(this._length);
        var offset = 0;
        for (var n = 0; n < this._chunks.length; n++) {
            var chunk = this._chunks[n];
            chunk.copy(this._buffer, offset); //WEB: this._buffer.set(chunk, offset);
            offset += chunk.length;
        }
        this._chunks.length = 0;
    }

    result() {
        return this._buffer;
    }
}


function __extends(d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
}; 

interface ErrnoException extends Error {
    errno?: number;
}

class EventEmitter {
    constructor() {
        this._events = {};
    }

    private _events: Object;

    addListener(event: string, listener: Function): EventEmitter {
        var list = <Function[]>this._events[event] || [];
        list.push(listener);
        this._events[event] = list;
        return this;
    }

    on(event: string, listener: Function): EventEmitter {
        return this.addListener(event, listener);
    }

    removeListener(event: string, listener: Function): EventEmitter {
        var list = <Function[]>this._events[event];
        if (!Array.isArray(list))
            return;

        var n = list.indexOf(listener);
        if (n >= 0)
            list.splice(n, 1);

        return this;
    }

    removeAllListeners(event?: string): EventEmitter {
        if (typeof event === 'string')
            delete this._events[event];
        else if (typeof event === 'undefined')
            this._events = {};

        return this;
    }

    listeners(event: string): Function[] {
        return this._events[event];
    }

    emit(event: string, ...args: any[]): void {
        var list = <Function[]>this._events[event];
        if (!Array.isArray(list))
            return;

        for (var i = 0; i < list.length; i++) {
            list[i].apply(this, args);
        }
    }
}

class process {
    static nextTick(callback: Function): void {
        window.setTimeout(callback, 0);
    }
}

class BlobDataSource {

    private blob: Blob;
    private pos: number;
    private reader: FileReader;
    private finished: boolean;

    constructor(blob: Blob, position: number) {
        this.blob = blob;
        this.pos = position;
        this.reader = new FileReader();
        this.finished = false;

        this.reader.onload = (e: any) => {
            var buffer = new Uint8Array(e.target.result);
            this.ondata(null, buffer, buffer.length);
        };
    }

    name: string;

    ondata: (err: Error, buffer: Uint8Array, bytesRead: number) => void;

    read(bytesToRead: number): void {
        var slice = this.blob.slice(this.pos, this.pos + bytesToRead);
        this.pos += slice.size;
        this.reader.readAsArrayBuffer(slice);
    }

    next(callback: (err: Error, finished: boolean) => void): void {
        process.nextTick(() => {
            var finished = this.finished;
            this.finished = true;
            callback(null, finished);
        });
    }

    close(callback: (err: Error) => void): void {
        process.nextTick(() => {
            this.finished = true;
            callback(null);
        });
    }

}

function openBlobDataSource(blob: Blob, callback: (err: Error, source?: BlobDataSource) => void): void {
    process.nextTick(() => {
        callback(null, new BlobDataSource(blob, 0));
    });
}

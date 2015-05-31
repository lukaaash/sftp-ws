
function __extends(d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
}; 

interface ErrnoException extends Error {
    errno?: number;
}

//WEB: interface NodeEventEmitter extends EventEmitter {}
//WEB: interface NodeBuffer extends Uint8Array {}
//WEB: var undefined;

class EventEmitter {
    constructor() {
        this._events = {};
    }

    private _events: Object;

    static listenerCount(emitter: EventEmitter, event: string): number {
        if (!emitter || typeof emitter._events === "undefined") return 0;
        var list = <Function[]>emitter._events[event];
        if (!list) return 0;
        return list.length;
    }

    addListener(event: string, listener: Function): EventEmitter {
        var list = <Function[]>this._events[event] || [];
        list.push(listener);
        this._events[event] = list;
        return this;
    }

    on(event: string, listener: Function): EventEmitter {
        return this.addListener(event, listener);
    }

    once(event: string, listener: Function): EventEmitter {
        var wrapper = (...args: any[]) => {
            this.removeListener(event, wrapper);
            listener.apply(this, args);
        }

        return this.addListener(event, wrapper);
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

    emit(event: string, ...args: any[]): boolean {
        var list = <Function[]>this._events[event];
        var called = false;
        if (Array.isArray(list)) {
            for (var i = 0; i < list.length; i++) {
                list[i].apply(this, args);
                called = true;
            }
        }
        if (!called && event == "error") throw args[0];
        return called;
    }
}

class process {
    static nextTick(callback: Function): void {
        window.setTimeout(callback, 0);
    }

    static platform = "browser";
}

function encodeUTF8(value: string, buffer: Uint8Array, offset: number): number {
    var length = 0;
    var space = buffer.length - offset;

    for (var i = 0; i < value.length; i++) {
        var code = value.charCodeAt(i);
        if (code <= 0x7F) {
            var bytes = 1;
            if (space < bytes) return -1;
            length += bytes;
            space -= bytes;
            buffer[offset++] = (code | 0);
        } else if (code <= 0x7FF) {
            var bytes = 2;
            if (space < bytes) return -1;
            length += bytes;
            space -= bytes;
            buffer[offset++] = (code >> 6) | 0x80;
            buffer[offset++] = (code & 0x3F);
        } else if (code <= 0xFFFF) {
            var bytes = 3;
            if (space < bytes) return -1;
            length += bytes;
            space -= bytes;
            buffer[offset++] = ((code >> 12) & 0x0F) | 0xE0;
            buffer[offset++] = ((code >> 6) & 0x3F) | 0x80;
            buffer[offset++] = (code & 0x3F);
        } else if (code <= 0x1FFFFF) {
            var bytes = 4;
            if (space < bytes) return -1;
            length += bytes;
            space -= bytes;
            buffer[offset++] = ((code >> 18) & 0x03) | 0xF0;
            buffer[offset++] = ((code >> 12) & 0x0F) | 0xE0;
            buffer[offset++] = ((code >> 6) & 0x3F) | 0x80;
            buffer[offset++] = (code & 0x3F);
        } else {
            var bytes = 1;
            if (space < bytes) return -1;
            length += bytes;
            space -= bytes;
            buffer[offset++] = 0x3F;
        }
    }

    return length
}

function decodeUTF8(buffer: Uint8Array, offset: number, end: number): string {
    var value = "";
    var length = buffer.length;

    while (offset < end) {
        if (offset >= length) break;

        var code = buffer[offset++];
        if (code >= 128) {
            var len: number;
            switch (code & 0xE0) {
                case 0xE0:
                    if (code & 0x10) {
                        code &= 0x07;
                        len = 3;
                    } else {
                        code &= 0xF;
                        len = 2;
                    }
                    break;
                case 0xC0:
                    code &= 0x1F;
                    len = 1;
                    break;
                default:
                    code = 0xFFFD; // replacement character
                    len = 0;
                    break;
            }

            if ((offset + len) > length) {
                code = 0xFFFD;
                offset = length;
            } else {
                while (len > 0) {
                    var n = buffer[offset++];
                    if ((n & 0xC0) != 0x80) {
                        code = 0xFFFD;
                        break;
                    }
                    code = (code << 6) | (n & 0x3F);
                }
            }
        }

        value += String.fromCharCode(code);
    }

    return value;
}




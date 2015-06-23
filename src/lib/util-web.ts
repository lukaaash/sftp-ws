
function __extends(d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
}

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
                list[i].apply(null, args);
                called = true;
            }
        }
        if (!called && event == "error") {
            var error = <Error>args[0];
            console.error(error);
            throw error;
        }
        return called;
    }
}

class process {
    static nextTick(callback: Function): void {
        window.setTimeout(callback, 0);
    }

    static platform = "browser";
}

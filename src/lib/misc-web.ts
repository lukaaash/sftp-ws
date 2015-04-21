
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

        args = Array.prototype.slice.call(args, 1);
        for (var i = 0; i < list.length; i++) {
            list[i].apply(this, args);
        }
    }
}


function __extends(d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}; 

interface ErrnoException extends Error {
    errno?: number;
}

//WEB: interface Buffer extends Uint8Array {}
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
        if (typeof list === "function") return 1;
        return list.length;
    }

    addListener(event: string, listener: Function): EventEmitter {
        var list = <Function[]>this._events[event];
        if (!list) {
            list = <any>listener;
        } else if (typeof list === "function") {
            list = [<any>list, listener];
        } else {
            list.push(listener);
        }
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
        if (typeof list === "function") {
            if (<any>list === listener) {
                delete this._events[event];
            } else if (Array.isArray(list)) {
                var n = list.indexOf(listener);
                if (n >= 0) list.splice(n, 1);
                if (list.length == 0) delete this._events[event];
            }
        }

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
        var list = this._events[event];
        if (typeof list === "function") {
            list = [<any>list];
        } else if (!Array.isArray(list)) {
            list = [];
        }

        return list;
    }

    emit(event: string, ...args: any[]): boolean
    emit(event: string): boolean {
        var list = <Function[]>this._events[event];
        if (typeof list === "function") {
            var listener = <Function><any>list;
            switch (arguments.length) {
                case 1:
                    listener.call(null);
                    break;
                case 2:
                    listener.call(null, arguments[1]);
                    break;
                case 3:
                    listener.call(null, arguments[1], arguments[2]);
                    break;
                case 4:
                    listener.call(null, arguments[1], arguments[2], arguments[3]);
                    break;
                default:
                    var args = Array.prototype.slice(1);
                    listener.apply(null, args);
                    break;
            }
            return true;
        }

        var called = false;
        if (Array.isArray(list)) {
            for (var i = 0; i < list.length; i++) {
                var listener = <Function>list[i];
                switch (arguments.length) {
                    case 1:
                        listener.call(null);
                        break;
                    case 2:
                        listener.call(null, arguments[1]);
                        break;
                    case 3:
                        listener.call(null, arguments[1], arguments[2]);
                        break;
                    case 4:
                        listener.call(null, arguments[1], arguments[2], arguments[3]);
                        break;
                    default:
                        var args = Array.prototype.slice(1);
                        listener.apply(null, args);
                        break;
                }
                called = true;
            }
        }

        if (!called && event == "error") {
            var error = <Error>args[0];
            throw error;
        }

        return called;
    }
}

class Process { //WEB: class process {
    static nextTick(callback: Function): void {
        window.setTimeout(callback, 0);
    }

    static platform = "browser";
}

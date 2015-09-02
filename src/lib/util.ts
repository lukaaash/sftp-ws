/// <reference path="../typings/node/node.d.ts" />
import events = require("events");

import EventEmitter = events.EventEmitter;

export interface ILogWriter {
    info(message?: any, ...optionalParams: any[]): void;
    warn(message?: any, ...optionalParams: any[]): void;
    error(message?: any, ...optionalParams: any[]): void;
    log(message?: any, ...optionalParams: any[]): void;
}

export function toLogWriter(writer?: ILogWriter): ILogWriter {
    writer = writer || <ILogWriter>{};
    var fixed = <ILogWriter>{};
    var fix = false;

    function empty() {};

    function prepare(name: string) {
        var func = <Function>writer[name];
        if (typeof func !== 'function') {
            fixed[name] = empty;
            fix = true;
        } else {
            fixed[name] = function () {
                func.apply(writer, arguments);
            }
        }
    };

    prepare("info");
    prepare("warn");
    prepare("error");
    prepare("log");

    return fix ? fixed : writer;
}

export class Task<TResult> extends EventEmitter {
    on(event: 'success', listener: (result: TResult) => void): Task<TResult>;
    on(event: 'error', listener: (err: Error) => void): Task<TResult>;
    on(event: 'finish', listener: (err: Error, ...args: any[]) => void): Task<TResult>;
    on(event: string, listener: Function): Task<TResult>;
    on(event: string, listener: Function): Task<TResult> {
        return super.on(event, listener);
    }

    constructor() {
        super();
    }
}

export function wrapCallback(owner: NodeJS.EventEmitter, task: EventEmitter, callback?: (err: Error, ...args: any[]) => void): (err: Error, ...args: any[]) => void {
    return finish;

    function finish(err: Error, ...args: any[]): void {
        var error = arguments[0];
        try {
            if (typeof callback === 'function') {
                callback.apply(owner, arguments);
                error = null;
            } else if (task) {
                if (!error) {
                    switch (arguments.length) {
                        case 0:
                        case 1:
                            task.emit("success");
                            task.emit("finish", error);
                            break;
                        case 2:
                            task.emit("success", arguments[1]);
                            task.emit("finish", error, arguments[1]);
                            break;
                        case 3:
                            task.emit("success", arguments[1], arguments[2]);
                            task.emit("finish", error, arguments[1], arguments[2]);
                            break;
                        default:
                            arguments[0] = "success";
                            task.emit.apply(task, arguments);

                            if (EventEmitter.listenerCount(task, "finish") > 0) {
                                arguments[0] = "finish";
                                Array.prototype.splice.call(arguments, 1, 0, error);
                                task.emit.apply(task, arguments);
                            }
                            break;
                    }

                } else {
                    if (EventEmitter.listenerCount(task, "error")) {
                        task.emit("error", error);
                        error = null;
                    }

                    task.emit("finish", error);
                }
            }
        } catch (err) {
            if (error) owner.emit("error", error);
            error = err;
        }

        if (error) owner.emit("error", error);
    }
}

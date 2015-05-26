/// <reference path="../typings/node/node.d.ts" />

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

export function wrapCallback(obj: NodeEventEmitter, callback?: (err: Error, ...args: any[]) => void): (err: Error, ...args: any[]) => void {
    return function () {
        var error = arguments[0];
        if (typeof callback === 'function') {
            try {
                callback.apply(obj, arguments);
                error = null;
            } catch (err) {
                error = err;
            }
        }

        if (error) obj.emit("error", error);
    };
}

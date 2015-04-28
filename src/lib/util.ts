import utiln = require("./util-node"); //WEB: // removed

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

export function wrap(err: Error, callback: Function, action: Function) {
    if (err) {
        callback(err);
        return;
    }

    try {
        action();
    } catch (err) {
        callback(err);
    }
}

export interface IDataSource {
    ondata: (err: Error, buffer: NodeBuffer, bytesRead: number) => void;
    read(bytesToRead: number): void;
    close(callback: (err: Error) => void): void;
}

export function toDataSource(source: any, callback: (err: Error, source?: IDataSource) => void): IDataSource {

    if (typeof source === "string") return utiln.openFileDataSource(source, callback); //WEB: // removed
    //WEB: if (typeof source === "object" && typeof source.size == "number" && typeof source.slice == "function") return openBlobDataSource(source, callback);

    throw new Error("Unsupported data source");
}


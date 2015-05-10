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
    name: string;
    ondata: (err: Error, buffer: NodeBuffer, bytesRead: number) => void;
    read(bytesToRead: number): void;
    next(callback: (err: Error, finished: boolean) => void): void;
    close(callback: (err: Error) => void): void;
}

class ArrayDataSource implements IDataSource {

    private current: IDataSource;
    private list: IDataSource[];

    constructor() {
        this.current = null;
        this.list = [];
    }

    add(item: IDataSource) {
        this.list.push(item);
    }

    name: string;

    ondata: (err: Error, buffer: NodeBuffer, bytesRead: number) => void;

    read(bytesToRead: number): void {
        if (this.current == null)
            throw new Error("Call next first");

        this.current.read(bytesToRead);
    }

    next(callback: (err: Error, finished: boolean) => void): void {
        if (this.current == null)
            this.current = this.list.shift();

        if (!this.current)
            return process.nextTick(() => callback(null, true));

        this.current.next((err, finished) => {
            if (err) return callback(err, true);

            if (finished) {
                this.current = null;
                this.next(callback);
                return;
            }

            this.name = this.current.name;
            this.current.ondata = (err, buffer, bytesRead) => this.ondata(err, buffer, bytesRead);
            callback(null, false);
        });
    }

    close(callback: (err: Error) => void): void {
        var current = this.current;
        if (current != null) {
            this.current = null;
            this.list = [];
            current.close(callback);
        }
    }
}

export function toDataSource(input: any, callback: (err: Error, source?: IDataSource) => void): void {

    if (Array.isArray(input)) {
        var source = new ArrayDataSource();
        var array = <any[]>[];
        Array.prototype.push.apply(array, input);
        addNext();
        return;

        function addNext(): void {
            var item = array.pop();
            if (!item) return callback(null, source);
            if (Array.isArray(item)) return process.nextTick(() => callback(new Error("Unsupported array of arrays data source")));
            toDataSource(item,(err, source2) => {
                if (err) return callback(err, null);
                source.add(source2);
                addNext();
            });
        };
    }

    if (typeof input === "string") return utiln.openFileDataSource(input, callback); //WEB: // removed
    //WEB: if (typeof input === "object" && typeof input.size == "number" && typeof input.slice == "function") return openBlobDataSource(input, callback);

    process.nextTick(() => callback(new Error("Unsupported data source")));
}


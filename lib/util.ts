import events = require("events");
import util = require("util");

export interface ILogWriter {
    trace(format: string, ...params: any[]): void;
    trace(obj: Object, format?: string, ...params: any[]): void;
    debug(format: string, ...params: any[]): void;
    debug(obj: Object, format?: string, ...params: any[]): void;
    info(format: string, ...params: any[]): void;
    info(obj: Object, format?: string, ...params: any[]): void;
    warn(format: string, ...params: any[]): void;
    warn(obj: Object, format?: string, ...params: any[]): void;
    error(format: string, ...params: any[]): void;
    error(obj: Object, format?: string, ...params: any[]): void;
    fatal(format: string, ...params: any[]): void;
    fatal(obj: Object, format?: string, ...params: any[]): void;
    level(): string|number;
}

export const enum LogLevel {
    TRACE = 10,
    DEBUG = 20,
    INFO = 30,
    WARN = 40,
    ERROR = 50,
    FATAL = 60,
}

export class LogHelper {

    static getLevel(log: ILogWriter): LogLevel {
        var value = log.level();
        if (typeof value === "number") return value;
        switch (("" + value).toLowerCase()) {
            case "trace": return 10;
            case "debug": return 20;
            case "info": return 30;
            case "warn": return 40;
            case "error": return 50;
            case "fatal": return 60;
        }

        var level = <any>value | 0;
        if (level <= 0 || level >= 100) level = 60;
        return level;
    }

    static isTrace(log: ILogWriter): boolean {
        var level = log.level();
        return (level <= 10 || level === "trace");
    }
    
    static toLogWriter(writer?: ILogWriter): ILogWriter {

        function check(names: string[]) {
            if (typeof writer !== "object") return false;

            for (var i = 0; i < names.length; i++) {
                if (typeof writer[names[i]] !== "function") return false;
            }

            return true;
        };

        var levels = ["trace", "debug", "info", "warn", "error", "fatal"];

        if (writer == null || typeof writer === "undefined") {
            // no writer specified, create a dummy writer
            var proxy = <ILogWriter>new Object();

            levels.forEach(level => {
                proxy[level] = (obj?: Object, format?: any, ...params: any[]): void => { };
            });

            proxy["level"] = () => { return 90; }

            return <ILogWriter>proxy;
        }

        if (check(levels)) {
            // looks like bunyan, great!
            return writer;
        }

        // #if NODE
        if (check(["log", "debug", "info", "warn", "error", "query"])) {
            // looks like winston, lets's create a proxy for it
            var proxy = <ILogWriter>new Object();

            levels.forEach(level => {
                proxy[level] = (obj?: Object, format?: any, ...params: any[]): void => {
                    // log(level: string, msg: string, meta: any, callback ?: (err: Error, level: string, msg: string, meta: any) => void): LoggerInstance;
                    if (typeof obj === "string") {
                        var msg = util.format(obj, format, params);
                        (<any>writer).log(level, msg);
                    } else {
                        var msg = util.format(format, params);
                        (<any>writer).log(level, msg, obj);
                    }
                };
            });

            proxy["level"] = () => { return (<any>writer).level; }

            return <ILogWriter>proxy;
        }
        // #endif

        if (check(["log", "info", "warn", "error", "dir"])) {
            // looks like console, lets's create a proxy for it
            var proxy = <ILogWriter>new Object();
            var console = <Console><any>writer;
            var levelObj;
            var levelNum = LogLevel.DEBUG;

            var funcs = ["log", "log", "info", "warn", "error", "error"];
            var names = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"];

            [10, 20, 30, 40, 50, 60].forEach(level => {
                var index = level / 10 - 1;

                proxy[levels[index]] = function (obj?: Object, format?: any, ...params: any[]): void {

                    // update current level if needed
                    if (levelObj !== (<any>console).level) {
                        levelObj = (<any>console).level;
                        levelNum = LogHelper.getLevel(proxy);
                    }

                    // don't log if the logger log level is too high
                    if (level < levelNum) return;

                    // convert to actual console "log levels"
                    var func = funcs[index];

                    var array = params;
                    if (typeof format !== "undefined") array.unshift(format);
                    if (typeof obj === "string" || obj === null) {
                        array.unshift(obj);
                        obj = null;
                    }

                    array = [names[index] + ":", util.format.apply(util, array)]; // WEB: array.push("(" + names[index] + ")");

                    (<Function>console[func]).apply(console, array);
                    if (obj !== null) (<Function>console[func]).call(console, obj);
                };
            });

            proxy["level"] = () => { return (<any>console).level || LogLevel.DEBUG; }

            return <ILogWriter>proxy;
        }

        throw new TypeError("Unsupported log writer");
    }
}

export class Options {

    constructor(options: {}) {
        if (!options) return;

        for (var propertyName in options) {
            if (options.hasOwnProperty(propertyName)) this[propertyName] = options[propertyName];
        }
    }

    merge(options: any): any {
        var result = {};

        for (var propertyName in this) {
            if (this.hasOwnProperty(propertyName)) result[propertyName] = this[propertyName];
        }

        if (options) for (var propertyName in options) {
            if (options.hasOwnProperty(propertyName)) result[propertyName] = options[propertyName];
        }

        return result;
    }

    intersect(options: any): any {
        var result = {};

        for (var propertyName in this) {
            if (!this.hasOwnProperty(propertyName)) continue;

            if (options && options.hasOwnProperty(propertyName)) {
                result[propertyName] = options[propertyName];
            } else {
                result[propertyName] = this[propertyName];
            }
        }

        return result;
    }
}


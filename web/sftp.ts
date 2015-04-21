module SFTP {
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
    
    
    interface ILogWriter {
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
    
    
    interface IStats {
        mode?: number;
        uid?: number;
        gid?: number;
        size?: number;
        atime?: Date;
        mtime?: Date;
    }
    
    interface IStatsExt extends IStats {
        nlink?: number;
    }
    
    interface IItem {
        filename: string;
        stats?: IStats;
    }
    
    interface IFilesystem {
        open(path: string, flags: string, attrs?: IStats, callback?: (err: Error, handle: any) => any): void;
        close(handle: any, callback?: (err: Error) => any): void;
        read(handle: any, buffer: Uint8Array, offset: number, length: number, position: number, callback?: (err: Error, bytesRead: number, buffer: Uint8Array) => any): void;
        write(handle: any, buffer: Uint8Array, offset: number, length: number, position: number, callback?: (err: Error) => any): void;
        lstat(path: string, callback?: (err: Error, attrs: IStats) => any): void;
        fstat(handle: any, callback?: (err: Error, attrs: IStats) => any): void;
        setstat(path: string, attrs: IStats, callback?: (err: Error) => any): void;
        fsetstat(handle: any, attrs: IStats, callback?: (err: Error) => any): void;
        opendir(path: string, callback?: (err: Error, handle: any) => any): void;
        readdir(handle: any, callback?: (err: Error, items: IItem[]|boolean) => any): void;
        unlink(path: string, callback?: (err: Error) => any): void;
        mkdir(path: string, attrs?: IStats, callback?: (err: Error) => any): void;
        rmdir(path: string, callback?: (err: Error) => any): void;
        realpath(path: string, callback?: (err: Error, resolvedPath: string) => any): void;
        stat(path: string, callback?: (err: Error, attrs: IStats) => any): void;
        rename(oldPath: string, newPath: string, callback?: (err: Error) => any): void;
        readlink(path: string, callback?: (err: Error, linkString: string) => any): void;
        symlink(targetpath: string, linkpath: string, callback?: (err: Error) => any): void;
    }
    
    
    
    interface IFilesystemExt extends FilesystemPlus {
    }
    
    class FilesystemPlus extends EventEmitter implements IFilesystem {
    
        protected _fs: IFilesystem;
    
        constructor(fs: IFilesystem) {
            super();
            this._fs = fs;
        }
    
        private wrapCallback(callback: any): any {
            if (typeof callback !== 'function') {
                // use dummy callback to prevent having to check this later
                return function () { };
            } else {
                return () => {
                    try {
                        callback.apply(this, arguments);
                    } catch (error) {
                        this.emit("error", error);
                    }
                };
            }
        }
    
        on(event: 'error', listener: (err: Error) => void): EventEmitter;
        on(event: string, listener: Function): EventEmitter;
        on(event: string, listener: Function): EventEmitter {
            return super.on(event, listener);
        }
    
        // removed
        // removed
        // removed
            // removed
        // removed
    
        addListener(event: 'error', listener: (err: Error) => void): EventEmitter;
        addListener(event: string, listener: Function): EventEmitter;
        addListener(event: string, listener: Function): EventEmitter {
            return super.addListener(event, listener);
        }
    
        open(path: string, flags: string, attrs?: IStats, callback?: (err: Error, handle: any) => any): void {
            if (typeof attrs === 'function' && typeof callback === 'undefined') {
                callback = <any>attrs;
                attrs = null;
            }
            callback = this.wrapCallback(callback);
    
            this._fs.open(path, flags, attrs, callback);
        }
    
        close(handle: any, callback?: (err: Error) => any): void {
            callback = this.wrapCallback(callback);
    
            this._fs.close(handle, callback);
        }
    
        read(handle: any, buffer: Uint8Array, offset: number, length: number, position: number, callback?: (err: Error, bytesRead: number, buffer: Uint8Array) => any): void {
            callback = this.wrapCallback(callback);
    
            this._fs.read(handle, buffer, offset, length, position, callback);
        }
    
        write(handle: any, buffer: Uint8Array, offset: number, length: number, position: number, callback?: (err: Error) => any): void {
            callback = this.wrapCallback(callback);
    
            this._fs.write(handle, buffer, offset, length, position, callback);
        }
    
        lstat(path: string, callback?: (err: Error, attrs: IStats) => any): void {
            callback = this.wrapCallback(callback);
    
            this._fs.lstat(path, callback);
        }
    
        fstat(handle: any, callback?: (err: Error, attrs: IStats) => any): void {
            callback = this.wrapCallback(callback);
    
            this._fs.fstat(handle, callback);
        }
    
        setstat(path: string, attrs: IStats, callback?: (err: Error) => any): void {
            callback = this.wrapCallback(callback);
    
            this._fs.setstat(path, attrs, callback);
        }
    
        fsetstat(handle: any, attrs: IStats, callback?: (err: Error) => any): void {
            callback = this.wrapCallback(callback);
    
            this._fs.fsetstat(handle, attrs, callback);
        }
    
        opendir(path: string, callback?: (err: Error, handle: any) => any): void {
            callback = this.wrapCallback(callback);
    
            this._fs.opendir(path, callback);
        }
    
        readdir(path: string, callback?: (err: Error, items: IItem[]|boolean) => any)
        readdir(handle: any, callback?: (err: Error, items: IItem[]) => any): void {
            callback = this.wrapCallback(callback);
    
            if (typeof handle !== 'string')
                return this._fs.readdir(handle, callback);
    
            var path = <string>handle;
            var list: IItem[] = [];
    
            var next = (err, items: IItem[]|boolean) => {
    
                if (err != null) {
                    this.close(handle);
                    callback(err, list);
                    return;
                }
    
                if (items === false) {
                    this.close(handle, err => {
                        callback(err, list);
                    });
                    return;
                }
    
                list = list.concat(<IItem[]>items);
                this._fs.readdir(handle, next);
            };
    
            this.opendir(path,(err, h) => {
                if (err != null) {
                    callback(err, null);
                    return;
                }
    
                handle = h;
                next(null, []);
            });
        }
    
        unlink(path: string, callback?: (err: Error) => any): void {
            callback = this.wrapCallback(callback);
    
            this._fs.unlink(path, callback);
        }
    
        mkdir(path: string, attrs?: IStats, callback?: (err: Error) => any): void {
            if (typeof attrs === 'function' && typeof callback === 'undefined') {
                callback = <any>attrs;
                attrs = null;
            }
            callback = this.wrapCallback(callback);
    
            this._fs.mkdir(path, attrs, callback);
        }
    
        rmdir(path: string, callback?: (err: Error) => any): void {
            callback = this.wrapCallback(callback);
    
            this._fs.rmdir(path, callback);
        }
    
        realpath(path: string, callback?: (err: Error, resolvedPath: string) => any): void {
            callback = this.wrapCallback(callback);
    
            this._fs.realpath(path, callback);
        }
    
        stat(path: string, callback?: (err: Error, attrs: IStats) => any): void {
            callback = this.wrapCallback(callback);
    
            this._fs.stat(path, callback);
        }
    
        rename(oldPath: string, newPath: string, callback?: (err: Error) => any): void {
            callback = this.wrapCallback(callback);
    
            this._fs.rename(oldPath, newPath, callback);
        }
    
        readlink(path: string, callback?: (err: Error, linkString: string) => any): void {
            callback = this.wrapCallback(callback);
    
            this._fs.readlink(path, callback);
        }
    
        symlink(targetpath: string, linkpath: string, callback?: (err: Error) => any): void {
            callback = this.wrapCallback(callback);
    
            this._fs.symlink(targetpath, linkpath);
        }
    
    
    }
    
    
    interface ISessionHost {
        send(packet: Uint8Array): void;
        close(reason?: number): void;
        log?: ILogWriter;
    }
    
    interface ISession {
        _process(packet: Uint8Array): void;
        _end(): void;
    }
    
    class Channel implements ISessionHost {
    
        log: ILogWriter;
    
        private session: ISession;
        private ws: WebSocket;
        // removed
    
        constructor(session: ISession, ws: WebSocket) {
            this.session = session;
            this.ws = ws;
            // removed
        }
    
        start() {
            this.ws.onclose = e => {
                var code = e.code;
                var message = e.reason;
                this.log.info("Connection closed:", code, message);
                this.close(1000); // normal close
            };
            
            this.ws.onerror = err => {
                //this.emit('error', err);
                var name = typeof err;
                this.log.error("Socket error:", err.message, name);
                this.close(1011); // unexpected condition
            };
    
            this.ws.onmessage = message => {
    
                var request: Uint8Array;
                if (true) { //TODO: handle text messages
                    request = new Uint8Array(message.data);
                } else {
                    this.log.error("Text packet received, but not supported yet.");
                    this.close(1003); // unsupported data
                    return;
                }
    
                try {
                    this.session._process(request);
                } catch (error) {
                    this.log.error("Error while processing packet:", error);
                    this.close(1011); // unexpected condition
                }
            };
    
        }
    
        send(packet: Uint8Array): void {
            if (this.ws == null)
                return;
    
            this.ws.send(packet);
                // removed
                    // removed
                    // removed
                // removed
            // removed
        }
    
        close(reason: number): void {
            if (this.ws == null)
                return;
    
            if (typeof reason === 'undefined')
                reason = 1000; // normal close
    
            try {
                this.ws.close(reason, "closed");
            } catch (error) {
                this.log.error("Error while closing WebSocket:", error);
            } finally {
                this.ws = null;
            }
    
            try {
                this.session._end();
            } catch (error) {
                this.log.error("Error while closing session:", error);
            } finally {
                this.session = null;
            }
        }
    }
    const enum SftpPacketType {
    
        // initialization
        INIT = 1,
        VERSION = 2,
    
        // requests
        OPEN = 3,
        CLOSE = 4,
        READ = 5,
        WRITE = 6,
        LSTAT = 7,
        FSTAT = 8,
        SETSTAT = 9,
        FSETSTAT = 10,
        OPENDIR = 11,
        READDIR = 12,
        REMOVE = 13,
        MKDIR = 14,
        RMDIR = 15,
        REALPATH = 16,
        STAT = 17,
        RENAME = 18,
        READLINK = 19,
        SYMLINK = 20,
    
        // responses
        STATUS = 101,
        HANDLE = 102,
        DATA = 103,
        NAME = 104,
        ATTRS = 105,
    }
    
    const enum SftpStatusCode {
        OK = 0,
        EOF = 1,
        NO_SUCH_FILE = 2,
        PERMISSION_DENIED = 3,
        FAILURE = 4,
        BAD_MESSAGE = 5,
        NO_CONNECTION = 6,
        CONNECTION_LOST = 7,
        OP_UNSUPPORTED = 8,
    }
    
    const enum SftpOpenFlags {
        READ = 0x0001,
        WRITE = 0x0002,
        APPEND = 0x0004,
        CREATE = 0x0008,
        TRUNC = 0x0010,
        EXCL = 0x0020,
    }
    
    
    
    class SftpPacket {
        type: SftpPacketType;
        id: number;
    
        buffer: Uint8Array;
        position: number;
        length: number;
    
        constructor() {
        }
    
        check(count: number): void {
            var remaining = this.length - this.position;
            if (count > remaining)
                throw new Error("Unexpected end of packet");
        }
    
        skip(count: number): void {
            this.check(length);
            this.position += count;
        }
    
        static isBuffer(obj: any): boolean {
            return obj && obj.buffer instanceof ArrayBuffer && obj.byteLength !== undefined
        }
    }
    
    class SftpPacketReader extends SftpPacket {
    
        constructor(buffer: Uint8Array) {
            super();
    
            this.buffer = buffer;
            this.position = 0;
            this.length = buffer.length;
    
            var length = this.readInt32() + 4;
            if (length != this.length)
                throw new Error("Invalid packet received");
    
            this.type = this.readByte();
            if (this.type == SftpPacketType.INIT || this.type == SftpPacketType.VERSION) {
                this.id = null;
            } else {
                this.id = this.readInt32();
            }
        }
    
        readByte(): number {
            this.check(1);
            var value = this.buffer[this.position++];
            return value;
        }
    
        readInt32(): number {
    
            var value = this.readUint32();
    
            if (value & 0x80000000)
                value -= 0x100000000;
    
            return value;
        }
    
        readUint32(): number {
            this.check(4);
    
            var value = 0;
            value |= this.buffer[this.position++] << 24;
            value |= this.buffer[this.position++] << 16;
            value |= this.buffer[this.position++] << 8;
            value |= this.buffer[this.position++];
    
            return value;
        }
    
        readInt64(): number {
            var hi = this.readInt32();
            var lo = this.readUint32();
    
            var value = hi * 0x100000000 + lo;
            return value;
        }
    
        readString(): string {
            var length = this.readInt32();
            this.check(length);
    
            var value = "";
    
            var p = this.position;
            var end = p + length;
            while (p < end) {
                var code = this.buffer[p++];
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
    
                    if ((p + len) > this.length) {
                        code = 0xFFFD;
                        p = this.length;
                    } else {
                        while (len > 0) {
                            var n = this.buffer[p++];
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
    
            this.position = end;
    
            return value;
        }
    
        skipString(): void {
            var length = this.readInt32();
            this.check(length);
    
            var end = this.position + length;
            this.position = end;
        }
    
        readDadta(clone: boolean): Uint8Array {
            var length = this.readInt32();
            this.check(length);
    
            var start = this.position;
            var end = start + length;
            this.position = end;
            return this.buffer.subarray(start, end);
        }
    
        readData(clone: boolean): Uint8Array {
            var length = this.readInt32();
            this.check(length);
    
            var start = this.position;
            var end = start + length;
            this.position = end;
            var view = this.buffer.subarray(start, end);
            if (clone) {
                var buffer = new Uint8Array(length);
                buffer.set(view, 0);
                return buffer;
            } else {
                return view;
            }
        }
    
    }
    
    class SftpPacketWriter extends SftpPacket {
    
        constructor(length: number) {
            super();
    
            this.buffer = new Uint8Array(length);
            this.position = 0;
            this.length = length;
        }
    
        start(): void {
            this.position = 0;
            this.writeInt32(0); // length placeholder
            this.writeByte(this.type | 0);
    
            if (this.type == SftpPacketType.INIT || this.type == SftpPacketType.VERSION) {
                // these packets don't have an id
            } else {
                this.writeInt32(this.id | 0);
            }
        }
    
        finish(): Uint8Array {
            var length = this.position;
            this.position = 0;
            this.writeInt32(length - 4);
            return this.buffer.subarray(0, length);
        }
    
        writeByte(value: number): void {
            this.check(1);
            this.buffer[this.position++] = value & 0xFF;
        }
    
        writeInt32(value: number): void {
            this.check(4);
            this.buffer[this.position++] = (value >> 24) & 0xFF;
            this.buffer[this.position++] = (value >> 16) & 0xFF;
            this.buffer[this.position++] = (value >> 8) & 0xFF;
            this.buffer[this.position++] = value & 0xFF;
        }
    
        writeInt64(value: number): void {
            var hi = (value / 0x100000000) | 0;
            var lo = (value & 0xFFFFFFFF) | 0;
    
            this.writeInt32(hi);
            this.writeInt32(lo);
        }
    
        writeString(value: string): void {
            var start = this.position;
            this.writeInt32(0); // will get overwritten later
            this.check(value.length);
    
            var length = 0;
    
            for (var i = 0; i < value.length; i++) {
                var code = value.charCodeAt(i);
                if (code <= 0x7F) {
                    length += 1;
                    this.check(1);
                    this.buffer[this.position++] = (code | 0);
                } else if (code <= 0x7FF) {
                    length += 2;
                    this.check(2);
                    this.buffer[this.position++] = (code >> 6) | 0x80;
                    this.buffer[this.position++] = (code & 0x3F);
                } else if (code <= 0xFFFF) {
                    length += 3;
                    this.check(3);
                    this.buffer[this.position++] = ((code >> 12) & 0x0F) | 0xE0;
                    this.buffer[this.position++] = ((code >> 6) & 0x3F) | 0x80;
                    this.buffer[this.position++] = (code & 0x3F);
                } else if (code <= 0x1FFFFF) {
                    length += 4;
                    this.check(4);
                    this.buffer[this.position++] = ((code >> 18) & 0x03) | 0xF0;
                    this.buffer[this.position++] = ((code >> 12) & 0x0F) | 0xE0;
                    this.buffer[this.position++] = ((code >> 6) & 0x3F) | 0x80;
                    this.buffer[this.position++] = (code & 0x3F);
                } else {
                    length += 1;
                    this.check(1);
                    this.buffer[this.position++] = 0x3F;
                }
            }
    
            // write number of bytes
            var position = this.position;
            this.position = start;
            this.writeInt32(length);
            this.position = position;
        }
    
        writeData(data: Uint8Array, start?: number, end?: number): void {
            if (typeof start !== 'undefined')
                data = data.subarray(start, end);
    
            var length = data.length;
            this.writeInt32(length);
    
            this.check(length);
            this.buffer.set(data, this.position);
            this.position += length;
        }
    
    }
    
    
    
    class SftpFlags {
    
        static toFlags(flags: string): SftpOpenFlags {
            switch (flags) {
                case 'r':
                    return SftpOpenFlags.READ;
                case 'r+':
                    return SftpOpenFlags.READ | SftpOpenFlags.WRITE;
                case 'w':
                    return SftpOpenFlags.WRITE | SftpOpenFlags.CREATE | SftpOpenFlags.TRUNC;
                case 'w+':
                    return SftpOpenFlags.WRITE | SftpOpenFlags.CREATE | SftpOpenFlags.TRUNC | SftpOpenFlags.READ;
                case 'wx':
                case 'xw':
                    return SftpOpenFlags.WRITE | SftpOpenFlags.CREATE | SftpOpenFlags.TRUNC | SftpOpenFlags.EXCL;
                case 'wx+':
                case 'xw+':
                    return SftpOpenFlags.WRITE | SftpOpenFlags.CREATE | SftpOpenFlags.TRUNC | SftpOpenFlags.EXCL | SftpOpenFlags.READ;
                case 'a':
                    return SftpOpenFlags.WRITE | SftpOpenFlags.CREATE | SftpOpenFlags.APPEND;
                case 'a+':
                    return SftpOpenFlags.WRITE | SftpOpenFlags.CREATE | SftpOpenFlags.APPEND | SftpOpenFlags.READ;
                case 'ax':
                case 'xa':
                    return SftpOpenFlags.WRITE | SftpOpenFlags.CREATE | SftpOpenFlags.APPEND | SftpOpenFlags.EXCL;
                case 'ax+':
                case 'xa+':
                    return SftpOpenFlags.WRITE | SftpOpenFlags.CREATE | SftpOpenFlags.APPEND | SftpOpenFlags.EXCL | SftpOpenFlags.READ;
                default:
                    throw Error("Invalid flags '" + flags + "'");
            }
        }
    
        static fromFlags(flags: number): string[] {
            var read = ((flags & SftpOpenFlags.READ) != 0);
            var write = ((flags & SftpOpenFlags.WRITE) != 0);
            var append = ((flags & SftpOpenFlags.APPEND) != 0);
            var create = ((flags & SftpOpenFlags.CREATE) != 0);
            var trunc = ((flags & SftpOpenFlags.TRUNC) != 0);
            var excl = ((flags & SftpOpenFlags.EXCL) != 0);
    
            var modes = [];
    
            if (create) {
                if (excl) {
                    modes.push("wx+");
                } else if (trunc) {
                    modes.push("w+");
                } else {
                    modes.push("wx+");
                    create = false;
                }
            }
    
            if (!create) {
                if (append) {
                    if (read) {
                        modes.push("a+");
                    } else {
                        modes.push("a");
                    }
                } else if (write) {
                    modes.push("r+");
                } else {
                    modes.push("r");
                }
            }
    
            return modes;
        }
    
    }
    
    class SftpStatus {
    
    
        static write(response: SftpPacketWriter, code: SftpStatusCode, message: string) {
            response.type = SftpPacketType.STATUS;
            response.start();
    
            response.writeInt32(code);
            response.writeString(message);
            response.writeInt32(0);
        }
    
        static writeSuccess(response: SftpPacketWriter) {
            this.write(response, SftpStatusCode.OK, "OK");
        }
    
        static writeError(response: SftpPacketWriter, err: ErrnoException) {
            var message: string;
            var code = SftpStatusCode.FAILURE;
    
            // loosely based on the list from https://github.com/rvagg/node-errno/blob/master/errno.js
    
            switch (err.errno | 0) {
                default:
                    if (err["isPublic"] === true)
                        message = err.message;
                    else
                        message = "Unknown error";
                    break;
                case 1: // EOF
                    message = "End of file";
                    code = SftpStatusCode.EOF;
                    break;
                case 3: // EACCES
                    message = "Permission denied";
                    code = SftpStatusCode.PERMISSION_DENIED;
                    break;
                case 4: // EAGAIN
                    message = "Try again";
                    break;
                case 9: // EBADF
                    message = "Bad file number";
                    break;
                case 10: // EBUSY
                    message = "Device or resource busy";
                    break;
                case 18: // EINVAL
                    message = "Invalid argument";
                    break;
                case 20: // EMFILE
                    message = "Too many open files";
                    break;
                case 24: // ENFILE
                    message = "File table overflow";
                    break
                case 25: // ENOBUFS
                    message = "No buffer space available";
                    break
                case 26: // ENOMEM
                    message = "Out of memory";
                    break
                case 27: // ENOTDIR
                    message = "Not a directory";
                    break
                case 28: // EISDIR
                    message = "Is a directory";
                    break
                case 34: // ENOENT
                    message = "No such file or directory";
                    code = SftpStatusCode.NO_SUCH_FILE;
                    break
                case 35: // ENOSYS
                    message = "Function not implemented";
                    code = SftpStatusCode.OP_UNSUPPORTED;
                    break;
                case 47: // EEXIST
                    message = "File exists";
                    break
                case 49: // ENAMETOOLONG
                    message = "File name too long";
                    break
                case 50: // EPERM
                    message = "Operation not permitted";
                    break
                case 51: // ELOOP
                    message = "Too many symbolic links encountered";
                    break
                case 52: // EXDEV
                    message = "Cross-device link ";
                    break
                case 53: // ENOTEMPTY
                    message = "Directory not empty";
                    break
                case 54: // ENOSPC
                    message = "No space left on device";
                    break
                case 55: // EIO
                    message = "I/O error";
                    break
                case 56: // EROFS
                    message = "Read-only file system";
                    break
                case 57: // ENODEV
                    message = "No such device";
                    code = SftpStatusCode.NO_SUCH_FILE;
                    break
                case 58: // ESPIPE
                    message = "Illegal seek";
                    break;
                case 59: // ECANCELED
                    message = "Operation canceled";
                    break;
            }
    
            this.write(response, code, message);
        }
    
    }
    
    class SftpOptions {
        encoding: string;
        handle: Uint8Array;
        flags: string;
        mode: number;
        start: number;
        end: number;
        autoClose: boolean;
    }
    
    class SftpItem implements IItem {
        filename: string;
        longname: string;
        stats: SftpAttributes;
    
        constructor(request: SftpPacketReader)
        constructor(filename: string, stats?: IStats)
        constructor(arg: any, stats?: IStats) {
            if (typeof arg === 'object') {
                var request = <SftpPacketReader>arg;
                this.filename = request.readString();
                this.longname = request.readString();
                this.stats = new SftpAttributes(request);
            } else {
                var filename = <string>arg;
                this.filename = filename;
                this.longname = filename;
                if (typeof stats === 'object') {
                    var attr = new SftpAttributes();
                    attr.from(stats);
                    this.stats = attr;
                    this.longname = attr.toString() + " " + filename;
                }
            }
        }
    
        write(response: SftpPacketWriter): void {
            response.writeString(this.filename);
            response.writeString(this.longname);
            if (typeof this.stats === "object")
                this.stats.write(response);
            else
                response.writeInt32(0);
        }
    }
    
    const enum SftpAttributeFlags {
        SIZE         = 0x00000001,
        UIDGID       = 0x00000002,
        PERMISSIONS  = 0x00000004,
        ACMODTIME    = 0x00000008,
        BASIC        = 0x0000000F,
        EXTENDED     = 0x80000000,
    }
    
    const enum PosixFlags {
        FIFO              = 0x1000,
        CHARACTER_DEVICE  = 0x2000,
        DIRECTORY         = 0x4000,
        BLOCK_DEVICE      = 0x6000,
        REGULAR_FILE      = 0x8000,
        SYMLINK           = 0xA000,
        SOCKET            = 0XC000,
    }
    
    class SftpAttributes implements IStats {
    
        //uint32   flags
        //uint64   size           present only if flag SSH_FILEXFER_ATTR_SIZE
        //uint32   uid            present only if flag SSH_FILEXFER_ATTR_UIDGID
        //uint32   gid            present only if flag SSH_FILEXFER_ATTR_UIDGID
        //uint32   permissions    present only if flag SSH_FILEXFER_ATTR_PERMISSIONS
        //uint32   atime          present only if flag SSH_FILEXFER_ATTR_ACMODTIME
        //uint32   mtime          present only if flag SSH_FILEXFER_ATTR_ACMODTIME
        //uint32   extended_count present only if flag SSH_FILEXFER_ATTR_EXTENDED
        //string   extended_type
        //string   extended_data
        //...      more extended data(extended_type - extended_data pairs),
        //so that number of pairs equals extended_count
    
        flags: SftpAttributeFlags;
        size: number;
        uid: number;
        gid: number;
        mode: number;
        atime: Date;
        mtime: Date;
        nlink: number;
    
        constructor(request?: SftpPacketReader) {
            if (typeof request === 'undefined') {
                this.flags = 0;
                return;
            }
    
            var flags = this.flags = request.readUint32();
    
            if (flags & SftpAttributeFlags.SIZE) {
                this.size = request.readInt64();
            }
    
            if (flags & SftpAttributeFlags.UIDGID) {
                this.uid = request.readInt32();
                this.gid = request.readInt32();
            }
    
            if (flags & SftpAttributeFlags.PERMISSIONS) {
                this.mode = request.readUint32();
            }
    
            if (flags & SftpAttributeFlags.ACMODTIME) {
                this.atime = new Date(1000 * request.readUint32());
                this.mtime = new Date(1000 * request.readUint32());
            }
    
            if (flags & SftpAttributeFlags.EXTENDED) {
                this.flags &= ~SftpAttributeFlags.EXTENDED;
                this.size = request.readInt64();
                for (var i = 0; i < this.size; i++) {
                    request.skipString();
                    request.skipString();
                }
            }
        }
    
        write(response: SftpPacketWriter): void {
            var flags = this.flags;
            response.writeInt32(flags);
    
            if (flags & SftpAttributeFlags.SIZE) {
                response.writeInt64(this.size);
            }
    
            if (flags & SftpAttributeFlags.UIDGID) {
                response.writeInt32(this.uid);
                response.writeInt32(this.gid);
            }
    
            if (flags & SftpAttributeFlags.PERMISSIONS) {
                response.writeInt32(this.mode);
            }
    
            if (flags & SftpAttributeFlags.ACMODTIME) {
                response.writeInt32(this.atime.getTime() / 1000);
                response.writeInt32(this.mtime.getTime() / 1000);
            }
    
            if (flags & SftpAttributeFlags.EXTENDED) {
                response.writeInt32(0);
            }
        }
    
        from(stats: IStatsExt): void {
            if (stats == null || typeof stats === 'undefined') {
                this.flags = 0;
            } else {
                var flags = 0;
    
                if (typeof stats.size !== 'undefined') {
                    flags |= SftpAttributeFlags.SIZE;
                    this.size = stats.size | 0;
                }
    
                if (typeof stats.uid !== 'undefined' || typeof stats.gid !== 'undefined') {
                    flags |= SftpAttributeFlags.UIDGID;
                    this.uid = stats.uid | 0;
                    this.gid = stats.gid | 0;
                }
    
                if (typeof stats.mode !== 'undefined') {
                    flags |= SftpAttributeFlags.PERMISSIONS;
                    this.mode = stats.mode | 0;
                }
    
                if (typeof stats.atime !== 'undefined' || typeof stats.mtime !== 'undefined') {
                    flags |= SftpAttributeFlags.ACMODTIME;
                    this.atime = stats.atime; //TODO: make sure its Date
                    this.mtime = stats.mtime; //TODO: make sure its Date
                }
    
                if (typeof stats.nlink !== 'undefined') {
                    this.nlink = stats.nlink;
                }
    
                this.flags = flags;
            }
        }
    
        toString(): string {
            var attrs = this.mode;
    
            var perms;
            switch (attrs & 0xE000) {
                case PosixFlags.CHARACTER_DEVICE:
                    perms = "c";
                    break;
                case PosixFlags.DIRECTORY:
                    perms = "d";
                    break;
                case PosixFlags.BLOCK_DEVICE:
                    perms = "b";
                    break;
                case PosixFlags.REGULAR_FILE:
                    perms = "-";
                    break;
                case PosixFlags.SYMLINK:
                    perms = "l";
                    break;
                case PosixFlags.SOCKET:
                    perms = "s";
                    break;
                case PosixFlags.FIFO:
                    perms = "p";
                    break;
                default:
                    perms = "-";
                    break;
            }
    
            attrs &= 0x1FF;
    
            for (var j = 0; j < 3; j++) {
                var mask = (attrs >> ((2 - j) * 3)) & 0x7;
                perms += (mask & 4) ? "r" : "-";
                perms += (mask & 2) ? "w" : "-";
                perms += (mask & 1) ? "x" : "-";
            }
    
            var len = this.size.toString();
            if (len.length < 9)
                len = "         ".slice(len.length - 9) + len;
            else
                len = " " + len;
    
            var modified = this.mtime;
            var diff = (new Date().getTime() - modified.getTime()) / (3600 * 24);
            var date = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][modified.getUTCMonth()];
            var day = modified.getUTCDate();
            date += ((day <= 9) ? "  " : " ") + day;
    
            if (diff < -30 || diff > 180)
                date += "  " + modified.getUTCFullYear();
            else
                date += " " + ("0" + modified.getUTCHours()).slice(-2) + ":" + ("0" + modified.getUTCMinutes()).slice(-2);
    
            var nlink = (typeof this.nlink === 'undefined') ? 1 : this.nlink;
    
            return perms + " " + nlink + " user group " + len + " " + date;
        }
    
    }
    
    
    
    
    interface SftpRequest {
        callback: Function;
        responseParser: (reply: SftpPacket, callback: Function) => void;
    }
    
    class SftpClientCore implements ISession, IFilesystem {
    
        private _host: ISessionHost
        private _id: number;
        private _requests: SftpRequest[];
        private _ready: boolean;
    
        private _maxReadBlockLength: number;
        private _maxWriteBlockLength: number;
    
        private getRequest(type: number): SftpPacketWriter {
            var request = new SftpPacketWriter(this._maxWriteBlockLength + 1024); //TODO: cache buffers
    
            request.type = type;
            request.id = this._id;
    
            if (type == SftpPacketType.INIT) {
                if (this._id != null)
                    throw new Error("Already initialized");
                this._id = 1;
            } else {
                this._id = (this._id + 1) & 0xFFFFFFFF;
            }
    
            request.start();
            return request;
        }
    
        private writeStats(packet: SftpPacketWriter, attrs?: IStats): void {
            var pattrs = new SftpAttributes();
            pattrs.from(attrs);
            pattrs.write(packet);
        }
    
        constructor() {
            this._host = null;
            this._id = null;
            this._ready = false;
            this._requests = [];
    
            this._maxWriteBlockLength = 32 * 1024;
            this._maxReadBlockLength = 256 * 1024;
        }
    
        private execute(request: SftpPacketWriter, callback: Function, responseParser: (response: SftpPacketReader, callback: Function) => void): void {
    
            if (typeof callback !== 'function') {
                // use dummy callback to prevent having to check this later
                callback = function () { };
            }
    
            if (typeof this._requests[request.id] !== 'undefined')
                throw new Error("Duplicate request");
    
            var packet = request.finish();
            this._host.send(packet);
    
            this._requests[request.id] = { callback: callback, responseParser: responseParser };
    
        }
    
        _init(host: ISessionHost, callback: (err: Error) => any): void {
            this._host = host;
    
            var request = this.getRequest(SftpPacketType.INIT);
    
            request.writeInt32(3); // SFTPv3
    
            this.execute(request, callback,(response, cb) => {
    
                if (response.type != SftpPacketType.VERSION) {
                    callback(new Error("Protocol violation"));
                    return;
                }
    
                var version = response.readInt32();
                if (version != 3) {
                    callback(new Error("Protocol violation"));
                    return;
                }
    
                this._ready = true;
                callback(null);
            });
        }
    
        _process(packet: Uint8Array): void {
            var response = new SftpPacketReader(packet);
    
            var request = this._requests[response.id];
    
            if (typeof request === 'undefined')
                throw new Error("Unknown response ID");
    
            delete this._requests[response.id];
    
            request.responseParser.call(this, response, request.callback);
        }
    
        _end(): void {
        }
    
        end(): void {
            this._host.close();
        }
    
        open(path: string, flags: string, attrs?: IStats, callback?: (err: Error, handle: any) => any): void {
            path = this.toPath(path, 'path');
    
            if (typeof attrs === 'function' && typeof callback === 'undefined') {
                callback = <any>attrs;
                attrs = null;
            }
    
            var request = this.getRequest(SftpPacketType.OPEN);
    
            request.writeString(path);
            request.writeInt32(SftpFlags.toFlags(flags));
            this.writeStats(request, attrs);
    
            this.execute(request, callback, this.parseHandle);
        }
    
        close(handle: any, callback?: (err: Error) => any): void {
            handle = this.toHandle(handle);
    
            var request = this.getRequest(SftpPacketType.CLOSE);
    
            request.writeData(handle);
    
            this.execute(request, callback, this.parseStatus);
        }
    
        read(handle: any, buffer: Uint8Array, offset: number, length: number, position: number, callback?: (err: Error, bytesRead: number, buffer: Uint8Array) => any): void {
            handle = this.toHandle(handle);
            this.checkBuffer(buffer, offset, length);
            this.checkPosition(position);
    
            // make sure the length is within reasonable limits
            if (length > this._maxReadBlockLength)
                length = this._maxReadBlockLength;
    
            var request = this.getRequest(SftpPacketType.READ);
            
            request.writeData(handle);
            request.writeInt64(position);
            request.writeInt32(length);
    
            this.execute(request, callback, (response, cb) => this.parseData(response, <any>cb, buffer, offset, length));
        }
    
        write(handle: any, buffer: Uint8Array, offset: number, length: number, position: number, callback?: (err: Error) => any): void {
            handle = this.toHandle(handle);
            this.checkBuffer(buffer, offset, length);
            this.checkPosition(position);
    
            if (length > this._maxWriteBlockLength)
                throw new Error("Length exceeds maximum allowed data block length");
    
            var request = this.getRequest(SftpPacketType.WRITE);
            
            request.writeData(handle);
            request.writeInt64(position);
            request.writeData(buffer, offset, offset + length);
    
            this.execute(request, callback, this.parseStatus);
        }
    
        lstat(path: string, callback?: (err: Error, attrs: IStats) => any): void {
            path = this.toPath(path, 'path');
    
            this.command(SftpPacketType.LSTAT, [path], callback, this.parseAttribs);
        }
    
        fstat(handle: any, callback?: (err: Error, attrs: IStats) => any): void {
            handle = this.toHandle(handle);
    
            var request = this.getRequest(SftpPacketType.FSTAT);
    
            request.writeData(handle);
    
            this.execute(request, callback, this.parseAttribs);
        }
    
        setstat(path: string, attrs: IStats, callback?: (err: Error) => any): void {
            path = this.toPath(path, 'path');
    
            var request = this.getRequest(SftpPacketType.SETSTAT);
    
            request.writeString(path);
            this.writeStats(request, attrs);
    
            this.execute(request, callback, this.parseStatus);
        }
    
        fsetstat(handle: any, attrs: IStats, callback?: (err: Error) => any): void {
            handle = this.toHandle(handle);
    
            var request = this.getRequest(SftpPacketType.FSETSTAT);
    
            request.writeData(handle);
            this.writeStats(request, attrs);
    
            this.execute(request, callback, this.parseStatus);
        }
    
        opendir(path: string, callback?: (err: Error, handle: any) => any): void {
            path = this.toPath(path, 'path');
    
            this.command(SftpPacketType.OPENDIR, [path], callback, this.parseHandle);
        }
    
        readdir(handle: any, callback?: (err: Error, items: IItem[]|boolean) => any): void {
            handle = this.toHandle(handle);
    
            var request = this.getRequest(SftpPacketType.READDIR);
    
            request.writeData(handle);
    
            this.execute(request, callback, this.parseItems);
        }
    
        unlink(path: string, callback?: (err: Error) => any): void {
            path = this.toPath(path, 'path');
    
            this.command(SftpPacketType.REMOVE, [path], callback, this.parseStatus);
        }
    
        mkdir(path: string, attrs?: IStats, callback?: (err: Error) => any): void {
            path = this.toPath(path, 'path');
            if (typeof attrs === 'function' && typeof callback === 'undefined') {
                callback = <any>attrs;
                attrs = null;
            }
    
            var request = this.getRequest(SftpPacketType.MKDIR);
    
            request.writeString(path);
            this.writeStats(request, attrs);
    
            this.execute(request, callback, this.parseStatus);
        }
    
        rmdir(path: string, callback?: (err: Error) => any): void {
            path = this.toPath(path, 'path');
    
            this.command(SftpPacketType.RMDIR, [path], callback, this.parseStatus);
        }
    
        realpath(path: string, callback?: (err: Error, resolvedPath: string) => any): void {
            path = this.toPath(path, 'path');
    
            this.command(SftpPacketType.REALPATH, [path], callback, this.parsePath);
        }
    
        stat(path: string, callback?: (err: Error, attrs: IStats) => any): void {
            path = this.toPath(path, 'path');
    
            this.command(SftpPacketType.STAT, [path], callback, this.parseAttribs);
        }
    
        rename(oldPath: string, newPath: string, callback?: (err: Error) => any): void {
            oldPath = this.toPath(oldPath, 'oldPath');
            newPath = this.toPath(newPath, 'newPath');
    
            this.command(SftpPacketType.RENAME, [oldPath, newPath], callback, this.parseStatus);
        }
    
        readlink(path: string, callback?: (err: Error, linkString: string) => any): void {
            path = this.toPath(path, 'path');
    
            this.command(SftpPacketType.READLINK, [path], callback, this.parsePath);
        }
    
        symlink(targetPath: string, linkPath: string, callback?: (err: Error) => any): void {
            targetPath = this.toPath(targetPath, 'targetPath');
            linkPath = this.toPath(linkPath, 'linkPath');
    
            this.command(SftpPacketType.SYMLINK, [targetPath, linkPath], callback, this.parseStatus);
        }
    
        private toHandle(handle: { _handle: Uint8Array; _this: SftpClientCore }): Uint8Array {
            if (typeof handle === 'object') {
                if (SftpPacket.isBuffer(handle._handle) && handle._this == this)
                    return handle._handle;
            } else if (handle == null || typeof handle === 'undefined') {
                throw new Error("Missing handle");
            }
    
            throw new Error("Invalid handle");
        }
    
        private toPath(path: string, name: string): string {
            if (typeof path !== 'string') {
                if (path == null || typeof path === 'undefined')
                    throw new Error("Missing " + name);
    
                if (typeof path === 'function')
                    throw new Error("Invalid " + name);
    
                path = <string>new String(path);
            }
    
            if (path.length == 0)
                throw new Error("Empty " + name);
    
            return path;
        }
    
        private checkBuffer(buffer: Uint8Array, offset: number, length: number): void {
            if (!SftpPacket.isBuffer(buffer))
                throw new Error("Invalid buffer");
    
            if (typeof offset !== 'number' || offset < 0)
                throw new Error("Invalid offset");
    
            if (typeof length !== 'number' || length < 0)
                throw new Error("Invalid length");
    
            if ((offset + length) > buffer.length)
                throw new Error("Offset or length is out of bands");
        }
    
        private checkPosition(position: number): void {
            if (typeof position !== 'number' || position < 0 || position > 0x7FFFFFFFFFFFFFFF)
                throw new Error("Invalid position");
        }
    
        private command(command: number, args: string[], callback: Function, responseParser: (response: SftpPacketReader, callback: Function) => void): void {
            var request = this.getRequest(command);
    
            for (var i = 0; i < args.length; i++) {
                request.writeString(args[i]);
            }
    
            this.execute(request, callback, responseParser);
        }
    
        private readStatus(response: SftpPacketReader): Error {
            var code = response.readInt32();
            var message = response.readString();
            if (code == SftpStatusCode.OK)
                return null;
    
            var error = new Error("SFTP error " + code + ": " + message);
            error['code'] = code;
            error['description'] = message;
            return error;
        }
    
        private checkResponse(response: SftpPacketReader, expectedType: number, callback: Function): boolean {
            if (response.type == SftpPacketType.STATUS) {
                var error = this.readStatus(response);
                if (error != null) {
                    callback(error);
                    return false;
                }
            }
    
            if (response.type != expectedType)
                throw new Error("Unexpected packet received");
    
            return true;
        }
    
        private parseStatus(response: SftpPacketReader, callback?: (err: Error) => any): void {
            if (!this.checkResponse(response, SftpPacketType.STATUS, callback))
                return;
    
            callback(null);
        }
    
        private parseAttribs(response: SftpPacketReader, callback?: (err: Error, attrs: IStats) => any): void {
            if (!this.checkResponse(response, SftpPacketType.ATTRS, callback))
                return;
    
            var attrs = new SftpAttributes(response);
            delete attrs.flags;
    
            callback(null, attrs);
        }
    
        private parseHandle(response: SftpPacketReader, callback?: (err: Error, handle: any) => any): void {
            if (!this.checkResponse(response, SftpPacketType.HANDLE, callback))
                return;
    
            var handle = response.readData(true);
    
            callback(null, { _handle: handle, _this: this });
        }
    
        private parsePath(response: SftpPacketReader, callback?: (err: Error, path?: string) => any): void {
            if (!this.checkResponse(response, SftpPacketType.NAME, callback))
                return;
    
            var count = response.readInt32();
            if (count != 1)
                throw new Error("Invalid response");
    
            var path = response.readString();
    
            callback(null, path);
        }
    
        private parseData(response: SftpPacketReader, callback: (err: Error, bytesRead: number, buffer: Uint8Array) => any, buffer: Uint8Array, offset: number, length: number): void {
            if (!this.checkResponse(response, SftpPacketType.DATA, callback))
                return;
    
            var data = response.readData(false);
    
            if (data.length > length)
                throw new Error("Received too much data");
    
            length = data.length;
    
            buffer.set(data, offset);
            var view = buffer.subarray(offset, offset + length); 
    
            callback(null, length, view); //TODO: make sure that this corresponds to the behavior of fs.read
        }
    
        private parseItems(response: SftpPacketReader, callback?: (err: Error, items: IItem[]|boolean) => any): void {
    
            if (response.type == SftpPacketType.STATUS) {
                var error = this.readStatus(response);
                if (error != null) {
                    if (error['code'] == SftpStatusCode.EOF)
                        callback(null, false);
                    else
                        callback(error, null);
                    return;
                }
            }
    
            if (response.type != SftpPacketType.NAME)
                throw new Error("Unexpected packet received");
    
            var count = response.readInt32();
    
            var items: SftpItem[] = [];
            for (var i = 0; i < count; i++) {
                items[i] = new SftpItem(response);
            }
    
            callback(null, items);
        }
    }
    
    class SftpClient extends FilesystemPlus {
    
        constructor(ws: any, log?: ILogWriter) {
    
            var sftp = new SftpClientCore();
            var channel = new Channel(sftp, ws);
            channel.log = toLogWriter(log);
    
            super(sftp);
    
            ws.onopen = () => {
    
                channel.start();
    
                sftp._init(channel, err => {
                    if (err != null) {
                        this.emit('error', err);
                    } else {
                        this.emit('ready');
                    }
                });
            };
        }
    
        end(): void {
            (<SftpClientCore>this._fs).end();
        }
    }
    
    
    
    interface IClientOptions {
        protocol?: string;
        log?: ILogWriter;
    }
    
    export class Client extends SftpClient {
    
        constructor(address: string, options?: IClientOptions) {
            var protocols = [];
            if (typeof options !== 'object' || typeof options.protocol == 'undefined') {
                protocols.push('sftp');
            } else {
                protocols.push(options.protocol);
            }
    
            var ws = new WebSocket(address, protocols);
            ws.binaryType = "arraybuffer";
    
            super(ws, options.log);
        }
    }
    
}
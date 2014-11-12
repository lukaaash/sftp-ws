/// <reference path="Stats.d.ts" />
import events = require("events");
import Stats = require("Stats");

declare class SFTP extends events.EventEmitter {

    // transport layer interface
    constructor(stream: WritableStream, server_ident_raw: string);
    _init(): void;
    _parse(chunk: NodeBuffer): void;
    end(): void;

    // core methods
    open(path: string, flags: string, attrs?: Stats, callback?: (err: Error, handle: any) => any): void;
    close(handle: any, callback?: (err: Error) => any): void;
    read(handle: any, buffer: NodeBuffer, offset: number, length: number, position: number, callback?: (err: Error, bytesRead: number, buffer: NodeBuffer) => any): void;
    write(handle: any, buffer: NodeBuffer, offset: number, length: number, position: number, callback?: (err: Error) => any): void;
    lstat(path: string, callback?: (err: Error, attrs: Stats) => any): void;
    fstat(handle: any, callback?: (err: Error, attrs: Stats) => any): void;
    setstat(path: string, attrs: Stats, callback?: (err: Error) => any): void;
    fsetstat(handle: any, attrs: Stats, callback?: (err: Error) => any): void;
    opendir(path: string, callback?: (err: Error, handle: any) => any): void;
    readdir(handle: any, callback?: (err: Error, items: { filename: string; longname: string; stats?: Stats; }[]) => any): void;
    unlink(path: string, callback?: (err: Error) => any): void;
    mkdir(path: string, attrs?: Stats, callback?: (err: Error) => any): void;
    rmdir(path: string, callback?: (err: Error) => any): void;
    realpath(path: string, callback?: (err: Error, resolvedPath: string) => any): void;
    stat(path: string, callback?: (err: Error, attrs: Stats) => any): void;
    rename(oldPath: string, newPath: string, callback?: (err: Error) => any): void;
    readlink(path: string, callback?: (err: Error, linkString: string) => any): void;
    symlink(targetpath: string, linkpath: string, callback?: (err: Error) => any): void;

    // wrapper methods
    open(path: string, flags: string, cb: Function);
    futimes(handle: NodeBuffer, atime, mtime, cb: Function);
    utimes(path: string, atime, mtime, cb: Function);
    fchown(handle: NodeBuffer, uid, gid, cb: Function);
    chown(path: string, uid, gid, cb: Function);
    fchmod(handle: NodeBuffer, mode, cb: Function);
    chmod(path: string, mode, cb: Function);
    readdir(path: string, cb: Function);
    fastGet(remotepath: string, localpath: string, opts, cb: Function);
    fastPut(localpath: string, remotepath: string, opts, cb: Function);
    readFile(path: string, cb: Function);
    readFile(path: string, options: any, cb: Function);
    writeFile(path: string, data, options: any, cb: Function);
    appendFile(path: string, data, options: any, cb: Function);
    exists(path: string, cb: Function);
    createReadStream(path: string, options?: any): ReadableStream;
    createWriteStream(path: string, options?: any): WritableStream;
}

export = SFTP;
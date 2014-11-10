import events = require("events");

declare class SFTP extends events.EventEmitter {

    // transport layer interface
    constructor(stream: WritableStream, server_ident_raw: string);
    _init(): void;
    _parse(chunk: NodeBuffer): void;
    end(): void;

    // core methods
    open(path: string, flags: string, attrs, cb: Function);
    close(handle: NodeBuffer, cb: Function);
    read(handle: NodeBuffer, buffer, offset, length, position, cb: Function);
    write(handle: NodeBuffer, buffer, offset, length, position, cb: Function);
    unlink(filename, cb: Function);
    rename(oldpath: string, newpath: string, cb: Function);
    mkdir(path: string, attrs, cb: Function);
    rmdir(path: string, cb: Function);
    readdir(handle: NodeBuffer, cb: Function);
    fstat(handle: NodeBuffer, cb: Function);
    stat(path: string, cb: Function);
    lstat(path: string, cb: Function);
    opendir(path: string, cb: Function);
    setstat(path: string, attrs, cb: Function);
    fsetstat(handle: NodeBuffer, attrs, cb: Function);
    readlink(path: string, cb: Function);
    symlink(targetpath: string, linkpath: string, cb: Function);
    realpath(path: string, cb: Function);

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

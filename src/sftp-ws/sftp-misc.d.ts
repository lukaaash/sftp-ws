/// <reference path="sftp-packet.d.ts" />
import fs = require("fs");
import packet = require("./sftp-packet");
export declare class SftpFlags {
    static READ: number;
    static WRITE: number;
    static APPEND: number;
    static CREAT: number;
    static TRUNC: number;
    static EXCL: number;
    static getModes(flags: number): string[];
}
export declare class SftpStatus {
    static OK: number;
    static EOF: number;
    static NO_SUCH_FILE: number;
    static PERMISSION_DENIED: number;
    static FAILURE: number;
    static BAD_MESSAGE: number;
    static NO_CONNECTION: number;
    static CONNECTION_LOST: number;
    static OP_UNSUPPORTED: number;
    static write(packet: packet.SftpPacket, requestId: number, code: number, message: string): void;
    static writeSuccess(packet: packet.SftpPacket, requestId: number): void;
    static writeError(packet: packet.SftpPacket, requestId: number, err: ErrnoException): void;
}
export declare class SftpOptions {
    public encoding: string;
    public handle: NodeBuffer;
    public flags: string;
    public mode: number;
    public start: number;
    public end: number;
    public autoClose: boolean;
}
export declare class SftpItem {
    public filename: string;
    public longname: string;
    public attrs: SftpAttributes;
    constructor(filename: string, attrs?: SftpAttributes);
    public write(buffer: packet.SftpPacket): void;
}
export declare class SftpAttributes {
    static SIZE: number;
    static UIDGID: number;
    static PERMISSIONS: number;
    static ACMODTIME: number;
    static BASIC: number;
    static EXTENDED: number;
    public flags: number;
    public size: number;
    public uid: number;
    public gid: number;
    public mode: number;
    public atime: number;
    public mtime: number;
    private nlink;
    private modified;
    constructor(packet?: packet.SftpPacket);
    public write(buffer: packet.SftpPacket): void;
    public from(stats: fs.Stats): void;
    public toString(): string;
}
export declare class SftpHandle {
    private _path;
    private _fd;
    public files: string[];
    public path(): string;
    public fd(): number;
    public invalid(): boolean;
    constructor(path: string, fd: number);
    static BAD: SftpHandle;
}

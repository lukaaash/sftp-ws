import api = require("./fs-api");
import events = require("events"); //WEB: /// <reference path="misc-web.ts" />

import IFilesystem = api.IFilesystem;
import IItem = api.IItem;
import IStats = api.IStats;
import EventEmitter = events.EventEmitter;

export interface IFilesystemExt extends FilesystemPlus {
}

export class FilesystemPlus extends EventEmitter implements IFilesystem {

    protected _fs: IFilesystem;

    constructor(fs: IFilesystem) {
        super();
        this._fs = fs;
    }

    open(path: string, flags: string, attrs?: IStats, callback?: (err: Error, handle: any) => any): void {
        this._fs.open(path, flags, attrs, callback);
    }

    close(handle: any, callback?: (err: Error) => any): void {
        this._fs.close(handle, callback);
    }

    read(handle: any, buffer: NodeBuffer, offset: number, length: number, position: number, callback?: (err: Error, bytesRead: number, buffer: NodeBuffer) => any): void {
        this._fs.read(handle, buffer, offset, length, position, callback);
    }

    write(handle: any, buffer: NodeBuffer, offset: number, length: number, position: number, callback?: (err: Error) => any): void {
        this._fs.write(handle, buffer, offset, length, position, callback);
    }

    lstat(path: string, callback?: (err: Error, attrs: IStats) => any): void {
        this._fs.lstat(path, callback);
    }

    fstat(handle: any, callback?: (err: Error, attrs: IStats) => any): void {
        this._fs.fstat(handle, callback);
    }

    setstat(path: string, attrs: IStats, callback?: (err: Error) => any): void {
        this._fs.setstat(path, attrs, callback);
    }

    fsetstat(handle: any, attrs: IStats, callback?: (err: Error) => any): void {
        this._fs.fsetstat(handle, attrs, callback);
    }

    opendir(path: string, callback?: (err: Error, handle: any) => any): void {
        this._fs.opendir(path, callback);
    }

    readdir(path: string, callback?: (err: Error, items: IItem[]|boolean) => any)
    readdir(handle: any, callback?: (err: Error, items: IItem[]) => any): void {
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
        this._fs.unlink(path, callback);
    }

    mkdir(path: string, attrs?: IStats, callback?: (err: Error) => any): void {
        this._fs.mkdir(path, attrs, callback);
    }

    rmdir(path: string, callback?: (err: Error) => any): void {
        this._fs.rmdir(path, callback);
    }

    realpath(path: string, callback?: (err: Error, resolvedPath: string) => any): void {
        this._fs.realpath(path, callback);
    }

    stat(path: string, callback?: (err: Error, attrs: IStats) => any): void {
        this._fs.stat(path, callback);
    }

    rename(oldPath: string, newPath: string, callback?: (err: Error) => any): void {
        this._fs.rename(oldPath, newPath, callback);
    }

    readlink(path: string, callback?: (err: Error, linkString: string) => any): void {
        this._fs.readlink(path, callback);
    }

    symlink(targetpath: string, linkpath: string, callback?: (err: Error) => any): void {
        this._fs.symlink(targetpath, linkpath);
    }


}
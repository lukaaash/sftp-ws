import api = require("./fs-api");

import IFilesystem = api.IFilesystem;
import IStats = api.IStats;
import IItem = api.IItem;

export function isDirectory(stats: IStats): boolean {
    return stats ? (stats.mode & 0xE000) == 0x4000 : false; // directory
}

export function isFile(stats: IStats): boolean {
    return stats ? (stats.mode & 0xE000) == 0x8000 : false; // regular file
}

export function readdir(fs: IFilesystem, path: string, callback?: (err: Error, items: IItem[]) => any): void {
    var list: IItem[] = [];
    var handle;

    function next(err, items: IItem[]|boolean): void {

        if (err != null) {
            fs.close(handle);
            callback(err, list);
            return;
        }

        if (items === false) {
            fs.close(handle, err => {
                callback(err, list);
            });
            return;
        }

        list = list.concat(<IItem[]>items);
        fs.readdir(handle, next);
    };

    fs.opendir(path,(err, h) => {
        if (err != null) {
            callback(err, null);
            return;
        }

        handle = h;
        next(null, []);
    });
}
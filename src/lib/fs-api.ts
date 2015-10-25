
export const enum FileType {
    FIFO = 0x1000,
    CHARACTER_DEVICE = 0x2000,
    DIRECTORY = 0x4000,
    BLOCK_DEVICE = 0x6000,
    REGULAR_FILE = 0x8000,
    SYMLINK = 0xA000,
    SOCKET = 0XC000,

    ALL = 0xF000,
}

export interface IStats {
    mode?: number;
    uid?: number;
    gid?: number;
    size?: number;
    atime?: Date;
    mtime?: Date;

    isFile?(): boolean;
    isDirectory?(): boolean;
    isSymbolicLink?(): boolean;
}

export interface IItem {
    filename: string;
    stats: IStats;

    longname?: string;
    path?: string;
}

export interface IFilesystem {
    open(path: string, flags: string, attrs?: IStats, callback?: (err: Error, handle: any) => any): void;
    close(handle: any, callback?: (err: Error) => any): void;
    read(handle: any, buffer: Buffer, offset: number, length: number, position: number, callback?: (err: Error, buffer: Buffer, bytesRead: number) => any): void;
    write(handle: any, buffer: Buffer, offset: number, length: number, position: number, callback?: (err: Error) => any): void;
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
    symlink(oldPath: string, newPath: string, callback?: (err: Error) => any): void;
    link(oldPath: string, newPath: string, callback?: (err: Error) => any): void;
}

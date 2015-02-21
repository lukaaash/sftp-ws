
export interface IStats {
    mode?: number;
    uid?: number;
    gid?: number;
    size?: number;
    atime?: Date;
    mtime?: Date;
}

export interface IStatsExt extends IStats {
    nlink?: number;
}

export interface IItem {
    filename: string;
    stats?: IStats;
}

export interface IFilesystem {
    open(path: string, flags: string, attrs?: IStats, callback?: (err: Error, handle: any) => any): void;
    close(handle: any, callback?: (err: Error) => any): void;
    read(handle: any, buffer: NodeBuffer, offset: number, length: number, position: number, callback?: (err: Error, bytesRead: number, buffer: NodeBuffer) => any): void;
    write(handle: any, buffer: NodeBuffer, offset: number, length: number, position: number, callback?: (err: Error) => any): void;
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

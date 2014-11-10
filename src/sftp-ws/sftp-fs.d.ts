export interface IAttributes {
    mode?: number;
    uid?: number;
    gid?: number;
    size?: number;
    atime?: number;
    mtime?: number;
    isDirectory(): boolean;
    isFile(): boolean;
    isBlockDevice(): boolean;
    isCharacterDevice(): boolean;
    isSymbolicLink(): boolean;
    isFIFO(): boolean;
    isSocket(): boolean;
}
export interface IName {
    filename: string;
    longname: string;
    attrs?: IAttributes;
}
export interface IFilesystem {
    open(path: string, flags: string, attrs: IAttributes, callback?: (err: Error, handle: NodeBuffer) => any): void;
    close(handle: NodeBuffer, callback?: (err: Error) => any): void;
    read(handle: NodeBuffer, buffer: any, offset: any, length: any, position: any, callback?: (err: Error, bytesRead: number, buffer: NodeBuffer) => any): void;
    write(handle: NodeBuffer, buffer: any, offset: any, length: any, position: any, callback?: (err: Error) => any): void;
    lstat(path: string, callback?: (err: Error, attrs: IAttributes) => any): void;
    fstat(handle: NodeBuffer, callback?: (err: Error, attrs: IAttributes) => any): void;
    setstat(path: string, attrs: any, callback?: (err: Error) => any): void;
    fsetstat(handle: NodeBuffer, attrs: any, callback?: (err: Error) => any): void;
    opendir(path: string, callback?: (err: Error, handle: NodeBuffer) => any): void;
    readdir(handle: NodeBuffer, callback?: (err: Error, items: IName[]) => any): void;
    unlink(filename: any, callback?: (err: Error) => any): void;
    mkdir(path: string, attrs: any, callback?: (err: Error) => any): void;
    rmdir(path: string, callback?: (err: Error) => any): void;
    realpath(path: string, callback?: (err: Error, resolvedPath: string) => any): void;
    stat(path: string, callback?: (err: Error, attrs: IAttributes) => any): void;
    rename(oldpath: string, newpath: string, callback?: (err: Error) => any): void;
    readlink(path: string, callback?: (err: Error, resolvedPath: string) => any): void;
    symlink(targetpath: string, linkpath: string, callback?: (err: Error) => any): void;
}

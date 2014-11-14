interface IStats {
    mode?: number;
    permissions?: number; // backwards compatiblity
    uid?: number;
    gid?: number;
    size?: number;
    atime?: Date;
    mtime?: Date;
}

export = IStats;

export class SftpPacketType {

    // initialization
    static INIT = 1;
    static VERSION = 2;

    // requests
    static REQUEST_MIN = 3;
    static OPEN = 3;
    static CLOSE = 4;
    static READ = 5;
    static WRITE = 6;
    static LSTAT = 7;
    static FSTAT = 8;
    static SETSTAT = 9;
    static FSETSTAT = 10;
    static OPENDIR = 11;
    static READDIR = 12;
    static REMOVE = 13;
    static MKDIR = 14;
    static RMDIR = 15;
    static REALPATH = 16;
    static STAT = 17;
    static RENAME = 18;
    static READLINK = 19;
    static SYMLINK = 20;
    static REQUEST_MAX = 20;

    // replies
    static RESPONSE_MIN = 101;
    static STATUS = 101;
    static HANDLE = 102;
    static DATA = 103;
    static NAME = 104;
    static ATTRS = 105;
    static RESPONSE_MAX = 105;
}

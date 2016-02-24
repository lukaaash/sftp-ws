export const enum SftpPacketType {

    // initialization
    INIT = 1,
    VERSION = 2,

    // requests
    OPEN = 3,
    CLOSE = 4,
    READ = 5,
    WRITE = 6,
    LSTAT = 7,
    FSTAT = 8,
    SETSTAT = 9,
    FSETSTAT = 10,
    OPENDIR = 11,
    READDIR = 12,
    REMOVE = 13,
    MKDIR = 14,
    RMDIR = 15,
    REALPATH = 16,
    STAT = 17,
    RENAME = 18,
    READLINK = 19,
    SYMLINK = 20,
    EXTENDED = 200,

    // responses
    STATUS = 101,
    HANDLE = 102,
    DATA = 103,
    NAME = 104,
    ATTRS = 105,
    EXTENDED_REPLY = 201,
}

export const enum SftpStatusCode {
    OK = 0,
    EOF = 1,
    NO_SUCH_FILE = 2,
    PERMISSION_DENIED = 3,
    FAILURE = 4,
    BAD_MESSAGE = 5,
    NO_CONNECTION = 6,
    CONNECTION_LOST = 7,
    OP_UNSUPPORTED = 8,
}

export const enum SftpOpenFlags {
    READ = 0x0001,
    WRITE = 0x0002,
    APPEND = 0x0004,
    CREATE = 0x0008,
    TRUNC = 0x0010,
    EXCL = 0x0020,

    ALL = 0x003F,
}

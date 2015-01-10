
export class SftpPacket {

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
    static STATUS = 101;
    static HANDLE = 102;
    static DATA = 103;
    static NAME = 104;
    static ATTRS = 105;

    id: number;
    buffer: NodeBuffer;
    offset: number;
    length: number;

    constructor(buffer: NodeBuffer) {
        this.buffer = buffer;
        this.offset = 0;
        this.length = buffer.length;
    }

    reset(): void {
        this.offset = 0;
        this.writeInt32(0);
    }

    seek(offset: number): void {
        this.offset = offset;
    }

    ignore(count: number): number {
        this.checkSize(count);
        var offset = this.offset;
        this.offset += count;
        return offset;
    }

    writeByte(value: number): void {
        this.checkSize(1);
        this.buffer.writeInt8(value, this.offset, true);
        this.offset += 1;
    }

    writeInt32(value: number): void {
        this.checkSize(4);
        this.buffer.writeInt32BE(value, this.offset, true);
        this.offset += 4;
    }

    writeInt64(value: number): void {

        var hi = (value / 0x100000000) | 0;
        var lo = (value & 0xFFFFFFFF) | 0;

        this.writeInt32(hi);
        this.writeInt32(lo);
    }

    writeString(value: string): void {
        var offset = this.offset;
        this.writeInt32(0); // will get overwritten later
        var charLength = value.length;
        this.checkSize(value.length); // does not ensure there is enough space (because of UTF-8)

        (<any>this.buffer)._charsWritten = 0;
        var bytesWritten = this.buffer.write(value, this.offset, undefined, 'utf-8');
        this.offset += bytesWritten;
        if ((<any>Buffer)._charsWritten != charLength)
            throw new Error("Not enough space in the buffer");

        // write number of bytes
        this.buffer.writeInt32BE(bytesWritten, offset, true);
    }

    private checkSize(size: number): void {
        var remaining = this.length - this.offset;
        if (size > remaining)
            throw new Error("Premature end of packet encountered");
    }

    readByte(): number {
        this.checkSize(1);
        var value = this.buffer.readUInt8(this.offset, true);
        this.offset += 1;

        return value;
    }

    readInt32(): number {
        this.checkSize(4);
        var value = this.buffer.readInt32BE(this.offset, true);
        this.offset += 4;
        return value;
    }

    readUint32(): number {
        this.checkSize(4);
        var value = this.buffer.readUInt32BE(this.offset, true);
        this.offset += 4;
        return value;
    }

    readInt64(): number {
        var hi = this.readInt32();
        var lo = this.readUint32();

        var value = hi * 0x100000000 + lo;
        return value;
    }

    readString(): string {
        var length = this.readInt32();
        this.checkSize(length);

        var end = this.offset + length;
        var value = this.buffer.toString('utf8', this.offset, end);
        this.offset = end;

        return value;
    }

    skipString(): void {
        var length = this.readInt32();
        this.checkSize(length);

        var end = this.offset + length;
        this.offset = end;
    }

    writeHandle(h: number): void {
        this.writeInt32(4);
        this.writeInt32(h);
    }

    readHandle(): number {
        var length = this.readInt32();
        var value;
        if (length == 4) {
            value = this.readInt32();
        } else {
            this.checkSize(length);
            this.offset += length;
            value = -1;
        }

        return value;
    }

    isEmpty(): boolean {
        return this.offset >= this.length;
    }
}

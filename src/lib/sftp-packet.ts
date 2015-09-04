import enums = require("./sftp-enums");
import charsets = require("./charsets");

import SftpPacketType = enums.SftpPacketType;
import encodeUTF8 = charsets.encodeUTF8;

export class SftpPacket {
    type: SftpPacketType|string;
    id: number;

    buffer: Buffer;
    position: number;
    length: number;

    constructor() {
    }

    check(count: number): void {
        var remaining = this.length - this.position;
        if (count > remaining)
            throw new Error("Unexpected end of packet");
    }

    skip(count: number): void {
        this.check(count);
        this.position += count;
    }

    static isBuffer(obj: any): boolean {
        return Buffer.isBuffer(obj); //WEB: return obj && obj.buffer instanceof ArrayBuffer && typeof obj.byteLength !== "undefined";
    }

    static toString(packetType: SftpPacketType|string): string {
        switch (packetType) {
            case SftpPacketType.INIT: return "INIT";
            case SftpPacketType.VERSION: return "VERSION";
            case SftpPacketType.OPEN: return "OPEN";
            case SftpPacketType.CLOSE: return "CLOSE";
            case SftpPacketType.READ: return "READ";
            case SftpPacketType.WRITE: return "WRITE";
            case SftpPacketType.LSTAT: return "LSTAT";
            case SftpPacketType.FSTAT: return "FSTAT";
            case SftpPacketType.SETSTAT: return "SETSTAT";
            case SftpPacketType.FSETSTAT: return "FSETSTAT";
            case SftpPacketType.OPENDIR: return "OPENDIR";
            case SftpPacketType.READDIR: return "READDIR";
            case SftpPacketType.REMOVE: return "REMOVE";
            case SftpPacketType.MKDIR: return "MKDIR";
            case SftpPacketType.RMDIR: return "RMDIR";
            case SftpPacketType.REALPATH: return "REALPATH";
            case SftpPacketType.STAT: return "STAT";
            case SftpPacketType.RENAME: return "RENAME";
            case SftpPacketType.READLINK: return "READLINK";
            case SftpPacketType.SYMLINK: return "SYMLINK";
            case SftpPacketType.EXTENDED: return "EXTENDED";
            case SftpPacketType.STATUS: return "STATUS";
            case SftpPacketType.HANDLE: return "HANDLE";
            case SftpPacketType.DATA: return "DATA";
            case SftpPacketType.NAME: return "NAME";
            case SftpPacketType.ATTRS: return "ATTRS";
            case SftpPacketType.EXTENDED_REPLY: return "EXTENDED_REPLY";
            default: return "" + packetType;
        }
    }
}

export class SftpPacketReader extends SftpPacket {

    constructor(buffer: Buffer) {
        super();

        this.buffer = buffer;
        this.position = 0;
        this.length = buffer.length;

        var length = this.readInt32() + 4;
        if (length != this.length)
            throw new Error("Invalid packet received");

        this.type = this.readByte();
        if (this.type == SftpPacketType.INIT || this.type == SftpPacketType.VERSION) {
            this.id = null;
        } else {
            this.id = this.readInt32();

            if (this.type == SftpPacketType.EXTENDED) {
                this.type = this.readString();
            }
        }
    }

    readByte(): number {
        this.check(1);
        var value = this.buffer.readUInt8(this.position++, true); //WEB: var value = this.buffer[this.position++] & 0xFF;
        return value;
    }

    readInt32(): number {
        this.check(4); //WEB: var value = this.readUint32();
        var value = this.buffer.readInt32BE(this.position, true); //WEB: if (value & 0x80000000) value -= 0x100000000;
        this.position += 4; //WEB: // removed
        return value;
    }

    readUint32(): number {
        this.check(4);
        var value = this.buffer.readUInt32BE(this.position, true); //WEB: // removed
        this.position += 4; //WEB: var value = 0;
        //WEB: value |= (this.buffer[this.position++] & 0xFF) << 24;
        //WEB: value |= (this.buffer[this.position++] & 0xFF) << 16;
        //WEB: value |= (this.buffer[this.position++] & 0xFF) << 8;
        //WEB: value |= (this.buffer[this.position++] & 0xFF);
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
        this.check(length);
        var end = this.position + length;
        var value = this.buffer.toString('utf8', this.position, end); //WEB: var value = decodeUTF8(this.buffer, this.position, end);
        this.position = end;
        return value;
    }

    skipString(): void {
        var length = this.readInt32();
        this.check(length);

        var end = this.position + length;
        this.position = end;
    }

    readData(clone: boolean): Buffer {
        var length = this.readInt32();
        this.check(length);

        var start = this.position;
        var end = start + length;
        this.position = end;
        //WEB: var view = this.buffer.subarray(start, end);
        if (clone) {
            var buffer = new Buffer(length); //WEB: var buffer = new Uint8Array(length);
            this.buffer.copy(buffer, 0, start, end); //WEB: buffer.set(view, 0);
            return buffer;
        } else {
            return this.buffer.slice(start, end); //WEB: return view;
        }
    }

}

export class SftpPacketWriter extends SftpPacket {

    constructor(length: number) {
        super();

        this.buffer = new Buffer(length);
        this.position = 0;
        this.length = length;
    }

    start(): void {
        this.position = 0;
        this.writeInt32(0); // length placeholder

        if (typeof this.type === "number") {
            this.writeByte(<number>this.type);
        } else {
            this.writeByte(<number>SftpPacketType.EXTENDED);
        }

        if (this.type == SftpPacketType.INIT || this.type == SftpPacketType.VERSION) {
            // these packets don't have an id
        } else {
            this.writeInt32(this.id | 0);

            if (typeof this.type !== "number") {
                this.writeString(<string>this.type);
            }
        }
    }

    finish(): Buffer {
        var length = this.position;
        this.position = 0;
        this.buffer.writeInt32BE(length - 4, 0, true); //WEB: this.writeInt32(length - 4);
        return this.buffer.slice(0, length); //WEB: return this.buffer.subarray(0, length);
    }

    writeByte(value: number): void {
        this.check(1);
        this.buffer.writeInt8(value, this.position++, true); //WEB: this.buffer[this.position++] = value & 0xFF;
    }

    writeInt32(value: number): void {
        this.check(4);
        this.buffer.writeInt32BE(value, this.position, true); //WEB: // removed
        this.position += 4; //WEB: // removed
        //WEB: this.buffer[this.position++] = (value >> 24) & 0xFF;
        //WEB: this.buffer[this.position++] = (value >> 16) & 0xFF;
        //WEB: this.buffer[this.position++] = (value >> 8) & 0xFF;
        //WEB: this.buffer[this.position++] = value & 0xFF;
    }

    writeInt64(value: number): void {
        var hi = (value / 0x100000000) | 0;
        var lo = (value & 0xFFFFFFFF) | 0;
        this.writeInt32(hi);
        this.writeInt32(lo);
    }

    writeString(value: string): void {
        if (typeof value !== "string") value = "" + value;
        var offset = this.position;
        this.writeInt32(0); // will get overwritten later

        var bytesWritten = encodeUTF8(value, this.buffer, this.position);
        if (bytesWritten < 0)
            throw new Error("Not enough space in the buffer");

        // write number of bytes and seek back to the end
        this.position = offset;
        this.writeInt32(bytesWritten);
        this.position += bytesWritten;
    }

    writeData(data: Buffer, start?: number, end?: number): void {
        if (typeof start !== 'undefined')
            data = data.slice(start, end); //WEB: data = data.subarray(start, end);

        var length = data.length;
        this.writeInt32(length);

        this.check(length);
        data.copy(this.buffer, this.position, 0, length); //WEB: this.buffer.set(data, this.position);
        this.position += length;
    }

}

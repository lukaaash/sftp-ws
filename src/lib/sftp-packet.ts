import common = require("./sftp-common");

import SftpPacketType = common.SftpPacketType;

export class SftpPacket {
    type: number;
    id: number;

    buffer: NodeBuffer;
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
        this.check(length);
        this.position += count;
    }

    static isBuffer(obj: any): boolean {
        return Buffer.isBuffer(obj);
    }
}

export class SftpPacketReader extends SftpPacket {

    constructor(buffer: NodeBuffer) {
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
        }
    }

    readByte(): number {
        this.check(1);
        var value = this.buffer.readUInt8(this.position, true);
        this.position += 1;

        return value;
    }

    readInt32(): number {
        this.check(4);
        var value = this.buffer.readInt32BE(this.position, true);
        this.position += 4;
        return value;
    }

    readUint32(): number {
        this.check(4);
        var value = this.buffer.readUInt32BE(this.position, true);
        this.position += 4;
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
        var value = this.buffer.toString('utf8', this.position, end);
        this.position = end;

        return value;
    }

    skipString(): void {
        var length = this.readInt32();
        this.check(length);

        var end = this.position + length;
        this.position = end;
    }

    readData(clone: boolean): NodeBuffer {
        var length = this.readInt32();
        this.check(length);

        var start = this.position;
        var end = start + length;
        this.position = end;
        if (clone) {
            var buffer = new Buffer(length);
            this.buffer.copy(buffer, 0, start, end);
            return buffer;
        } else {
            return this.buffer.slice(start, end);
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
        this.writeByte(this.type | 0);

        if (this.type == SftpPacketType.INIT || this.type == SftpPacketType.VERSION) {
            // these packets don't have an id
        } else {
            this.writeInt32(this.id | 0);
        }
    }

    finish(): NodeBuffer {
        var length = this.position;
        this.buffer.writeInt32BE(length - 4, 0, true);
        return this.buffer.slice(0, length);
    }

    writeByte(value: number): void {
        this.check(1);
        this.buffer.writeInt8(value, this.position, true);
        this.position += 1;
    }

    writeInt32(value: number): void {
        this.check(4);
        this.buffer.writeInt32BE(value, this.position, true);
        this.position += 4;
    }

    writeInt64(value: number): void {

        var hi = (value / 0x100000000) | 0;
        var lo = (value & 0xFFFFFFFF) | 0;

        this.writeInt32(hi);
        this.writeInt32(lo);
    }

    writeString(value: string): void {
        var offset = this.position;
        this.writeInt32(0); // will get overwritten later
        var charLength = value.length;
        this.check(value.length); // does not ensure there is enough space (because of UTF-8)

        (<any>this.buffer)._charsWritten = 0;
        var bytesWritten = this.buffer.write(value, this.position, undefined, 'utf-8');
        this.position += bytesWritten;
        if ((<any>Buffer)._charsWritten != charLength)
            throw new Error("Not enough space in the buffer");

        // write number of bytes
        this.buffer.writeInt32BE(bytesWritten, offset, true);
    }

    writeData(data: NodeBuffer, start?: number, end?: number): void {
        if (typeof start !== 'undefined')
            data = data.slice(start, end);

        var length = data.length;
        this.writeInt32(length);
        this.check(length);

        data.copy(this.buffer, this.position, 0, length);
        this.position += length;
    }
}

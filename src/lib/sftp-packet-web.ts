import enums = require("./sftp-enums");

import SftpPacketType = enums.SftpPacketType;

interface ErrnoException extends Error {
    errno?: number;
}

interface WritableStream {
    write(buffer: Uint8Array, cb?: Function): boolean;
}

class EventEmitter {
    constructor() {
    }
}

class SftpPacket {
    type: SftpPacketType;
    id: number;

    buffer: Uint8Array;
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
        return obj && obj.buffer instanceof ArrayBuffer && obj.byteLength !== undefined
    }
}

class SftpPacketReader extends SftpPacket {

    constructor(buffer: Uint8Array) {
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
        var value = this.buffer[this.position++];
        return value;
    }

    readInt32(): number {

        var value = this.readUint32();

        if (value & 0x80000000)
            value -= 0x100000000;

        return value;
    }

    readUint32(): number {
        this.check(4);

        var value = 0;
        value |= this.buffer[this.position++] << 24;
        value |= this.buffer[this.position++] << 16;
        value |= this.buffer[this.position++] << 8;
        value |= this.buffer[this.position++];

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

        var value = "";

        var p = this.position;
        var end = p + length;
        while (p < length) {
            var code = this.buffer[p++];
            if (code >= 128) {
                var len: number;
                switch (code & 0xE0) {
                    case 0xE0:
                        if (code & 0x10) {
                            code &= 0x07;
                            len = 3;
                        } else {
                            code &= 0xF;
                            len = 2;
                        }
                        break;
                    case 0xC0:
                        code &= 0x1F;
                        len = 1;
                        break;
                    default:
                        code = 0xFFFD; // replacement character
                        len = 0;
                        break;
                }

                if ((p + len) > this.length) {
                    code = 0xFFFD;
                    p = this.length;
                } else {
                    while (len > 0) {
                        var n = this.buffer[p++];
                        if ((n & 0xC0) != 0x80) {
                            code = 0xFFFD;
                            break;
                        }
                        code = (code << 6) | (n & 0x3F);
                    }
                }
            }

            value += String.fromCharCode(code);
        }

        return value;
    }

    skipString(): void {
        var length = this.readInt32();
        this.check(length);

        var end = this.position + length;
        this.position = end;
    }

    readDadta(clone: boolean): Uint8Array {
        var length = this.readInt32();
        this.check(length);

        var start = this.position;
        var end = start + length;
        this.position = end;
        return this.buffer.subarray(start, end);
    }

    readData(clone: boolean): Uint8Array {
        var length = this.readInt32();
        this.check(length);

        var start = this.position;
        var end = start + length;
        this.position = end;
        var view = this.buffer.subarray(start, end);
        if (clone) {
            var buffer = new Uint8Array(length);
            buffer.set(view, 0);
            return buffer;
        } else {
            return view;
        }
    }

}

class SftpPacketWriter extends SftpPacket {

    constructor(length: number) {
        super();

        this.buffer = new Uint8Array(length);
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

    finish(): Uint8Array {
        var length = this.position;
        this.position = 0;
        this.writeInt32(length - 4);
        return this.buffer.subarray(0, length);
    }

    writeByte(value: number): void {
        this.check(1);
        this.buffer[this.position++] = value & 0xFF;
    }

    writeInt32(value: number): void {
        this.check(4);
        this.buffer[this.position++] = (value >> 24) & 0xFF;
        this.buffer[this.position++] = (value >> 16) & 0xFF;
        this.buffer[this.position++] = (value >> 8) & 0xFF;
        this.buffer[this.position++] = value & 0xFF;
    }

    writeInt64(value: number): void {
        var hi = (value / 0x100000000) | 0;
        var lo = (value & 0xFFFFFFFF) | 0;

        this.writeInt32(hi);
        this.writeInt32(lo);
    }

    writeString(value: string): void {
        var start = this.position;
        this.writeInt32(0); // will get overwritten later
        this.check(value.length);

        var length = 0;

        for (var i = 0; i < value.length; i++) {
            var code = value.charCodeAt(i);
            if (code <= 0x7F) {
                length += 1;
                this.check(1);
                this.buffer[this.position++] = (code | 0);
            } else if (code <= 0x7FF) {
                length += 2;
                this.check(2);
                this.buffer[this.position++] = (code >> 6) | 0x80;
                this.buffer[this.position++] = (code & 0x3F);
            } else if (code <= 0xFFFF) {
                length += 3;
                this.check(3);
                this.buffer[this.position++] = ((code >> 12) & 0x0F) | 0xE0;
                this.buffer[this.position++] = ((code >> 6) & 0x3F) | 0x80;
                this.buffer[this.position++] = (code & 0x3F);
            } else if (code <= 0x1FFFFF) {
                length += 4;
                this.check(4);
                this.buffer[this.position++] = ((code >> 18) & 0x03) | 0xF0;
                this.buffer[this.position++] = ((code >> 12) & 0x0F) | 0xE0;
                this.buffer[this.position++] = ((code >> 6) & 0x3F) | 0x80;
                this.buffer[this.position++] = (code & 0x3F);
            } else {
                length += 1;
                this.check(1);
                this.buffer[this.position++] = 0x3F;
            }
        }

        // write number of bytes
        var position = this.position;
        this.position = start;
        this.writeInt32(length);
        this.position = position;
    }

    writeData(data: Uint8Array, start?: number, end?: number): void {
        if (typeof start !== 'undefined')
            data = data.subarray(start, end);

        var length = data.length;
        this.writeInt32(length);

        this.check(length);
        this.buffer.set(data, this.position);
        this.position += length;
    }

}

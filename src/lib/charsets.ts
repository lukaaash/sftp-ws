
export interface IStringEncoder extends StringEncoder {
}

export interface IStringDecoder extends StringDecoder {
}

export class Encoding {

    constructor(name: string) {
        var encoding = (name + "").toLowerCase().replace("-", "");
        if (encoding != "utf8") throw new Error("Encoding not supported: " + name);
        //TODO: support ASCII and other encodings in addition to UTF-8
    }

    static UTF8 = new Encoding("utf8");

    getEncoder(value: string): IStringEncoder {
        return new StringEncoder(value);
    }

    getDecoder(): IStringDecoder {
        return new StringDecoder();
    }

    encode(value: string, buffer: NodeBuffer, offset: number, end?: number): number {
        return encodeUTF8(value, buffer, offset, end);
    }

    decode(buffer: NodeBuffer, offset: number, end?: number): string {
        return decodeUTF8(buffer, offset, end);
    }
}

const enum UnicodeChars {
    REPLACEMENT_CHAR = 0xFFFD,
    BOM = 0xFEFF,
}

export class StringEncoder {

    private _value: string;
    private _code: number;
    private _length: number;
    private _position: number;
    private _done: boolean;

    //TODO: add write():bool, change finish() to end():void, then expect read()
    finished(): boolean {
        return this._done;
    }

    constructor(value: string) {
        if (typeof value !== "string") value = "" + value;
        this._value = value;
    }

    read(buffer: NodeBuffer, offset: number, end?: number): number {
        return encodeUTF8(this._value, buffer, offset, end, <any>this);
    }
}

export function encodeUTF8(value: string, buffer: NodeBuffer, offset: number, end?: number, state?: { _code: number; _length: number; _position: number; _done: boolean; }): number {
    end = end || buffer.length;

    var code: number;
    var length: number;
    var position: number;
    if (state) {
        code = state._code | 0;
        length = state._length | 0;
        position = state._position | 0;
    } else {
        code = 0;
        length = 0;
        position = 0;
    }

    var done = false;
    var start = offset;

    while (true) {
        if (length > 0) {
            if (offset >= end) break;

            // emit multi-byte sequences
            buffer[offset++] = (code >> 12) | 0x80;

            if (length > 1) {
                code = (code & 0xFFF) << 6;
                length--;
                continue;
            }

            // proceed to next character
            length = 0;
            code = 0;
        }

        // fetch next string if needed
        if (position >= value.length) {
            position = 0;

            // if the string ends normally, we are done
            if (code == 0) {
                done = true;
                break;
            }

            // if the string ends with a lone high surrogate, emit a replacement character instead
            value = String.fromCharCode(UnicodeChars.REPLACEMENT_CHAR);
            code = 0;
        }

        if (offset >= end) break;

        var c = value.charCodeAt(position++);
        if (code == 0) {
            code = c;

            // handle high surrogate
            if (c >= 0xD800 && c < 0xDC00) {
                code = 0x10000 + ((code & 0x3FF) << 10);
                continue;
            }

            // handle lone low surrogate
            if (c >= 0xDC00 && c < 0xE000) {
                code = UnicodeChars.REPLACEMENT_CHAR;
            } else {
                code = c;
            }
        } else {
            // handle low surrogate
            if (c >= 0xDC00 && c < 0xE000) {
                // calculate code
                code += (c & 0x3FF);
            } else {
                // invalid low surrogate
                code = UnicodeChars.REPLACEMENT_CHAR;
            }
        }

        // emit first byte in a sequence and determine what to emit next
        if (code <= 0x7F) {
            buffer[offset++] = code;
            code = 0;
        } else if (code <= 0x7FF) {
            length = 1;
            buffer[offset++] = (code >> 6) | 0xC0;
            code = (code & 0x3F) << 12;
        } else if (code <= 0xFFFF) {
            length = 2;
            buffer[offset++] = (code >> 12) | 0xE0;
            code = (code & 0xFFF) << 6;
        } else if (code <= 0x10FFFF) {
            length = 3;
            buffer[offset++] = (code >> 18) | 0xF0;
            code = (code & 0x1FFFFF);
        } else {
            code = UnicodeChars.REPLACEMENT_CHAR;
            length = 2;
            buffer[offset++] = (code >> 12) | 0xE0;
            code = (code & 0xFFF) << 6;
        }
    }

    if (state) {
        state._code = code;
        state._length = length;
        state._position = position;
        state._done = done;
    } else {
        if (!done) return -1;
    }

    return offset - start;
}

export class StringDecoder {
    private _text: string;
    private _code: number;
    private _length: number;
    private _position: number;
    private _removeBom: boolean;

    text(): string {
        return this._text;
    }

    write(buffer: NodeBuffer, offset: number, end: number): void {
        var bytes = decodeUTF8(buffer, offset, end, <any>this);
        var text = this._text;

        if (this._removeBom && text.length > 0) {
            if (text.charCodeAt(0) == UnicodeChars.BOM) this._text = text.substr(1);
            this._removeBom = false;
        }
    }
}

export function decodeUTF8(buffer: NodeBuffer, offset: number, end?: number, state?: { _text?: string; _code?: number; _length?: number; }): string {
    end = end || buffer.length;

    var text: string;
    var code: number;
    var length: number;
    if (state) {
        text = state._text || "";
        code = state._code | 0;
        length = state._length | 0;
    } else {
        text = "";
        code = 0;
        length = 0;
    }

    while (offset < end) {
        var b = buffer[offset++];

        if (length > 0) {
            if ((b & 0xC0) != 0x80) {
                code = UnicodeChars.REPLACEMENT_CHAR;
                length = 0;
            } else {
                code = (code << 6) | (b & 0x3F);
                length--;
                if (length > 0) continue;
            }
        } else if (b <= 128) {
            code = b;
            length = 0;
        } else {
            switch (b & 0xE0) {
                case 0xE0:
                    if (b & 0x10) {
                        code = b & 0x07;
                        length = 3;
                    } else {
                        code = b & 0xF;
                        length = 2;
                    }
                    continue;
                case 0xC0:
                    code = b & 0x1F;
                    length = 1;
                    continue;
                default:
                    code = UnicodeChars.REPLACEMENT_CHAR;
                    length = 0;
                    break;
            }
        }

        // emit surrogate pairs for supplementary plane characters
        if (code >= 0x10000) {
            code -= 0x10000;
            if (code > 0xFFFFF) {
                code = UnicodeChars.REPLACEMENT_CHAR;
            } else {
                text += String.fromCharCode(0xD800 + ((code >> 10) & 0x3FF));
                code = 0xDC00 + (code & 0x3FF);
            }
        }

        text += String.fromCharCode(code);
    }

    if (state) {
        state._code = code;
        state._length = length;
        state._text = text;
        return null;
    } else {
        if (length > 0) text += String.fromCharCode(UnicodeChars.REPLACEMENT_CHAR);
        return text;
    }
}

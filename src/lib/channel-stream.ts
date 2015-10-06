import channel = require("./channel");
import events = require("events");

export class StreamChannel extends events.EventEmitter implements channel.IChannel {

    private stream: NodeJS.ReadWriteStream;
    private closed: boolean;

    constructor(stream: NodeJS.ReadWriteStream) {
        super();

        this.stream = stream;
        this.closed = false;

        var buffer = new Buffer(65 * 1024);
        var offset = 0;
        var packetLength = 0;

        this.stream.on("end",() => {
            this._close();
        });

        this.stream.on("error", err => {
            err = err || new Error("Connection failed");
            this._close(err);
        });

        this.stream.on("data", d => {
            if (this.closed) return;

            try {
                var data = <Buffer>d;
                //console.info("->", data.length);

                while (data.length > 0) {
                    // if the buffer is empty, process the new block of data
                    if (offset == 0) {
                        // if it's too short, buffer it and wait for more data
                        if (data.length < 4) {
                            data.copy(buffer, offset, 0, data.length);
                            offset = data.length;
                            packetLength = 4;
                            return;
                        }

                        // determine packet length and check it
                        packetLength = <number>data.readInt32BE(0, true) + 4;
                        if (packetLength > buffer.length || packetLength <= 4) {
                            throw new Error("Bad packet length");
                        }

                        // if only part of the packet arrived, buffer it and wait for more data
                        if (packetLength > data.length) {
                            data.copy(buffer, offset, 0, data.length);
                            offset = data.length;
                            return;
                        }

                        // whole packet arrived, process it
                        super.emit("message", data.slice(0, packetLength));

                        // if there is more data, continue processing
                        if (data.length > packetLength) {
                            data = data.slice(packetLength, data.length);
                            packetLength = packetLength;
                            continue;
                        }

                        // otherwise wait for more data
                        return;
                    }

                    // copy expected data to the buffer
                    var n = Math.min(packetLength - offset, data.length);
                    data.copy(buffer, offset, 0, n);
                    offset += n;
                    data = data.slice(n);

                    // if not enough received yet, wait for more data to arrive
                    if (offset < packetLength) continue;

                    // if receiving the header, parse its length and wait for the rest of data
                    if (packetLength == 4) {
                        // determine the packet length and check it
                        packetLength = buffer.readInt32BE(0, true) + 4;
                        if (packetLength > buffer.length || packetLength <= 4) {
                            throw new Error("Bad packet length");
                        }

                        // wait for more data
                        packetLength = packetLength;
                        continue;
                    }

                    // process the buffered packet
                    super.emit("message", buffer.slice(0, packetLength));

                    // reset the offset and packet length
                    offset = 0;
                    packetLength = 0;
                }
            } catch (err) {
                this._close(err);  
            }
        });
    }

    on(event: string, listener: Function): StreamChannel {
        if (event == "ready") process.nextTick(listener);
        else super.on(event, listener);
        return this;
    }

    send(packet: Buffer): void {
        if (this.closed) return;

        try {
            this.stream.write(packet);
        } catch (err) {
            this._close(err);  
        }
    }

    private _close(err?: Error) {
        if (this.closed) return;

        this.close();

        process.nextTick(() => super.emit("close", err));
    }

    close(reason?: number, description?: string): void {
        if (this.closed) return;
        this.closed = true;

        try {
            this.stream.end();
        } catch (err) {
            // ignore errors
        }
    }
}

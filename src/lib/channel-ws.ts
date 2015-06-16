import channel = require("./channel");
import WebSocket = require("ws");

import IChannel = channel.IChannel;

export class WebSocketChannel implements IChannel {
    private ws: WebSocket;
    private options: any; //WEB: // removed
    private wasConnected: boolean;
    private failed: boolean;
    private onopen: () => void;
    private onclose: (err: Error) => void;
    private onmessage: (packet: NodeBuffer) => void;
    private onerror: (err: Error) => void;

    private open(callback: () => void): void {
        if (typeof callback !== "function")
            callback = function () { };

        var reason = 0;
        var error = <string>null;
        switch (this.ws.readyState) {
            case WebSocket.CLOSED:
            case WebSocket.CLOSING:
                reason = 3006;
                error = "WebSocket has been closed";
                break;
            case WebSocket.OPEN:
                this.wasConnected = true;
                process.nextTick(() => callback());
                return;
            case WebSocket.CONNECTING:
                break;
            default:
                reason = 3005;
                error = "WebSocket state is unknown";
                break;
        }

        if (error != null) {
            process.nextTick(() => {
                this.close(reason, error);
            });
            return;
        }

        this.onopen = callback;

        this.ws.on("open",() => { //WEB: this.ws.onopen = () => {
            this.wasConnected = true;
            var onopen = this.onopen;
            this.onopen = null;
            if (typeof onopen === "function") {
                onopen();
            }
        }); //WEB: };
    }

    on(event: string, listener: Function): IChannel {
        switch (event) {
            case "ready":
                this.open(<any>listener);
                break;
            case "message":
                this.onmessage = <any>listener;
                break;
            case "close":
                this.onclose = <any>listener;
                break;
            case "error":
                this.onerror = <any>listener;
                break;
            default:
                break;
        }
        return this;
    }

    constructor(ws: WebSocket) {
        this.ws = ws;
        this.options = { binary: true }; //WEB: // removed
        this.failed = false;
        this.wasConnected = (ws.readyState == WebSocket.OPEN);

        this.ws.on('close',(reason, description) => { //WEB: this.ws.onclose = e => {
            //WEB: var reason = e.code;
            //WEB: var description = e.reason;
            this.close(reason, description);
        }); //WEB: };
        
        this.ws.on('error', err => { //WEB: this.ws.onerror = err => {
            this.failed = true;
        }); //WEB: };

        this.ws.on('message', (data, flags) => { //WEB: this.ws.onmessage = message => {
            var packet: NodeBuffer;
            if (flags.binary) { //WEB: if (true) { //TODO: handle text messages
                packet = <NodeBuffer>data; //WEB: packet = new Uint8Array(message.data);
            } else {
                this.reportError(new Error("Closed due to unsupported text packet"));
                return;
            }

            if (typeof this.onmessage === "function") this.onmessage(packet);
        }); //WEB: };
    }

    private reportError(err: Error): void {
        if (typeof this.onerror === "function") this.onerror(err);
        else throw err;
    }

    close(reason: number, description?: string): void {
        if (typeof reason !== 'number')
            reason = 1000;

        if (typeof description !== 'string')
            description = "";

        if (this.ws != null) {
            try {
                this.ws.close();
            } catch (err) {
                this.reportError(err);
            } finally {
                this.ws = null;
            }
        }

        var onclose = this.onclose;
        this.onopen = null;
        this.onclose = null;
        if (typeof onclose === "function") {
            var err = null;

            var message: string;

            switch (reason) {
                case 1000:
                    message = "Connection closed";
                    break;
                case 1006:
                    message = "Connection aborted";
                    break;
                default:
                    message = "Connection failed";
                    break;
            }
            
            if (!this.wasConnected || this.failed || reason != 1000) {
                message = this.wasConnected ? (this.failed ? "Connection failed" : message) : "Unable to connect";
                err = <any>new Error(message);
                err.reason = reason;
            }

            onclose(err);
        }
    }

    send(packet: NodeBuffer): void {
        if (this.ws == null)
            return;

        try {
            this.ws.send(packet, this.options, err => { //WEB: this.ws.send(packet);
                if (err) this.reportError(err); //WEB: // removed
            }); //WEB: // removed
        } catch (err) {
            process.nextTick(() => {
                this.reportError(err);
            });
        }
    }

}
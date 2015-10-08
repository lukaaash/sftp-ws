import channel = require("./channel");
import http = require("http");
import WebSocket = require("ws");

import IChannel = channel.IChannel;

export class WebSocketChannelFactory {

    constructor() {
    }

    connect(address: string, options: any, callback: (err: Error, channel: IChannel) => any): void {
        options = options || {};

        //WEB: var protocols;
        //WEB: if (options.protocol) protocols = [options.protocol];
        var ws = new WebSocket(address, options); //WEB: var ws = new WebSocket(address, protocols);
        //WEB: ws.binaryType = "arraybuffer";

        var channel = new WebSocketChannel(ws, false);

        ws.on("open", () => { //WEB: ws.onopen = () => {
            channel._init();

            callback(null, channel);
        }); //WEB: };

        // #if NODE
        (<Function>ws.on)("unexpected-response", (req: http.ClientRequest, res: http.IncomingMessage) => {
            var msg = <http.IncomingMessage><any>req;

            // abort the request
            req.abort();
    
            var banner = res.headers["x-sftp-banner"];

            var message: string;
            var code = "X_NOWS";
            switch (res.statusCode) {
                case 200:
                    message = "Unable to upgrade to WebSocket protocol";
                    break;
                case 401:
                    message = "Authentication required";
                    code = "X_NOAUTH";
                    break;
                default:
                    message = "Unexpected server response: '" + res.statusCode + " " + res.statusMessage + "'";
                    break;
            }

            channel._close(0, message, code, banner);
        });
        // #endif

        channel.on("close", (err) => {
            err = err || new Error("Connection closed");
            callback(err, null);
        });
    }

    // #if NODE
    bind(ws: WebSocket): IChannel {
        if (ws.readyState != WebSocket.OPEN) throw new Error("WebSocket is not open");

        return new WebSocketChannel(ws, true);
    }
    // #endif
}

class WebSocketChannel implements IChannel {
    private ws: WebSocket;
    private options: any; //WEB: // removed
    private established: boolean;
    private closed: boolean;
    //WEB: private failed: boolean;
    private onclose: (err: Error) => void;

    on(event: string, listener: Function): IChannel {
        if (typeof listener !== "function") throw new Error("Listener must be a function");

        switch (event) {
            case "message":
                this.onmessage(<any>listener);
                break;
            case "close":
                this.onclose = <any>listener;
                break;
            default:
                break;
        }
        return this;
    }

    private onmessage(listener: (packet: Buffer) => void): void {
        this.ws.on("message", (data, flags) => { //WEB: this.ws.onmessage = message => {
            if (this.closed) return;

            var packet: Buffer;
            if (flags.binary) { //WEB: if (true) { //TODO: handle text messages
                packet = <Buffer>data; //WEB: packet = new Uint8Array(message.data);
            } else {
                this._close(0, "Text packets not supported");
                return;
            }

            listener(packet);
        }); //WEB: };
    }

    constructor(ws: WebSocket, established: boolean) {
        this.ws = ws;
        this.options = { binary: true }; //WEB: // removed
        this.established = established;
        //WEB: this.failed = false;

        ws.on("close", (reason, description) => { //WEB: ws.onclose = e => {
            //WEB: var reason = e.code;
            //WEB: var description = e.reason;
            this._close(reason, description);
        }); //WEB: };
        
        ws.on("error", err => { //WEB: ws.onerror = err => {
            //WEB: this.failed = true;
            // #if NODE
            var message = err.message;
            var code = (<any>err).code;
            switch (code) {
                case "ECONNREFUSED":
                    message = "Connection refused";
                    break;
                case "ENOTFOUND":
                    message = "Server not found";
                    break;
                case "ETIMEDOUT":
                    message = "Connection timed out";
                    break;
                case "ECONNRESET":
                    message = "Connection was reset";
                    break;
                case "HPE_INVALID_CONSTANT":
                    code = "EPROTOTYPE";
                    message = "Invalid protocol";
                    break;
            }

            this._close(0, message, code);
            // #endif
        }); //WEB: };
    }

    _init(): void {
        this.onclose = null;
        this.established = true;
    }

    _close(reason: number, description?: string, code?: string, banner?: string): void {
        if (this.closed) return;
        var onclose = this.onclose;
        this.close();

        reason = 0 + reason;
        description = "" + description;
        code = code || "EFAILURE";

        //WEB: if (this.failed) reason = 1;

        switch (reason) {
            case 0:
                break;
            case 1000:
                description = "Connection closed";
                code = "ECONNRESET";
                break;
            case 1006:
                description = "Connection aborted";
                code = "ECONNABORTED";
                break;
            case 1011:
                code = "ECONNRESET";
                break;
            default:
                description = "Connection failed";
                code = "ECONNRESET";
                break;
        }

        if (reason != 0) {
            if (!this.established) {
                description = "Connection refused";
                code = "ECONNREFUSED";
                reason = 1;
            }
        }

        var err;
        if (reason != 1000) {
            err = <any>new Error(description);
            if (reason >= 1000) err.reason = reason;
            if (banner) err.banner = banner;
            err.code = code;
        } else {
            err = null;
        }

        if (typeof onclose === "function") {
            process.nextTick(() => onclose(err));
        } else {
            if (err) throw err;
        }
    }

    close(reason?: number, description?: string): void {
        if (this.closed) return;
        this.closed = true;

        this.onclose = null;
        this.onmessage = null;

        try {
            this.ws.close(reason, description);
        } catch (err) {
            // ignore errors - we are shuting down the socket anyway
        }
    }

    send(packet: Buffer): void {
        if (this.closed) return;

        try {
            this.ws.send(packet, this.options, err => { //WEB: this.ws.send(packet);
                if (err) this._close(0, err.message); //WEB: // removed
            }); //WEB: // removed
        } catch (err) {
            this._close(0, err.message);
        }
    }

}
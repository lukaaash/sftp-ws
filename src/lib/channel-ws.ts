import channel = require("./channel");
import http = require("http");
import WebSocket = require("ws");

import IChannel = channel.IChannel;

export class WebSocketChannel implements IChannel {
    private ws: WebSocket;
    private options: any; //WEB: // removed
    private established: boolean;
    private closed: boolean;
    //WEB: private failed: boolean;
    private onclose: (err: Error) => void;
    private onmessage: (packet: Buffer) => void;

    private open(callback: () => void): void {
        if (typeof callback !== "function")
            callback = function () { };

        var error = <string>null;
        switch (this.ws.readyState) {
            case WebSocket.CLOSED:
            case WebSocket.CLOSING:
                error = "WebSocket has been closed";
                break;
            case WebSocket.OPEN:
                this.established = true;
                process.nextTick(() => callback());
                return;
            case WebSocket.CONNECTING:
                break;
            default:
                error = "WebSocket state is unknown";
                break;
        }

        if (error != null) {
            this._close(0, error);
            return;
        }

        this.ws.on("open",() => { //WEB: this.ws.onopen = () => {
            this.established = true;
            callback();
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
            default:
                break;
        }
        return this;
    }

    constructor(ws: WebSocket) {
        this.ws = ws;
        this.options = { binary: true }; //WEB: // removed
        //WEB: this.failed = false;
        this.established = (ws.readyState == WebSocket.OPEN);

        this.ws.on('close',(reason, description) => { //WEB: this.ws.onclose = e => {
            //WEB: var reason = e.code;
            //WEB: var description = e.reason;
            this._close(reason, description);
        }); //WEB: };

        // #if NODE
        (<Function>this.ws.on)("unexpected-response", (req: http.ClientRequest, res: http.IncomingMessage) => {
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

            this._close(0, message, code, banner);
        });
        // #endif
        
        this.ws.on('error', err => { //WEB: this.ws.onerror = err => {

            // #if NODE
            var message = err.message;
            var code = (<any>err).code;
            switch (code) {
                case "ECONNREFUSED":
                    message = "Connection refused";
                    break;
                case "ENOTFOUND":
                    message = "Host not found";
                    break;
                case "ETIMEDOUT":
                    message = "Connection timed out";
                    break;
                case "ECONNRESET":
                    message = "Connection was reset";
                    break;
                case "HPE_INVALID_CONSTANT":
                    message = "Not a HTTP or WebSocket server";
                    break;
                default:
                    message = "Unable to connect";
                    break;
            }
            this._close(0, message, code);
            // #endif

            //WEB: this.failed = true;
        }); //WEB: };

        this.ws.on('message', (data, flags) => { //WEB: this.ws.onmessage = message => {
            var packet: Buffer;
            if (flags.binary) { //WEB: if (true) { //TODO: handle text messages
                packet = <Buffer>data; //WEB: packet = new Uint8Array(message.data);
            } else {
                this._close(0, "Text packets not supported");
                return;
            }

            if (typeof this.onmessage === "function") this.onmessage(packet);
        }); //WEB: };
    }

    private _close(reason: number, description?: string, code?: string, banner?: string): void {
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
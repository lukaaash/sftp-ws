import api = require("./fs-api");
import util = require("./util");
import WebSocket = require("ws");

import ILogWriter = util.ILogWriter;

export interface ISessionHost {
    send(packet: NodeBuffer): void;
    close(reason?: number, description?: string): void;
    log?: ILogWriter;
}

export interface ISession {
    _process(packet: NodeBuffer): void;
    _end(): void;
}

export class Channel implements ISessionHost {

    log: ILogWriter;

    private session: ISession;
    private ws: WebSocket;
    private options: any; //WEB: // removed
    private wasConnected: boolean;
    private failed: boolean;
    private onopen: () => void;
    private onclose: (err: Error) => void;

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

    once(event: string, listener: Function): void {
        switch (event) {
            case "open":
                this.open(<any>listener);
                break;
            case "close":
                this.onclose = <any>listener;
                break;
            default:
                throw new Error("Unsupported event");                
        }
    }

    constructor(session: ISession, ws: WebSocket, log: ILogWriter) {
        this.session = session;
        this.ws = ws;
        this.options = { binary: true }; //WEB: // removed
        this.log = log;
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
                this.close(3008, "Closed due to unsupported text packet");
                return;
            }

            this.message(packet);
        }); //WEB: };
    }

    private message(packet: NodeBuffer): void {
        try {
            this.session._process(packet);
        } catch (error) {
            this.log.error("Error while processing packet:", error);
            this.close(3011, "Error while processing packet");
        }
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
                this.log.info("Error while closing WebSocket:", err);
            } finally {
                this.ws = null;
            }
        }

        if (this.session != null) {
            try {
                this.session._end();
            } catch (err) {
                this.log.error("Error while closing session:", err);
            } finally {
                this.session = null;
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

            this.log.info(message + " (" + reason + ")");

            try {
                onclose(err);
            } catch (err) {
                this.log.error("Error in close event listener:", err);
            }
        }
    }

    send(packet: NodeBuffer): void {
        if (this.ws == null)
            return;

        try {
            this.ws.send(packet, this.options, err => { //WEB: this.ws.send(packet);
                if (typeof err !== 'undefined' && err != null) { //WEB: // removed
                    this.log.error("Error while sending:", err.message, err.name); //WEB: // removed
                    this.close(3011, "Error while sending packet"); //WEB: // removed
                } //WEB: // removed
            }); //WEB: // removed
        } catch (error) {
            process.nextTick(() => {
                this.log.error("Error while sending packet:", error);
                this.close(3011, "Error while sending packet");
            });
        }
    }

}
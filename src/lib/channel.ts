import api = require("./sftp-api");
import WebSocket = require("ws"); //WEB: // removed

import ISession = api.ISession;
import ISessionHost = api.ISessionHost;
import ILogWriter = api.ILogWriter;

export class Channel implements ISessionHost {

    log: ILogWriter;

    private session: ISession;
    private ws: WebSocket;
    private options: any; //WEB: // removed

    constructor(session: ISession, ws: WebSocket) {
        this.session = session;
        this.ws = ws;
        this.options = { binary: true }; //WEB: // removed
    }

    start() {
        this.ws.on('close',(code, message) => { //WEB: this.ws.onclose = e => {
            //WEB: var code = e.code;
            //WEB: var message = e.reason;
            this.log.info("Connection closed:", code, message);
            this.close(1000); // normal close
        }); //WEB: };
        
        this.ws.on('error', err => { //WEB: this.ws.onerror = err => {
            //this.emit('error', err);
            var name = err.name; //WEB: var name = typeof err;
            this.log.error("Socket error:", err.message, name);
            this.close(1011); // unexpected condition
        }); //WEB: };

        this.ws.on('message', (data, flags) => { //WEB: this.ws.onmessage = message => {

            var request: NodeBuffer;
            if (flags.binary) { //WEB: if (true) { //TODO: handle text messages
                request = <NodeBuffer>data; //WEB: request = new Uint8Array(message.data);
            } else {
                this.log.error("Text packet received, but not supported yet.");
                this.close(1003); // unsupported data
                return;
            }

            try {
                this.session._process(request);
            } catch (error) {
                this.log.error("Error while processing packet:", error);
                this.close(1011); // unexpected condition
            }
        }); //WEB: };

    }

    send(packet: NodeBuffer): void {
        if (this.ws == null)
            return;

        this.ws.send(packet, this.options, err => { //WEB: this.ws.send(packet);
            if (typeof err !== 'undefined' && err != null) { //WEB: // removed
                this.log.error("Error while sending:", err.message, err.name); //WEB: // removed
                this.close(1011); //WEB: // removed
            } //WEB: // removed
        }); //WEB: // removed
    }

    close(reason: number): void {
        if (this.ws == null)
            return;

        if (typeof reason === 'undefined')
            reason = 1000; // normal close

        try {
            this.ws.close(reason, "closed");
        } catch (error) {
            this.log.error("Error while closing WebSocket:", error);
        } finally {
            this.ws = null;
        }

        try {
            this.session._end();
        } catch (error) {
            this.log.error("Error while closing session:", error);
        } finally {
            this.session = null;
        }
    }
}
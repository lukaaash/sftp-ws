import channel = require("./channel");
import http = require("http");
import WebSocket = require("ws");
import Url = require("url");

import IChannel = channel.IChannel;

export class WebSocketChannelFactory {

    constructor() {
    }

    connect(address: string, options: any, callback: (err: Error, channel: IChannel) => any): void {
        options = options || {};

        // #if NODE
        var url = Url.parse(address);
        options.username = url.auth || options.username;
        options.password = options.password || options.passphrase;
        url.auth = null;
        address = Url.format(url);
        // #endif

        this._connect(address, options, null, callback); // WEB: // removed
    } // WEB: // removed

    private _connect(address: string, options: any, credentials: string, callback: (err: Error, channel: IChannel) => any): void { // WEB: // removed
        // #if NODE
        var username = options.username;
        var password = options.password;

        if (username && password) {
            credentials = getBasicAuthHeader(username, password);
        }

        if (credentials != null) {
            options.headers = options.headers || {};
            options.headers["Authorization"] = credentials;
        }

        var authenticate = null;
        // #endif

        //WEB: var protocols;
        //WEB: if (options.protocol) protocols = [options.protocol];
        var ws = new WebSocket(address, options); //WEB: var ws = new WebSocket(address, protocols);
        //WEB: ws.binaryType = "arraybuffer";

        var channel = new WebSocketChannel(ws, true, false);

        ws.on("open", () => { //WEB: ws.onopen = () => {
            channel._init();

            callback(null, channel);
        }); //WEB: };

        // #if NODE
        (<Function>ws.on)("unexpected-response", (req: http.ClientRequest, res: http.IncomingMessage) => {
            var msg = <http.IncomingMessage><any>req;

            // abort the request
            req.abort();
    
            var information = res.headers["sftp-authenticate-info"];

            var message: string;
            var code = "X_NOWS";
            switch (res.statusCode) {
                case 200:
                    message = "Unable to upgrade to WebSocket protocol";
                    break;
                case 401:
                    if (credentials == null) {
                        for (var i = 0; i < res.rawHeaders.length; i += 2) {
                            if (!res.rawHeaders[i].match(/^WWW-Authenticate$/i)) continue;
                            if (!res.rawHeaders[i + 1].match(/^Basic realm/)) continue;

                            authenticate = "Basic";
                            break;
                        }

                        message = "Authentication required";
                    } else {
                        message = "Authentication failed";
                    }

                    code = "X_NOAUTH";
                    break;
                default:
                    message = "Unexpected server response: '" + res.statusCode + " " + res.statusMessage + "'";
                    break;
            }

            var err = <any>new Error(message);
            err.code = err.errno = code;
            err.level = "http";
            if (information) err.info = information;
            
            channel._close(2, err);
        });

        function getBasicAuthHeader(username: string, password: string): string {
            return "Basic " + new Buffer(username + ":" + password).toString("base64")
        }
        // #endif

        channel.on("close", (err) => {
            err = err || new Error("Connection closed");

            // #if NODE
            if (err.code === "X_NOAUTH" && authenticate && typeof(options.authenticate) === "function") {

                // prepare queries
                var queries = [];
                if (!username) queries.push({ name: "username", prompt: "Username:", secret: false });
                queries.push({ name: "password", prompt: "Password:", secret: true });

                var instructions = err.info;
                var self = this;

                // invoke client authentication callback
                var auth = options.authenticate;
                if (auth.length >= 3) {
                    return auth(instructions, queries, supply);
                } else {
                    var result = auth(instructions, queries);
                    return supply(result);
                }
            }

            function supply(values: { [name: string]: string }): void {
                values = values || {};
                if (!username) username = values["username"];
                password = values["password"];

                if (username && password) {
                    // try authenticating with the supplied credentials
                    credentials = getBasicAuthHeader(username, password);
                    options.username = null;
                    options.password = null;
                    self._connect(address, options, credentials, callback);
                } else {
                    // fail if no credentials supplied
                    callback(err, null);
                }
            }
            // #endif

            callback(err, null);
        });
    }

    // #if NODE
    bind(ws: WebSocket): IChannel {
        if (ws.readyState != WebSocket.OPEN) throw new Error("WebSocket is not open");

        return new WebSocketChannel(ws, true, true);
    }
    // #endif
}

class WebSocketChannel implements IChannel {
    private ws: WebSocket;
    private options: any; //WEB: private binary: boolean;
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
            if (flags.binary) { //WEB: if (this.binary) { //TODO: handle text messages
                packet = <Buffer>data; //WEB: packet = new Uint8Array(message.data);
            } else {
                var err = <any>new Error("Connection failed due to unsupported packet type");
                err.code = err.errno = "EFAILURE";
                err.level = "ws";
                this._close(1, err);
                return;
            }

            listener(packet);
        }); //WEB: };
    }

    constructor(ws: WebSocket, binary: boolean, established: boolean) {
        this.ws = ws;
        this.options = { binary: binary }; //WEB: this.binary = binary;
        this.established = established;
        //WEB: this.failed = false;

        ws.on("close", (reason, description) => { //WEB: ws.onclose = e => {
            //WEB: var reason = e.code;
            //WEB: var description = e.reason;

            var message = "Connection failed";
            var code = "EFAILURE";
            switch (reason) {
                case 1000:
                    return this._close(reason, null);
                case 1001:
                    message = "Endpoint is going away";
                    code = "X_GOINGAWAY";
                    break;
                case 1002:
                    message = "Protocol error";
                    code = "EPROTOTYPE";
                    break;
                case 1006:
                    //WEB: if (this.failed) {
                    //WEB:     message = "Connection refused";
                    //WEB:     code = "ECONNREFUSED";
                    //WEB:     break;
                    //WEB: }
                    message = "Connection aborted";
                    code = "ECONNABORTED";
                    break;
                case 1007:
                    message = "Invalid message";
                    break;
                case 1008:
                    message = "Prohibited message";
                    break;
                case 1009:
                    message = "Message too large";
                    break;
                case 1010:
                    message = "Connection terminated";
                    code = "ECONNRESET";
                    break;
                case 1011:
                    message = description; //WEB: message = "Connection reset";
                    code = "ECONNRESET";
                    break;
                case 1015:
                    message = "Unable to negotiate secure connection";
                    break;
            }

            var err = <any>new Error(message);
            err.code = err.errno = code;
            err.level = "ws";
            err.nativeCode = reason;

            this._close(reason, err);
        }); //WEB: };
        
        ws.on("error", err => { //WEB: ws.onerror = err => {
            //WEB: this.failed = true;

            // #if NODE
            var message = err.message;
            var code = (<any>err).code;

            switch (code) {
                case "HPE_INVALID_CONSTANT":
                    err.message = "Server uses invalid protocol";
                    (<any>err).level = "http";
                    break;
                case "UNABLE_TO_VERIFY_LEAF_SIGNATURE":
                    err.message = "Unable to verify leaf certificate (possibly due to missing intermediate CA certificate)";
                    (<any>err).level = "ssl";
                    break;
            }

            if (typeof (<any>err).code !== "undefined" && typeof (<any>err).errno === "undefined") (<any>err).errno = code;

            this._close(0, err);
            // #endif
        }); //WEB: };
    }

    _init(): void {
        this.onclose = null;
        this.established = true;
    }

    _close(kind: number, err: Error|any): void {
        if (this.closed) return;
        var onclose = this.onclose;
        this.close();

        if (!err && !this.established) {
            err = new Error("Connection refused");
            err.code = err.errno = "ECONNREFUSED";
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

        if (!reason) reason = 1000;
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
                if (err) this._close(3, err); //WEB: // removed
            }); //WEB: // removed
        } catch (err) {
            this._close(2, err);
        }
    }

}
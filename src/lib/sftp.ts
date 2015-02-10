/// <reference path="../typings/node/node.d.ts" />
/// <reference path="../typings/ws/ws.d.ts" />

import WebSocket = require("ws");
import http = require("http");
import path = require("path");
import stream = require("stream");
import client = require("./sftp-client");
import server = require("./sftp-server");
import sfs = require("./sftp-fs");
import api = require("./sftp-api");

import IFilesystem = api.IFilesystem;
import ILogWriter = api.ILogWriter;
import SftpClient = client.SftpClient;
import SftpServer = server.SftpServer;
import SafeFilesystem = sfs.SafeFilesystem;
import WebSocketServer = WebSocket.Server;

module SFTP {

    class WebSocketStream extends stream.Writable {

        private ws: WebSocket;
        private options: any;

        constructor(ws: WebSocket, options: any) {
            super({});
            this.ws = ws;
            this.options = options;
        }

        _write(data: NodeBuffer, encoding: string, callback: Function): void;
        _write(data: string, encoding: string, callback: Function): void;
        _write(data: any, encoding: string, callback: Function): void {
            var buffer = <NodeBuffer>data;
            if (!Buffer.isBuffer(buffer)) {
                super.emit("error", new Error("Only Buffer writes are currently supported"));
                return;
            }

            this.ws.send(buffer, this.options, err => {
                if (typeof err !== 'undefined' && err != null) {
                    super.emit('error', err);
                }

                if (typeof callback === "function") {
                    callback();
                }
            });
        }

        end() {
            this.ws.close(1000, "closed"); // normal close
        }
    }

    export interface IClientOptions {
        protocol?: string;
        agent?: http.Agent;
        headers?: { [key: string]: string };
        protocolVersion?: any;
        host?: string;
        origin?: string;
        pfx?: any;
        key?: any;
        passphrase?: string;
        cert?: any;
        ca?: any[];
        ciphers?: string;
        rejectUnauthorized?: boolean;
    }

    export class Client extends SftpClient {

        constructor(address: string, options?: IClientOptions) {

            if (typeof options == 'undefined') {
                options = {};
            }

            if (typeof options.protocol == 'undefined') {
                options.protocol = 'sftp';
            }

            var ws = new WebSocket(address, options);
         
            super(new WebSocketStream(ws, {}), "");

            ws.on("open", () => {
                this._init(err => {
                    if (err != null) {
                        this.emit('error', err);
                    } else {
                        this.emit('ready');
                    }
                });
            });

            ws.on('error', err => {
                this.emit('error', err);
            });

            ws.on('message', (data, flags) => {

                var packet: NodeBuffer;
                if (flags.binary) {
                    packet = <NodeBuffer>data;
                } else {
                    console.error("Text packet received, but not supported yet.");
                    ws.close(1003); // unsupported data
                    return;
                }

                try {
                    this._parse(packet);
                } catch (err) {
                    this.emit('error', err);
                }

            });
        }
    }

    export class RequestInfo {
        origin: string;
        secure: boolean;
        req: http.ServerRequest;
    }

    export interface ISessionInfo {
        filesystem?: IFilesystem;
        virtualRoot?: string;
        readOnly?: boolean;
    }

    export interface IServerOptions extends api.IServerOptions, WebSocket.IServerOptions {
        verifyClient?: {
            (info: RequestInfo): boolean;
            (info: RequestInfo, accept: (result: boolean) => void): void;
            (info: RequestInfo, accept: (session: ISessionInfo) => void): void;
        };
    }

    export interface IServerSession extends api.IServerSession {
    }

    export class Server {

        private _wss: WebSocketServer;
        private _virtualRoot: string;
        private _fs: IFilesystem;
        private _readOnly: boolean;
        private _log: ILogWriter;
        private _verifyClient: Function;

        constructor(options?: IServerOptions) {
            var serverOptions: WebSocket.IServerOptions = {};

            var noServer = false;
            var verifyClient = null;

            if (typeof options !== 'undefined') {
                this._virtualRoot = options.virtualRoot;
                this._fs = options.filesystem;
                this._log = options.log;
                this._verifyClient = options.verifyClient;
                noServer = options.noServer;

                serverOptions.handleProtocols = this.handleProtocols;
                serverOptions.verifyClient = <any>((info, callback): void => {
                    this.verifyClient(info, callback);
                });

                for (var option in options) {
                    if ((<Object>options).hasOwnProperty(option)) {
                        switch (option) {
                            case "filesystem":
                            case "virtualRoot":
                            case "readOnly":
                            case "log":
                            case "verifyClient":
                                break;                                
                            default:
                                serverOptions[option] = options[option];
                                break;
                        }
                    }
                }
            }

            if (typeof this._virtualRoot === 'undefined') {
                // TODO: serve a dummy filesystem in this case to prevent revealing any files accidently
                this._virtualRoot = process.cwd();
            } else {
                this._virtualRoot = path.resolve(this._virtualRoot);
            }

            if (typeof this._fs === 'undefined') {
                this._fs = new sfs.LocalFilesystem();
            }

            //TODO: when no _fs and no _virtualRoot is specified, serve a dummy filesystem as well

            if (typeof this._log === 'undefined') {
                this._log = {
                    info: function () { },
                    warn: function () { },
                    error: function () { },
                    log: function () { }
                };
            }

            if (!noServer) {
                this._wss = new WebSocketServer(serverOptions);
                this._wss.on('connection', ws => this.accept(ws));
                //this._wss.on('error', err => this.error(err)); //TODO
            }
        }

        private verifyClient(info: RequestInfo, accept: (result: boolean) => void): void {

            this._log.info("Incoming session request from %s", info.req.connection.remoteAddress);

            var innerVerify = this._verifyClient;

            if (typeof innerVerify == 'function') {
                if (innerVerify.length >= 2) {

                    var outerAccept = (result: any) => {
                        if (typeof result == 'object') {
                            (<any>info.req)._sftpSessionInfo = result;
                            accept(true);
                        } else {
                            accept(result);
                        }
                    };

                    innerVerify(info, outerAccept);
                } else {
                    var result = innerVerify(info);
                    accept(result);
                }
            }

            accept(true);
        }

        private handleProtocols(protocols: string[], callback: (result: boolean, protocol?: string) => void): void {
            for (var i = 0; i < protocols.length; i++) {
                var protocol = protocols[i];
                switch (protocol) {
                    case "sftp":
                        callback(true, protocol);
                        return;
                }
            };

            callback(false);
        }

        end() {
            if (typeof this._wss === 'object') {
                // end all active sessions
                this._wss.clients.forEach(ws => {
                    var session = <SftpServer>(<any>ws).session;
                    if (typeof session === 'object') {
                        session.end();
                        delete (<any>ws).session;
                    }
                });

                // stop accepting connections
                this._wss.close();
            }
        }

        // TODO: add argument - info: ISessionInfo
        create(sendReply: (reply: NodeBuffer) => void): IServerSession {

            var fs = new SafeFilesystem(this._fs, this._virtualRoot, this._readOnly);

            var session = new SftpServer({
                fs: fs,
                send: sendReply,
                log: this._log,
            });

            return session;
        }

        accept(ws: WebSocket): void {

            var log = this._log;

            log.info("Connection accepted.");

            var options = { binary: true };

            var close = (code: number) => {
                try {
                    session.end();
                } catch (error) {
                    log.error("Error while closing session.", error);
                }

                try {
                    ws.close(code);
                } catch (error) {
                    log.error("Error while closing websocket.", error);
                }
            };

            var sendReply = data => {
                ws.send(data, options, err => {
                    if (typeof err !== 'undefined' && err != null) {
                        log.error("Error while sending:", err);
                        close(1011); // unexpected condition
                    }
                });
            };

            var session = this.create(sendReply);
            (<any>ws).session = session;

            ws.on('close', (code, message) => {
                log.info("Connection closed:", code, message);
                close(1000); // normal close
            });

            ws.on('error', err => {
                log.error("Socket error:", err.message, err.name);
                close(1011); // unexpected condition
            });

            ws.on('message', (data, flags) => {

                var request: NodeBuffer;
                if (flags.binary) {
                    request = <NodeBuffer>data;
                } else {
                    log.error("Text packet received, but not supported yet.");
                    close(1003); // unsupported data
                    return;
                }

                try {
                    session.process(request);
                } catch (error) {
                    log.error("Error while processing packet.", error);
                    close(1011); // unexpected condition
                }
            });
        }

    }

}

export = SFTP;

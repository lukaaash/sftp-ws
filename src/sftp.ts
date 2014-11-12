/// <reference path="typings/node/node.d.ts" />
/// <reference path="typings/ws/ws.d.ts" />
/// <reference path="client/SFTPv3.d.ts" />
/// <reference path="sftp-server.ts" />

import SftpClient = require("./client/SFTPv3");
import WebSocket = require("ws");
import http = require("http");
import stream = require("stream");
import server = require("./sftp-server");
import sfs = require("./sftp-fs");
import api = require("./sftp-api");

import IFilesystem = api.IFilesystem;
import ILogWriter = api.ILogWriter;
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

    export class Client extends SftpClient implements IFilesystem {

        constructor(address: string) {
            var ws = new WebSocket(address, {
                protocol: "sftp"
            });

            super(new WebSocketStream(ws, {}), "");

            ws.on("open", () => {
                this._init();
            });

            ws.on('error', err => {
                this.emit('error', err);
                return;
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

                this._parse(packet);
            });
        }
    }

    export interface IServerOptions extends api.IServerOptions, WebSocket.IServerOptions {
    }

    export class Server {

        private _wss: WebSocketServer;
        private _virtualRoot: string;
        private _fs: IFilesystem;
        private _readOnly: boolean;
        private _log: ILogWriter;

        constructor(options?: IServerOptions) {
            var serverOptions: WebSocket.IServerOptions = {};

            if (typeof options !== 'undefined') {
                this._virtualRoot = options.virtualRoot;
                this._fs = options.filesystem;
                this._log = options.log;

                serverOptions.handleProtocols = this._handleProtocols;

                for (var option in options) {
                    if ((<Object>options).hasOwnProperty(option)) {
                        switch (option) {
                            case "filesystem":
                            case "virtualRoot":
                            case "readOnly":
                            case "log":
                                break;
                            default:
                                serverOptions[option] = options[option];
                                break;
                        }
                    }
                }
            }

            if (typeof this._virtualRoot === 'undefined') {
                this._virtualRoot = process.cwd();
            }

            if (typeof this._fs === 'undefined') {
                this._fs = new sfs.LocalFilesystem();
            }

            if (typeof this._log === 'undefined') {
                this._log = {
                    info: function () { },
                    warn: function () { },
                    error: function () { },
                    log: function () { }
                };
            }

            this._wss = new WebSocketServer(serverOptions);
            this._wss.on('connection', ws => this.accept(ws));
            //this._wss.on('error', err => this.error(err)); //TODO
        }

        private _handleProtocols(protocols: string[], callback: (result: boolean, protocol?: string) => void): void {
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
            this._wss.close();
            //TODO: dispose all instances of SafeFilesystem
        }

        accept(ws: WebSocket): void {

            var log = this._log;

            log.info("Connection accepted.");

            var options = { binary: true };

            var fs = new SafeFilesystem(this._fs, this._virtualRoot, this._readOnly);

            var close = (code: number) => {
                fs.dispose();
                ws.close(code);
            };

            var sendData = data => {
                ws.send(data, options, err => {
                    if (typeof err !== 'undefined' && err != null) {
                        log.error("Error while sending:", err);
                        close(1011); // unexpected condition
                    }
                });
            };

            var sftp = new SftpServer({
                fs: fs,
                send: sendData,
                log: log
            });

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
                    sftp.process(request);
                } catch (error) {
                    log.error("Error while processing packet.", error);
                    close(1011); // unexpected condition
                }
            });
        }

    }

}

export = SFTP;

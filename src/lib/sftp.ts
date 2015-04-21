/// <reference path="../typings/node/node.d.ts" />
/// <reference path="../typings/ws/ws.d.ts" />

import WebSocket = require("ws");
import http = require("http");
import path = require("path");
import client = require("./sftp-client");
import server = require("./sftp-server");
import safe = require("./fs-safe");
import local = require("./fs-local");
import api = require("./fs-api");
import channel = require("./channel");
import util = require("./util");

import SftpClient = client.SftpClient;
import SafeFilesystem = safe.SafeFilesystem;
import WebSocketServer = WebSocket.Server;
import Channel = channel.Channel;
import SftpServerSession = server.SftpServerSession

module SFTP {

    export interface IStats extends api.IStats {
    }

    export interface IItem extends api.IItem {
    }

    export interface IFilesystem extends api.IFilesystem {
    }

    export interface ILogWriter extends util.ILogWriter {
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

        log?: ILogWriter;
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
            super(ws, options.log);
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

    export interface IServerOptions extends WebSocket.IServerOptions {
        filesystem?: IFilesystem;
        virtualRoot?: string;
        readOnly?: boolean;
        noServer?: boolean;
        log?: ILogWriter;

        verifyClient?: {
            (info: RequestInfo): boolean;
            (info: RequestInfo, accept: (result: boolean) => void): void;
            (info: RequestInfo, accept: (session: ISessionInfo) => void): void;
        };
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
                this._log = util.toLogWriter(options.log);
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
                this._fs = new local.LocalFilesystem();
            }

            //TODO: when no _fs and no _virtualRoot is specified, serve a dummy filesystem as well

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
                    var session = <SftpServerSession>(<any>ws).session;
                    if (typeof session === 'object') {
                        session.end();
                        delete (<any>ws).session;
                    }
                });

                // stop accepting connections
                this._wss.close();
            }
        }

        accept(ws: WebSocket): void {

            var log = this._log;

            log.info("Connection accepted.");

            var options = { binary: true };

            var fs = new SafeFilesystem(this._fs, this._virtualRoot, this._readOnly);

            var session = new SftpServerSession(ws, fs, log);
            (<any>ws).session = session;
        }

    }

}

export = SFTP;

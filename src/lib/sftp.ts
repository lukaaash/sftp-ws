import WebSocket = require("ws");
import http = require("http");
import path = require("path");
import events = require("events");
import client = require("./sftp-client");
import server = require("./sftp-server");
import safe = require("./fs-safe");
import local = require("./fs-local");
import api = require("./fs-api");
import plus = require("./fs-plus");
import misc = require("./fs-misc");
import channel = require("./channel");
import channel_ws = require("./channel-ws");
import channel_stream = require("./channel-stream");
import util = require("./util");

import SafeFilesystem = safe.SafeFilesystem;
import WebSocketServer = WebSocket.Server;
import WebSocketChannelFactory = channel_ws.WebSocketChannelFactory;
import StreamChannel = channel_stream.StreamChannel;
import CloseReason = channel.CloseReason;
import SftpServerSession = server.SftpServerSession
import FileUtil = misc.FileUtil;
import Options = util.Options;

module SFTP {

    export interface IStats extends api.IStats {
    }

    export interface IItem extends api.IItem {
    }

    export interface IFilesystem extends api.IFilesystem {
    }

    export interface ILogWriter extends util.ILogWriter {
    }

    export interface IClientAuthenticationQuery {
        name: string;
        prompt: string;
        secret: boolean;
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

        log?: ILogWriter|any;

        authenticate?:
        ((instructions: string, queries: IClientAuthenticationQuery[]) => { [name: string]: string }) |
        ((instructions: string, queries: IClientAuthenticationQuery[], callback: (values: { [name: string]: string }) => void) => void);
    }

    export class Client extends client.SftpClient implements client.ISftpClientEvents<Client> {

        on(event: string, listener: Function): Client {
            return <any>super.on(event, listener);
        }

        once(event: string, listener: Function): Client {
            return <any>super.on(event, listener);
        }

        constructor() {
            var localFs = new local.LocalFilesystem();
            super(localFs);
        }

        connect(address: string, options?: IClientOptions, callback?: (err: Error) => void): void {
            options = options || {};

            if (typeof options.protocol == 'undefined') {
                options.protocol = 'sftp';
            }

            var factory = new WebSocketChannelFactory();
            factory.connect(address, options, (err, channel) => {
                if (err) {
                    if (typeof callback === "function") return callback(err);
                    super.emit("error", err);
                    return;
                }
                super.bind(channel, callback);
            });
        }
    }

    export class Local extends plus.FilesystemPlus {
        constructor() {
            var fs = new local.LocalFilesystem();
            super(fs, null);
        }
    }

    export var LocalFilesystem = local.LocalFilesystem;

    export interface IChannel extends channel.IChannel { }

    export module Internals {
        export var StreamChannel = channel_stream.StreamChannel;
        export var WebSocketChannelFactory = channel_ws.WebSocketChannelFactory;
        export var ToLogWriter: (writer: any) => ILogWriter = util.toLogWriter;
    }

    export class RequestInfo {
        origin: string;
        secure: boolean;
        req: http.ServerRequest;
    }

    export interface ISessionInfo {
        userName?: string;
        filesystem?: IFilesystem;
        virtualRoot?: string;
        readOnly?: boolean;
        hideUidGid?: boolean;
    }

    export interface IServerOptions {
        filesystem?: IFilesystem;
        virtualRoot?: string;
        readOnly?: boolean;
        hideUidGid?: boolean;

        log?: ILogWriter|any;

        // options for WebSocket server
        host?: string;
        port?: number;
        server?: http.Server;
        handleProtocols?: any;
        path?: string;
        noServer?: boolean;
        disableHixie?: boolean;
        clientTracking?: boolean;

        // client verification callback
        verifyClient?:
        ((info: RequestInfo) => boolean) |
        ((info: RequestInfo, accept: (result: boolean, statusCode?: number, statusMessage?: string, headers?: string[]) => void) => void) |
        ((info: RequestInfo, accept: (session: ISessionInfo) => void) => void);
    }

    export class Server extends events.EventEmitter {

        private _wss: WebSocketServer;

        private _sessionInfo: Options;
        /*
        private _virtualRoot: string;
        private _fs: IFilesystem;
        private _readOnly: boolean;
        private _hideUidGid: boolean;
        */
        private _log: ILogWriter;
        private _verifyClient: Function;

        constructor(options?: IServerOptions) {
            super();

            options = options || {};
            var serverOptions: WebSocket.IServerOptions = {};

            var virtualRoot = options.virtualRoot;
            var filesystem = options.filesystem;
            this._log = util.toLogWriter(options.log);
            this._verifyClient = options.verifyClient;
            var noServer = options.noServer;

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
                        case "hideUidGid":
                        case "log":
                        case "verifyClient":
                            break;
                        default:
                            serverOptions[option] = options[option];
                            break;
                    }
                }
            }

            if (typeof virtualRoot === 'undefined') {
                // TODO: serve a dummy filesystem in this case to prevent revealing any files accidently
                virtualRoot = process.cwd();
            } else {
                virtualRoot = path.resolve(virtualRoot);
            }

            if (typeof filesystem === 'undefined') {
                filesystem = new local.LocalFilesystem();
            }

            this._sessionInfo = new Options({
                userName: null,
                filesystem: filesystem,
                virtualRoot: virtualRoot,
                readOnly: null,
                hideUidGid: null,
            });

            //TODO: when no _fs and no _virtualRoot is specified, serve a dummy filesystem as well

            if (!noServer) {
                this._wss = new WebSocketServer(serverOptions);
                this._wss.on('connection', ws => this.accept(ws, (err, session) => {
                    if (err) this._log.fatal(err, "Error while accepting connection");
                }));
            }
        }

        private verifyClient(info: RequestInfo, accept: (result: boolean, code?: number, description?: string) => void): void {

            var con = info.req.connection;
            this._log.debug("Incoming connection from %s:%d", con.remoteAddress, con.remotePort);

            var innerVerify = this._verifyClient;

            var outerAccept = (result: any, code?: number, description?: string, headers?: string[]) => {
                if (!result) {
                    if (typeof code === 'undefined') code = 401;
                    if (typeof description === 'undefined') description = http.STATUS_CODES[code];
                    if (typeof headers !== 'undefined') description += "\r\n" + headers.join("\r\n");
                    accept(false, code, description);
                    return;
                }

                if (typeof result == 'object') (<any>info.req)._sftpSessionInfo = result;
                accept(true);
            };

            if (typeof innerVerify == 'function') {
                if (innerVerify.length >= 2) {
                    innerVerify(info, outerAccept);
                } else {
                    var result = false || innerVerify(info);
                    outerAccept(result);
                }

                return;
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

        accept(ws: WebSocket, callback?: (err: Error, session: SftpServerSession) => void): void {
            try {
                //this._log.debug(ws.upgradeReq);

                // retrieve session info passed to verifyClient's accept callback
                var sessionInfo = <ISessionInfo>(<any>ws.upgradeReq)._sftpSessionInfo;

                // merge session info with default session info
                sessionInfo = this._sessionInfo.intersect(sessionInfo);

                var log = this._log;
                var virtualRoot = sessionInfo.virtualRoot;
                var fs = new SafeFilesystem(sessionInfo.filesystem, virtualRoot, sessionInfo);

                fs.stat(".", (err, attrs) => {
                    try {
                        if (!err && !FileUtil.isDirectory(attrs)) err = new Error("Not a directory");

                        if (err) {
                            var message = "Unable to access file system";
                            log.error({ root: virtualRoot }, message);
                            ws.close(CloseReason.UNEXPECTED_CONDITION, message);
                            callback(err, null);
                            return;
                        }

                        var factory = new WebSocketChannelFactory();
                        var channel = factory.bind(ws);

                        var socket = ws.upgradeReq.connection;
                        var info = {
                            "userName": sessionInfo.userName,
                            "clientAddress": socket.remoteAddress,
                            "clientPort": socket.remotePort,
                            "clientFamily": socket.remoteFamily,
                            "serverAddress": socket.localAddress,
                            "serverPort": socket.localPort,
                        };

                        var session = new SftpServerSession(channel, fs, this, log, info);
                        this.emit("startedSession", this);
                        (<any>ws).session = session;
                    } catch (err) {
                        callback(err, null);
                    }
                });
            } catch (err) {
                process.nextTick(() => callback(err, null));
            }
        }

    }

}

export = SFTP;

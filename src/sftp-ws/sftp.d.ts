/// <reference path="Scripts/typings/node/node.d.ts" />
/// <reference path="Scripts/typings/ws/ws.d.ts" />
/// <reference path="client/SFTPv3.d.ts" />
/// <reference path="sftp-server.d.ts" />
import SftpClient = require("./client/SFTPv3");
import WebSocket = require("ws");
import fsx = require("./sftp-fs");
declare module SFTP {
    interface IName extends fsx.IName {
    }
    interface IAttributes extends fsx.IAttributes {
    }
    interface IFilesystem extends fsx.IFilesystem {
    }
    class Client extends SftpClient implements IFilesystem {
        constructor(address: string);
    }
    interface IServerOptions extends WebSocket.IServerOptions {
        filesystem?: IFilesystem;
    }
    class Server {
        private _wss;
        constructor(options?: IServerOptions);
        public accept(ws: WebSocket): void;
    }
}
export = SFTP;

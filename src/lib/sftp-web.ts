import client = require("./sftp-client");
import api = require("./fs-api");
import channel = require("./channel");

import SftpClient = client.SftpClient;
import IFilesystem = api.IFilesystem;
import ILogWriter = channel.ILogWriter;

export interface IClientOptions {
    protocol?: string;
    log?: ILogWriter;
}

export class Client extends SftpClient {

    constructor(address: string, options?: IClientOptions) {
        var protocols = [];
        if (typeof options !== 'object' || typeof options.protocol == 'undefined') {
            protocols.push('sftp');
        } else {
            protocols.push(options.protocol);
        }

        var ws = new WebSocket(address, protocols);
        ws.binaryType = "arraybuffer";

        super(ws, options.log);
    }
}

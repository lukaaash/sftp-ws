import client = require("./sftp-client");
import api = require("./sftp-api");
import channel = require("./channel");

import SftpClient = client.SftpClient;
import IFilesystem = api.IFilesystem;
import ILogWriter = api.ILogWriter;
import Channel = channel.Channel;

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
        var channel = new Channel(this, <any>ws);
        channel.log = options.log;
        super(channel);

        ws.onopen = () => {

            ws.binaryType = "arraybuffer";

            channel.start();

            this._init(err => {
                if (err != null) {
                    this.emit('error', err);
                } else {
                    this.emit('ready');
                }
            });
        };

    }
}
import client = require("./sftp-client");
import api = require("./fs-api");
import channel = require("./channel-ws");
import util = require("./util");

import SftpClient = client.SftpClient;
import ISftpClientEvents = client.ISftpClientEvents;
import IFilesystem = api.IFilesystem;
import ILogWriter = util.ILogWriter;
import WebSocketChannelFactory = channel.WebSocketChannelFactory;

export interface IClientOptions {
    protocol?: string;
    log?: ILogWriter;
}

export class Client extends SftpClient implements ISftpClientEvents<Client> {

    on(event: string, listener: Function): Client {
        return <any>super.on(event, listener);
    }

    once(event: string, listener: Function): Client {
        return <any>super.on(event, listener);
    }

    constructor() {
        super(null);
    }

    connect(address: string, options?: IClientOptions, callback?: (err: Error) => void): void {
        options = options || {};

        if (typeof options.protocol == 'undefined') {
            options.protocol = 'sftp';
        }

        var factory = new WebSocketChannelFactory();
        factory.connect(address, options, (err, channel) => {
            if (err) return callback(err);
            super.bind(channel, callback);
        });
    }
}

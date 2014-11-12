/// <reference path="typings/ws/ws.d.ts" />
/// <reference path="sftp.ts" />

import SFTP = require("./sftp");

import SftpServer = SFTP.Server;
import SftpClient = SFTP.Client;

console.log("Starting SFTP.WS server...");

var port = process.env.port || 1984;
var host = "0.0.0.0";

var server = new SftpServer({
    port: port,
    host: host,
    log: console
});

console.log("SFTP.WS server running at port %s", port);

var client = new SftpClient("ws://127.0.0.1:" + port);

client.on('error', err => {
    console.log("client:", "Error : %s", err.message);
});

client.on('ready', () => {

    console.log("client: Connected.");

    client.readdir("/client", (err, list) => {
        console.log("client:", err);
        console.log("client:", list);
        client.end();
    });

});

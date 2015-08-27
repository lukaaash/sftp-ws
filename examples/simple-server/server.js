var SFTP = require("sftp-ws");

// prepare host and port
var host = 'localhost';
var port = process.env.port || 4001;

// start SFTP over WebSockets server
var sftp = new SFTP.Server({
    host: host,
    port: port,
    virtualRoot: '.',
    readOnly: true,
    //verifyClient: verifyClientCallback, //TODO: add authentication, check origin, etc.
    log: console // log to console
});

console.log('SFTP server listening at ws://%s:%s', host, port);

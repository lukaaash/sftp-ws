var http = require('http');
var express = require('express');
var SFTP = require("sftp-ws");

// initialize an express app
var app = express();

// specify host and port for the HTTP server and websocket endpoint for SFTP server
// (this sample lacks any kind of authentication, so let's use localhost)
var port = process.env.port || 4002;
var host = 'localhost';
var endpoint = '/sftp';

// serve static files from 'client' subfolder
app.use(express.static(__dirname + '/client'));

// create a HTTP server for the express app
var server = http.createServer(app);

// start SFTP over WebSockets server
var sftp = new SFTP.Server({
    server: server,
    virtualRoot: __dirname + '/files',
    path: endpoint,
    //verifyClient: verifyClientCallback, //TODO: add authentication, check origin, etc.
    log: console // log to console
});

// start accepting requests at http://host:port
server.listen(port, host, function () {
    var host = server.address().address;
    console.log('HTTP server listening at http://%s:%s', host, port);
    console.log('SFTP server listening at ws://%s:%s%s', host, port, endpoint);
});

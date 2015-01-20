var SftpClient = require('sftp-ws').Client;

// specify host and port to connect to
var host = 'localhost';
var port = 4001;

// connect to the server
var client = new SftpClient("ws://" + host + ":" + port);

// handle errors
client.on('error', function (err) {
    console.log("Error : %s", err.message);
});

// when connected, display a message and file listing
client.on('ready', function () {
    console.log("Connected to the server.");

    // retrieve directory listing
    client.readdir(".", function (err, list) {
        console.log(list);
        client.end();
    });
});

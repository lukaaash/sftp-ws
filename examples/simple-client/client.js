var SFTP = require("sftp-ws");

// specify host and port to connect to
var host = 'localhost';
var port = 4001;

// connect to the server
var client = new SFTP.Client();
client.connect("ws://" + host + ":" + port);

// handle errors
client.on('error', function (err) {
    console.log("Error: %s", err.message);
});

// when connected, display a message and file listing
client.on('ready', function () {
    console.log("Connected to the server.");
    
    // retrieve directory listing
    client.list(".")
        .on("success", function (list) { return list.forEach(function (item) { return console.log(item.longname); }); })
        .on("finish", function () { return client.end(); });
});

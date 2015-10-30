var SFTP = require("sftp-ws");

// url, credentials and options
var url = "ws://nuane.com/sftp";
var options = {
    username: "guest",
    password: "none",
    promise: null // you can supply a custom Promise implementation
};

// connect to the server
var client = new SFTP.Client();
client.connect(url, options).then(function () {
    // display a message
    console.log("Connected to %s", url);
    
    // retrieve directory listing
    return client.list(".");

}).then(function (list) {
    // display the listing
    list.forEach(function (item) {
        console.log(item.longname);
    });

}).catch(function (err) {
    // handle errors
    console.log("Error: %s", err.message);

}).then(function () {
    // disconnect
    client.end();

});

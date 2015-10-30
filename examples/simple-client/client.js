var SFTP = require("sftp-ws");

// url, credentials and options
var url = "ws://nuane.com/sftp";
var options = { username: "guest", password: "none" };

// connect to the server
var client = new SFTP.Client();
client.connect(url, options, function (err) {
    if (err) {
        // handle error
        console.log("Error: %s", err.message);
        return;
    }
    
    // display a message
    console.log("Connected to %s", url);
    
    // retrieve directory listing
    client.list(".", function (err, list) {
        if (err) {
            // handle error
            console.log("Error: %s", err.message);
            return;
        }
        
        // display the listing
        list.forEach(function (item) {
            console.log(item.longname);
        });
        
        // disconnect
        client.end();
    });
});

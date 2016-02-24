import assert = require('assert');
import SFTP = require('../lib/sftp');

function startServer(): SFTP.Server {
    var server = new SFTP.Server({
        port: 3022,
        virtualRoot: "/this-directory-should-not-exist/another-one",
    });

    return server;
}

function startClient(): SFTP.Client {
    var client = new SFTP.Client();
    client.connect("ws://localhost:3022");
    return client;
}

describe("Server Tests", function () {

    it("bad_root", done => {

        var server = startServer();
        var client = startClient();

        client.on("ready", () => {
            done(new Error("Connection attempt should fail"));
            server.end();
        });

        client.on("error", err => {
            try {
                assert.equal(err.message, "Unable to access file system");
                done();
            } catch (err) {
                done(err);
            }
            server.end();
        });
    });
});

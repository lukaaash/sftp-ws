var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var SftpClient = require("./client/SFTPv3");
var WebSocket = require("ws");

var path = require("path");
var stream = require("stream");
var server = require("./sftp-server");
var sfs = require("./sftp-fs");

var SftpServer = server.SftpServer;
var SafeFilesystem = sfs.SafeFilesystem;
var WebSocketServer = WebSocket.Server;

var SFTP;
(function (SFTP) {
    var WebSocketStream = (function (_super) {
        __extends(WebSocketStream, _super);
        function WebSocketStream(ws, options) {
            _super.call(this, {});
            this.ws = ws;
            this.options = options;
        }
        WebSocketStream.prototype._write = function (data, encoding, callback) {
            var _this = this;
            var buffer = data;
            if (!Buffer.isBuffer(buffer)) {
                _super.prototype.emit.call(this, "error", new Error("Only Buffer writes are currently supported"));
                return;
            }

            this.ws.send(buffer, this.options, function (err) {
                if (typeof err !== 'undefined' && err != null) {
                    _super.prototype.emit.call(_this, 'error', err);
                }

                if (typeof callback === "function") {
                    callback();
                }
            });
        };

        WebSocketStream.prototype.end = function () {
            this.ws.close(1000, "closed");
        };
        return WebSocketStream;
    })(stream.Writable);

    var Client = (function (_super) {
        __extends(Client, _super);
        function Client(address, options) {
            var _this = this;
            if (typeof options == 'undefined') {
                options = {};
            }

            if (typeof options.protocol == 'undefined') {
                options.protocol = 'sftp';
            }

            var ws = new WebSocket(address, options);

            _super.call(this, new WebSocketStream(ws, {}), "");

            ws.on("open", function () {
                _this._init();
            });

            ws.on('error', function (err) {
                _this.emit('error', err);
                return;
            });

            ws.on('message', function (data, flags) {
                var packet;
                if (flags.binary) {
                    packet = data;
                } else {
                    console.error("Text packet received, but not supported yet.");
                    ws.close(1003);
                    return;
                }

                _this._parse(packet);
            });
        }
        return Client;
    })(SftpClient);
    SFTP.Client = Client;

    var RequestInfo = (function () {
        function RequestInfo() {
        }
        return RequestInfo;
    })();
    SFTP.RequestInfo = RequestInfo;

    var Server = (function () {
        function Server(options) {
            var _this = this;
            var serverOptions = {};

            var noServer = false;
            var verifyClient = null;

            if (typeof options !== 'undefined') {
                this._virtualRoot = options.virtualRoot;
                this._fs = options.filesystem;
                this._log = options.log;
                this._verifyClient = options.verifyClient;
                noServer = options.noServer;

                serverOptions.handleProtocols = this.handleProtocols;
                serverOptions.verifyClient = (function (info, callback) {
                    _this.verifyClient(info, callback);
                });

                for (var option in options) {
                    if (options.hasOwnProperty(option)) {
                        switch (option) {
                            case "filesystem":
                            case "virtualRoot":
                            case "readOnly":
                            case "log":
                            case "verifyClient":
                                break;
                            default:
                                serverOptions[option] = options[option];
                                break;
                        }
                    }
                }
            }

            if (typeof this._virtualRoot === 'undefined') {
                this._virtualRoot = process.cwd();
            } else {
                this._virtualRoot = path.resolve(this._virtualRoot);
            }

            if (typeof this._fs === 'undefined') {
                this._fs = new sfs.LocalFilesystem();
            }

            if (typeof this._log === 'undefined') {
                this._log = {
                    info: function () {
                    },
                    warn: function () {
                    },
                    error: function () {
                    },
                    log: function () {
                    }
                };
            }

            if (!noServer) {
                this._wss = new WebSocketServer(serverOptions);
                this._wss.on('connection', function (ws) {
                    return _this.accept(ws);
                });
            }
        }
        Server.prototype.verifyClient = function (info, accept) {
            this._log.info("Incoming session request from %s", info.req.connection.remoteAddress);

            var innerVerify = this._verifyClient;

            if (typeof innerVerify == 'function') {
                if (innerVerify.length >= 2) {
                    var outerAccept = function (result) {
                        if (typeof result == 'object') {
                            info.req._sftpSessionInfo = result;
                            accept(true);
                        } else {
                            accept(result);
                        }
                    };

                    innerVerify(info, outerAccept);
                } else {
                    var result = innerVerify(info);
                    accept(result);
                }
            }

            accept(true);
        };

        Server.prototype.handleProtocols = function (protocols, callback) {
            for (var i = 0; i < protocols.length; i++) {
                var protocol = protocols[i];
                switch (protocol) {
                    case "sftp":
                        callback(true, protocol);
                        return;
                }
            }
            ;

            callback(false);
        };

        Server.prototype.end = function () {
            if (typeof this._wss === 'object') {
                this._wss.clients.forEach(function (ws) {
                    var session = ws.session;
                    if (typeof session === 'object') {
                        session.end();
                        delete ws.session;
                    }
                });

                this._wss.close();
            }
        };

        Server.prototype.create = function (sendReply) {
            var fs = new SafeFilesystem(this._fs, this._virtualRoot, this._readOnly);

            var session = new SftpServer({
                fs: fs,
                send: sendReply,
                log: this._log
            });

            return session;
        };

        Server.prototype.accept = function (ws) {
            var log = this._log;

            log.info("Connection accepted.");

            var options = { binary: true };

            var close = function (code) {
                try  {
                    session.end();
                } catch (error) {
                    log.error("Error while closing session.", error);
                }

                try  {
                    ws.close(code);
                } catch (error) {
                    log.error("Error while closing websocket.", error);
                }
            };

            var sendReply = function (data) {
                ws.send(data, options, function (err) {
                    if (typeof err !== 'undefined' && err != null) {
                        log.error("Error while sending:", err);
                        close(1011);
                    }
                });
            };

            var session = this.create(sendReply);
            ws.session = session;

            ws.on('close', function (code, message) {
                log.info("Connection closed:", code, message);
                close(1000);
            });

            ws.on('error', function (err) {
                log.error("Socket error:", err.message, err.name);
                close(1011);
            });

            ws.on('message', function (data, flags) {
                var request;
                if (flags.binary) {
                    request = data;
                } else {
                    log.error("Text packet received, but not supported yet.");
                    close(1003);
                    return;
                }

                try  {
                    session.process(request);
                } catch (error) {
                    log.error("Error while processing packet.", error);
                    close(1011);
                }
            });
        };
        return Server;
    })();
    SFTP.Server = Server;
})(SFTP || (SFTP = {}));

module.exports = SFTP;

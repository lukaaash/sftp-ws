var Channel = (function () {
    function Channel(session, ws) {
        this.session = session;
        this.ws = ws;
        this.options = { binary: true }; //WEB: // removed
    }
    Channel.prototype.start = function () {
        var _this = this;
        this.ws.on('close', function (code, message) {
            //WEB: var code = e.code;
            //WEB: var message = e.reason;
            _this.log.info("Connection closed:", code, message);
            _this.close(1000); // normal close
        }); //WEB: };
        this.ws.on('error', function (err) {
            //this.emit('error', err);
            var name = err.name; //WEB: var name = typeof err;
            _this.log.error("Socket error:", err.message, name);
            _this.close(1011); // unexpected condition
        }); //WEB: };
        this.ws.on('message', function (data, flags) {
            var request;
            if (flags.binary) {
                request = data; //WEB: request = new Uint8Array(message.data);
            }
            else {
                _this.log.error("Text packet received, but not supported yet.");
                _this.close(1003); // unsupported data
                return;
            }
            try {
                _this.session._process(request);
            }
            catch (error) {
                _this.log.error("Error while processing packet:", error);
                _this.close(1011); // unexpected condition
            }
        }); //WEB: };
    };
    Channel.prototype.send = function (packet) {
        var _this = this;
        if (this.ws == null)
            return;
        this.ws.send(packet, this.options, function (err) {
            if (typeof err !== 'undefined' && err != null) {
                _this.log.error("Error while sending:", err.message, err.name); //WEB: // removed
                _this.close(1011); //WEB: // removed
            } //WEB: // removed
        }); //WEB: // removed
    };
    Channel.prototype.close = function (reason) {
        if (this.ws == null)
            return;
        if (typeof reason === 'undefined')
            reason = 1000; // normal close
        try {
            this.ws.close(reason, "closed");
        }
        catch (error) {
            this.log.error("Error while closing WebSocket:", error);
        }
        finally {
            this.ws = null;
        }
        try {
            this.session._end();
        }
        catch (error) {
            this.log.error("Error while closing session:", error);
        }
        finally {
            this.session = null;
        }
    };
    return Channel;
})();
exports.Channel = Channel;

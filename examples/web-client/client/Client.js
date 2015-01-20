var SftpClient = (function () {
    function SftpClient() {
        this._socket = null;
    }
    SftpClient.prototype.connect = function (url) {
        var _this = this;
        if (this._socket != null)
            throw "Already connected";

        var protocols = ['sftp'];

        var worker = new SftpWorker(this);

        this._socket = new WebSocket(url, protocols);

        this._socket.onerror = function (error) {
            worker._fail('WebSocket error: ' + error.toString());
            _this._socket = null;
        };

        this._socket.onclose = function (closeEvent) {
            worker._fail('WebSocket closed: ' + closeEvent.code + '(' + closeEvent.reason + ')');
            _this._socket = null;
        };

        this._socket.onmessage = function (message) {
            if (_this._sftp == null) {
                worker._fail('Received unrequested data.');
                _this._socket.close();
                return;
            }

            var packet = new Uint8Array(message.data);
            _this._sftp._parse(packet);
        };

        this._socket.onopen = function () {
            var stream = {
                writable: true,
                on: function (event, handler) {
                    // hardwired above
                },
                once: function (event, handler) {
                    // 'timeout'
                    // 'error' err
                    // 'end'
                    // 'close' had_err
                },
                write: function (buffer) {
                    var packet = new Uint8Array(buffer.length);
                    for (var i = 0; i < packet.length; i++) {
                        packet[i] = buffer[i];
                    }
                    _this._socket.send(packet.buffer);
                }
            };

            _this._socket.binaryType = "arraybuffer";

            _this._sftp = new SFTP(stream, 'sftp.ws');

            _this._sftp.emit = function (name, arg1, arg2) {
                switch (name) {
                    case 'error':
                        break;
                    case 'timeout':
                        break;
                    case 'ready':
                        worker._finish();
                        return;
                }
                console.log('emitted: ' + name + " " + arg1 + " " + arg2);
            };

            _this._sftp._init();
        };

        return worker._result;
    };

    SftpClient.prototype.getList = function (path) {
        var worker = new SftpWorker(this);
        this._sftp.opendir(path, function (error, handle) {
            worker._start(worker.getList, error, handle);
        });
        return worker._result;
    };

    SftpClient.prototype.getFile = function (path) {
        var worker = new SftpWorker(this);
        this._sftp.open(path, 'r', function (error, handle) {
            worker._start(worker.getFile, error, handle);
        });
        return worker._result;
    };

    SftpClient.prototype.putFile = function (blob, path, resume) {
        var flags = resume ? 'a' : 'w';

        var worker = new SftpWorker(this);
        this._sftp.open(path, flags, function (error, handle) {
            worker._start(worker.putFile, error, handle, blob);
        });
        return worker._result;
    };
    return SftpClient;
})();

var SftpItem = (function () {
    function SftpItem(item) {
        this.name = item.filename;
        this.length = item.attrs.size;
        this.modified = new Date(item.attrs.mtime * 1000);

        this._item = item;
        this._attrs = item.attrs;
        this._type = item.attrs.permissions & 0xF000;
    }
    SftpItem.prototype.isDirectory = function () {
        return this._type == 0x4000;
    };

    SftpItem.prototype.isFile = function () {
        return this._type == 0x8000;
    };
    return SftpItem;
})();

var SftpResult = (function () {
    function SftpResult() {
        this._running = true;
        this._failed = false;
        this._events = {};
    }
    SftpResult.prototype.isRunning = function () {
        return this._running;
    };

    SftpResult.prototype.invoke = function (name, arg1, arg2, arg3) {
        var handlers = this._events[name];
        if (typeof handlers === 'undefined')
            return;

        handlers.forEach(function (handler) {
            handler(arg1, arg2, arg3);
        });
    };

    SftpResult.prototype.on = function (name, handler) {
        if (typeof handler !== 'function') {
            console.log('Specified handler is not a function.');
            return;
        }

        var handlers = this._events[name];
        if (typeof handlers === 'undefined') {
            handlers = [];
            this._events[name] = handlers;
        }

        handlers.push(handler);
    };

    SftpResult.prototype.progress = function (handler) {
        this.on('progress', handler);
        return this;
    };

    SftpResult.prototype.item = function (handler) {
        this.on('item', handler);
        return this;
    };

    SftpResult.prototype.error = function (handler) {
        this.on('error', handler);
        return this;
    };

    SftpResult.prototype.success = function (handler) {
        this.on('success', handler);
        return this;
    };

    SftpResult.prototype.finished = function (handler) {
        this.on('finished', handler);
        return this;
    };
    return SftpResult;
})();

var SftpWorker = (function () {
    function SftpWorker(client) {
        this._client = client;
        this._sftp = client._sftp;
        this._handle = null;
        this._result = new SftpResult();
    }
    SftpWorker.prototype._finish = function () {
        if (this._handle != null) {
            this._sftp.close(this._handle);
            this._handle = null;
        }

        this._result._running = false;
        if (!this._result._failed)
            this._result.invoke('success', this._result);

        this._result.invoke('finished', this._result);
    };

    SftpWorker.prototype._fail = function (error) {
        if (typeof error === 'string')
            error = { type: 0, message: error };

        this._result._failed = true;
        this._result._running = false;
        this._result.invoke('error', error);
        this._finish();
    };

    SftpWorker.prototype._checkError = function (error) {
        if (typeof error === 'undefined')
            return false;

        this._fail(error);
        return true;
    };

    SftpWorker.prototype._start = function (action, error, handle) {
        var args = [];
        for (var _i = 0; _i < (arguments.length - 3); _i++) {
            args[_i] = arguments[_i + 3];
        }
        // end on error
        if (this._checkError(error))
            return;

        // store handle
        this._handle = handle;

        // prepare arguments
        var argc = arguments.length - 2;
        var argv = argc <= 0 ? undefined : Array.prototype.slice.call(arguments, 2, argc + 2);

        // start action
        action.apply(this, argv);
    };

    SftpWorker.prototype.getList = function (handle) {
        var self = this;
        var result = this._result;

        // locals
        var listing = [];

        // start reading directory
        self._sftp.readdir(handle, onReadDir);

        // callback
        function onReadDir(error, items) {
            // end on error
            if (self._checkError(error))
                return;

            // detect end-of-listing
            if (items == false) {
                // pass result and finish
                result.listing = listing;
                self._finish();
                return;
            }

            // detect bad arrays
            if (!Array.isArray(items)) {
                self._fail('Not an array');
                return;
            }

            // process items
            items.forEach(function (item) {
                item = new SftpItem(item);
                listing.push(item);

                result.invoke('item', item);
            });

            // continue reading directory
            self._sftp.readdir(handle, onReadDir);
        }
    };

    SftpWorker.prototype.getFile = function (handle) {
        var self = this;
        var result = this._result;

        // locals
        var BUFFER_LENGTH = 0x8000;
        var total = 0;
        var data = null;
        var length = 0;
        var position = 0;
        var buffer = null;

        // determine file length first
        self._sftp.fstat(handle, function (error, attrs) {
            // end on error
            if (self._checkError(error))
                return;

            total = attrs.size;
            data = new Uint8Array(total);

            // detect empty files
            if (total == 0) {
                // pass result and finish
                result.data = data;
                self._finish();
                return;
            }

            length = total;
            if (length > BUFFER_LENGTH)
                length = BUFFER_LENGTH;

            buffer = new Buffer(length);

            // read first block
            self._sftp.read(handle, buffer, 0, length, position, onRead);
        });

        // callback
        function onRead(error, bytesRead, buffer, position) {
            // end on error
            if (self._checkError(error))
                return;

            if (bytesRead > 0) {
                for (var i = 0; i < bytesRead; i++) {
                    data[position++] = buffer[i];
                }

                var remaining = total - position;
                if (remaining > 0) {
                    if (remaining > BUFFER_LENGTH)
                        remaining = BUFFER_LENGTH;

                    // continue reading file
                    self._sftp.read(handle, buffer, 0, remaining, position, onRead);
                    return;
                }
            }

            // pass result and finish
            result.data = data;
            self._finish();
        }
    };

    SftpWorker.prototype.putFile = function (handle, blob) {
        var self = this;
        var result = this._result;

        // locals
        var BUFFER_LENGTH = 0x8000;
        var position = 0;
        var total = blob.size;
        var remaining = 0;
        var buffer = new Buffer(BUFFER_LENGTH);
        var reader = new FileReader();
        reader.onload = onRead;

        // determine file length first
        self._sftp.fstat(handle, function (error, attrs) {
            // end on error
            if (self._checkError(error))
                return;

            position = attrs.size;
            remaining = total - position;
            readNext();
        });

        function readNext() {
            if (remaining <= 0) {
                // finish
                self._finish();
                return;
            }

            length = remaining;
            if (length > BUFFER_LENGTH)
                length = BUFFER_LENGTH;

            // read next slice from the input blob
            var slice = blob.slice(position, position + length);
            reader.readAsArrayBuffer(slice);
        }

        function onRead(e) {
            var array = new Uint8Array(e.target.result);
            for (var i = 0; i < array.length; i++) {
                buffer[i] = array[i];
            }

            // write the slice to the remote file
            self._sftp.write(handle, buffer, 0, length, position, onWritten);
        }

        function onWritten(error, bytesWritten) {
            // end on error
            if (self._checkError(error))
                return;

            // update locals
            position += bytesWritten;
            remaining -= bytesWritten;

            // report progress
            result.position = position;
            result.total = total;
            result.invoke('progress', result, (position * 100) / total);

            // read next slice
            readNext();
        }
    };
    return SftpWorker;
})();

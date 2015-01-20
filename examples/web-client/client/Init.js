
var process = {
	binding: function (name) { },
	nextTick: function (callback) { window.setTimeout(callback, 0); }
};

var module = {};

var exports = {};

function require(name) {
    var Events = {
        EventEmmiter: {}
    };
    
    var Util = {
        inherits: function (object, ancestor) { },
        isDate: function (x) { throw 'Not implemented.'; }
    };
    
    var Fs = {
};
    
    var Assert = {
        ok: function () { }
    };
    
    var Stream = {
        Readable: true,
        Writable: true
    };
    
    switch (name) {
        case './Stats':
            return Stats;
        case 'events':
            return Events;
        case 'util':
            return Util;
        case 'fs':
            return Fs;
        case 'stream':
            return Stream;
        case 'assert':
            return Assert;
    }
}

Uint8Array.prototype.copy = function (target, targetStart, start, end) {
    for (var i = start; i < end; i++) {
        target[targetStart++] = this[i];
    }
};

Uint8Array.prototype.toString = function (encoding, start, end) {
    var s = "";
    for (var i = start; i < end; i++) {
        s += String.fromCharCode(this[i]);
    }
    return s;
}

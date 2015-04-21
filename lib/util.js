function toLogWriter(writer) {
    writer = writer || {};
    var fixed = {};
    var fix = false;
    function empty() {
    }
    ;
    function prepare(name) {
        var func = writer[name];
        if (typeof func !== 'function') {
            fixed[name] = empty;
            fix = true;
        }
        else {
            fixed[name] = function () {
                func.apply(writer, arguments);
            };
        }
    }
    ;
    prepare("info");
    prepare("warn");
    prepare("error");
    prepare("log");
    return fix ? fixed : writer;
}
exports.toLogWriter = toLogWriter;

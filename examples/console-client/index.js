var SFTP = require("sftp-ws");
var shell = require("minish");

// remote SFTP and current path
var remote = null;
var remotePath = "/";

// local filesystem and current path
var local = new SFTP.Local();
var localPath = process.cwd();

// log writer object
var log = null;

// open command
shell.command("open", "Connect to an SFTP over WebSockets server", function (context) {
    if (remote) return fail(context, "Already connected to a server");
    
    var address = context.args[0];
    
    var client = new SFTP.Client();
    var options = { authenticate: authenticate, log: log };
    client.connect(address, options, function (err) {
        if (err) return fail(context, err);
      
        remote = client;
        context.execute("cd");
    });

    client.on("error", function (err) {
        shell.write("Error:", err.message);
    });

    client.on("close", function () {
        shell.write("Connection closed");
        remote = null;
        remotePath = "/";
    });
});

// cd command
shell.command("cd", "Change the current remote working directory", function (context) {
    if (!remote) return fail(context, "Not connected to a server");
    
    var path = remote.join(remotePath, typeof context.args[0] !== "undefined" ? context.args[0] : "~");
    
    remote.realpath(path, function (err, path) {
        if (err) return fail(context, err);
        remotePath = path;
        context.execute("pwd");
    });
});

// pwd command
shell.command("pwd", "Print the current remote working directory", function (context) {
    if (!remote) return fail(context, "Not connected to a server");
    
    shell.write("Remote directory is", remotePath);
    context.end();
});

// ls command
shell.command(["ls", "dir"], "List remote files", function (context) {
    if (!remote) return fail(context, "Not connected to a server");
    
    var path = remote.join(remotePath, context.args[0]);
    
    shell.write("Listing remote directory", path);
    remote.list(path, function (err, items) {
        list(context, err, items);
    });
});

// search command
shell.command("search", "Search remote files (globstars allowed)", function (context) {
    if (!remote) return fail(context, "Not connected to a server");
    
    var path = remote.join(remotePath, context.args[0]);
    
    shell.write("Searching remote files", path);
    remote.search(path, function (err, items) {
        list(context, err, items, true);
    });
});

// lcd command
shell.command("lcd", "Change the current local working directory", function (context) {
    var path = local.join(localPath, typeof context.args[0] !== "undefined" ? context.args[0] : "~");
    
    local.realpath(path, function (err, path) {
        if (err) return fail(context, err);
        localPath = path;
        context.execute("lpwd");
    });
});

// lpwd command
shell.command("lpwd", "Print the current local working directory", function (context) {
    shell.write("Local directory is", localPath);
    context.end();
});

// lls command
shell.command(["lls", "ldir"], "List local files", function (context) {
    var path = local.join(localPath, context.args[0]);
    
    shell.write("Listing local directory", path);
    local.list(path, function (err, items) {
        list(context, err, items);
    });
});

// lsearch command
shell.command("lsearch", "Search local files (globstars allowed)", function (context) {
    var path = local.join(localPath, context.args[0]);
    
    shell.write("Searching local files", path);
    local.search(path, function (err, items) {
        list(context, err, items, true);
    });
});

// mget command
shell.command("mget", "Download multiple files", function (context) {
    if (!remote) return fail(context, "Not connected to a server");
    
    if (context.args.length < 1) return fail(context, "Remote path missing");
    var rp = remote.join(remotePath, context.args[0]);
    var lp = local.join(localPath, context.args[1]);
    
    var task = remote.download(rp, lp, function (err) {
        done(context, err, "Finished");
    });
    
    task.on("transferring", function (item) {
        shell.write("Downloading %s (%s bytes)", item.path, item.stats.size);
    });
});

// mput command
shell.command("mput", "Upload multiple files", function (context) {
    if (!remote) return fail(context, "Not connected to a server");
    
    if (context.args.length < 1) return fail(context, "Local path missing");
    var lp = local.join(localPath, context.args[0]);
    var rp = remote.join(remotePath, context.args[1]);
    
    var task = remote.upload(lp, rp, function (err) {
        done(context, err, "Finished");
    });
    
    task.on("transferring", function (item) {
        shell.write("Uploading %s (%s bytes)", item.path, item.stats.size);
    });
});

// get command
shell.command(["get", "reget"], "Download a single file", function (context) {
    if (!remote) return fail(context, "Not connected to a server");
    
    // prepare source path
    if (context.args.length < 1) return fail(context, "Remote path missing");
    var rp = remote.join(remotePath, context.args[0]);
    
    // prepare target path (if not specified, append "/" to instruct the function to use the original name
    var lp = context.args[1] ? local.join(localPath, context.args[1]) : localPath + "/";
    
    var task = remote.getFile(rp, lp, function (err) {
        done(context, err, "Finished");
    });
    
    task.on("transferring", function (item) {
        shell.write("Downloading %s (%s bytes)", item.path, item.stats.size);
    });
});

// put command
shell.command(["put", "reput"], "Upload a single file", function (context) {
    if (!remote) return fail(context, "Not connected to a server");
    
    // prepare source path
    if (context.args.length < 1) return fail(context, "Local path missing");
    var lp = local.join(localPath, context.args[0]);
    
    // prepare target path (if not specified, append "/" to instruct the function to use the original name
    var rp = context.args[1] ? remote.join(remotePath, context.args[1]) : remotePath + "/";
    
    var task = remote.putFile(lp, rp, function (err) {
        done(context, err, "Finished");
    });
    
    task.on("transferring", function (item) {
        shell.write("Uploading %s (%s bytes)", item.path, item.stats.size);
    });
});

// del command
shell.command(["del", "rm"], "Delete a single file", function (context) {
    execute(context, function (path) {
        remote.unlink(path, function (err) {
            done(context, err);
        });
    });
});

// mkdir command
shell.command(["mkdir", "md"], "Create a directory", function (context) {
    execute(context, function (path) {
        remote.mkdir(path, function (err) {
            done(context, err);
        });
    });
});

// rmdir command
shell.command(["rmdir", "rd"], "Remove a directory", function (context) {
    execute(context, function (path) {
        remote.rmdir(path, function (err) {
            done(context, err);
        });
    });
});

// mv command
shell.command(["mv", "ren"], "Rename or move remote items", function (context) {
    if (!remote) return fail(context, "Not connected to a server");
    
    // prepare paths
    if (context.args.length < 1) return fail(context, "Source path missing");
    if (context.args.length < 2) return fail(context, "Target path missing");
    var sourcePath = remote.join(remotePath, context.args[0]);
    var targetPath = remote.join(remotePath, context.args[1]);
    
    remote.rename(sourcePath, targetPath, function (err) {
        done(context, err);
    });
});

// close command
shell.command("close", "Exit the SFTP client", function (context) {
    if (!remote) return fail(context, "Not connected to a server");
    remote.end();
    context.end();
});

// exit command
shell.command(["exit", "quit", "bye"], "Exit the SFTP client", function (context) {
    shell.write("Exiting...");
    shell.exit();
});

// log command
shell.command("log", "Turns logging on or off (only applies to new connections)", function (context) {
    log = log ? null : console;
    shell.write("Logging is", log ? "on" : "off");
    context.end();
});

// help command
shell.command(["help", "?"], "Display list of supported commands", function (context) {
    shell.write("Supported commands:");
    context.help();
    context.end();
});

// execute a simple action on a remote path
function execute(context, action) {
    if (!remote) return fail(context, "Not connected to a server");
    
    // prepare source path
    if (context.args.length < 1) return fail(context, "Remote path missing");
    var path = remote.join(remotePath, context.args[0]);
    action(path);
}

// display a list of items
function list(context, err, items, paths) {
    if (err) return fail(context, err);
    
    var long = context.options["l"];
    
    if (typeof long === "undefined") long = (context.command.slice(-3) === "dir");
    
    items.forEach(function (item) {
        if (item.filename == "." || item.filename == "..") return;
        
        if (paths) {
            shell.write(item.path);
        } else if (long) {
            shell.write(item.longname);
        } else {
            shell.write(item.filename);
        }
    });
    
    context.end();
}

// authenticate the client
function authenticate(instructions, queries, callback) {
    if (instructions) shell.write(instructions);
    
    var credentials = {};
    next();
    
    function next() {
        var query = queries.shift();
        
        // no more queries -> pass the credentials to the callback
        if (!query) return callback(credentials);
        
        // query the user for credentials
        if (query.secret) {
            shell.password(query.prompt, reply);
        } else {
            shell.question(query.prompt, reply);
        }
        
        function reply(value) {
            credentials[query.name] = value;
            next();
        }
    }
}

// finish command successfully or with an error
function done(context, err, message) {
    if (err) return fail(context, err);
    if (typeof message !== "undefined") shell.write(message);
    context.end();
}

// fail command with an error message
function fail(context, err) {
    var message;
    switch (err.code) {
        case "ENOENT":
            message = err.path + ": No such file or directory";
            break;
        case "ENOSYS":
            message = "Command not supported";
            break;
        default:
            message = err["description"] || err.message;
            break;
    }
    
    return context.fail(message);
}

// display welcome message
shell.write("Welcome to SFTP over WebSockets client!");
shell.write("Type 'help' to see a list of commands.")
shell.write("Use 'open url' to connect to a server (eg. 'open wss://nuane.com/sftp').")

// on Windows, treat backspace as ordinary character
var options = {
    ignoreBackslash: (process.platform === 'win32')
};

// start shell
shell.prompt("sftp> ", options);
